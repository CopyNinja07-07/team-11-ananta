import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { useT } from '../lib/i18n';

// "About this page": a short, plain list of what the page shows and what to do on it.
// points: [[english, hindi], ...]. Open the first time; the choice is remembered per page.
export default function About({ id, points, title }) {
  const t = useT();
  const key = `about:${id}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) !== '0'; } catch { return true; } });
  const flip = () => { setOpen(!open); try { localStorage.setItem(key, open ? '0' : '1'); } catch { /* private mode */ } };
  return (
    <section className="rounded-xl border border-leaf-200 bg-leaf-50/60">
      <button onClick={flip} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-leaf-800">
        <Info size={15} aria-hidden className="text-leaf-600" />
        <span className="flex-1">{title || t('About this page', 'इस पेज के बारे में')}</span>
        <ChevronDown size={15} aria-hidden className={`transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="grid gap-x-8 gap-y-1.5 px-4 pb-3.5 text-[13px] leading-relaxed text-ink-700 md:grid-cols-2">
          {points.map(([en, hi]) => (
            <li key={en} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-leaf-500" aria-hidden /><span>{t(en, hi)}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}

// One line under a chart: what each line or bar means.
export function ChartNote({ en, hi }) {
  const t = useT();
  return <p className="mt-2 border-t border-ink-100 pt-2 text-xs leading-relaxed text-ink-500"><b className="font-medium text-ink-700">{t('How to read: ', 'कैसे पढ़ें: ')}</b>{t(en, hi)}</p>;
}
