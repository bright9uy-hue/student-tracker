// Extension Background Script (Service Worker)
//
// gradesScraped used to be relayed by finding a matching tab via
// chrome.tabs.query({}) and chrome.tabs.sendMessage() straight to it. That
// only works when the Student Tracker is open as an actual browser tab -
// it silently finds nothing when the tracker is the Electron desktop app
// instead, since Electron runs its own separate, independent Chromium
// process that this browser's extension APIs have no visibility into at
// all (no permission can grant that - they're simply different browser
// engine processes). Posting directly to server.js's own local HTTP
// server instead works identically either way, since server.js is running
// regardless of whether the frontend is being viewed in Electron or a
// plain browser tab - the frontend just polls for a pending import
// (js/madrasati-noor.js) instead of waiting for a pushed message.
const TRACKER_SERVER_URL = 'http://127.0.0.1:8000';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Madrasati Extension Service Worker] Message received:', message);

    if (message.action === 'gradesScraped') {
        fetch(`${TRACKER_SERVER_URL}/api/madrasati-import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: message.data, assignmentTitle: message.assignmentTitle })
        })
            .then(() => console.log('[Service Worker] Posted grades to the tracker server.'))
            .catch(err => console.error('[Service Worker] Failed to reach the tracker server (is it running?):', err));
    }

    if (message.action === 'closeActiveTab' && sender.tab) {
        console.log('[Service Worker] Closing tab:', sender.tab.id);
        chrome.tabs.remove(sender.tab.id);
    }
});
