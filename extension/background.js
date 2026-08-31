// Extension Background Script (Service Worker)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Madrasati Extension Service Worker] Message received:', message);

    if (message.action === 'gradesScraped') {
        // Find Student Tracker tabs
        chrome.tabs.query({}, (tabs) => {
            const trackerTabs = tabs.filter(tab => 
                tab.url && (tab.url.includes('127.0.0.1:8000') || tab.url.includes('localhost:8000'))
            );

            if (trackerTabs.length > 0) {
                console.log(`[Service Worker] Broadcasting grades to ${trackerTabs.length} tracker tab(s).`);
                trackerTabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'importAutoGrades',
                        data: message.data
                    });
                });
            } else {
                console.warn('[Service Worker] No active Student Tracker tab found to receive grades.');
            }
        });
    }

    if (message.action === 'closeActiveTab' && sender.tab) {
        console.log('[Service Worker] Closing tab:', sender.tab.id);
        chrome.tabs.remove(sender.tab.id);
    }
});
