# Aid Letter Decoder: submission kit

Built Nov 11, 2026. One build, two hackathons.

| | AccessED Hacks | SLAY HACKS |
| --- | --- | --- |
| Page | https://accessed-hacks.devpost.com | https://slayy-hacks.devpost.com |
| Due | **Fri Nov 20, 5:00 PM ET** | **Mon Dec 7** (time per Devpost page) |
| Prize | $225 first | $2,000 first ($5,000 pool) |
| Who | Students above the age of majority, solo OK | Students and builders, solo OK |
| Needs | Story, screenshots, a demo or recorded walkthrough (video optional). Mark what was built during the event. Credit AI help. Synthetic data only. Judging links must work through Nov 22. | Title, description, problem, **AI implementation details**, working demo or video, screenshots, **source repo**, team info |
| Judged on | Barrier Removed, Learning Value, Inclusive Experience, Working Prototype & Explanation (equal, 1-5 each) | Innovation 25%, Technical 25%, Real-world impact 20%, AI integration and responsible use 15%, UX and presentation 15% |

## What is ready

- Working site: `~/Downloads/aid-letter-decoder/` (open `index.html`, or `python3 -m http.server 5178` in that folder)
- Demo video: `demo/aid-letter-decoder-demo.mp4` (1:46, 1280x800, captions on screen, no voiceover)
- Screenshots: `screenshots/1-home.png` to `6-phone.png`
- Sample letters: `samples/` (3 made-up schools, plus one as a PDF)
- README and MIT license for the repo
- Local git repo with one commit, **not pushed anywhere**

## What needs Loki (nothing is public yet)

**On hold (Nov 12):** Loki said yes to all three, then asked to restyle the decoder to match Clarity Prep's other tools and "don't publish this". Nothing has been pushed or uploaded. The restyle is done (Schibsted Grotesk, ink, lava orange, paper, the same stage and card as the GPA calculator and essay grader). Wait for a fresh OK on the new look before 1-3. Note: Chrome's GitHub sign-in is the `Loki-Pam` account, not `LokeshPampatti`; confirm which account should own the repo.

1. **OK to make a public GitHub repo** `LokeshPampatti/aid-letter-decoder` and push this folder. SLAY requires a source repo.
2. **OK to host the demo** so judges can click it (GitHub Pages from that repo, or a Vercel Hobby project). AccessED wants judging links live through Nov 22.
3. **OK to upload the video** to YouTube as Unlisted (Devpost takes a YouTube or Vimeo link). AccessED says the video is optional, SLAY wants a demo or a video.
4. **Devpost login**: sign in, register for both hackathons if not done, then Claude fills in the forms. Team = solo.

Once 1-3 are approved, Claude can do the push, hosting and the Devpost forms. The tabs will be left open on the Devpost "Submit project" pages for your final click if Devpost asks for a checkbox or captcha.

---

## Devpost text (paste-ready)

**Project name:** Aid Letter Decoder

**Tagline (Elevator pitch, under 200 characters):**
Paste a college aid letter. See what is a gift, what is a loan, and the real price, in plain English or Spanish. Runs on your device.

### Inspiration

Every spring, families get financial aid letters that read like a puzzle. Grants, loans and work-study sit in one list under "Your Award". Many letters subtract loans from the cost and call the result a "net cost", so a $43,600 school looks like $9,220. A 2022 U.S. Government Accountability Office review of aid offers found that most colleges either left out the net price or understated it.

I run a small college admissions guidance service, and this letter is where first-generation and lower-income families get stuck. They do not lack information. They lack someone to translate it. The families who most need a clear answer are often the ones without a counselor, reading a long PDF on an old phone, sometimes in their second language. That is the barrier I wanted to remove.

### What it does

You paste the letter text, open the PDF, or try one of three sample letters. In under a second you get:

- **The real price for one year**: the full cost minus gifts only. Loans and work-study are never treated as discounts.
- **Every line sorted** into gifts (grants and scholarships), loans and work-study, with a bar showing how the cost gets covered (black for gifts, orange for loans, gray for work-study).
- **Plain-English warnings** written for a 16-year-old or a busy parent: when the letter's "net cost" hides loans, when a Parent PLUS loan is in a parent's name, when a "Federal Direct Loan" could be subsidized or not, when "award" is vague, when a scholarship needs a GPA to renew, and when the letter leaves out books, travel and personal costs.
- **What the loans cost later**: a rough monthly payment over 10 years, with the rates it assumes shown on screen.
- **A box for missing costs**, so a family can add what the letter left out and watch the price update.
- **Questions to ask the aid office** before signing anything.
- **Spanish with one click**, read-aloud, full keyboard and screen-reader support, and a layout that works on a phone.

Every line can be re-sorted by hand, and nothing is uploaded. The letter never leaves the device, and the page works offline once it is on the computer.

### How we built it

- A static site in plain HTML, CSS and JavaScript. No framework, no backend, no account.
- `decoder.js` is the core: about 20 ordered rules built from real aid-letter vocabulary (Pell, SEOG, subsidized, unsubsidized, Parent PLUS, institutional and "alternative" loans, FWS, tuition, room and board). It reads single amounts and Fall / Spring / Total columns, checks whether the last column is the sum, and keeps the school's own totals aside so it can compare them with the real math.
- Wrapped sentences are joined back into paragraphs so conditions like "renewable with a 3.25 GPA" are caught and quoted.
- PDFs are read in the browser with Mozilla's pdf.js. We rebuild table rows from each text piece's position so "Tuition ... $64,800" stays on one line.
- **On-device AI for the hard lines.** Rules cannot know every school's made-up name ("Opportunity Fund", "Bridge Financing Option", "Dean's Award"). When the rules are unsure, the user can ask a small sentence-embedding model (all-MiniLM-L6-v2) running in the browser through transformers.js. It compares the line with about 50 labeled examples of gifts, loans, work-study and costs, and suggests a sort with a match score that is shown on screen. The model loads only after a click, sees only line labels, and runs locally. No paid API and no data sent to a server.
- All text lives in one `i18n.js` file in English and Spanish. Read-aloud uses the browser's built-in speech.
- The demo video was recorded with a scripted headless Chrome session so every step is reproducible.

### Challenges we ran into

- **Letters have no standard format.** Some use columns, some use dot leaders, some put the total first. Deciding when to add columns and when to trust a total took several passes.
- **Order of rules matters.** "Tuition Scholarship" is a gift, not a cost. "Federal Direct Subsidized Loan" must not match "unsubsidized". We ordered the rules from most specific to least and tested every sample line.
- **Small AI models are easy to fool.** Our first try used a zero-shot language model, and it called a "Dean's Award" a work-study job. Switching to embeddings plus labeled examples gave sensible answers and a score we can show honestly.
- **PDF text comes out in pieces.** pdf.js returns words, not lines, so we rebuild lines from their x and y positions.
- **Being honest about estimates.** Interest rates change every year, so the payment estimate states its assumptions right next to the number.

### Accomplishments that we're proud of

- The first sample letter says "Your net cost: $9,220". The decoder shows the real price, $43,600, and explains why in one sentence.
- It works with no internet, no account and no upload, which matters for families on shared or older devices.
- Everything a family reads is available in Spanish.
- Every number on screen can be traced back to a line in the letter.

### What we learned

- The hardest part of financial aid is vocabulary, not math. A plain sentence does more than a chart.
- Rules plus a small local model beat either one alone. Rules are predictable, and the model covers the long tail of school-specific names.
- Accessibility choices (labels, focus order, live regions, contrast) also made the page easier for everyone.

### What's next for Aid Letter Decoder

- Compare two or more letters side by side to pick the best real offer.
- Photo and scan support with on-device text recognition for paper letters.
- More languages (Vietnamese, Chinese, Haitian Creole), starting with the warnings.
- A four-year view that accounts for scholarships that do not renew.
- Testing with real families and school counselors, then a printable one-page summary to bring to the aid office.

### Built with

html, css, javascript, pdf.js, transformers.js, all-minilm-l6-v2, web-speech-api, puppeteer, ffmpeg

### Work done during the event (AccessED asks for this)

Everything in this repo was written on Nov 11, 2026, inside the AccessED event window (Oct 17 to Nov 20). Pre-existing work used: pdf.js and transformers.js (open source, Apache 2.0) and the all-MiniLM-L6-v2 model. AI assistance: built with help from Claude (Anthropic) as a coding assistant. All sample letters, schools and students are made up.

### Links to fill in after Loki's OK

- Try it: `https://lokeshpampatti.github.io/aid-letter-decoder/` (after the repo push and Pages are on)
- Source: `https://github.com/LokeshPampatti/aid-letter-decoder`
- Video: YouTube Unlisted link

### SLAY HACKS extra field: "AI implementation"

The decoder uses two layers. The first is a set of ordered rules for the vocabulary every aid letter shares, because rules are predictable and auditable when money is involved. The second is an on-device embedding model (Xenova/all-MiniLM-L6-v2 through transformers.js) for the lines rules cannot place, such as school-branded award and loan names. Each unsure line is embedded and compared with about 50 labeled example lines across four groups (gifts, loans, work-study, costs). The group whose three closest examples score highest wins, and the score is shown next to the suggestion so the user can judge it. Responsible use: the model runs only after the user asks, sees only line labels, never leaves the device, and every suggestion is marked "AI match" and can be changed with one click.
