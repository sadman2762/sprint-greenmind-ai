import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, IconButton, Paper, Portal, Stack, Switch, FormControlLabel, Typography } from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useActionRegistry } from './actionContext';
import { LiveConnection, getVoiceStatus, type VoiceLog, type VoiceStatus } from './LiveConnection';

export default function VoiceControl() {
  const registry = useActionRegistry();
  const session = useRef<LiveConnection | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [state, setState] = useState('Disconnected');
  const [config, setConfig] = useState<VoiceStatus | null>(null);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<VoiceLog[]>([]);
  const [localOnly, setLocalOnly] = useState(() => localStorage.getItem('greenmind.voice.localOnly') === 'true');
  useEffect(() => () => session.current?.stop(), []);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getVoiceStatus().then(result => { if (!cancelled) setConfig(result); }).catch(() => { if (!cancelled) setError('Voice backend is unavailable.'); });
    return () => { cancelled = true; };
  }, [open]);
  function append(entry: VoiceLog) {
    setLogs(previous => {
      const last = previous.at(-1);
      if ((entry.kind === 'user' || entry.kind === 'assistant') && last?.kind === entry.kind) {
        return [...previous.slice(0, -1), { ...last, text: (last.text + entry.text).slice(-4000) }];
      }
      return [...previous, entry].slice(-60);
    });
  }
  async function start() {
    if (session.current || localOnly) return;
    setError(''); setLogs([]); setActive(true); setMuted(false);
    const connection = new LiveConnection(registry, { status: setState, log: append, closed: () => { session.current = null; setActive(false); setMuted(false); } });
    session.current = connection;
    try { await connection.connect(); }
    catch (cause) {
      connection.stop();
      setError(cause instanceof Error ? cause.message : 'Voice connection failed.');
    }
  }
  return <>
    <Stack direction="row" sx={{ alignItems: 'center', gap: .5 }}>
      <Button size="small" startIcon={<MicRoundedIcon />} variant={active ? 'contained' : 'outlined'} aria-expanded={open} onClick={() => setOpen(v => !v)}>{active ? 'Voice on' : 'Voice'}</Button>
      {active && <Button size="small" color="error" onClick={() => session.current?.stop()}>End voice</Button>}
    </Stack>
    {open && <Portal><Paper role="region" aria-label="Voice map control" elevation={5} sx={{ position: 'fixed', right: { xs: 8, sm: 16 }, top: 70, width: 350, maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100dvh - 90px)', zIndex: 1700, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 3 }}>
      <Stack direction="row" sx={{ p: 2, pb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box><Typography variant="subtitle1" sx={{ fontWeight: 650 }}>Control the map by voice</Typography><Typography variant="caption" color="text.secondary">GPT-Live 1 · Azure</Typography></Box>
        <IconButton aria-label="Collapse voice panel" onClick={() => setOpen(false)}><CloseRoundedIcon /></IconButton>
      </Stack>
      <Stack spacing={1.5} sx={{ px: 2, pb: 2 }}>
        <Chip size="small" label={state} color={active && !muted ? 'primary' : 'default'} sx={{ alignSelf: 'flex-start' }} />
        {!active && <Typography variant="body2">“Show water sensors.” “Suggest three locations.” “Set the radius to 500 metres.”</Typography>}
        <FormControlLabel control={<Switch size="small" checked={localOnly} onChange={event => { const value = event.target.checked; setLocalOnly(value); localStorage.setItem('greenmind.voice.localOnly', String(value)); if (value) session.current?.stop(); }} />} label={<Typography variant="body2">Local-only mode · voice off</Typography>} />
        {error && <Alert severity="error">{error}</Alert>}
        {config && !config.configured && <Alert severity="info">{config.reason}{config.missing.length > 0 && <Box component="ul" sx={{ m: 0, pl: 2 }}>{config.missing.map(name => <li key={name}><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>{name}</Typography></li>)}</Box>}</Alert>}
        {active ? <Stack direction="row" sx={{ gap: 1 }}>
          <Button variant="outlined" onClick={() => { session.current?.mute(!muted); setMuted(v => !v); }}>{muted ? 'Unmute' : 'Mute'}</Button>
          <Button variant="contained" color="error" onClick={() => session.current?.stop()}>End conversation</Button>
        </Stack> : <Button variant="contained" disabled={localOnly || config?.localOnly} onClick={() => void start()}>Start voice control</Button>}
        {active && <Button size="small" onClick={() => { void session.current?.playAudio().catch(() => setError('Audio playback is still blocked by the browser.')); }}>Enable audio</Button>}
        <Typography variant="caption" color="text.secondary">While connected, microphone audio and relevant map context go to Azure. The key stays on the server. End stops the microphone and queued commands.</Typography>
        {logs.length > 0 && <Box role="log" aria-label="Voice transcript and actions" aria-live="polite" sx={{ maxHeight: 270, overflowY: 'auto', borderTop: 1, borderColor: 'divider', pt: 1 }}>
          {logs.map(entry => <Box key={entry.id} sx={{ mb: 1, p: 1, bgcolor: entry.kind === 'action' ? 'action.hover' : 'transparent', borderRadius: 1 }}><Typography variant="caption" color={entry.kind === 'error' ? 'error' : 'text.secondary'}>{entry.kind === 'user' ? 'You' : entry.kind === 'assistant' ? 'Assistant' : entry.kind === 'action' ? 'Action completed' : 'Action unavailable'}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{entry.text}</Typography></Box>)}
        </Box>}
      </Stack>
    </Paper></Portal>}
  </>;
}
