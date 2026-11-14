import { useEffect, useRef, useState } from 'react';
import { api, wsUrl } from './api';

// Live building state: one fetch, then updates pushed over the websocket.
// Falls back to polling every 5 s if the websocket can't connect.
export function useLive() {
  const [live, setLive] = useState(null);
  const [error, setError] = useState(null);
  const poll = useRef(null);

  useEffect(() => {
    let ws;
    let closed = false;
    const load = () => api.live().then((d) => { setLive(d); setError(null); }).catch((e) => setError(e.message));
    load();
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl());
        ws.onmessage = (ev) => {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'tick') { setLive(msg.data); setError(null); }
        };
        ws.onclose = () => {
          if (closed) return;
          if (!poll.current) poll.current = setInterval(load, 5000);
          setTimeout(connect, 5000);
        };
        ws.onopen = () => { clearInterval(poll.current); poll.current = null; };
      } catch {
        poll.current = setInterval(load, 5000);
      }
    };
    connect();
    return () => { closed = true; ws?.close(); clearInterval(poll.current); };
  }, []);

  return { live, error };
}
