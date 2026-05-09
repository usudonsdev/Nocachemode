const domainInput = document.getElementById('domainInput');
const addDomainButton = document.getElementById('addDomain');
const addCurrentButton = document.getElementById('addCurrent');
const domainList = document.getElementById('domainList');
const status = document.getElementById('status');
const allModeToggle = document.getElementById('allMode');

function setStatus(message, isError = true) {
  status.textContent = message;
  status.style.color = isError ? '#d14343' : '#0f766e';
}

function sendMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => resolve(response));
  });
}

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

addDomainButton.addEventListener('click', async () => {
  const value = domainInput.value.trim();
  if (!value) {
    setStatus('ドメインまたはURLを入力してください');
    return;
  }
  await addDomain(value);
});

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

allModeToggle.addEventListener('change', async (event) => {
  const enabled = event.target.checked;
  const response = await sendMessage({ action: 'toggleCacheBypassMode', enabled });
  if (!response || !response.success) {
    setStatus('切り替えに失敗しました');
    return;
  }
  setStatus(enabled ? '全URLモードを有効化しました' : '全URLモードを無効化しました', false);
});

refreshState();
