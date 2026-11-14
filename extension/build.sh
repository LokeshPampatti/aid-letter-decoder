#!/bin/sh
# Builds the Chrome extension into extension/dist from the same files the website uses.
# Load it with chrome://extensions > Developer mode > Load unpacked > extension/dist
set -e
cd "$(dirname "$0")/.."
OUT=extension/dist
V=13.3.0
rm -rf "$OUT"
mkdir -p "$OUT/vendor/firebase" "$OUT/icons"
cp extension/src/manifest.json extension/src/background.js extension/src/ext.js "$OUT/"
cp app.js decoder.js i18n.js hybrid.js samples.js firebase-config.js styles.css "$OUT/"
cp -R samples "$OUT/samples"
cp -R vendor/fonts vendor/pdf.min.js vendor/pdf.worker.min.js "$OUT/vendor/"
cp extension/icons/*.png "$OUT/icons/"

# Firebase SDK, bundled because extensions cannot load code from the web.
# The three files import each other by full URL; point them at the local copies.
for f in firebase-app.js firebase-app-check.js firebase-ai.js; do
  curl -fsS "https://www.gstatic.com/firebasejs/$V/$f" \
    | sed "s#https://www.gstatic.com/firebasejs/$V/firebase-app.js#./firebase-app.js#g" > "$OUT/vendor/firebase/$f"
done

# The side panel is the website's page plus the right-click glue.
sed -e 's#<script type="module" src="hybrid.js"></script>#<script type="module" src="hybrid.js"></script>\n  <script src="ext.js"></script>#' \
    -e 's#<title>Aid Letter Decoder | Clarity Prep</title>#<title>Aid Letter Decoder</title>#' \
    index.html > "$OUT/sidepanel.html"
echo "Built $OUT"
