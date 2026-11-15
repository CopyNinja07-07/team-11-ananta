import { useApp } from '../App';

// Tiny two-language helper. Every label is written in both languages where it is used:
//   const t = useT();  t('Alerts', 'अलर्ट')
// Hindi falls back to English when a string has no Hindi yet.
export function useT() {
  const { lang } = useApp();
  return (en, hi) => (lang === 'hi' && hi ? hi : en);
}
