/**
 * Normalize a domain or URL to a hostname.
 * ドメインまたはURLをホスト名に正規化します。
 * @param {string} input 入力されたドメインまたはURL
 * @returns {string|null} 正規化されたホスト名、またはnull
 */
function normalizeDomain(input) {
    const value = String(input || '').trim().toLowerCase();
    if (!value) return null;

    try {
        const hasScheme = value.includes('://');
        const url = new URL(hasScheme ? value : `https://${value}`);
        return url.hostname || null;
    } catch {
        return null;
    }
}

/**
 * Check if a hostname matches a target domain or its subdomains.
 * ホスト名が対象ドメインまたはそのサブドメインに一致するか判定します。
 * @param {string} hostname ホスト名
 * @param {string} domain 対象ドメイン
 * @returns {boolean} 一致する場合はtrue
 */
function isDomainMatch(hostname, domain) {
    if (!hostname || !domain) return false;
    if (hostname === domain) return true;
    return hostname.endsWith(`.${domain}`);
}

/**
 * Get stored domains from sync storage.
 * 保存されているドメイン一覧を同期ストレージから取得します。
 * @param {(domains: string[]) => void} callback 取得後に呼ばれるコールバック
 */
function getStoredDomains(callback) {
    chrome.storage.sync.get(['targetDomains'], (result) => {
        callback(result.targetDomains || []);
    });
}

/**
 * Save domains to sync storage.
 * ドメイン一覧を同期ストレージに保存します。
 * @param {string[]} domains 保存するドメイン配列
 * @param {() => void} callback 保存後に呼ばれるコールバック
 */
function saveDomains(domains, callback) {
    chrome.storage.sync.set({ targetDomains: domains }, callback);
}

/**
 * Get the cache bypass mode flag.
 * キャッシュバイパスモードの有効/無効フラグを取得します。
 * @param {(enabled: boolean) => void} callback 取得後に呼ばれるコールバック
 */
function getCacheBypassMode(callback) {
    chrome.storage.sync.get(['cacheBypassMode'], (result) => {
        callback(Boolean(result.cacheBypassMode));
    });
}

/**
 * Set the cache bypass mode flag.
 * キャッシュバイパスモードの有効/無効フラグを設定します。
 * @param {boolean} enabled 有効にする場合はtrue
 * @param {() => void} callback 設定後に呼ばれるコールバック
 */
function setCacheBypassMode(enabled, callback) {
    chrome.storage.sync.set({ cacheBypassMode: Boolean(enabled) }, callback);
}

/**
 * Handle messages from the popup UI.
 * ポップアップUIからのメッセージを処理します。
 * @param {{action: string, domain?: string, enabled?: boolean}} message 受信したメッセージ
 * @param {chrome.runtime.MessageSender} sender 送信元情報
 * @param {(response: {success: boolean, error?: string, domains?: string[], cacheBypassMode?: boolean}) => void} sendResponse 応答コールバック
 * @returns {boolean|void} 非同期応答の場合はtrue
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender?.id && sender.id !== chrome.runtime.id) {
        sendResponse({ success: false, error: 'Unauthorized sender' });
        return true;
    }

    if (message.action === 'getState') {
        getStoredDomains((domains) => {
            getCacheBypassMode((cacheBypassMode) => {
                sendResponse({ success: true, domains, cacheBypassMode });
            });
        });
        return true;
    }

    if (message.action === 'addDomain') {
        const domain = normalizeDomain(message.domain);
        if (!domain) {
            sendResponse({ success: false, error: 'Invalid domain' });
            return true;
        }

        getStoredDomains((domains) => {
            const nextDomains = Array.isArray(domains) ? domains : [];
            if (!nextDomains.includes(domain)) {
                nextDomains.push(domain);
                nextDomains.sort();
                saveDomains(nextDomains, () => sendResponse({ success: true }));
            } else {
                sendResponse({ success: false, error: 'Domain already exists' });
            }
        });
        return true;
    }

    if (message.action === 'removeDomain') {
        const domain = normalizeDomain(message.domain);
        if (!domain) {
            sendResponse({ success: false, error: 'Invalid domain' });
            return true;
        }

        getStoredDomains((domains) => {
            const nextDomains = (Array.isArray(domains) ? domains : []).filter((item) => item !== domain);
            saveDomains(nextDomains, () => sendResponse({ success: true }));
        });
        return true;
    }

    if (message.action === 'toggleCacheBypassMode') {
        setCacheBypassMode(message.enabled, () => sendResponse({ success: true }));
        return true;
    }
});

/**
 * Apply a cache buster on navigation when applicable.
 * 必要に応じてナビゲーション時にキャッシュバスターを付与します。
 * @param {chrome.webNavigation.WebNavigationFramedCallbackDetails} details ナビゲーション詳細
 */
chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;

    if (!details.url.startsWith('http://') && !details.url.startsWith('https://')) {
        return;
    }

    getCacheBypassMode((cacheBypassMode) => {
        const url = new URL(details.url);

        if (cacheBypassMode) {
            if (!url.searchParams.has('_upd_')) {
                url.searchParams.set('_upd_', Date.now());
                chrome.tabs.update(details.tabId, { url: url.toString() });
            }
            return;
        }

        getStoredDomains((domains) => {
            const safeDomains = Array.isArray(domains) ? domains : [];
            if (safeDomains.some((domain) => isDomainMatch(url.hostname, domain))) {
                if (!url.searchParams.has('_upd_')) {
                    url.searchParams.set('_upd_', Date.now());
                    chrome.tabs.update(details.tabId, { url: url.toString() });
                }
            }
        });
    });
});