/** Mono PCM16 at 24 kHz, the GPT-Live WebSocket audio format. */
export class PcmAudio {
  private context = new AudioContext({ sampleRate: 24000 });
  private capture: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private nextTime = 0;
  private timelineOrigin: number | null = null;
  private ended = false;
  private onPlayback: (playing: boolean) => void;
  constructor(onPlayback: (playing: boolean) => void = () => {}) { this.onPlayback = onPlayback; }
  async start(stream: MediaStream, send: (audio: string) => void) {
    await this.context.resume();
    await this.context.audioWorklet.addModule('/voice/pcm-capture.js');
    if (this.ended) return;
    if (this.context.sampleRate !== 24000) throw new Error('This browser cannot capture voice at 24 kHz.');
    this.capture = new AudioWorkletNode(this.context, 'pcm-capture');
    this.capture.port.onmessage = event => {
      if (this.ended) return;
      const bytes = new Uint8Array(event.data);
      send(btoa(String.fromCharCode(...bytes)));
    };
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.capture);
    this.capture.connect(this.context.destination); // Worklet outputs silence; no microphone feedback.
  }
  play(encoded: string, startMs?: number) {
    if (this.ended) return;
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    if (!bytes.length || bytes.length % 2) return;
    const view = new DataView(bytes.buffer);
    const buffer = this.context.createBuffer(1, bytes.length / 2, 24000);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    const source = this.context.createBufferSource(); source.buffer = buffer;
    source.connect(this.context.destination);
    let timelineTime = 0;
    if (typeof startMs === 'number' && Number.isFinite(startMs)) {
      this.timelineOrigin ??= this.context.currentTime + .08 - startMs / 1000;
      timelineTime = this.timelineOrigin + startMs / 1000;
    }
    const at = Math.max(this.context.currentTime + .02, this.nextTime, timelineTime);
    this.nextTime = at + buffer.duration;
    this.playing.add(source); this.onPlayback(true); source.onended = () => { this.playing.delete(source); source.disconnect(); if (!this.ended && this.playing.size === 0) this.onPlayback(false); };
    source.start(at);
  }
  async resume() { await this.context.resume(); }
  stop() {
    this.ended = true;
    this.source?.disconnect(); this.capture?.disconnect();
    for (const source of this.playing) { source.stop(); source.disconnect(); }
    this.playing.clear(); void this.context.close();
  }
}
