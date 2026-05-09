/**
 * Normalize a domain or URL to a hostname.
 * @param {string} input
 * @returns {string|null}
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
 * @param {string} hostname
 * @param {string} domain
 * @returns {boolean}
 */
function isDomainMatch(hostname, domain) {
    if (!hostname || !domain) return false;
    if (hostname === domain) return true;
    return hostname.endsWith(`.${domain}`);
}

/**
 * Get stored domains from sync storage.
 * @param {(domains: string[]) => void} callback
 */
function getStoredDomains(callback) {
    chrome.storage.sync.get(['targetDomains'], (result) => {
        callback(result.targetDomains || []);
    });
}

/**
 * Save domains to sync storage.
 * @param {string[]} domains
 * @param {() => void} callback
 */
function saveDomains(domains, callback) {
    chrome.storage.sync.set({ targetDomains: domains }, callback);
}

/**
 * Get the cache bypass mode flag.
 * @param {(enabled: boolean) => void} callback
 */
function getCacheBypassMode(callback) {
    chrome.storage.sync.get(['cacheBypassMode'], (result) => {
        callback(Boolean(result.cacheBypassMode));
    });
}

/**
 * Set the cache bypass mode flag.
 * @param {boolean} enabled
 * @param {() => void} callback
 */
function setCacheBypassMode(enabled, callback) {
    chrome.storage.sync.set({ cacheBypassMode: Boolean(enabled) }, callback);
}

/**
 * Handle messages from the popup UI.
 * @param {{action: string, domain?: string, enabled?: boolean}} message
 * @param {chrome.runtime.MessageSender} sender
 * @param {(response: {success: boolean, error?: string, domains?: string[], cacheBypassMode?: boolean}) => void} sendResponse
 * @returns {boolean|void}
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
 * @param {chrome.webNavigation.WebNavigationFramedCallbackDetails} details
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