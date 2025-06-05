// デフォルト設定
const DEFAULT_SETTINGS = {
  enabled: true,
  idleTime: 5, // 分
  excludedSites: [],
  siteSpecificSettings: {},
  debugMode: false
};

// タブごとのアイドル時間管理
const tabIdleData = new Map();

// 設定を読み込む
async function loadSettings() {
  const result = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return result;
}

// 設定を保存する
async function saveSettings(settings) {
  await chrome.storage.sync.set(settings);
}

// タブのアイドル時間をリセット
function resetTabIdleTime(tabId) {
  if (tabIdleData.has(tabId)) {
    clearTimeout(tabIdleData.get(tabId).timer);
  }
  
  tabIdleData.set(tabId, {
    lastActivity: Date.now(),
    timer: null
  });
  
  startIdleTimer(tabId);
}

// アイドルタイマーを開始
async function startIdleTimer(tabId) {
  const settings = await loadSettings();
  
  if (!settings.enabled) {
    return;
  }
  
  // 既存のタイマーをクリア
  if (tabIdleData.has(tabId) && tabIdleData.get(tabId).timer) {
    clearTimeout(tabIdleData.get(tabId).timer);
  }
  
  // タブ情報を取得
  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch (error) {
    // タブが存在しない場合は削除
    tabIdleData.delete(tabId);
    return;
  }
  
  // 除外サイトをチェック
  if (isExcludedSite(tab.url, settings.excludedSites)) {
    return;
  }
  
  // サイト固有の設定をチェック
  const idleTime = getSiteSpecificIdleTime(tab.url, settings);
  
  const timer = setTimeout(async () => {
    await reloadTab(tabId);
  }, idleTime * 60 * 1000); // 分を秒に変換
  
  if (tabIdleData.has(tabId)) {
    tabIdleData.get(tabId).timer = timer;
  } else {
    tabIdleData.set(tabId, {
      lastActivity: Date.now(),
      timer: timer
    });
  }
}

// タブをリロード
async function reloadTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      await chrome.tabs.reload(tabId);
      console.log(`タブをリロードしました: ${tab.url}`);
    }
  } catch (error) {
    console.error('タブのリロードに失敗しました:', error);
    tabIdleData.delete(tabId);
  }
}

// 除外サイトかどうかチェック
function isExcludedSite(url, excludedSites) {
  if (!url || !excludedSites) return false;
  
  return excludedSites.some(pattern => {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(url);
    } catch (error) {
      return url.includes(pattern);
    }
  });
}

// サイト固有のアイドル時間を取得
function getSiteSpecificIdleTime(url, settings) {
  if (!url || !settings.siteSpecificSettings) {
    return settings.idleTime;
  }
  
  for (const [pattern, time] of Object.entries(settings.siteSpecificSettings)) {
    try {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      if (regex.test(url)) {
        return time;
      }
    } catch (error) {
      if (url.includes(pattern)) {
        return time;
      }
    }
  }
  
  return settings.idleTime;
}

// イベントリスナー設定
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Auto Reload Idle Tab 拡張機能がインストールされました');
  
  // デフォルト設定を保存
  const settings = await loadSettings();
  await saveSettings({ ...DEFAULT_SETTINGS, ...settings });
});

// コンテンツスクリプトからのメッセージ処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'userActivity' && sender.tab) {
    resetTabIdleTime(sender.tab.id);
  } else if (message.type === 'getSettings') {
    loadSettings().then(settings => sendResponse(settings));
    return true; // 非同期レスポンス
  } else if (message.type === 'saveSettings') {
    saveSettings(message.settings).then(() => sendResponse({ success: true }));
    return true;
  } else if (message.type === 'getRemainingTime') {
    (async () => {
      try {
        const [settings, tab] = await Promise.all([
          loadSettings(),
          chrome.tabs.get(message.tabId)
        ]);
        const idleTime = getSiteSpecificIdleTime(tab.url, settings);
        if (tabIdleData.has(message.tabId)) {
          const { lastActivity } = tabIdleData.get(message.tabId);
          const elapsed = Date.now() - lastActivity;
          const remaining = idleTime * 60 * 1000 - elapsed;
          sendResponse({ remainingTime: remaining });
        } else {
          sendResponse({ remainingTime: null });
        }
      } catch (error) {
        sendResponse({ remainingTime: null });
      }
    })();
    return true;
  }
});

// 設定変更を監視
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'sync' || !changes.enabled) {
    return;
  }

  const { oldValue, newValue } = changes.enabled;

  if (newValue === false) {
    // すべてのタイマーを停止
    for (const data of tabIdleData.values()) {
      if (data.timer) {
        clearTimeout(data.timer);
        data.timer = null;
      }
    }
  } else if (newValue === true && oldValue === false) {
    // 有効化されたら既存タブのタイマーを再開
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      if (tab.id) {
        resetTabIdleTime(tab.id);
      }
    });
  }
});

// タブの変更を監視
chrome.tabs.onActivated.addListener(({ tabId }) => {
  resetTabIdleTime(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    resetTabIdleTime(tabId);
  }
});

// タブが閉じられた時の清理
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabIdleData.has(tabId)) {
    clearTimeout(tabIdleData.get(tabId).timer);
    tabIdleData.delete(tabId);
  }
});

// 拡張機能起動時に既存のタブを初期化
chrome.runtime.onStartup.addListener(async () => {
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    if (tab.id) {
      resetTabIdleTime(tab.id);
    }
  });
}); 