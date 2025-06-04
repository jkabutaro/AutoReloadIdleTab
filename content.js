// ユーザーアクティビティを検出するためのイベントリスナー
let lastActivityTime = Date.now();
let activityTimeout = null;

// アクティビティを報告する関数（デバウンス処理付き）
function reportActivity() {
  const now = Date.now();
  
  // 前回のアクティビティから100ms以上経過している場合のみ報告
  if (now - lastActivityTime > 100) {
    lastActivityTime = now;
    
    // 既存のタイムアウトをクリア
    if (activityTimeout) {
      clearTimeout(activityTimeout);
    }
    
    // デバウンス処理：200ms後に実際に報告
    activityTimeout = setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'userActivity' });
    }, 200);
  }
}

// 各種ユーザーアクティビティを監視
const activityEvents = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'dblclick',
  'contextmenu'
];

// イベントリスナーを追加（パッシブ処理で性能向上）
activityEvents.forEach(eventType => {
  document.addEventListener(eventType, reportActivity, { 
    passive: true, 
    capture: true 
  });
});

// ページの可視状態変更を監視
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    reportActivity();
  }
});

// フォーカス状態の変更を監視
window.addEventListener('focus', reportActivity);

// ページロード完了時にアクティビティを報告
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', reportActivity);
} else {
  reportActivity();
}

console.log('Auto Reload Idle Tab: コンテンツスクリプトが読み込まれました'); 