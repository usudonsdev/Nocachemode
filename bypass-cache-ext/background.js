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

function getStoredDomains(callback) {
    chrome.storage.sync.get(['targetDomains'], (result) => {
        callback(result.targetDomains || []);
    });
}

function saveDomains(domains, callback) {
    chrome.storage.sync.set({ targetDomains: domains }, callback);
}

function getCacheBypassMode(callback) {
    chrome.storage.sync.get(['cacheBypassMode'], (result) => {
        callback(Boolean(result.cacheBypassMode));
    });
}

function setCacheBypassMode(enabled, callback) {
    chrome.storage.sync.set({ cacheBypassMode: Boolean(enabled) }, callback);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
            if (!domains.includes(domain)) {
                domains.push(domain);
                saveDomains(domains, () => sendResponse({ success: true }));
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
            const nextDomains = domains.filter((item) => item !== domain);
            saveDomains(nextDomains, () => sendResponse({ success: true }));
        });
        return true;
    }

    if (message.action === 'toggleCacheBypassMode') {
        setCacheBypassMode(message.enabled, () => sendResponse({ success: true }));
        return true;
    }
});

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
            if (domains.some((domain) => url.hostname.includes(domain))) {
                if (!url.searchParams.has('_upd_')) {
                    url.searchParams.set('_upd_', Date.now());
                    chrome.tabs.update(details.tabId, { url: url.toString() });
                }
            }
        });
    });
});