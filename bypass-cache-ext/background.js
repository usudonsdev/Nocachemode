chrome.webNavigation.onCommitted.addListener((details) => {
    // メインフレーム（ページ本体）の読み込みのみ対象とする
    if (details.frameId !== 0) return;

    // 1. ブックマークからの遷移か判定
    if (details.transitionType === 'auto_bookmark') {
        const url = new URL(details.url);

        // 2. 特定のドメインのみを対象にする（ここに利用したいサイトのドメインを入力）
        const targetDomains = ['your-app-domain.com', 'admin.example.net'];

        if (targetDomains.some(domain => url.hostname.includes(domain))) {
            // 3. すでにパラメータが付与されている場合は無視（無限ループ防止）
            if (!url.searchParams.has('_upd_')) {
                // タイムスタンプを付与してキャッシュをバイパス
                url.searchParams.set('_upd_', Date.now());
        
                // パラメータを付与したURLでタブを更新
                chrome.tabs.update(details.tabId, { url: url.toString() });
            }
        }
    }
});