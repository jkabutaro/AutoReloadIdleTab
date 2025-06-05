// ユーザーアクティビティを検出するためのイベントリスナー
let lastActivityTime = Date.now();
let activityTimeout = null;

// アクティビティを報告する関数（デバウンス処理付き）
function reportActivity() {
  // 拡張機能のコンテキストが無効な場合は処理を停止
  if (!isExtensionContextValid()) {
    console.log('Auto Reload Idle Tab: Extension context は無効です - 処理をスキップします');
    return;
  }
  
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
      try {
        chrome.runtime.sendMessage({ type: 'userActivity' }, (response) => {
          // chrome.runtime.lastError をチェック
          if (chrome.runtime.lastError) {
            if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
              console.log('Auto Reload Idle Tab: Extension context invalidated - スクリプトを終了します');
              // イベントリスナーを削除してスクリプトを無効化
              activityEvents.forEach(eventType => {
                document.removeEventListener(eventType, reportActivity, { 
                  passive: true, 
                  capture: true 
                });
              });
              return;
            }
            console.error('Auto Reload Idle Tab: sendMessage エラー:', chrome.runtime.lastError.message);
          }
        });
      } catch (error) {
        // Extension context invalidated の場合は無視
        if (error.message.includes('Extension context invalidated')) {
          console.log('Auto Reload Idle Tab: Extension context invalidated - スクリプトを終了します');
          // イベントリスナーを削除してスクリプトを無効化
          activityEvents.forEach(eventType => {
            document.removeEventListener(eventType, reportActivity, { 
              passive: true, 
              capture: true 
            });
          });
          return;
        }
        console.error('Auto Reload Idle Tab: sendMessage エラー:', error);
      }
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

// 拡張機能のコンテキストが有効かどうかをチェックする関数
function isExtensionContextValid() {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (error) {
    return false;
  }
}

console.log('Auto Reload Idle Tab: コンテンツスクリプトが読み込まれました');

// 楽天証券サイトで自動ログアウトがONなら自動でOFFにする
(function autoDisableRakutenAutoLogout() {
  if (location.hostname !== 'member.rakuten-sec.co.jp') return;

  const disableAutoLogout = () => {
    try {
      // jQueryが利用可能かチェック
      if (typeof $ !== 'undefined' && typeof $.cookie === 'function') {
        // 楽天証券の自動ログアウト機能を完全にOFFにする
        if (typeof window.autoLogoutUsed !== 'undefined') {
          window.autoLogoutUsed = true;
        }
        
        // Cookieで自動ログアウトをOFFに設定
        if (typeof window.autoLogoutStsCookieKey !== 'undefined') {
          $.cookie(window.autoLogoutStsCookieKey, "0");
        }
        
        // グローバル変数を設定
        if (typeof window.autoLogout !== 'undefined') {
          window.autoLogout = false;
        }
        
        // チェックボックスをOFFに設定
        $('#changeAutoLogout').prop("checked", false);
        
        // 要素のIDを変更
        $("a[id^='changeAutoLogout']").attr("id", "member-top-btn-automatic-logout");
        
        // タイマーをリセット
        if (typeof window.reloadtime !== 'undefined') {
          window.reloadtime = +new Date(0);
        }
        
        // タイマーループを再開
        if (typeof window.refreshTimerLoop === 'function') {
          window.refreshTimerLoop();
        }
        
        console.log('Auto Reload Idle Tab: 楽天証券の自動ログアウトを完全にOFFに設定しました');
        return true;
      } else {
        // jQueryが利用できない場合はチェックボックスのみ操作
        const checkbox = document.getElementById('changeAutoLogout');
        if (checkbox && checkbox.checked) {
          checkbox.checked = false;
          // change イベントを発火
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('Auto Reload Idle Tab: 楽天証券の自動ログアウトをOFFに変更しました（基本モード）');
          return true;
        } else if (checkbox && !checkbox.checked) {
          console.log('Auto Reload Idle Tab: 楽天証券の自動ログアウトは既にOFFです');
          return true;
        }
      }
    } catch (error) {
      console.error('Auto Reload Idle Tab: 楽天証券の自動ログアウト設定でエラーが発生:', error);
    }
    return false;
  };

  const run = () => {
    // 自動ログアウト設定の処理
    if (!disableAutoLogout()) {
      // 処理が失敗した場合はMutationObserverで監視
      const observer = new MutationObserver(() => {
        if (disableAutoLogout()) {
          observer.disconnect(); // 処理完了時に監視停止
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      
      // 10秒後に監視を停止（タイムアウト）
      setTimeout(() => {
        observer.disconnect();
        console.log('Auto Reload Idle Tab: 楽天証券の自動ログアウト設定の監視がタイムアウトしました');
      }, 10000);
    }
  };

  // ページ読み込み後に少し遅延させて実行（楽天証券のスクリプト読み込み待ち）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(run, 1000); // 1秒遅延
    });
  } else {
    setTimeout(run, 1000); // 1秒遅延
  }
})();
