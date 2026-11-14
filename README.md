# Aid Letter Decoder

Paste a college financial aid letter (or open the PDF). The decoder sorts every line into gifts (grants and scholarships), loans and work-study, then shows the real price for one year in plain English or Spanish.

It runs entirely in the browser. No account, no server, no upload. The letter never leaves the device.

## Try it

Live: https://lokeshpampatti.github.io/aid-letter-decoder/ · Demo video: https://youtu.be/OFkOC5Jwi_M

Or run it locally: open `index.html` in any modern browser, or serve the folder:

```bash
python3 -m http.server 5178
```

Then visit http://127.0.0.1:5178 and click one of the three sample letters.

## What it does

- Sorts each line of the letter with keyword and pattern rules (Pell, SEOG, subsidized, unsubsidized, Parent PLUS, private and school loans, work-study, tuition, housing and more).
- Reads amounts in single-column and Fall / Spring / Total layouts.
- Real price = full cost of attendance minus gifts only. Loans and work-study are never subtracted.
- Catches the "net cost" trick: when a letter subtracts loans to show a smaller number, it says so and shows the real price.
- Flags missing costs (letters that list only billed costs), Parent PLUS loans, private loans, vague "award" lines, unclear "Federal Direct Loan" lines and GPA renewal rules.
- Estimates monthly payments over 10 years (2025-26 federal rates, clearly labeled as a rough estimate).
- Every line can be re-sorted by hand and the totals update.
- English and Spanish, read-aloud (browser speech), keyboard and screen-reader friendly, works on a phone, works offline from the folder.

## The AI part: hybrid, on the device first

Added Nov 13-14, 2026 for #BuildHybridAI. Uses [Firebase AI Logic](https://firebase.google.com/docs/ai-logic) in hybrid mode (`InferenceMode.PREFER_ON_DEVICE`): **Gemini Nano runs inside Chrome on the family's own computer**, and a cloud Gemini model (`gemini-3.5-flash-lite`) is only a fallback.

Three jobs, all in `hybrid.js`:

1. **Sort the lines the rules could not place** ("Dean's Award", "Bridge Financing Option") into gift, loan, work-study or cost, with a one-line reason in English or Spanish. Output is held to a JSON schema.
2. **Explain the letter in plain words**: four sentences built only from the totals the rules already computed. The code then checks the answer: every dollar figure must appear in the letter, and the first sentence must state the real price. If not, it retries once, then shows a warning and points back to the boxes.
3. **Read a photo of a paper letter** (Nano takes image input): it copies each row and amount into the text box, and the page asks the family to check each line against the paper.

Privacy rules:

- If Gemini Nano is on the device, nothing leaves the computer and no prompt is shown.
- If it is not, the page asks first ("Yes, use the cloud" / "No thanks") and says exactly what would be sent: only the unclear line names, only the totals, or the photo. "No" sends nothing.
- No names or student details go into any prompt. The summary is built from numbers only.
- [App Check](https://firebase.google.com/docs/app-check) (reCAPTCHA Enterprise, no puzzle) blocks cloud calls that do not come from this site. The Firebase web config in `firebase-config.js` is a public identifier, not a secret.
- With `firebase: null` in `firebase-config.js`, or in a browser without Firebase, the page falls back to the older on-device model below and works the same.

The older fallback: a small sentence-embedding model (`Xenova/all-MiniLM-L6-v2`, about 23 MB) through [transformers.js](https://github.com/xenova/transformers.js) compares each unsure line with labeled examples and suggests a sort with a match score. It also only loads after a click and runs on the device.

Gemini Nano needs a recent desktop Chrome with enough disk space (tested on Chrome 156, macOS); the page offers the one-time download with a progress bar.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `styles.css` | The page |
| `decoder.js` | Parsing and math. Pure functions, also runs in Node |
| `app.js` | Page logic, PDF reading, read-aloud, AI buttons and the cloud consent prompt |
| `hybrid.js` | Gemini Nano + cloud fallback through Firebase AI Logic, App Check, answer checks |
| `firebase-config.js` | Public Firebase web config (set `firebase: null` to turn Gemini off) |
| `i18n.js` | All text in English and Spanish |
| `samples/` | Three made-up letters (plus one as a PDF and one as a phone photo) |
| `vendor/` | pdf.js 3.11.174 (Apache 2.0), kept local so the page works offline |

## Run the parser in Node

```bash
node -e 'const D=require("./decoder.js");const p=D.parse(require("fs").readFileSync("samples/northgate-private.txt","utf8"));console.log(D.summarize(p.items,{notes:p.notes}))'
```

## Credits

- Firebase JS SDK and Firebase AI Logic by Google (Apache 2.0); Gemini Nano and Gemini models by Google
- pdf.js by Mozilla (Apache 2.0)
- transformers.js by Xenova / Hugging Face (Apache 2.0) and the all-MiniLM-L6-v2 model (Apache 2.0)
- Built with help from Claude (Anthropic) as an AI coding assistant.

All sample letters, schools and students are made up.

This tool explains a letter. It is not financial advice.

## License

MIT
