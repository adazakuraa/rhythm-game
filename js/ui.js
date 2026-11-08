// DOM ヘルパー
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function refs(root) {
  const r = {};
  root.querySelectorAll('[data-ref]').forEach((e) => { r[e.dataset.ref] = e; });
  return r;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
}

let toastTimer;
export function toast(msg, ms = 1800) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export function go(path) {
  const target = '#/' + path;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

export function header(title, backTo = '') {
  return `<header class="top">
    <button class="icon-btn" data-back="${esc(backTo)}" aria-label="戻る">‹</button>
    <h1>${esc(title)}</h1>
    <span class="top-right" data-ref="topRight"></span>
  </header>`;
}

/** header() の戻るボタンを有効化 */
export function bindBack(root) {
  root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => go(b.dataset.back)));
}

export function rankBadge(best) {
  if (!best) return '';
  return `<span class="rank r-${best.rank}">${best.rank}</span>`;
}
