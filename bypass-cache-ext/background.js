// ストレージに保存されたドメインリストを取得する関数
function getStoredDomains(callback) {
    chrome.storage.sync.get(['targetDomains'], (result) => {
        callback(result.targetDomains || []);
    });
}

// ドメインリストをストレージに保存する関数
function saveDomains(domains, callback) {
    chrome.storage.sync.set({ targetDomains: domains }, callback);
}

// キャッシュ無効モードの状態を取得する関数
function getCacheBypassMode(callback) {
    chrome.storage.sync.get(['cacheBypassMode'], (result) => {
        callback(result.cacheBypassMode || false);
    });
}

// キャッシュ無効モードを設定する関数
function setCacheBypassMode(enabled, callback) {
    chrome.storage.sync.set({ cacheBypassMode: enabled }, callback);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'addDomain') {
        getStoredDomains((domains) => {
            if (!domains.includes(message.domain)) {
                domains.push(message.domain);
                saveDomains(domains, () => sendResponse({ success: true }));
            } else {
                sendResponse({ success: false, error: 'Domain already exists' });
            }
        });
        return true; // 非同期応答を許可
    } else if (message.action === 'toggleCacheBypassMode') {
        setCacheBypassMode(message.enabled, () => sendResponse({ success: true }));
        return true;
    }
});

chrome.webNavigation.onCommitted.addListener((details) => {
    // メインフレーム（ページ本体）の読み込みのみ対象とする
    if (details.frameId !== 0) return;

    getCacheBypassMode((cacheBypassMode) => {
        if (cacheBypassMode) {
            const url = new URL(details.url);
            if (!url.searchParams.has('_upd_')) {
                url.searchParams.set('_upd_', Date.now());
                chrome.tabs.update(details.tabId, { url: url.toString() });
            }
            return;
        }

        if (details.transitionType === 'auto_bookmark') {
            const url = new URL(details.url);

            getStoredDomains((domains) => {
                if (domains.some(domain => url.hostname.includes(domain))) {
                    if (!url.searchParams.has('_upd_')) {
                        url.searchParams.set('_upd_', Date.now());
                        chrome.tabs.update(details.tabId, { url: url.toString() });
                    }
                }
            });
        }
    });
});