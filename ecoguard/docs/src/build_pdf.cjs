// Renders an HTML file in docs/ to PDF with headless Chromium (Playwright).
// Usage: node build_pdf.cjs ../ECOGUARD-Round2-Design-Pack.html
const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');
(async () => {
  const src = path.resolve(process.argv[2] || path.join(__dirname, '..', 'ECOGUARD-Round2-Design-Pack.html'));
  const out = src.replace(/\.html$/, '.pdf');
  const b = await chromium.launch();
  const page = await b.newPage();
  await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle' });
  await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log('wrote', out);
})();
