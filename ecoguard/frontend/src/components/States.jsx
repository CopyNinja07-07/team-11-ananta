import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function Loading({ what = 'data' }) {
  return (
    <div className="card card-pad flex items-center gap-3 text-ink-500" role="status" aria-live="polite">
      <Loader2 className="animate-spin" size={18} /> Loading {what}…
    </div>
  );
}

export function Empty({ title, hint, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-ink-300 bg-white p-8 text-center">
      <Inbox className="text-ink-300" size={28} aria-hidden />
      <div className="font-medium text-ink-700">{title}</div>
      {hint && <div className="max-w-md text-sm text-ink-500">{hint}</div>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

// A 4xx answer means the server is up and said no; only a network failure or 5xx means it is down.
export function ErrorState({ message, onRetry }) {
  const code = Number(String(message).slice(0, 3));
  const serverDown = !(code >= 400 && code < 500);
  const detail = serverDown ? `${message}. Check that the backend is running, then retry.` : String(message).replace(/^\d{3}\s*/, '').replace(/^\{"detail":"(.*)"\}$/, '$1');
  return (
    <div className="card card-pad flex flex-wrap items-center gap-3 border-red-200 bg-red-50 text-danger" role="alert">
      <AlertTriangle size={18} />
      <div className="flex-1 text-sm">
        <div className="font-medium">{serverDown ? 'Could not reach the ECOGUARD server.' : 'The server could not do that.'}</div>
        <div className="text-red-700/80">{detail}</div>
      </div>
      {onRetry && <button className="btn-ghost bg-white" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function NotStarted() {
  return (
    <Empty title="No readings yet"
      hint="Start the sensor gateway (node sensors/gateway.mjs) or connect the ESP32 nodes. The dashboard fills in as soon as the first 15-minute reading arrives." />
  );
}
