// カホン演奏パッド。叩いた位置で奏法（音色）が変わる。
import { Audio } from './audio.js';
import { TECH } from './patterns.js';
import { db } from './storage.js';

// 位置 → 奏法（上から順に判定。左右上部の角はゴースト）
export const ZONES = [
  { t: 'g', x0: 0, x1: 0.2, y0: 0, y1: 0.42 },
  { t: 'g', x0: 0.8, x1: 1, y0: 0, y1: 0.42 },
  { t: 'S', x0: 0, x1: 1, y0: 0, y1: 0.2 },
  { t: 'O', x0: 0, x1: 1, y0: 0.2, y1: 0.42 },
  { t: 'M', x0: 0, x1: 1, y0: 0.82, y1: 1 },
  { t: 'B', x0: 0, x1: 1, y0: 0.42, y1: 0.82 },
];

export function zoneAt(x, y) {
  for (const z of ZONES) if (x >= z.x0 && x < z.x1 && y >= z.y0 && y < z.y1) return z.t;
  return 'B';
}

const KEYS = { f: 'B', j: 'S', d: 'g', k: 'g', l: 'O', v: 'M', ' ': 'B' };

/**
 * @param {HTMLElement} mount
 * @param {{onHit?:(type:string,time:number)=>void}} opts
 */
export function createCajon(mount, opts = {}) {
  const labels = db.settings().showLabels;
  const el = document.createElement('div');
  el.className = 'cajon' + (labels ? '' : ' no-labels');
  const zonesHtml = ZONES.map((z, i) => {
    const style = `left:${z.x0 * 100}%;top:${z.y0 * 100}%;width:${(z.x1 - z.x0) * 100}%;height:${(z.y1 - z.y0) * 100}%`;
    const label = z.t === 'g' ? (i === 0 ? 'ゴースト' : '') : TECH[z.t].short;
    return `<div class="zone z-${z.t}${z.t === 'g' ? ' z-side' : ''}" data-t="${z.t}" style="${style}"><span>${label}</span></div>`;
  }).join('');
  el.innerHTML = `<div class="cajon-face">${zonesHtml}
    <i class="screw s1"></i><i class="screw s2"></i><i class="screw s3"></i><i class="screw s4"></i>
    <div class="cajon-name" data-ref="name"></div></div>`;
  mount.appendChild(el);
  const face = el.querySelector('.cajon-face');
  const nameEl = el.querySelector('.cajon-name');
  const zoneEls = [...el.querySelectorAll('.zone')];

  let nameTimer;
  function hit(type, px, py) {
    const time = Audio.now();
    Audio.play(TECH[type].sound, 0, 1, 'tap');
    if (px != null) ripple(px, py, type);
    flash(type, 90);
    nameEl.textContent = TECH[type].name;
    nameEl.style.color = TECH[type].color;
    nameEl.classList.add('show');
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => nameEl.classList.remove('show'), 350);
    opts.onHit?.(type, time);
  }

  function onDown(e) {
    e.preventDefault();
    Audio.init();
    const r = face.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    hit(zoneAt(x, y), e.clientX - r.left, e.clientY - r.top);
  }

  function ripple(x, y, type) {
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.borderColor = TECH[type].color;
    face.appendChild(s);
    setTimeout(() => s.remove(), 450);
  }

  function flash(type, ms = 120) {
    for (const z of zoneEls) {
      if (z.dataset.t !== type) continue;
      z.classList.add('lit');
      clearTimeout(z._t);
      z._t = setTimeout(() => z.classList.remove('lit'), ms);
    }
  }

  let hinted = null;
  function hint(type) {
    if (hinted === type) return;
    hinted = type;
    for (const z of zoneEls) z.classList.toggle('hint', !!type && z.dataset.t === type);
  }

  function onKey(e) {
    if (e.repeat || e.target.closest('input,select,textarea')) return;
    const t = KEYS[e.key.toLowerCase()];
    if (t) { e.preventDefault(); Audio.init(); hit(t); }
  }

  face.addEventListener('pointerdown', onDown);
  face.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKey);

  return {
    el,
    flash,
    hint,
    destroy() { window.removeEventListener('keydown', onKey); el.remove(); },
  };
}
