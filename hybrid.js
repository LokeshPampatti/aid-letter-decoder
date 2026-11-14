/* Aid Letter Decoder: hybrid AI through Firebase AI Logic.
 *
 * Gemini Nano runs inside Chrome on the family's own computer. When Nano is not
 * on the device, the same request can go to a cloud Gemini model instead, but only
 * after the person says yes, and only the minimum needed (line names, or the totals).
 *
 * Three jobs:
 *   1. sortLines:  sort the lines the rules could not place, with a short reason.
 *   2. explain:    a plain-language summary of the letter, built from the totals.
 *   3. readPhoto:  copy the text out of a photo of a paper letter.
 *
 * App Check (reCAPTCHA Enterprise, score-based, no puzzle) protects the cloud model.
 * On localhost it uses a debug token instead. The Chrome extension build is on-device only.
 */
const V = '13.3.0';
// The Chrome extension cannot load code from the web, so it ships the same SDK files in vendor/firebase.
// It also runs on the device only: nothing from the side panel is ever sent to the cloud.
const EXT = location.protocol === 'chrome-extension:';
const base = EXT ? new URL('vendor/firebase/', import.meta.url).href : 'https://www.gstatic.com/firebasejs/' + V + '/';

const CATS = ['grant', 'loan', 'work', 'cost', 'ignore'];
const LANGS = { en: 'English', es: 'Spanish' };
const CLOUD_MODEL = 'gemini-3.5-flash-lite';

let lib = null;      // loaded SDK modules
let models = null;   // { sort, explain, photo }
let lastSource = null;

function cfg() { return window.ALD_FIREBASE || null; }

async function load() {
  if (models) return models;
  const c = cfg();
  if (!c || !c.firebase) throw new Error('not-configured');
  const [appMod, checkMod, aiMod] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-app-check.js'),
    import(base + 'firebase-ai.js')
  ]);
  lib = { appMod, checkMod, aiMod };
  const app = appMod.initializeApp(c.firebase);
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (local) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  if (!EXT && (c.recaptchaSiteKey || local)) {
    checkMod.initializeAppCheck(app, {
      provider: new checkMod.ReCaptchaEnterpriseProvider(c.recaptchaSiteKey || 'debug'),
      isTokenAutoRefreshEnabled: true
    });
  }
  const { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } = aiMod;
  const ai = getAI(app, { backend: new GoogleAIBackend() });

  const sortSchema = {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            n: { type: 'integer' },
            cat: { type: 'string', enum: CATS },
            why: { type: 'string' }
          },
          required: ['n', 'cat', 'why']
        }
      }
    },
    required: ['items']
  };

  function make(schema, inputs) {
    const p = {
      mode: EXT ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.PREFER_ON_DEVICE,
      onDeviceParams: {
        createOptions: {
          expectedInputs: inputs,
          expectedOutputs: [{ type: 'text', languages: ['en', 'es'] }]
        }
      },
      inCloudParams: { model: CLOUD_MODEL, generationConfig: { temperature: 0.2 } }
    };
    if (schema) {
      p.onDeviceParams.promptOptions = { responseConstraint: schema };
      p.inCloudParams.generationConfig.responseMimeType = 'application/json';
      p.inCloudParams.generationConfig.responseJsonSchema = schema;
    }
    return getGenerativeModel(ai, p);
  }
  const text = [{ type: 'text', languages: ['en', 'es'] }];
  models = {
    sort: make(sortSchema, text),
    explain: make(null, text),
    photo: make(null, [{ type: 'text', languages: ['en'] }, { type: 'image' }])
  };
  return models;
}

/** 'on-device' | 'downloadable' | 'downloading' | 'cloud-only' | 'off' */
async function status() {
  if (!cfg() || !cfg().firebase) return 'off';
  const LM = self.LanguageModel;
  if (!LM || !LM.availability) return EXT ? 'off' : 'cloud-only';
  try {
    const a = await LM.availability({ expectedInputs: [{ type: 'text', languages: ['en', 'es'] }], expectedOutputs: [{ type: 'text', languages: ['en', 'es'] }] });
    if (a === 'available') return 'on-device';
    if (a === 'downloadable') return 'downloadable';
    if (a === 'downloading') return 'downloading';
    return EXT ? 'off' : 'cloud-only';
  } catch (e) {
    return 'cloud-only';
  }
}

/** Starts the one-time Gemini Nano download. Must run from a click. */
async function download(onProgress) {
  const m = await load();
  await m.sort.initializeDeviceModel(onProgress);
}

/** Must run from a click, before the first prompt, so Chrome can open a Nano session. */
async function warm() {
  const m = await load();
  try { m.sort.initializeDeviceModel(); } catch (e) {}
  return m;
}

/** Small models still add markdown and dashes now and then. Strip them. */
function tidy(t) {
  return String(t || '')
    .replace(/\*\*?|__|^#+\s*/gm, '')
    .replace(/\s*[\u2013\u2014]\s*/g, ', ')
    .replace(/¡/g, '').replace(/!/g, '.')
    .replace(/\.\.+/g, '.')
    .trim();
}

function sourceOf(result) {
  const s = result && result.response && result.response.inferenceSource;
  lastSource = s === 'in_cloud' ? 'cloud' : 'device';
  return lastSource;
}

async function sortLines(labels, lang) {
  const m = await warm();
  const list = labels.map((l, i) => (i + 1) + '. ' + l).join('\n');
  const prompt =
    'You sort lines from a United States college financial aid letter.\n' +
    'Categories:\n' +
    '- grant: gift money that is never paid back (grants, scholarships, awards, tuition discounts, waivers).\n' +
    '- loan: borrowed money that must be paid back, even if the letter calls it an award, option or plan.\n' +
    '- work: work-study or campus job pay the student has to earn.\n' +
    '- cost: something the family pays for (tuition, fees, housing, meals, books, travel).\n' +
    '- ignore: anything else (headings, totals, dates, deadlines).\n' +
    'For each numbered line give n, cat, and why: one short, calm reason (under 15 words) in ' + LANGS[lang] + ', written for a 16-year-old, no exclamation marks.\n' +
    'If a name is vague, pick the most likely category and say in why that the family should ask the school.\n\n' +
    'Lines:\n' + list;
  const r = await m.sort.generateContent(prompt);
  const src = sourceOf(r);
  let data;
  try { data = JSON.parse(r.response.text()); } catch (e) { throw new Error('bad-json'); }
  const out = labels.map(() => null);
  (data.items || []).forEach(function (it) {
    const i = (it.n | 0) - 1;
    if (i >= 0 && i < out.length && CATS.indexOf(it.cat) !== -1) out[i] = { cat: it.cat, why: tidy(it.why).slice(0, 160) };
  });
  return { items: out, source: src };
}

/**
 * Plain summary from the totals only. No names or student details are in the prompt.
 * Every dollar figure in the answer is checked against the numbers we sent.
 */
async function explain(facts, lang) {
  const m = await warm();
  const prompt =
    'Explain this college financial aid offer to a family in ' + LANGS[lang] + '.\n' +
    'Rules: exactly 4 short sentences, plain text only. No greeting, no markdown, no bold, no dashes, no exclamation marks.\n' +
    'Sentence 1 tells the family the REAL PRICE for one year. Sentence 2: the gifts. Sentence 3: the loans and who repays them; if there is work-study, say it is pay from a job and is never repaid. Sentence 4: one thing to ask the aid office.\n' +
    'Plain words a 16-year-old knows. Use only the numbers given, written exactly as given. Never call a loan or work-study a discount.\n\n' +
    'Facts:\n' + facts.lines.join('\n');
  const allowed = new Set(facts.numbers.map(function (n) { return String(Math.round(n)); }));
  const price = facts.price == null ? null : String(Math.round(facts.price));
  function dollars(t) { return (t.match(/\$\s?[\d,]+(?:\.\d+)?/g) || []).map(function (x) { return String(Math.round(parseFloat(x.replace(/[$,\s]/g, '')))); }); }
  function firstSentence(t) { const m1 = t.match(/^[\s\S]*?[.?](\s|$)/); return m1 ? m1[0] : t; }
  let text = '', src = 'device';
  // Two tries at most: the first sentence has to state the real price.
  for (let tries = 0; tries < 2; tries++) {
    const r = await m.explain.generateContent(prompt);
    src = sourceOf(r);
    text = tidy(r.response.text());
    if (!price || dollars(firstSentence(text)).indexOf(price) !== -1) break;
  }
  const bad = dollars(text).filter(function (n) { return !allowed.has(n); });
  const priceOk = !price || dollars(firstSentence(text)).indexOf(price) !== -1;
  return { text: text, source: src, numbersOk: bad.length === 0, badNumbers: bad, priceOk: priceOk };
}

/** Copy the text out of a photo of a paper letter. */
async function readPhoto(blob) {
  const m = await warm();
  const b64 = await new Promise(function (res, rej) {
    const fr = new FileReader();
    fr.onload = function () { res(String(fr.result).split(',')[1]); };
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
  const prompt =
    'This is a photo of a college financial aid letter. Read it top to bottom, one printed row at a time.\n' +
    'For each row that ends in a dollar amount, write the words at the start of that same row, four spaces, then the amount at the end of that same row. ' +
    'Follow the dots across the row to find its amount. Never move an amount to the row above or below.\n' +
    'A heading row with no amount on it (for example a section title) is written alone, with no amount.\n' +
    'Example of the format (made-up rows):\nHousing Costs\nRoom and Board    $12,345\n' +
    'If a row has Fall, Spring and Total columns, keep all three amounts on that row. ' +
    'Also copy sentences about loans, renewal or GPA as plain lines. Output only the copied lines, nothing else.';
  const r = await m.photo.generateContent([prompt, { inlineData: { data: b64, mimeType: blob.type || 'image/jpeg' } }]);
  return { text: r.response.text().trim(), source: sourceOf(r) };
}

window.HybridAI = { status, download, sortLines, explain, readPhoto, ext: EXT, get lastSource() { return lastSource; } };
window.dispatchEvent(new Event('hybridai-ready'));
