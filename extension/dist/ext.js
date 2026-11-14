// Side panel glue: when text was sent from the right-click menu, put it in the letter box and decode it.
(function () {
  function take(p) {
    if (!p || !p.text) return;
    chrome.storage.session.remove('pending');
    var box = document.getElementById('letter');
    if (!document.getElementById('results').hidden) document.getElementById('again').click();
    box.value = p.text;
    document.getElementById('decode').click();
  }
  chrome.storage.session.get('pending').then(function (r) { take(r.pending); });
  chrome.storage.session.onChanged.addListener(function (ch) { if (ch.pending && ch.pending.newValue) take(ch.pending.newValue); });
})();
