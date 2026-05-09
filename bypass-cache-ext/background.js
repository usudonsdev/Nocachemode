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
    console.log('Fetching cacheBypassMode...');
    chrome.storage.sync.get(['cacheBypassMode'], (result) => {
        if (chrome.runtime.lastError) {
            console.error('Error accessing chrome.storage.sync:', chrome.runtime.lastError);
            callback(false); // デフォルト値を返す
            return;
        }
        console.log('cacheBypassMode result:', result);
        callback(result.cacheBypassMode || false);
    });
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
    console.log('onCommitted event triggered:', details);
    if (details.frameId !== 0) return;

    // 特殊なスキームを無視
    if (!details.url.startsWith('http://') && !details.url.startsWith('https://')) {
        console.log('Ignoring non-http(s) URL:', details.url);
        return;
    }

    console.log('Processing URL:', details.url); // デバッグ用ログを追加
    console.log('Transition type:', details.transitionType); // Transition type を確認

    getCacheBypassMode((cacheBypassMode) => {
        console.log('Cache bypass mode:', cacheBypassMode);
        if (cacheBypassMode) {
            const url = new URL(details.url);
            if (!url.searchParams.has('_upd_')) {
                url.searchParams.set('_upd_', Date.now());
                console.log('Updating URL with cache buster:', url.toString());
                chrome.tabs.update(details.tabId, { url: url.toString() });
            }
            return;
        }

        // 一時的に transitionType の条件を無効化
        const url = new URL(details.url);
        getStoredDomains((domains) => {
            console.log('Stored domains:', domains);
            if (domains.some(domain => url.hostname.includes(domain))) {
                if (!url.searchParams.has('_upd_')) {
                    url.searchParams.set('_upd_', Date.now());
                    console.log('Updating URL with cache buster for domain:', url.toString());
                    chrome.tabs.update(details.tabId, { url: url.toString() });
                }
            } else {
                console.log('Domain not in stored domains, skipping:', url.hostname);
            }
        });
    });
});