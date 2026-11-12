# Aid Letter Decoder

Paste a college financial aid letter (or open the PDF). The decoder sorts every line into gifts (grants and scholarships), loans and work-study, then shows the real price for one year in plain English or Spanish.

It runs entirely in the browser. No account, no server, no upload. The letter never leaves the device.

## Try it

Open `index.html` in any modern browser, or serve the folder:

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

## The AI part

Lines the rules cannot place can go to a small sentence-embedding model (`Xenova/all-MiniLM-L6-v2`, about 23 MB) that runs in the browser through [transformers.js](https://github.com/xenova/transformers.js). It compares each unsure line with labeled examples of aid lines and suggests a sort with a match score. The model only loads after the user clicks, only sees line labels, and runs on the device. No paid API and no letter data sent anywhere.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `styles.css` | The page |
| `decoder.js` | Parsing and math. Pure functions, also runs in Node |
| `app.js` | Page logic, PDF reading, read-aloud, on-device AI |
| `i18n.js` | All text in English and Spanish |
| `samples/` | Three made-up letters (plus one as a PDF) |
| `vendor/` | pdf.js 3.11.174 (Apache 2.0), kept local so the page works offline |

## Run the parser in Node

```bash
node -e 'const D=require("./decoder.js");const p=D.parse(require("fs").readFileSync("samples/northgate-private.txt","utf8"));console.log(D.summarize(p.items,{notes:p.notes}))'
```

## Credits

- pdf.js by Mozilla (Apache 2.0)
- transformers.js by Xenova / Hugging Face (Apache 2.0) and the all-MiniLM-L6-v2 model (Apache 2.0)
- Built with help from Claude (Anthropic) as an AI coding assistant.

All sample letters, schools and students are made up.

This tool explains a letter. It is not financial advice.

## License

MIT
