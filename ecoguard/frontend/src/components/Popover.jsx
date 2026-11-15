import { useEffect, useRef, useState } from 'react';

// A chip that opens a small explanation card when clicked (or tapped on a phone).
// Closes on a second click, a click outside, or Escape.
export default function Popover({ label, children, className = '', align = 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <span ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 transition hover:shadow-sm ${className}`}>{label}</button>
      {open && (
        <div role="dialog" className={`absolute top-full z-40 mt-2 w-72 rounded-xl border border-ink-200 bg-white p-3.5 text-[12.5px] leading-relaxed text-ink-700 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {children}
        </div>
      )}
    </span>
  );
}
