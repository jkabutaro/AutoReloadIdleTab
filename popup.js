// DOM要素の取得
const enabledToggle = document.getElementById('enabledToggle');
const idleTimeInput = document.getElementById('idleTime');
const currentTabUrl = document.getElementById('currentTabUrl');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const nextReload = document.getElementById('nextReload');
const reloadTime = document.getElementById('reloadTime');
const manualReloadBtn = document.getElementById('manualReload');
const resetTimerBtn = document.getElementById('resetTimer');
const openOptionsBtn = document.getElementById('openOptions');
const messageDiv = document.getElementById('message');
let countdownInterval = null;

// 設定を読み込む
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getSettings' }, resolve);
  });
}

// 設定を保存する
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'saveSettings', settings }, resolve);
  });
}

// 現在のタブ情報を取得する
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// 残り時間を取得
async function getRemainingTime(tabId) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'getRemainingTime', tabId }, (res) => {
      if (res && typeof res.remainingTime === 'number') {
        resolve(res.remainingTime);
      } else {
        resolve(null);
      }
    });
  });
}

// ミリ秒を「X分YY秒」形式にフォーマット
function formatRemainingTime(ms) {
  if (ms === null) return '不明';
  if (ms <= 0) return 'まもなく';
  const totalSec = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  if (minutes > 0) {
    return `あと${minutes}分${String(seconds).padStart(2, '0')}秒`;
  }
  return `あと${seconds}秒`;
}

// メッセージを表示する
function showMessage(text, isError = false) {
  messageDiv.textContent = text;
  messageDiv.className = isError ? 'message error' : 'message';
  messageDiv.style.display = 'block';
  
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 3000);
}

// URLを短縮表示する
function shortenUrl(url) {
  if (!url) return '不明';
  if (url.length <= 40) return url;
  return url.substring(0, 37) + '...';
}

// タブの状態を更新する
async function updateTabStatus() {
  try {
    const tab = await getCurrentTab();
    const settings = await loadSettings();
    
    currentTabUrl.textContent = shortenUrl(tab.url);
    
    // 除外サイトかどうかチェック
    const isExcluded = isExcludedSite(tab.url, settings.excludedSites);
    const isSystemPage = tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://');
    
    if (!settings.enabled) {
      statusIndicator.className = 'status-indicator disabled';
      statusText.textContent = '無効';
      nextReload.style.display = 'none';
      if (countdownInterval) clearInterval(countdownInterval);
    } else if (isSystemPage) {
      statusIndicator.className = 'status-indicator excluded';
      statusText.textContent = 'システムページ（対象外）';
      nextReload.style.display = 'none';
      if (countdownInterval) clearInterval(countdownInterval);
    } else if (isExcluded) {
      statusIndicator.className = 'status-indicator excluded';
      statusText.textContent = '除外サイト';
      nextReload.style.display = 'none';
      if (countdownInterval) clearInterval(countdownInterval);
    } else {
      statusIndicator.className = 'status-indicator active';
      statusText.textContent = 'アクティブ';

      nextReload.style.display = 'block';
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
      const updateCountdown = async () => {
        const remaining = await getRemainingTime(tab.id);
        reloadTime.textContent = formatRemainingTime(remaining);
      };
      await updateCountdown();
      countdownInterval = setInterval(updateCountdown, 1000);
    }
    
  } catch (error) {
    console.error('タブ状態の更新に失敗:', error);
    statusText.textContent = 'エラー';
    statusIndicator.className = 'status-indicator';
  }
}

// 除外サイトかどうかチェック（popup用）
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

// サイト固有のアイドル時間を取得（popup用）
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

// UIを初期化する
async function initializeUI() {
  const settings = await loadSettings();
  
  enabledToggle.checked = settings.enabled;
  idleTimeInput.value = settings.idleTime;
  
  await updateTabStatus();
}

// イベントリスナーの設定
enabledToggle.addEventListener('change', async () => {
  const settings = await loadSettings();
  settings.enabled = enabledToggle.checked;
  await saveSettings(settings);
  await updateTabStatus();
  
  showMessage(settings.enabled ? '自動リロードを有効にしました' : '自動リロードを無効にしました');
});

idleTimeInput.addEventListener('change', async () => {
  const value = parseInt(idleTimeInput.value);
  if (value < 1 || value > 60) {
    idleTimeInput.value = 5;
    showMessage('アイドル時間は1〜60分の間で設定してください', true);
    return;
  }
  
  const settings = await loadSettings();
  settings.idleTime = value;
  await saveSettings(settings);
  await updateTabStatus();
  
  showMessage('アイドル時間を更新しました');
});

manualReloadBtn.addEventListener('click', async () => {
  try {
    const tab = await getCurrentTab();
    await chrome.tabs.reload(tab.id);
    showMessage('タブをリロードしました');
  } catch (error) {
    showMessage('リロードに失敗しました', true);
  }
});

resetTimerBtn.addEventListener('click', async () => {
  try {
    const tab = await getCurrentTab();
    chrome.runtime.sendMessage({ type: 'userActivity' });
    showMessage('タイマーをリセットしました');
  } catch (error) {
    showMessage('タイマーのリセットに失敗しました', true);
  }
});

openOptionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

// タブが変更された時に状態を更新
chrome.tabs.onActivated.addListener(updateTabStatus);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    updateTabStatus();
  }
});

// 初期化
document.addEventListener('DOMContentLoaded', initializeUI);
window.addEventListener('unload', () => {
  if (countdownInterval) clearInterval(countdownInterval);
});
