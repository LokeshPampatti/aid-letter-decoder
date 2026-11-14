// Aid Letter Decoder extension: open the side panel from the toolbar, or right-click selected
// letter text to decode it. The text is handed to the side panel through session storage,
// which stays in memory on this computer and is cleared when Chrome closes.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'decode', title: 'Decode this aid letter', contexts: ['selection'] });
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'decode' || !info.selectionText) return;
  // Open first, inside the click, so Chrome counts it as the user's action.
  chrome.sidePanel.open({ windowId: tab.windowId });
  chrome.storage.session.set({ pending: { text: info.selectionText, at: Date.now() } });
});
