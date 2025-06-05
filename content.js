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
  'keyup',
  'input',
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

// フォーカスやタブの可視状態の変化ではタイマーをリセットしない

// ページロード完了時にアクティビティを報告
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', reportActivity);
} else {
  reportActivity();
}

console.log('Auto Reload Idle Tab: コンテンツスクリプトが読み込まれました');

// 楽天証券サイトで自動ログアウトがONなら自動でOFFにする
(function autoDisableRakutenAutoLogout() {
  if (location.hostname !== 'member.rakuten-sec.co.jp') return;

  const disable = () => {
    const checkbox = document.getElementById('changeAutoLogout');
    if (checkbox && checkbox.checked) {
      checkbox.click();
      console.log('Auto Reload Idle Tab: 自動ログアウトをOFFにしました');
      return true;
    }
    return Boolean(checkbox);
  };

  const run = () => {
    if (!disable()) {
      const observer = new MutationObserver(() => {
        if (disable()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => observer.disconnect(), 10000);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
