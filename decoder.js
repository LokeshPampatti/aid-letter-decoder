/* Aid Letter Decoder: the parsing rules.
   Pure functions, no network. Works in the browser (window.Decoder) and in Node (require). */
(function (root) {
  'use strict';

  // Rough loan rates used only for the "what this costs later" estimate.
  // Federal undergrad and Parent PLUS figures are the 2025-26 federal rates; private is a guess.
  var RATES = { federal: 0.0639, parent: 0.0894, private: 0.09 };

  // Order matters: the first rule that matches wins.
  var RULES = [
    // Summary lines the school adds up for you. We keep them only to compare.
    { cat: 'summary', kind: 'claimedNet', re: /\b(net (cost|price)|your (net )?cost|remaining balance|balance due|amount due|you owe|estimated (cost|bill) to you|out[- ]of[- ]pocket)\b/i },
    { cat: 'summary', kind: 'total', re: /\b(total|sum)\b.*\b(aid|award|offer|package|financial|cost|costs|attendance|expenses|direct|indirect)\b|\b(aid|award)s? total\b/i },
    { cat: 'summary', kind: 'total', re: /\b(cost of attendance|attendance cost|coa|estimated (total )?cost|total cost|student budget|cost budget)\b/i },
    { cat: 'info', kind: 'sai', re: /\b(student aid index|sai|expected family contribution|efc)\b/i },

    // Work-study before loans and grants.
    { cat: 'work', kind: 'workstudy', re: /\b(work[- ]?study|fws|student employment|campus job)\b/i },

    // Loans.
    { cat: 'loan', kind: 'parentplus', re: /\bparent\b.*\bplus\b|\bplus\b.*\bparent\b|\bparent loan\b/i },
    { cat: 'loan', kind: 'gradplus', re: /\bgrad(uate)? plus\b/i },
    { cat: 'loan', kind: 'subsidized', re: /\bsubsidi[sz]ed\b(?!.*\bun)/i, not: /\bunsubsidi[sz]ed\b/i },
    { cat: 'loan', kind: 'unsubsidized', re: /\bunsubsidi[sz]ed\b/i },
    { cat: 'loan', kind: 'private', re: /\b(private|alternative|bank|credit union)\b.*\bloan\b|\bloan\b.*\b(private|alternative)\b/i },
    { cat: 'loan', kind: 'institutional', re: /\b(institutional|university|college|school)\b.*\bloan\b/i },
    { cat: 'loan', kind: 'federalUnclear', re: /\b(federal )?direct loan\b|\bstafford\b/i },
    { cat: 'loan', kind: 'perkins', re: /\bperkins\b/i },
    { cat: 'loan', kind: 'loan', re: /\bloans?\b|\bborrow/i },

    // Grants and scholarships (money you keep).
    { cat: 'grant', kind: 'pell', re: /\bpell\b/i },
    { cat: 'grant', kind: 'seog', re: /\b(seog|supplemental educational opportunity)\b/i },
    { cat: 'grant', kind: 'state', re: /\b(state|hope|zell|tap|cal grant|opportunity grant|bright futures)\b.*\b(grant|scholarship|award)\b|\bcal grant\b|\bhope\b|\bzell\b/i },
    { cat: 'grant', kind: 'scholarship', re: /\bscholarships?\b|\bfellowships?\b/i },
    { cat: 'grant', kind: 'grant', re: /\bgrants?\b|\bgift aid\b|\btuition (waiver|remission|discount)\b|\bwaiver\b/i },
    // "Award" alone usually means a grant, but schools blur it. Flag it.
    { cat: 'grant', kind: 'vagueAward', check: true, re: /\b(award|merit|achievement|dean'?s|president'?s|trustee|founder'?s)\b/i },

    // Costs.
    { cat: 'cost', kind: 'direct', re: /\b(tuition|fees?|housing|residence|room|dorm|meal|dining|board|food|health insurance)\b/i },
    { cat: 'cost', kind: 'indirect', re: /\b(books?|supplies|course materials|transportation|travel|personal|miscellaneous|misc|computer|laptop|living)\b/i }
  ];

  var MONEY = /\$\s?\d[\d,]*(?:\.\d{1,2})?|\b\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?\b/g;

  // Bare numbers ("Subsidized 3500") count only on lines that name a kind of aid or cost.
  var PLAIN = /(?<![\d\-\/(.:])\d{3,7}(?:\.\d{1,2})?(?![\d\-\/)%])/g;
  var YEARISH = /\b(19|20)\d{2}\s*[-–\/]\s*\d{2,4}\b|\b(year|academic|fall|spring|semester|term|class of)\b/i;

  function toNumber(s) { return Math.round(parseFloat(s.replace(/[$,\s]/g, '')) || 0); }

  // A line like "Pell Grant  $3,698  $3,697  $7,395" has fall, spring and a total.
  function pickAmount(nums) {
    if (!nums.length) return null;
    if (nums.length === 1) return nums[0];
    var last = nums[nums.length - 1];
    var rest = nums.slice(0, -1).reduce(function (a, b) { return a + b; }, 0);
    if (Math.abs(last - rest) <= 2) return last;
    // Columns without a total: add them up (fall + spring).
    return nums.reduce(function (a, b) { return a + b; }, 0);
  }

  function labelOf(line) {
    return line.replace(MONEY, ' ').replace(/[.…_]{2,}/g, ' ').replace(/\s{2,}/g, ' ').replace(/[:\-\s]+$/, '').trim()
      .replace(/[\s,:(]*\b(up to|maximum of|maximum|max\.?|not to exceed|approx(imately|\.)?|about|est\.?)\s*$/i, '').trim();
  }

  function classify(label) {
    for (var i = 0; i < RULES.length; i++) {
      var r = RULES[i];
      if (r.re.test(label) && !(r.not && r.not.test(label))) {
        return { cat: r.cat, kind: r.kind, check: !!r.check };
      }
    }
    return { cat: 'unknown', kind: 'unknown', check: true };
  }

  function parse(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n');
    var items = [];
    var notes = { renewal: [], pushesPrivate: false };
    // Prose often wraps across lines. Join it into paragraphs before reading it.
    var prose = [];
    function flushProse() {
      if (!prose.length) return;
      var para = prose.join(' ');
      prose = [];
      para.split(/(?<=[.!?])\s+/).forEach(function (sentence) {
        if (/\b(renew|renewable|gpa|grade point|maintain)\b/i.test(sentence)) notes.renewal.push(sentence);
        if (/\b(private|alternative)\b.*\bloan\b/i.test(sentence)) notes.pushesPrivate = true;
      });
    }
    lines.forEach(function (raw, idx) {
      var line = raw.trim();
      if (!line) { flushProse(); return; }
      var found = line.match(MONEY) || [];
      var nums = found.map(toNumber);
      var label = labelOf(line);
      if (!nums.length) {
        var plain = (line.match(PLAIN) || []).filter(function (n) { return !(YEARISH.test(line) && /^(19|20)\d{2}$/.test(n)); });
        var plainLabel = line.replace(PLAIN, ' ').replace(/\s{2,}/g, ' ').replace(/[:\-\s]+$/, '').trim();
        if (plain.length && classify(plainLabel).cat !== 'unknown') {
          nums = plain.map(toNumber);
          label = labelOf(plainLabel);
        }
      }

      if (!nums.length || !/[a-z]/i.test(label)) {
        prose.push(line);
        return;
      }
      flushProse();
      var c = classify(label);
      if (c.kind === 'sai') return; // not money on the bill
      if (/\b(renew|renewable|gpa|grade point|maintain)\b/i.test(label)) notes.renewal.push(label);
      items.push({
        id: 'l' + idx,
        line: line,
        label: label,
        amount: pickAmount(nums),
        cat: c.cat,
        kind: c.kind,
        check: c.check,
        estimated: /\bestimat/i.test(line)
      });
    });
    flushProse();
    return { items: items, notes: notes };
  }

  function sum(items, cat, kind) {
    return items.filter(function (i) { return i.cat === cat && (!kind || i.kind === kind); })
      .reduce(function (a, i) { return a + (i.amount || 0); }, 0);
  }

  function monthly(principal, rate, years) {
    if (!principal) return 0;
    var r = rate / 12, n = years * 12;
    return principal * r / (1 - Math.pow(1 + r, -n));
  }

  function loanRate(kind) {
    if (kind === 'parentplus' || kind === 'gradplus') return RATES.parent;
    if (kind === 'private' || kind === 'institutional') return RATES.private;
    return RATES.federal;
  }

  // extraCost: costs the family adds when the letter leaves some out.
  function summarize(items, opts) {
    opts = opts || {};
    var extra = Math.max(0, Math.round(opts.extraCost || 0));
    var direct = sum(items, 'cost', 'direct');
    var indirect = sum(items, 'cost', 'indirect');
    var listedCost = direct + indirect;
    var claimedTotalCost = items.filter(function (i) { return i.cat === 'summary' && i.kind === 'total' && /\b(cost|costs|attendance|expenses|coa|budget)\b/i.test(i.label); })
      .reduce(function (m, i) { return Math.max(m, i.amount); }, 0);
    // Use the itemized costs, or the letter's own cost of attendance if that is bigger
    // (letters often itemize only the billed costs and give the full total separately).
    var cost = Math.max(listedCost, claimedTotalCost) + extra;
    var grants = sum(items, 'grant');
    var loans = sum(items, 'loan');
    var work = sum(items, 'work');
    var net = Math.max(0, cost - grants);
    var claimed = items.filter(function (i) { return i.cat === 'summary' && i.kind === 'claimedNet'; });
    var claimedNet = claimed.length ? claimed[claimed.length - 1].amount : null;

    var parentLoans = items.filter(function (i) { return i.cat === 'loan' && (i.kind === 'parentplus'); });
    var studentLoans = items.filter(function (i) { return i.cat === 'loan' && i.kind !== 'parentplus'; });
    function payback(list) {
      var yearly = list.reduce(function (a, i) { return a + i.amount; }, 0);
      var four = yearly * 4;
      var m = list.reduce(function (a, i) { return a + monthly(i.amount * 4, loanRate(i.kind), 10); }, 0);
      return { yearly: yearly, fourYears: four, monthly: Math.round(m), totalRepaid: Math.round(m * 120) };
    }

    var flags = [];
    if (!cost) flags.push({ key: 'noCost' });
    else if (direct && !indirect && !claimedTotalCost && !extra) flags.push({ key: 'directOnly' });
    if (claimedNet !== null && cost && Math.abs(claimedNet - net) > 50) flags.push({ key: 'claimedNetWrong', claimed: claimedNet, real: net });
    if (items.some(function (i) { return i.cat === 'loan' && i.kind === 'parentplus'; })) flags.push({ key: 'parentPlus' });
    if (items.some(function (i) { return i.cat === 'loan' && (i.kind === 'private' || i.kind === 'institutional'); })) flags.push({ key: 'privateLoan' });
    if (items.some(function (i) { return i.kind === 'federalUnclear'; })) flags.push({ key: 'federalUnclear' });
    if (items.some(function (i) { return i.kind === 'vagueAward'; })) flags.push({ key: 'vagueAward' });
    if (cost && loans > net + 50) flags.push({ key: 'overBorrow', loans: loans, left: net, extra: loans - net });
    if (work) flags.push({ key: 'workStudy' });
    if (opts.notes && opts.notes.pushesPrivate) flags.push({ key: 'pushesPrivate' });
    if (opts.notes && opts.notes.renewal.length) flags.push({ key: 'renewal', lines: opts.notes.renewal });
    if (items.some(function (i) { return i.cat === 'unknown'; })) flags.push({ key: 'unknown' });

    return {
      cost: cost, direct: direct, indirect: indirect, extra: extra,
      grants: grants, loans: loans, work: work,
      net: net,
      // What is left after loans and work-study: the cash you need up front.
      cashGap: Math.max(0, net - loans - work),
      claimedNet: claimedNet,
      studentPayback: payback(studentLoans),
      parentPayback: payback(parentLoans),
      flags: flags
    };
  }

  var api = { parse: parse, summarize: summarize, classify: classify, pickAmount: pickAmount, monthly: monthly, RATES: RATES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Decoder = api;
})(this);
