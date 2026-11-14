/* Aid Letter Decoder: page logic. */
(function () {
  'use strict';
  var D = window.Decoder;
  var lang = 'en';
  var T = window.I18N.en;
  var state = { items: [], notes: null };
  var el = function (id) { return document.getElementById(id); };

  window.fmtMoney = function (n) {
    return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  };
  var $ = window.fmtMoney;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // ---------- language ----------
  function applyLang(l) {
    lang = l; T = window.I18N[l];
    document.documentElement.lang = l;
    document.title = T.title.replace(/\.$/, '') + ' | Clarity Prep';
    document.querySelectorAll('[data-t]').forEach(function (n) {
      var v = T[n.getAttribute('data-t')];
      if (typeof v === 'string') n.textContent = v;
    });
    el('letter').placeholder = T.pastePlaceholder;
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === l));
    });
    try { localStorage.setItem('ald-lang', l); } catch (e) {}
    if (!el('results').hidden) render();
    if (typeof refreshEngine === 'function' && window.HybridAI) refreshEngine();
  }

  // ---------- input ----------
  function decode() {
    var text = el('letter').value;
    var parsed = D.parse(text);
    if (!parsed.items.length) {
      el('status').textContent = T.nothing;
      el('results').hidden = true;
      return;
    }
    el('status').textContent = '';
    state.items = parsed.items;
    state.notes = parsed.notes;
    el('extraCost').value = '';
    el('aiStatus').textContent = '';
    el('results').hidden = false;
    render();
    el('resultsHeading').focus();
    el('resultsHeading').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function readFile(file) {
    if (file && /^image\//.test(file.type) && engine !== 'off') return readPhoto(file);
    if (!file) return;
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      el('status').textContent = T.readingPdf;
      file.arrayBuffer().then(pdfToText).then(function (text) {
        if (!text.trim()) throw new Error('empty');
        el('letter').value = text;
        el('status').textContent = '';
        decode();
      }).catch(function () { el('status').textContent = T.pdfFail; });
    } else {
      file.text().then(function (text) { el('letter').value = text; decode(); });
    }
  }

  // Rebuild lines from pdf.js text pieces using their y position, so table rows stay on one line.
  function pdfToText(buf) {
    var lib = window.pdfjsLib;
    lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    return lib.getDocument({ data: buf }).promise.then(function (pdf) {
      var pages = [];
      for (var p = 1; p <= pdf.numPages; p++) pages.push(pdf.getPage(p).then(function (pg) { return pg.getTextContent(); }));
      return Promise.all(pages).then(function (contents) {
        return contents.map(function (c) {
          var rows = {};
          c.items.forEach(function (it) {
            var y = Math.round(it.transform[5] / 3) * 3;
            (rows[y] = rows[y] || []).push({ x: it.transform[4], w: it.width || 0, s: it.str });
          });
          return Object.keys(rows).map(Number).sort(function (a, b) { return b - a; }).map(function (y) {
            // Small gaps are spaces between words; wide gaps are table columns.
            var row = rows[y].sort(function (a, b) { return a.x - b.x; }), out = '', end = null;
            row.forEach(function (r) {
              if (!r.s.trim()) return;
              if (end !== null) out += (r.x - end > 12) ? '   ' : (r.x - end > 0.5 ? ' ' : '');
              out += r.s; end = r.x + r.w;
            });
            return out.replace(/ {4,}/g, '   ');
          }).join('\n');
        }).join('\n');
      });
    });
  }

  // ---------- render ----------
  function render() {
    var s = D.summarize(state.items, { extraCost: parseFloat(el('extraCost').value) || 0, notes: state.notes });
    state.summary = s;

    el('realPrice').textContent = s.cost ? $(s.net) : '?';
    el('realPriceSub').textContent = s.cost ? T.realPriceSub(s) : T.flags.noCost;

    // Bar: share of the full cost covered by each kind of money.
    var base = Math.max(s.cost, s.grants + s.loans + s.work, 1);
    var gap = Math.max(0, s.cost - s.grants - s.loans - s.work);
    var parts = [['grant', s.grants], ['loan', s.loans], ['work', s.work], ['gap', gap]];
    el('bar').innerHTML = parts.map(function (p) {
      return p[1] ? '<span class="b-' + p[0] + '" style="width:' + (100 * p[1] / base).toFixed(2) + '%"></span>' : '';
    }).join('');
    el('bar').setAttribute('aria-label', T.barLabel + ': ' + [T.bigGrants + ' ' + $(s.grants), T.bigLoans + ' ' + $(s.loans), T.bigWork + ' ' + $(s.work), T.bigCash + ' ' + $(gap)].join('; '));

    el('totals').innerHTML = [
      ['cost', T.bigCost, s.cost ? $(s.cost) : '?'],
      ['grant', T.bigGrants, $(s.grants)],
      ['loan', T.bigLoans, $(s.loans)],
      ['work', T.bigWork, $(s.work)],
      ['gap', T.bigCash, s.cost ? $(gap) : '?']
    ].map(function (r) {
      return '<div><dt><span class="sw ' + r[0] + '" aria-hidden="true"></span>' + esc(r[1]) + '</dt><dd>' + r[2] + '</dd></div>';
    }).join('');

    // Flags
    var flagsHtml = s.flags.map(function (f) {
      var v = T.flags[f.key];
      var txt = typeof v === 'function' ? v(f) : v;
      var extra = f.key === 'renewal' ? f.lines.map(function (l) { return '<blockquote>' + esc(l) + '</blockquote>'; }).join('') : '';
      return '<li>' + esc(txt) + extra + '</li>';
    }).join('');
    el('flags').innerHTML = flagsHtml;
    el('watch').hidden = !s.flags.length;

    el('missing').hidden = !s.flags.some(function (f) { return f.key === 'noCost' || f.key === 'directOnly'; }) && !s.extra;

    list('listGrant', 'grant', T.grantsEmpty);
    list('listLoan', 'loan', T.loansEmpty);
    list('listWork', 'work', T.workEmpty);

    var pb = '';
    if (s.studentPayback.yearly) pb += '<p>' + esc(T.payback(s.studentPayback, T.whoStudent)) + '</p>';
    if (s.parentPayback.yearly) pb += '<p>' + esc(T.payback(s.parentPayback, T.whoParent)) + '</p>';
    if (pb) pb += '<p class="fine">' + esc(T.paybackNote) + '</p>';
    el('payback').innerHTML = pb;

    renderLines();
    el('questions').innerHTML = T.questions.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('');

    var unsure = state.items.filter(function (i) { return i.cat === 'unknown' || (i.check && !i.ai && !i.aiSrc); });
    el('aiBox').hidden = !unsure.length;
    var gem = engine !== 'off';
    el('explainBox').hidden = !gem;
    var nano = engine === 'on-device';
    el('aiBox').querySelector('[data-t="aiHelp"]').textContent = !gem ? T.aiHelp : nano ? T.aiHelpNano : T.aiHelpCloud;
    el('aiRun').textContent = !gem ? T.aiButton : nano ? T.aiButtonNano : T.aiButtonCloud;
  }

  function list(id, cat, empty) {
    var rows = state.items.filter(function (i) { return i.cat === cat; });
    el(id).innerHTML = rows.length ? rows.map(function (i) {
      return '<li><span>' + esc(i.label) + (i.check ? ' <span class="tag" title="' + esc(T.checkTip) + '">' + esc(T.checkTag) + '</span>' : '') + '</span><b>' + $(i.amount) + '</b></li>';
    }).join('') : '<li class="empty">' + esc(empty) + '</li>';
  }

  function renderLines() {
    var cats = ['grant', 'loan', 'work', 'cost', 'summary', 'unknown', 'ignore'];
    el('lines').innerHTML = state.items.map(function (i) {
      var tags = (i.check && i.cat !== 'unknown' ? ' <span class="tag" title="' + esc(T.checkTip) + '">' + esc(T.checkTag) + '</span>' : '') +
        (i.aiSrc ? ' <span class="tag ai">' + esc(i.aiSrc === 'cloud' ? T.aiTagCloud : T.aiTagNano) + '</span>' :
          i.ai ? ' <span class="tag ai">' + esc(T.aiTag) + ' ' + Math.round(i.ai * 100) + '%</span>' : '') +
        (i.why ? '<span class="d-why">' + esc(i.why) + '</span>' : '');
      return '<tr class="t-' + i.cat + '"><td>' + esc(i.label) + tags + '</td><td class="num">' + $(i.amount) + '</td><td>' +
        '<select data-id="' + i.id + '" aria-label="' + esc(T.colType + ': ' + i.label) + '">' +
        cats.map(function (c) { return '<option value="' + c + '"' + (c === i.cat ? ' selected' : '') + '>' + esc(T.cat[c]) + '</option>'; }).join('') +
        '</select></td></tr>';
    }).join('');
  }

  // ---------- read aloud ----------
  function speakText() {
    var s = state.summary;
    var parts = [T.realPrice + ': ' + (s.cost ? $(s.net) : '?') + '.', s.cost ? T.realPriceSub(s) : '',
      T.bigLoans + ': ' + $(s.loans) + '.', T.bigWork + ': ' + $(s.work) + '.'];
    s.flags.forEach(function (f) { var v = T.flags[f.key]; parts.push(typeof v === 'function' ? v(f) : v); });
    return parts.join(' ');
  }
  function toggleSpeak() {
    var synth = window.speechSynthesis;
    if (!synth) return;
    if (synth.speaking) { synth.cancel(); el('speak').textContent = T.readAloud; return; }
    var u = new SpeechSynthesisUtterance(speakText());
    u.lang = lang === 'es' ? 'es-US' : 'en-US';
    u.rate = 0.95;
    u.onend = function () { el('speak').textContent = T.readAloud; };
    el('speak').textContent = T.stopReading;
    synth.speak(u);
  }

  // ---------- on-device AI (optional) ----------
  // A small sentence-embedding model (all-MiniLM-L6-v2) runs in the browser through transformers.js.
  // It turns each unsure line into a vector and compares it with labeled examples of aid lines.
  // It only sees the line labels, only after the user clicks, and nothing leaves the device.
  var EXAMPLES = {
    grant: ['scholarship', 'merit scholarship', 'merit award', 'academic achievement award', 'presidential scholarship', 'dean\'s scholarship',
      'need-based grant', 'institutional grant', 'university grant', 'federal Pell grant', 'state grant', 'tuition discount', 'tuition waiver',
      'gift aid', 'endowed scholarship', 'trustee award', 'leadership award', 'talent award', 'athletic scholarship', 'grant in aid'],
    loan: ['student loan', 'federal direct loan', 'subsidized loan', 'unsubsidized loan', 'parent PLUS loan', 'private education loan',
      'alternative loan', 'institutional loan', 'bank loan', 'borrowed money to repay', 'Perkins loan', 'promissory note', 'financing option'],
    work: ['federal work-study', 'work study', 'student employment', 'campus job earnings', 'part-time job wages', 'FWS'],
    cost: ['tuition', 'fees', 'housing', 'room', 'board', 'meal plan', 'dining', 'books and supplies', 'transportation', 'personal expenses',
      'health insurance', 'technology fee', 'orientation fee', 'residence hall']
  };
  var ai = null;
  function embed(extractor, texts) {
    return extractor(texts, { pooling: 'mean', normalize: true }).then(function (t) { return t.tolist(); });
  }
  function dot(a, b) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
  function loadAI() {
    if (ai) return Promise.resolve(ai);
    return import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2').then(function (m) {
      m.env.allowLocalModels = false;
      return m.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }).then(function (extractor) {
      var cats = Object.keys(EXAMPLES), flat = [], owner = [];
      cats.forEach(function (c) { EXAMPLES[c].forEach(function (e) { flat.push(e); owner.push(c); }); });
      return embed(extractor, flat).then(function (vecs) {
        ai = { extractor: extractor, vecs: vecs, owner: owner, cats: cats };
        return ai;
      });
    });
  }
  // Score each category by its 3 closest examples.
  function aiSort(label) {
    var clean = label.replace(/\b(northgate|lakeshore|riverbend|university|college|institute|of|technology)\b/gi, ' ').trim() || label;
    return embed(ai.extractor, [clean]).then(function (v) {
      v = v[0];
      var best = null;
      ai.cats.forEach(function (c) {
        var sims = ai.vecs.map(function (e, i) { return ai.owner[i] === c ? dot(v, e) : -1; }).sort(function (a, b) { return b - a; }).slice(0, 3);
        var score = (sims[0] + sims[1] + sims[2]) / 3;
        if (!best || score > best.score) best = { cat: c, score: score };
      });
      return best;
    });
  }
  // ---------- Gemini through Firebase AI Logic (hybrid: Nano on device, cloud only with a yes) ----------
  var engine = 'off';
  function H() { return window.HybridAI; }
  function refreshEngine() {
    if (!H()) return Promise.resolve();
    return H().status().then(function (st) {
      engine = st;
      var key = { 'on-device': 'engineDevice', downloadable: 'engineDownload', downloading: 'engineDownloading', 'cloud-only': 'engineCloud', off: 'engineOff' }[st];
      el('engine').hidden = st === 'off';
      el('engineText').textContent = T[key] || '';
      el('engineGet').hidden = st !== 'downloadable';
      el('photoRow').hidden = st === 'off';
      if (!el('results').hidden) render();
    });
  }
  // Resolves true when Nano is here, or when the person says yes to the cloud.
  var askResolve = null;
  function okToRun(askKey) {
    if (engine === 'on-device') return Promise.resolve(true);
    el('askText').textContent = T[askKey];
    el('ask').hidden = false;
    el('askYes').focus();
    return new Promise(function (res) { askResolve = res; });
  }
  function answer(yes) {
    el('ask').hidden = true;
    if (askResolve) { var r = askResolve; askResolve = null; r(yes); }
  }

  function runGemini(targets) {
    el('aiRun').disabled = true;
    return okToRun('cloudAskLines').then(function (ok) {
      if (!ok) { el('aiStatus').textContent = T.cloudDeclined; return; }
      el('aiStatus').textContent = T.aiThinking;
      return H().sortLines(targets.map(function (i) { return i.label; }), lang).then(function (r) {
        var n = 0;
        targets.forEach(function (item, k) {
          var got = r.items[k];
          if (!got) return;
          item.cat = got.cat; item.why = got.why; item.aiSrc = r.source; item.check = false; n++;
        });
        el('aiStatus').textContent = T.aiDoneNano(n, r.source);
        render();
      });
    }).catch(function (e) {
      console.warn(e);
      el('aiStatus').textContent = T.aiFail;
    }).then(function () { el('aiRun').disabled = false; });
  }

  function facts() {
    var s = state.summary, nums = [s.cost, s.grants, s.loans, s.work, s.net, s.cashGap];
    function names(cat) { return state.items.filter(function (i) { return i.cat === cat; }).map(function (i) { nums.push(i.amount); return i.label + ' ' + $(i.amount); }).join('; ') || 'none'; }
    var lines = [
      'REAL PRICE for one year (full cost minus gifts only): ' + $(s.net),
      'Full cost for one year before any aid: ' + (s.cost ? $(s.cost) : 'not listed in the letter'),
      'Gifts (never repaid): ' + $(s.grants) + ' (' + names('grant') + ')',
      'Loans (must be repaid): ' + $(s.loans) + ' (' + names('loan') + ')',
      'Work-study (earned by working a job): ' + $(s.work),
      'Cash still needed after loans and work-study: ' + $(s.cashGap)
    ];
    if (s.claimedNet !== null) { nums.push(s.claimedNet); lines.push('The letter itself says the net cost is ' + $(s.claimedNet) + ', which subtracts loans.'); }
    if (s.parentPayback.yearly) { nums.push(s.parentPayback.yearly, s.parentPayback.monthly); lines.push('Parent PLUS loans of ' + $(s.parentPayback.yearly) + ' a year are repaid by the parent, about ' + $(s.parentPayback.monthly) + ' a month over 10 years for four years of them.'); }
    if (s.studentPayback.yearly) { nums.push(s.studentPayback.yearly, s.studentPayback.monthly); lines.push('Student loans of ' + $(s.studentPayback.yearly) + ' a year are repaid by the student, about ' + $(s.studentPayback.monthly) + ' a month over 10 years for four years of them.'); }
    s.flags.forEach(function (f) { var v = window.I18N.en.flags[f.key]; if (v) lines.push('Warning: ' + (typeof v === 'function' ? v(f) : v)); if (f.loans) nums.push(f.loans, f.left, f.extra); if (f.claimed) nums.push(f.claimed, f.real); });
    return { lines: lines, price: s.net, numbers: nums.filter(function (n) { return typeof n === 'number'; }) };
  }
  function runExplain() {
    el('explainRun').disabled = true;
    okToRun('cloudAskTotals').then(function (ok) {
      if (!ok) { el('explainStatus').textContent = T.cloudDeclined; return; }
      el('explainStatus').textContent = T.aiThinking;
      return H().explain(facts(), lang).then(function (r) {
        el('explainStatus').textContent = '';
        var paras = r.text.split(/\n+/).filter(Boolean).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
        var check = !r.numbersOk ? '<p class="warn">' + esc(T.explainBad(r.badNumbers.map(function (n) { return $(+n); }))) + '</p>'
          : !r.priceOk ? '<p class="warn">' + esc(T.explainPrice($(state.summary.net))) + '</p>'
          : '<p class="fine">' + esc(T.explainOk) + '</p>';
        el('explainOut').innerHTML = paras + check + '<p class="fine">' + esc(T.madeOn(r.source)) + '</p>';
        el('explainOut').hidden = false;
      });
    }).catch(function (e) {
      console.warn(e);
      el('explainStatus').textContent = T.aiFail;
    }).then(function () { el('explainRun').disabled = false; });
  }

  // Shrink the photo so it fits the on-device model's input budget.
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1400 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('blob')); }, 'image/jpeg', 0.9);
      };
      img.onerror = rej;
      img.src = URL.createObjectURL(file);
    });
  }
  function readPhoto(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) { el('status').textContent = T.photoType; return; }
    okToRun('cloudAskPhoto').then(function (ok) {
      if (!ok) { el('status').textContent = T.cloudDeclined; return; }
      el('status').textContent = T.photoReading;
      return shrink(file).then(function (b) { return H().readPhoto(b); }).then(function (r) {
        el('letter').value = r.text;
        decode();
        el('status').textContent = T.photoDone(r.source);
      });
    }).catch(function (e) {
      console.warn(e);
      el('status').textContent = T.photoFail;
    }).then(function () { el('photo').value = ''; });
  }

  function runAI() {
    var targets = state.items.filter(function (i) { return i.cat === 'unknown' || (i.check && !i.ai && !i.aiSrc); });
    if (targets.length && engine !== 'off') return runGemini(targets);
    if (!targets.length) return;
    el('aiRun').disabled = true;
    el('aiStatus').textContent = T.aiLoading;
    loadAI().then(function () {
      return targets.reduce(function (p, item) {
        return p.then(function () {
          return aiSort(item.label).then(function (r) { item.cat = r.cat; item.ai = Math.max(0.01, r.score); });
        });
      }, Promise.resolve());
    }).then(function () {
      el('aiStatus').textContent = T.aiDone(targets.length);
      render();
    }).catch(function (e) {
      console.warn(e);
      el('aiStatus').textContent = T.aiFail;
    }).then(function () { el('aiRun').disabled = false; });
  }

  // ---------- wire up ----------
  el('decode').addEventListener('click', decode);
  el('clear').addEventListener('click', function () {
    el('letter').value = ''; el('file').value = ''; el('results').hidden = true; el('status').textContent = '';
    if (window.speechSynthesis) speechSynthesis.cancel();
    el('letter').focus();
  });
  el('file').addEventListener('change', function (e) { readFile(e.target.files[0]); });
  el('letter').addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') decode(); });
  document.querySelectorAll('[data-sample]').forEach(function (b) {
    b.addEventListener('click', function () { el('letter').value = window.SAMPLES[b.getAttribute('data-sample')]; decode(); });
  });
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { applyLang(b.getAttribute('data-lang')); });
  });
  el('lines').addEventListener('change', function (e) {
    var id = e.target.getAttribute('data-id');
    state.items.forEach(function (i) { if (i.id === id) { i.cat = e.target.value; i.check = false; i.ai = 0; i.aiSrc = null; i.why = ''; } });
    render();
  });
  el('extraCost').addEventListener('input', render);
  el('speak').addEventListener('click', toggleSpeak);
  el('aiRun').addEventListener('click', runAI);
  el('explainRun').addEventListener('click', runExplain);
  el('askYes').addEventListener('click', function () { answer(true); });
  el('askNo').addEventListener('click', function () { answer(false); });
  el('photo').addEventListener('change', function (e) { readPhoto(e.target.files[0]); });
  el('photoSample').addEventListener('click', function () {
    fetch('samples/lakeshore-photo.jpg').then(function (r) { return r.blob(); }).then(function (b) {
      readPhoto(new File([b], 'lakeshore-photo.jpg', { type: 'image/jpeg' }));
    });
  });
  el('engineGet').addEventListener('click', function () {
    el('engineGet').hidden = true;
    H().download(function (v) { el('engineText').textContent = T.engineProgress(Math.round(v * 100)); })
      .then(refreshEngine)
      .catch(function (e) { console.warn(e); refreshEngine(); });
  });
  if (window.HybridAI) refreshEngine(); else window.addEventListener('hybridai-ready', refreshEngine);

  // Drag a file anywhere onto the letter box.
  el('letter').addEventListener('dragover', function (e) { e.preventDefault(); });
  el('letter').addEventListener('drop', function (e) {
    if (e.dataTransfer.files.length) { e.preventDefault(); readFile(e.dataTransfer.files[0]); }
  });

  var saved = null;
  try { saved = localStorage.getItem('ald-lang'); } catch (e) {}
  applyLang(saved === 'es' ? 'es' : 'en');

  // Hairline under the header once the page scrolls, like joinclarityprep.com.
  var hdr = el('hdr');
  function edge() { hdr.classList.toggle('c-edge', window.scrollY > 4); }
  window.addEventListener('scroll', edge, { passive: true });
  edge();
})();
