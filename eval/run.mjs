// Measures the hybrid AI with real Gemini Nano in Chrome.
// Usage: node eval/run.mjs <chrome-user-data-dir-with-nano> [url]
// The user data dir must already have Gemini Nano downloaded (chrome://on-device-internals).
// Writes eval/results.json. Needs puppeteer-core (npm i puppeteer-core) and a local server.
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const dir = process.argv[2];
const URL = process.argv[3] || 'http://localhost:5178/';
const RUNS = 5;
const b = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ignoreDefaultArgs: true, pipe: true,
  args: ['--remote-debugging-pipe', '--user-data-dir=' + dir, '--no-first-run', '--headless=new',
    '--enable-features=OptimizationGuideOnDeviceModel,PromptAPIForGeminiNano,PromptAPIForGeminiNanoMultimodalInput']
});
const p = (await b.pages())[0] || await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.evaluateOnNewDocument(() => { try { localStorage.setItem('ald-lang', 'en'); } catch (e) {} });
await p.goto(URL, { waitUntil: 'networkidle0' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitFor = async (fn, max = 90000) => { const s = Date.now(); while (Date.now() - s < max) { if (await p.evaluate(fn)) return true; await sleep(200); } return false; };
await waitFor(() => /ready on this computer/.test(document.getElementById('engineText').textContent), 20000);
const engine = await p.evaluate(() => document.getElementById('engineText').textContent);

// ---- 1. Plain-words summaries: every number checked, real price in sentence one ----
const PRICES = { northgate: '$43,600', riverbend: '$13,235', lakeshore: '$40,990' };
const summaries = [];
for (const lang of ['en', 'es']) {
  for (const s of Object.keys(PRICES)) {
    for (let r = 0; r < RUNS; r++) {
      await p.evaluate((lang) => { document.querySelector(`[data-lang="${lang}"]`).click(); }, lang);
      await p.evaluate((s) => { const a = document.getElementById('again'); if (!document.getElementById('results').hidden) a.click(); document.querySelector(`[data-sample="${s}"]`).click(); }, s);
      await sleep(300);
      await p.evaluate(() => { document.getElementById('explainOut').hidden = true; document.getElementById('explainRun').click(); });
      const t0 = Date.now();
      await waitFor(() => !document.getElementById('explainOut').hidden || /could not|no pudo/i.test(document.getElementById('explainStatus').textContent));
      const ms = Date.now() - t0;
      const res = await p.evaluate(() => {
        const o = document.getElementById('explainOut');
        return { text: o.innerText.split('\n')[0], warn: !!o.querySelector('.warn'), device: /Nano/.test(o.innerText) };
      });
      const firstSentence = (res.text.match(/^[\s\S]*?[.?](\s|$)/) || [res.text])[0];
      summaries.push({ lang, sample: s, ms, numbersOk: !res.warn, priceFirst: firstSentence.includes(PRICES[s]), device: res.device, text: res.text });
    }
  }
}
await p.evaluate(() => document.querySelector('[data-lang="en"]').click());

// ---- 2. Sorting school-made line names (labels written for this test, answers fixed in advance) ----
const LINES = [
  ['Dean\'s Award', 'grant'], ['Achievement Award', 'grant'], ['Trustee Scholarship', 'grant'], ['Founders Award', 'grant'],
  ['Opportunity Grant', 'grant'], ['Tuition Remission', 'grant'], ['Promise Scholarship', 'grant'], ['Heritage Award', 'grant'],
  ['Bridge Financing Option', 'loan'], ['Alternative Education Loan', 'loan'], ['Institutional Loan', 'loan'], ['Family Investment Plan (repayable)', 'loan'],
  ['Signature Student Loan', 'loan'], ['Parent Education Option', 'loan'], ['Deferred Tuition Agreement', 'loan'], ['University Financing Option', 'loan'],
  ['Campus Employment Award', 'work'], ['Student Job Earnings', 'work'], ['FWS', 'work'], ['Work Award', 'work'],
  ['Technology Fee', 'cost'], ['Student Activity Fee', 'cost'], ['Residence Hall', 'cost'], ['Health Insurance', 'cost'], ['Orientation Fee', 'cost'],
  ['Total Award', 'ignore'], ['Reply by May 1', 'ignore'], ['Estimated Net Cost', 'ignore']
];
const sortRuns = [];
for (let r = 0; r < 3; r++) {
  const t0 = Date.now();
  const out = await p.evaluate(async (labels) => { const res = await window.HybridAI.sortLines(labels, 'en'); return { items: res.items, source: res.source }; }, LINES.map(l => l[0]));
  const ms = Date.now() - t0;
  const got = out.items.map((it, i) => ({ label: LINES[i][0], want: LINES[i][1], got: it ? it.cat : null, why: it ? it.why : '' }));
  sortRuns.push({ ms, source: out.source, correct: got.filter(g => g.got === g.want).length, total: got.length, misses: got.filter(g => g.got !== g.want) });
}

// ---- 3. Reading the sample photo of a paper letter ----
const photos = [];
for (let r = 0; r < 3; r++) {
  await p.evaluate(() => { const a = document.getElementById('again'); if (!document.getElementById('results').hidden) a.click(); document.getElementById('letter').value = ''; });
  const t0 = Date.now();
  await p.evaluate(() => document.getElementById('photoSample').click());
  await waitFor(() => !document.getElementById('results').hidden || /could not/i.test(document.getElementById('status').textContent));
  const ms = Date.now() - t0;
  photos.push(await p.evaluate((ms) => ({ ms, price: document.getElementById('realPrice').textContent, lines: document.querySelectorAll('.a-row:not(.a-hd)').length, gpaRule: /3\.0 GPA/.test(document.getElementById('lines').innerText) }), ms));
}

const pct = (a, b) => Math.round(100 * a / b);
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const summary = {
  when: new Date().toISOString(), engine, url: URL,
  summaries: { runs: summaries.length, numbersOk: pct(summaries.filter(s => s.numbersOk).length, summaries.length), priceFirst: pct(summaries.filter(s => s.priceFirst).length, summaries.length), onDevice: pct(summaries.filter(s => s.device).length, summaries.length), medianMs: med(summaries.map(s => s.ms)) },
  sorting: { runs: sortRuns.length, accuracy: pct(sortRuns.reduce((a, r) => a + r.correct, 0), sortRuns.reduce((a, r) => a + r.total, 0)), medianMs: med(sortRuns.map(r => r.ms)), source: sortRuns[0].source },
  photo: { runs: photos.length, priceRight: pct(photos.filter(x => x.price === '$40,990').length, photos.length), gpaRuleKept: pct(photos.filter(x => x.gpaRule).length, photos.length), medianMs: med(photos.map(x => x.ms)) }
};
fs.mkdirSync('eval/out', { recursive: true });
fs.writeFileSync('eval/results.json', JSON.stringify(summary, null, 2));
fs.writeFileSync('eval/out/detail.json', JSON.stringify({ summaries, sortRuns, photos }, null, 2));
console.log(JSON.stringify(summary, null, 2));
await b.close();
