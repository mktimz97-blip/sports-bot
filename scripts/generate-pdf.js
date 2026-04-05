const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox'],
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  });
  const page = await browser.newPage();
  const filePath = 'file:///' + path.resolve('docs/pitch-deck-v2.html').replace(/\\/g, '/');
  console.log('Loading:', filePath);
  await page.goto(filePath, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.setViewport({ width: 1920, height: 1080 });
  // Wait for fonts
  await new Promise(r => setTimeout(r, 3000));
  // Make all fade-in elements visible for PDF
  await page.evaluate(() => {
    document.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
    document.querySelectorAll('.agent-node, .event-node, .arrow').forEach(el => el.classList.add('active'));
  });
  await new Promise(r => setTimeout(r, 500));
  await page.pdf({
    path: 'docs/tzai-pitch.pdf',
    width: '1920px',
    height: '1080px',
    printBackground: true,
    preferCSSPageSize: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await browser.close();
  const stat = fs.statSync('docs/tzai-pitch.pdf');
  console.log('PDF saved: docs/tzai-pitch.pdf (' + (stat.size / 1024).toFixed(0) + ' KB)');
})().catch(e => { console.error(e.message); process.exit(1); });
