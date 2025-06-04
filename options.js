// DOM要素の取得
const enabledToggle = document.getElementById('enabledToggle');
const enabledToggleContainer = document.querySelector('label[data-state]'); // 自動リロード用
const idleTimeInput = document.getElementById('idleTime');
const debugModeToggle = document.getElementById('debugMode');
const debugModeToggleContainer = debugModeToggle.closest('.toggle-container'); // デバッグモード用
const excludedSiteInput = document.getElementById('excludedSiteInput');
const addExcludedSiteBtn = document.getElementById('addExcludedSite');
const excludedSitesList = document.getElementById('excludedSitesList');
const sitePatternInput = document.getElementById('sitePatternInput');
const siteIdleTimeInput = document.getElementById('siteIdleTimeInput');
const addSiteSpecificBtn = document.getElementById('addSiteSpecific');
const siteSpecificList = document.getElementById('siteSpecificList');
const exportSettingsBtn = document.getElementById('exportSettings');
const importSettingsBtn = document.getElementById('importSettings');
const resetSettingsBtn = document.getElementById('resetSettings');
const importFile = document.getElementById('importFile');
const saveStatus = document.getElementById('saveStatus');
const saveStatusText = document.getElementById('saveStatusText');
const confirmDialog = document.getElementById('confirmDialog');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');

let currentSettings = {};

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

// 保存ステータスを表示
function showSaveStatus(message, isError = false) {
  saveStatusText.textContent = message;
  saveStatus.className = isError ? 'save-status error' : 'save-status';
  saveStatus.style.display = 'block';
  
  setTimeout(() => {
    saveStatus.style.display = 'none';
  }, 3000);
}

// 確認ダイアログを表示
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmDialog.style.display = 'flex';
    
    const handleOk = () => {
      confirmDialog.style.display = 'none';
      confirmOk.removeEventListener('click', handleOk);
      confirmCancel.removeEventListener('click', handleCancel);
      resolve(true);
    };
    
    const handleCancel = () => {
      confirmDialog.style.display = 'none';
      confirmOk.removeEventListener('click', handleOk);
      confirmCancel.removeEventListener('click', handleCancel);
      resolve(false);
    };
    
    confirmOk.addEventListener('click', handleOk);
    confirmCancel.addEventListener('click', handleCancel);
  });
}

// 除外サイトリストを更新
function updateExcludedSitesList() {
  excludedSitesList.innerHTML = '';
  
  // excludedSitesが存在しない、または空の場合の初期化
  if (!currentSettings.excludedSites) {
    currentSettings.excludedSites = [];
  }
  
  if (currentSettings.excludedSites.length === 0) {
    excludedSitesList.innerHTML = '<li style="text-align: center; color: #666; font-style: italic;">除外サイトはありません</li>';
    return;
  }
  
  currentSettings.excludedSites.forEach((pattern, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="site-pattern">${pattern}</span>
      <button class="remove-btn" data-index="${index}">削除</button>
    `;
    
    li.querySelector('.remove-btn').addEventListener('click', async () => {
      currentSettings.excludedSites.splice(index, 1);
      await saveSettings(currentSettings);
      updateExcludedSitesList();
      showSaveStatus('除外サイトを削除しました');
    });
    
    excludedSitesList.appendChild(li);
  });
}

// サイト別設定リストを更新
function updateSiteSpecificList() {
  siteSpecificList.innerHTML = '';
  
  // siteSpecificSettingsが存在しない場合の初期化
  if (!currentSettings.siteSpecificSettings) {
    currentSettings.siteSpecificSettings = {};
  }
  
  if (Object.keys(currentSettings.siteSpecificSettings).length === 0) {
    siteSpecificList.innerHTML = '<div style="text-align: center; color: #666; font-style: italic; padding: 20px;">サイト別設定はありません</div>';
    return;
  }
  
  Object.entries(currentSettings.siteSpecificSettings).forEach(([pattern, time]) => {
    const div = document.createElement('div');
    div.className = 'site-specific-item';
    div.innerHTML = `
      <div class="site-specific-info">
        <span class="site-pattern">${pattern}</span>
        <span class="site-time">${time}分</span>
      </div>
      <button class="remove-btn" data-pattern="${pattern}">削除</button>
    `;
    
    div.querySelector('.remove-btn').addEventListener('click', async () => {
      delete currentSettings.siteSpecificSettings[pattern];
      await saveSettings(currentSettings);
      updateSiteSpecificList();
      showSaveStatus('サイト別設定を削除しました');
    });
    
    siteSpecificList.appendChild(div);
  });
}

// トグルスイッチの状態表示を更新
function updateToggleState(toggleElement, containerElement, isEnabled) {
  if (containerElement) {
    containerElement.setAttribute('data-state', isEnabled ? 'ON' : 'OFF');
  }
}

// UIを初期化
async function initializeUI() {
  currentSettings = await loadSettings();
  
  // 基本設定の初期化
  enabledToggle.checked = currentSettings.enabled === true;
  idleTimeInput.value = currentSettings.idleTime || 5;
  debugModeToggle.checked = currentSettings.debugMode === true;
  
  // トグルスイッチの状態表示を更新
  updateToggleState(enabledToggle, enabledToggleContainer, currentSettings.enabled === true);
  updateToggleState(debugModeToggle, debugModeToggleContainer, currentSettings.debugMode === true);
  
  updateExcludedSitesList();
  updateSiteSpecificList();
}

// 除外サイトを追加
async function addExcludedSite() {
  const pattern = excludedSiteInput.value.trim();
  
  if (!pattern) {
    showSaveStatus('パターンを入力してください', true);
    return;
  }
  
  // excludedSitesが存在しない場合の初期化
  if (!currentSettings.excludedSites) {
    currentSettings.excludedSites = [];
  }
  
  if (currentSettings.excludedSites.includes(pattern)) {
    showSaveStatus('このパターンは既に追加されています', true);
    return;
  }
  
  currentSettings.excludedSites.push(pattern);
  await saveSettings(currentSettings);
  
  excludedSiteInput.value = '';
  updateExcludedSitesList();
  showSaveStatus('除外サイトを追加しました');
}

// サイト別設定を追加
async function addSiteSpecificSetting() {
  const pattern = sitePatternInput.value.trim();
  const time = parseInt(siteIdleTimeInput.value);
  
  if (!pattern) {
    showSaveStatus('サイトパターンを入力してください', true);
    return;
  }
  
  if (!time || time < 1 || time > 120) {
    showSaveStatus('アイドル時間は1〜120分の間で設定してください', true);
    return;
  }
  
  // siteSpecificSettingsが存在しない場合の初期化
  if (!currentSettings.siteSpecificSettings) {
    currentSettings.siteSpecificSettings = {};
  }
  
  currentSettings.siteSpecificSettings[pattern] = time;
  await saveSettings(currentSettings);
  
  sitePatternInput.value = '';
  siteIdleTimeInput.value = '';
  updateSiteSpecificList();
  showSaveStatus('サイト別設定を追加しました');
}

// 設定をエクスポート
function exportSettings() {
  const dataStr = JSON.stringify(currentSettings, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
  
  const exportFileDefaultName = `auto-reload-settings-${new Date().toISOString().split('T')[0]}.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
  
  showSaveStatus('設定をエクスポートしました');
}

// 設定をインポート
function importSettings() {
  importFile.click();
}

// ファイルインポート処理
importFile.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    const importedSettings = JSON.parse(text);
    
    // 設定の妥当性をチェック
    if (typeof importedSettings !== 'object' || !importedSettings.hasOwnProperty('enabled')) {
      throw new Error('無効な設定ファイルです');
    }
    
    const confirmed = await showConfirmDialog('設定のインポート', '現在の設定を上書きしますか？この操作は元に戻せません。');
    
    if (confirmed) {
      currentSettings = { ...currentSettings, ...importedSettings };
      await saveSettings(currentSettings);
      await initializeUI();
      showSaveStatus('設定をインポートしました');
    }
    
  } catch (error) {
    showSaveStatus('設定ファイルの読み込みに失敗しました: ' + error.message, true);
  }
  
  // ファイル入力をリセット
  importFile.value = '';
});

// 設定をリセット
async function resetSettings() {
  const confirmed = await showConfirmDialog('設定のリセット', 'すべての設定をデフォルトに戻しますか？この操作は元に戻せません。');
  
  if (confirmed) {
    const defaultSettings = {
      enabled: true,
      idleTime: 5,
      excludedSites: [],
      siteSpecificSettings: {},
      debugMode: false
    };
    
    currentSettings = defaultSettings;
    await saveSettings(currentSettings);
    await initializeUI();
    showSaveStatus('設定をリセットしました');
  }
}

// イベントリスナーの設定
enabledToggle.addEventListener('change', async () => {
  currentSettings.enabled = enabledToggle.checked;
  await saveSettings(currentSettings);
  updateToggleState(enabledToggle, enabledToggleContainer, enabledToggle.checked);
  showSaveStatus(enabledToggle.checked ? '自動リロードを有効にしました' : '自動リロードを無効にしました');
});

idleTimeInput.addEventListener('change', async () => {
  const value = parseInt(idleTimeInput.value);
  if (value < 1 || value > 120) {
    idleTimeInput.value = currentSettings.idleTime || 5;
    showSaveStatus('アイドル時間は1〜120分の間で設定してください', true);
    return;
  }
  
  currentSettings.idleTime = value;
  await saveSettings(currentSettings);
  showSaveStatus('アイドル時間を保存しました');
});

debugModeToggle.addEventListener('change', async () => {
  currentSettings.debugMode = debugModeToggle.checked;
  await saveSettings(currentSettings);
  updateToggleState(debugModeToggle, debugModeToggleContainer, debugModeToggle.checked);
  showSaveStatus('デバッグモード設定を保存しました');
});

addExcludedSiteBtn.addEventListener('click', addExcludedSite);
excludedSiteInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addExcludedSite();
  }
});

addSiteSpecificBtn.addEventListener('click', addSiteSpecificSetting);
sitePatternInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addSiteSpecificSetting();
  }
});
siteIdleTimeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addSiteSpecificSetting();
  }
});

exportSettingsBtn.addEventListener('click', exportSettings);
importSettingsBtn.addEventListener('click', importSettings);
resetSettingsBtn.addEventListener('click', resetSettings);

// モーダルのクリック外し処理
confirmDialog.addEventListener('click', (e) => {
  if (e.target === confirmDialog) {
    confirmDialog.style.display = 'none';
  }
});

// 初期化
document.addEventListener('DOMContentLoaded', initializeUI); 