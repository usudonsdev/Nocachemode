const domainInput = document.getElementById('domainInput');
const addDomainButton = document.getElementById('addDomain');
const addCurrentButton = document.getElementById('addCurrent');
const domainList = document.getElementById('domainList');
const status = document.getElementById('status');
const allModeToggle = document.getElementById('allMode');

/**
 * Update the status message.
 * ステータスメッセージを更新します。
 * @param {string} message メッセージ内容
 * @param {boolean} [isError] エラーの場合はtrue（省略可）
 */
function setStatus(message, isError = true) {
    status.textContent = message;
    status.style.color = isError ? '#d14343' : '#0f766e';
}

/**
 * Send a message to the background script.
 * バックグラウンドスクリプトへメッセージを送信します。
 * @param {{action: string, domain?: string, enabled?: boolean}} payload 送信するデータ
 * @returns {Promise<any>} レスポンスのPromise
 */
function sendMessage(payload) {
    return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => resolve(response));
    });
}

/**
 * Render the domain list.
 * ドメイン一覧を描画します。
 * @param {string[]} domains ドメイン配列
 */
function renderDomains(domains) {
    domainList.innerHTML = '';
    if (!domains.length) {
        const empty = document.createElement('li');
        empty.textContent = 'まだ登録がありません';
        domainList.appendChild(empty);
        return;
    }

    domains.forEach((domain) => {
    const item = document.createElement('li');
    item.textContent = domain;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '削除';
    remove.addEventListener('click', async () => {
        const response = await sendMessage({ action: 'removeDomain', domain });
        if (response && response.success) {
            await refreshState();
        } else {
            setStatus(response?.error || '削除に失敗しました');
            }
        });

    item.appendChild(remove);
    domainList.appendChild(item);
    });
}

/**
 * Refresh UI state from storage.
 * ストレージから状態を取得しUIを更新します。
 * @returns {Promise<void>} なし
 */
async function refreshState() {
    const response = await sendMessage({ action: 'getState' });
    if (!response || !response.success) {
        setStatus('状態の取得に失敗しました');
        return;
    }

    allModeToggle.checked = Boolean(response.cacheBypassMode);
    renderDomains(response.domains || []);
    setStatus('');
}

/**
 * Add a domain or URL from user input.
 * ユーザー入力からドメインまたはURLを追加します。
 * @param {string} value 入力値
 * @returns {Promise<void>} なし
 */
async function addDomain(value) {
    const response = await sendMessage({ action: 'addDomain', domain: value });
    if (response && response.success) {
        domainInput.value = '';
        await refreshState();
        setStatus('追加しました', false);
    } else {
        setStatus(response?.error || '追加に失敗しました');
    }
}

/**
 * Handle manual add button click.
 * 手動追加ボタンのクリック処理。
 */
addDomainButton.addEventListener('click', async () => {
    const value = domainInput.value.trim();
    if (!value) {
        setStatus('ドメインまたはURLを入力してください');
        return;
    }
    await addDomain(value);
});

/**
 * Handle add current site button click.
 * 現在のサイト追加ボタンのクリック処理。
 */
addCurrentButton.addEventListener('click', async () => {
    setStatus('');
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = tabs[0]?.url || '';
    if (!currentUrl.startsWith('http://') && !currentUrl.startsWith('https://')) {
        setStatus('このページは追加できません');
        return;
    }
    await addDomain(currentUrl);
});

/**
 * Handle all-URL mode toggle.
 * 全URLモードのトグル切り替え処理。
 * @param {Event} event イベントオブジェクト
 */
allModeToggle.addEventListener('change', async (event) => {
    const enabled = event.target.checked;
    const response = await sendMessage({ action: 'toggleCacheBypassMode', enabled });
    if (!response || !response.success) {
        setStatus('切り替えに失敗しました');
        return;
    }
    setStatus(enabled ? '全URLモードを有効化しました' : '全URLモードを無効化しました', false);
});

/**
 * Initialize UI state.
 * UIの初期状態を設定します。
 */
refreshState();
