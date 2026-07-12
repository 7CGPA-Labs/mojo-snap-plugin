document.getElementById('launch-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('tv.html') });
});
