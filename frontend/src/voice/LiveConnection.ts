import { PcmAudio } from './PcmAudio';
import { CommandRegistry, type CommandResult } from './commands';
export interface VoiceStatus { configured: boolean; localOnly: boolean; missing: string[]; model: string; reasoningModel: string | null; reason: string }
export interface VoiceLog { id: string; kind: 'user' | 'assistant' | 'action' | 'error'; text: string }
interface Call { call_id: string; name: string; arguments: string }
interface Batch { calls: Call[]; delegation: string }
interface Callbacks { status: (value: string) => void; log: (entry: VoiceLog) => void; closed: () => void }
export async function getVoiceStatus(): Promise<VoiceStatus> {
  const response = await fetch('/api/voice/status', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Voice backend is unavailable.');
  return response.json();
}

/** Handles only documented GPT-Live events (not the older Realtime event protocol). */
export class LiveConnection {
  private socket: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private audio: PcmAudio | null = null;
  private abort = new AbortController();
  private batches = new Map<string, Batch>();
  private responses = new Map<string, string>();
  private completed = new Set<string>();
  private results = new Map<string, CommandResult>();
  private queue: Promise<void> = Promise.resolve();
  private task = new AbortController();
  private delegation = '';
  private contextTimer: ReturnType<typeof setInterval> | null = null;
  private startupTimer: ReturnType<typeof setTimeout> | null = null;
  private lastContext = '';
  private started = false;
  private speaking = false;
  private processing = false;
  private muted = false;
  private applying = 0;
  private refreshStatus() {
    if (this.ended || !this.started) return;
    this.callbacks.status(this.speaking ? "Speaking" : this.applying ? "Applying action" : this.processing ? "Processing" : this.muted ? "Microphone muted" : "Listening");
  }
  private ended = false;
  private registry: CommandRegistry;
  private callbacks: Callbacks;
  constructor(registry: CommandRegistry, callbacks: Callbacks) { this.registry = registry; this.callbacks = callbacks; }
  private log(kind: VoiceLog['kind'], text: string, id: string = crypto.randomUUID()) { this.callbacks.log({ id, kind, text }); }
  private send(event: Record<string, unknown>) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(event)); }
  private updateContext() {
    const context = JSON.stringify(this.registry.context());
    if (context === this.lastContext || !this.started) return;
    this.lastContext = context;
    // Full structured state is available via get_context; keep Live context under its 500-token limit.
    this.send({ type: 'session.thinking.append', event_id: crypto.randomUUID(), delegation_id: null,
      content: 'The GreenMind workspace changed. Before acting or describing current sensors, ask the backend to read get_context. Do not use previous coordinates or previous proposal IDs without checking.' });
  }
  async connect() {
    this.callbacks.status('Connecting');
    const config = await getVoiceStatus();
    if (this.abort.signal.aborted) return;
    if (!config.configured) throw new Error(`${config.reason}${config.missing.length ? ` Missing: ${config.missing.join(', ')}` : ''}`);
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone requires HTTPS or localhost and a supported browser.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    if (this.abort.signal.aborted) { stream.getTracks().forEach(track => track.stop()); return; }
    this.stream = stream;
    this.audio = new PcmAudio(playing => { this.speaking = playing; this.refreshStatus(); });
    await this.audio.start(stream, audio => {
      if (this.started && this.socket && this.socket.bufferedAmount < 96_000) this.send({ type: 'session.input_audio.append', audio });
    });
    if (this.ended) return;
    this.socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/voice/stream`);
    this.socket.onmessage = event => { try { this.handle(JSON.parse(event.data)); } catch { this.log('error', 'An invalid voice event was ignored.'); } };
    this.socket.onclose = () => { if (!this.ended) this.log('error', 'Voice connection ended. Reconnect to continue.'); this.stop(); };
    this.socket.onerror = () => { this.log('error', 'Cannot connect to the voice backend.'); this.stop(); };
    this.startupTimer = setTimeout(() => { if (!this.started) { this.log('error', 'Voice session did not start. Check deployment access and network connectivity.'); this.stop(); } }, 30_000);
    this.contextTimer = setInterval(() => this.updateContext(), 1500);
  }
  handle(event: Record<string, unknown>) {
    if (this.ended) return;
    if (event.type === 'session.started') {
      this.started = true; if (this.startupTimer) clearTimeout(this.startupTimer);
      this.callbacks.status('Listening'); this.updateContext();
    } else if (event.type === 'session.output_audio.delta') {
      if (typeof event.delta === 'string') this.audio?.play(event.delta, typeof event.start_ms === 'number' ? event.start_ms : undefined);
    } else if (event.type === 'relay.error') {
      this.log('error', typeof event.message === 'string' ? event.message : 'Voice connection failed.'); this.stop();
    } else if (event.type === 'session.input_transcript.delta' || event.type === 'session.output_transcript.delta') {
      if (typeof event.delta === 'string') this.log(event.type === 'session.input_transcript.delta' ? 'user' : 'assistant', event.delta.slice(0, 4000));
    } else if (event.type === 'session.closed') this.stop();
    else if (event.type === 'error') {
      // Provider errors may contain internal configuration; show a useful generic state, not the raw payload.
      this.log('error', 'The voice service could not complete the request. Check model access or try reconnecting.');
      if (!this.started) this.stop();
    } else if (event.type === 'session.delegation.created') {
      const delegation = event.delegation as { id?: string; target?: string } | undefined;
      if (!delegation?.id) return;
      this.processing = true; this.refreshStatus();
      if (this.delegation !== delegation.id) {
        this.task.abort(); this.task = new AbortController(); this.delegation = delegation.id;
      }
    } else if (event.type === 'response.event') {
      const nested = event.event as { type?: string; response?: { id?: string }; item?: Call & { type?: string } } | undefined;
      const delegation = typeof event.delegation_id === 'string' ? event.delegation_id : '';
      if (!nested) return;
      // Azure continuations can begin with in_progress without a created event.
      if ((nested.type === 'response.created' || nested.type === 'response.in_progress') && nested.response?.id) {
        this.responses.set(delegation, nested.response.id);
        if (!this.batches.has(nested.response.id) && !this.completed.has(nested.response.id)) {
          this.batches.set(nested.response.id, { calls: [], delegation });
        }
      }
      const responseId = nested.response?.id ?? this.responses.get(delegation);
      if (!responseId) return;
      if (nested.type === 'response.output_item.done' && nested.item?.type === 'function_call') {
        const batch = this.batches.get(responseId);
        if (batch && !batch.calls.some(c => c.call_id === nested.item!.call_id)) batch.calls.push(nested.item);
      }
      if (nested.type === 'response.completed' && !this.completed.has(responseId)) {
        this.completed.add(responseId);
        const batch = this.batches.get(responseId); this.batches.delete(responseId);
        if (batch?.calls.length) {
          const signal = this.task.signal;
          this.queue = this.queue.then(() => this.runBatch(batch, signal)).catch(() => this.log('error', 'A voice action could not finish. Read the current plan before retrying.'));
        }
      }
      if (nested.type === 'response.failed' || nested.type === 'response.cancelled') { this.batches.delete(responseId); this.processing = false; this.refreshStatus(); }
    }
  }
  private async runBatch(batch: Batch, signal: AbortSignal) {
    this.applying += 1; this.refreshStatus();
    try {
    for (const call of batch.calls) {
      if (this.ended) return;
      let result = this.results.get(call.call_id);
      if (!result) {
        if (signal.aborted || (this.delegation && batch.delegation !== this.delegation)) result = { ok: false, message: 'Superseded by a newer request. Read the current context.' };
        else if (call.name !== 'control_map') result = { ok: false, message: 'Unsupported tool.' };
        else {
          try { result = await this.registry.execute(JSON.parse(call.arguments), signal); }
          catch { result = { ok: false, message: 'Malformed action arguments.' }; }
        }
        this.results.set(call.call_id, result);
        this.log(result.ok ? 'action' : 'error', result.message, call.call_id);
        // Allow React to commit/remount the updated planner before the next dependent command.
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      if (this.ended) return;
      this.send({ type: 'response.item.create', event_id: crypto.randomUUID(), item: { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) } });
    }
    if (!this.ended) this.send({ type: 'response.create', event_id: crypto.randomUUID() });
    } finally { this.applying -= 1; this.processing = false; this.refreshStatus(); }
  }
  mute(muted: boolean) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach(track => { track.enabled = !muted; });
    this.send({ type: muted ? 'session.input_audio.mute' : 'session.input_audio.unmute' });
    this.refreshStatus();
  }
  async playAudio() { await this.audio?.resume(); }
  stop() {
    if (this.ended) return;
    this.ended = true; this.abort.abort(); this.task.abort();
    if (this.contextTimer) clearInterval(this.contextTimer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.stream?.getTracks().forEach(track => track.stop());
    this.send({ type: 'session.close', event_id: crypto.randomUUID() });
    const socket = this.socket; this.socket = null;
    this.audio?.stop(); this.audio = null;
    setTimeout(() => socket?.close(), 150);
    this.callbacks.status('Disconnected'); this.callbacks.closed();
  }
}
