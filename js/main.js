// エントリーポイント：ハッシュルーター
import { Audio } from './audio.js';
import { homeScreen, listScreen, detailScreen, guideScreen, settingsScreen, songScreen, freeScreen } from './screens.js';
import { practiceScreen } from './practice.js';
import { gameScreen, resultScreen } from './game.js';
import { editorScreen } from './editor.js';

const routes = {
  '': homeScreen,
  list: listScreen,
  p: detailScreen,
  practice: practiceScreen,
  game: gameScreen,
  result: resultScreen,
  edit: editorScreen,
  song: songScreen,
  free: freeScreen,
  guide: guideScreen,
  settings: settingsScreen,
};

let cleanup = null;
function render() {
  const [name, ...args] = location.hash.replace(/^#\/?/, '').split('/');
  try { cleanup?.(); } catch (e) { console.error(e); }
  cleanup = null;
  Audio.stopScheduled();
  const app = document.getElementById('app');
  app.innerHTML = '';
  window.scrollTo(0, 0);
  const fn = routes[name] || routes[''];
  document.body.dataset.screen = routes[name] ? name || 'home' : 'home';
  try {
    cleanup = fn(app, ...args.map(decodeURIComponent)) || null;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="pad"><p>エラーが発生しました。</p><pre class="small">${String(e && e.message)}</pre><button class="btn" onclick="location.hash='#/'">ホームへ</button></div>`;
  }
}

// 最初のユーザー操作でオーディオを起動（自動再生制限対策）
const unlock = () => Audio.init();
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) {
  document.addEventListener(ev, unlock, { capture: true, passive: true });
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) window.dispatchEvent(new Event('app-pause'));
});
// ダブルタップズーム防止（iOS）
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

window.addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}
