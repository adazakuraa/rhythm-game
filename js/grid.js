// マス目形式のリズム譜面
import { TECH, DRUM_ROWS } from './patterns.js';
import { JCOLOR } from './judge.js';

const on = (c) => !!c && c !== '.';

/**
 * @param {HTMLElement} mount
 * @param {object} p pattern
 * @param {{mode?:'cajon'|'drums', hidden?:boolean, onCell?:(row:string, step:number)=>void, rows?:object}} opts
 */
export function createGrid(mount, p, opts = {}) {
  const el = document.createElement('div');
  el.className = 'grid';
  mount.appendChild(el);
  let cells = []; // step -> [cell elements]
  let cajonCells = [];
  let cur = -1;
  let pat = p;
  const state = { mode: opts.mode || 'cajon', hidden: !!opts.hidden };

  function groupStartSet(p) {
    const s = new Set();
    if (p.groups) { let a = 0; for (const g of p.groups) { s.add(a * p.sub); a += g; } }
    return s;
  }

  function cellHtml(row, i, content, cls) {
    const beat = i % pat.sub === 0 ? ' beat' : '';
    return `<div class="cell${beat}${cls}" data-row="${row}" data-i="${i}">${content}</div>`;
  }

  function render() {
    const p = pat;
    const gs = groupStartSet(p);
    let html = '';
    for (let b = 0; b < p.bars; b++) {
      html += `<div class="bar-block">`;
      const rows = state.mode === 'drums' && p.drums ? [...DRUM_ROWS, null] : [null];
      for (const row of rows) {
        const key = row ? row.key : 'c';
        html += `<div class="grow${row ? ' drum-row' : ''}"><span class="lbl">${row ? row.short : b + 1}</span><div class="cells">`;
        for (let j = 0; j < p.barSteps; j++) {
          const i = b * p.barSteps + j;
          const grp = gs.has(j) ? ' grp' : '';
          if (row) {
            const v = p.drums[key][i];
            html += cellHtml(key, i, on(v) ? `<i class="d-${v === 'o' ? 'o' : 'x'}"></i>` : '', grp + (on(v) ? ' d-on' : ''));
          } else {
            const c = p.notes[i];
            const acc = p.accent[i] !== '.' && c !== '.' ? ' acc' : '';
            html += cellHtml('c', i, c !== '.' ? '<i></i>' : '', `${grp} n-${c === '.' ? 'r' : c}${acc}`);
          }
        }
        html += `</div></div>`;
      }
      html += `</div>`;
    }
    el.innerHTML = html;
    el.classList.toggle('hidden-notes', state.hidden);
    el.classList.toggle('editable', !!opts.onCell);
    cells = [];
    cajonCells = [];
    el.querySelectorAll('.cell').forEach((c) => {
      const i = +c.dataset.i;
      (cells[i] ||= []).push(c);
      if (c.dataset.row === 'c') cajonCells[i] = c;
    });
    cur = -1;
  }

  if (opts.onCell) {
    el.addEventListener('pointerdown', (e) => {
      const c = e.target.closest('.cell');
      if (!c) return;
      e.preventDefault();
      opts.onCell(c.dataset.row, +c.dataset.i);
    });
  }

  render();

  return {
    el,
    update(p2) { pat = p2; render(); },
    setMode(m) { state.mode = m; render(); },
    setHidden(v) { state.hidden = v; el.classList.toggle('hidden-notes', v); },
    setStep(i) {
      if (cur >= 0 && cells[cur]) cells[cur].forEach((c) => c.classList.remove('now'));
      cur = i;
      if (i >= 0 && cells[i]) cells[i].forEach((c) => c.classList.add('now'));
    },
    mark(i, j) {
      const c = cajonCells[i];
      if (!c) return;
      c.dataset.j = j;
      c.style.setProperty('--jc', JCOLOR[j]);
    },
    clearMarks() {
      for (const c of cajonCells) if (c && c.dataset.j) { delete c.dataset.j; c.style.removeProperty('--jc'); }
    },
  };
}

/** 凡例 */
export function legendHtml(keys = Object.keys(TECH)) {
  return `<div class="legend">${keys.map((k) => `<span class="lg"><span class="cell n-${k} mini"><i></i></span>${TECH[k].short}</span>`).join('')}</div>`;
}
