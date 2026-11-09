// リズム研究室：パターンを変形・作成して、リズムを「自分で構成する」力を育てる
import { h, refs, esc, header, bindBack, toast, go, memory } from './ui.js';
import { getPattern, normalize, toRaw, deriveCajon, TECH, TECH_ORDER } from './patterns.js';
import { createGrid, legendHtml } from './grid.js';
import { Looper } from './player.js';
import { db } from './storage.js';

export const SIGS = [
  { id: '4-4', label: '4/4・16分', beats: 4, sub: 4 },
  { id: '4-2', label: '4/4・8分', beats: 4, sub: 2 },
  { id: '4-3', label: '4/4・3連', beats: 4, sub: 3 },
  { id: '3-4', label: '3/4・16分', beats: 3, sub: 4 },
  { id: '3-2', label: '3/4・8分', beats: 3, sub: 2 },
  { id: '2-3', label: '6/8', beats: 2, sub: 3 },
  { id: '7-2', label: '7/8（2+2+3）', beats: 7, sub: 2, groups: [2, 2, 3] },
  { id: '5-2', label: '5/4・8分', beats: 5, sub: 2 },
];
export const sigId = (p) => `${p.beats}-${p.sub}`;

const BLANK = { name: '新しいパターン', bpm: 100, beats: 4, sub: 4, cajon: 'B.g.S.g.B.g.S.g.', accent: '' };

const clean = (s) => (s || '').replace(/[\s|]/g, '');

/** 位置の名前（例：2拍目の裏） */
export function posName(p, i) {
  const bar = Math.floor(i / p.barSteps) + 1;
  const j = i % p.barSteps;
  const beat = Math.floor(j / p.sub) + 1;
  const r = j % p.sub;
  const names = p.sub === 4 ? ['', 'の16分裏', 'の裏', 'の16分裏(後)'] : p.sub === 3 ? ['', 'の3連2つ目', 'の3連3つ目'] : ['', 'の裏'];
  return `${p.bars > 1 ? bar + '小節目 ' : ''}${beat}拍目${names[r] || ''}`;
}

const positions = (notes, set) => [...notes].map((c, i) => (set.includes(c) ? i : -1)).filter((i) => i >= 0).join(',');
const count = (notes, c) => [...notes].filter((x) => x === c).length;
const offbeatHits = (p) => [...p.notes].filter((c, i) => (c === 'B' || c === 'S') && i % p.sub !== 0).length;

const CHALLENGES = [
  { text: 'ベースの位置を1つ以上変えよう', check: (o, c) => positions(o.notes, 'B') !== positions(c.notes, 'B') && count(c.notes, 'B') > 0 },
  { text: 'スラップの位置を変えよう', check: (o, c) => positions(o.notes, 'S') !== positions(c.notes, 'S') && count(c.notes, 'S') > 0 },
  { text: 'ゴーストノートを2つ以上追加しよう', check: (o, c) => count(c.notes, 'g') - count(o.notes, 'g') >= 2 },
  { text: 'アクセントの位置を変えよう', check: (o, c) => o.accent !== c.accent },
  { text: '拍の裏にベースかスラップを置いて、シンコペーションを作ろう', check: (o, c) => offbeatHits(c) > offbeatHits(o) },
  { text: 'オープントーンかミュートを取り入れよう', check: (o, c) => count(c.notes, 'O') + count(c.notes, 'M') > count(o.notes, 'O') + count(o.notes, 'M') },
];

function rawFrom(id) {
  if (id === 'draft' && memory.draft) {
    const raw = toRaw(memory.draft);
    raw.id = memory.draftSrcId || null;
    return raw;
  }
  const p = id ? getPattern(id) : null;
  if (p) {
    const raw = toRaw(p);
    if (p.cat !== 'custom') { raw.id = null; raw.name = `${p.name}（アレンジ）`; raw.desc = `「${p.name}」をもとにアレンジ`; }
    return raw;
  }
  return { ...BLANK };
}

export function editorScreen(app, id) {
  let w = rawFrom(id); // 編集中の生データ
  w.cajon = clean(w.cajon); w.accent = clean(w.accent);
  let cur = normalize({ ...w, id: w.id || 'draft' });
  w.accent = cur.accent;
  const orig = normalize({ ...(id === 'draft' && memory.draftOrig ? memory.draftOrig : w), id: 'orig' });
  const history = [];
  const st = { tool: 'B', target: 'cajon', drumRow: 'k', playing: false, ab: false, metro: true, dirty: id === 'draft' || !w.id };

  const root = h(`<div class="screen editor">
    ${header('リズム研究室', w.id ? `p/${w.id}` : 'home')}
    <div class="pad">
      <label class="field">名前 <input data-ref="name" maxlength="40"></label>
      <div class="row3">
        <label class="field">BPM <input type="number" min="40" max="240" data-ref="bpm"></label>
        <label class="field">拍子 <select data-ref="sig">${SIGS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select></label>
        <label class="field">小節 <select data-ref="bars"><option>1</option><option>2</option><option>4</option></select></label>
      </div>
      <label class="check" data-ref="swingRow"><input type="checkbox" data-ref="swing"> ハネ（スウィング）</label>
      <div class="tabs" data-ref="tabs">
        <button data-target="cajon">カホンを編集</button>
        <button data-target="drums">ドラムから作る</button>
      </div>
      <div data-ref="palette" class="palette"></div>
      <div data-ref="gridWrap" class="grid-wrap"></div>
      <div data-ref="legend">${legendHtml()}</div>
      <div class="controls">
        <button class="btn primary play" data-ref="play">▶ 再生</button>
        <div class="chips">
          <button class="chip" data-ref="ab">元のパターンを聴く</button>
          <button class="chip" data-ref="metro">メトロノーム</button>
        </div>
      </div>
      <h3>変形してみよう</h3>
      <div class="transforms">
        <button class="btn small" data-tf="ghost">ゴーストで埋める</button>
        <button class="btn small" data-tf="noghost">ゴーストを消す</button>
        <button class="btn small" data-tf="kui">食い（前倒し）</button>
        <button class="btn small" data-tf="offacc">裏拍アクセント</button>
        <button class="btn small" data-tf="moveB">ベースを動かす</button>
        <button class="btn small" data-tf="moveS">スラップを動かす</button>
        <button class="btn small" data-tf="undo">1つ戻す</button>
        <button class="btn small" data-tf="reset">最初に戻す</button>
      </div>
      <p class="tf-msg" data-ref="tfMsg">ボタンで自動変形するか、マスを直接タップして編集しよう。</p>
      <h3>お題 <small data-ref="chScore"></small></h3>
      <ul class="challenges" data-ref="ch"></ul>
      <div class="btn-col">
        <button class="btn primary" data-ref="save">マイパターンに保存</button>
        <div class="row2">
          <button class="btn" data-ref="practice">練習モードで叩く</button>
          <button class="btn" data-ref="game">音ゲーで遊ぶ</button>
        </div>
        ${w.id ? '<button class="btn danger" data-ref="del">このマイパターンを削除</button>' : ''}
      </div>
    </div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);

  const grid = createGrid(r.gridWrap, cur, { onCell });

  function rebuild(pushHist = true, prev) {
    if (pushHist && prev) { history.push(prev); if (history.length > 50) history.shift(); }
    cur = normalize({ ...w, id: w.id || 'draft' });
    w.accent = cur.accent;
    grid.update(cur);
    if (st.target === 'drums') grid.setMode('drums');
    st.dirty = true;
    renderChallenges();
  }
  const snapshot = () => JSON.parse(JSON.stringify(w));

  function onCell(row, i) {
    const prev = snapshot();
    if (row === 'c') {
      const a = [...cur.notes], acc = [...cur.accent];
      if (st.tool === 'erase') { a[i] = '.'; acc[i] = '.'; }
      else if (st.tool === 'acc') { if (a[i] !== '.') acc[i] = acc[i] === '.' ? 'x' : '.'; }
      else if (a[i] === st.tool) { a[i] = '.'; acc[i] = '.'; }
      else a[i] = st.tool;
      w.cajon = a.join(''); w.accent = acc.join('');
    } else {
      ensureDrums();
      const a = [...w[row]];
      a[i] = row === 'h' ? (a[i] === '.' ? 'x' : a[i] === 'x' ? 'o' : '.') : a[i] === '.' ? 'x' : '.';
      w[row] = a.join('');
    }
    rebuild(true, prev);
  }

  function ensureDrums() {
    const n = cur.steps;
    for (const k of ['k', 's', 'h']) w[k] = (clean(w[k]) + '.'.repeat(n)).slice(0, n);
  }

  function renderPalette() {
    if (st.target === 'cajon') {
      r.palette.innerHTML = TECH_ORDER.map((k) => `<button class="tool${st.tool === k ? ' on' : ''}" data-tool="${k}" style="--c:${TECH[k].color}"><span class="cell n-${k} mini"><i></i></span>${TECH[k].short}</button>`).join('')
        + `<button class="tool${st.tool === 'acc' ? ' on' : ''}" data-tool="acc">› 強調</button><button class="tool${st.tool === 'erase' ? ' on' : ''}" data-tool="erase">消す</button>`;
    } else {
      r.palette.innerHTML = `<p class="small">ドラムの各行のマスをタップして、キック・スネア・ハイハット（2回でオープン）を置こう。</p>
        <button class="btn small primary" data-convert>ドラム → カホンに変換</button>
        <span class="small">（スネア→スラップ、キック→ベース、ハイハット→ゴースト）</span>`;
    }
  }

  function renderChallenges() {
    let done = 0;
    r.ch.innerHTML = CHALLENGES.map((c) => {
      const ok = c.check(orig, cur);
      if (ok) done++;
      return `<li class="${ok ? 'done' : ''}">${ok ? '✅' : '⬜'} ${esc(c.text)}</li>`;
    }).join('');
    r.chScore.textContent = `${done} / ${CHALLENGES.length}`;
  }

  function syncForm() {
    r.name.value = w.name;
    r.bpm.value = w.bpm;
    r.sig.value = sigId(w);
    r.bars.value = String(cur.bars);
    r.swing.checked = !!w.swing;
    r.swingRow.hidden = w.sub % 2 !== 0;
    r.tabs.querySelectorAll('[data-target]').forEach((b) => b.classList.toggle('on', b.dataset.target === st.target));
    r.legend.hidden = st.target !== 'cajon';
    r.play.textContent = looper.playing ? '■ 停止' : '▶ 再生';
    r.ab.classList.toggle('on', st.ab);
    r.metro.classList.toggle('on', st.metro);
    renderPalette();
  }

  /** 拍子・小節数の変更（小節ごとに内容を保つ） */
  function resize(beats, sub, bars, groups) {
    const prev = snapshot();
    const oldBar = cur.barSteps, newBar = beats * sub;
    const conv = (s) => {
      let out = '';
      for (let b = 0; b < bars; b++) {
        for (let j = 0; j < newBar; j++) {
          const srcBar = b % cur.bars;
          out += j < oldBar ? (s[srcBar * oldBar + j] || '.') : '.';
        }
      }
      return out;
    };
    w.cajon = conv(cur.notes); w.accent = conv(cur.accent);
    if (cur.drums) { w.k = conv(cur.drums.k); w.s = conv(cur.drums.s); w.h = conv(cur.drums.h); }
    w.beats = beats; w.sub = sub;
    if (groups) w.groups = groups; else delete w.groups;
    if (sub % 2) w.swing = 0;
    rebuild(true, prev);
    syncForm();
  }

  // --- 変形 ---
  const TF = {
    ghost() {
      const a = [...cur.notes];
      const stepG = cur.sub === 4 ? 2 : 1;
      let n = 0;
      for (let i = 0; i < a.length; i++) if (a[i] === '.' && i % stepG === 0) { a[i] = 'g'; n++; }
      if (!n) for (let i = 0; i < a.length; i++) if (a[i] === '.') { a[i] = 'g'; n++; }
      w.cajon = a.join('');
      return n ? `ゴーストを${n}個追加。すき間が埋まり、リズムが細かく感じられるようになった。` : 'もう埋める場所がありません。';
    },
    noghost() {
      w.cajon = cur.notes.replace(/g/g, '.');
      return 'ゴーストを消すと、ベースとスラップの「骨格」だけが残る。';
    },
    kui() {
      const a = [...cur.notes], acc = [...cur.accent];
      const shift = cur.sub % 2 === 0 ? cur.sub / 2 : 1;
      const barStart = (cur.bars - 1) * cur.barSteps;
      const cands = [barStart + (cur.beats - 1) * cur.sub, barStart + Math.floor(cur.beats / 2) * cur.sub];
      for (const i of cands) {
        const c = a[i];
        if ((c === 'B' || c === 'S') && i - shift >= 0) {
          a[i] = '.'; acc[i] = '.';
          a[i - shift] = c; acc[i - shift] = 'x';
          w.cajon = a.join(''); w.accent = acc.join('');
          return `${posName(cur, i)}の${TECH[c].name}を、${posName(cur, i - shift)}へ前倒し（食い）。次の拍を先取りする推進力が生まれる。`;
        }
      }
      return '前倒しできる拍頭のベース／スラップが見つかりません。';
    },
    offacc() {
      const acc = [...cur.notes].map((c, i) => (c !== '.' && i % cur.sub !== 0 ? 'x' : '.'));
      w.accent = acc.join('');
      return '裏拍にアクセントを移動。表拍が弱く裏が強いと、跳ねるような推進力が出る。';
    },
    moveB() { return moveRandom('B'); },
    moveS() { return moveRandom('S'); },
  };
  function moveRandom(c) {
    const a = [...cur.notes], acc = [...cur.accent];
    const idx = a.map((x, i) => (x === c ? i : -1)).filter((i) => i > 0);
    for (let tries = 0; tries < 30 && idx.length; tries++) {
      const i = idx[Math.floor(Math.random() * idx.length)];
      const dir = Math.random() < 0.5 ? -1 : 1;
      const j = i + dir;
      if (j < 0 || j >= a.length || (a[j] !== '.' && a[j] !== 'g')) continue;
      a[j] = c; acc[j] = acc[i]; a[i] = '.'; acc[i] = '.';
      w.cajon = a.join(''); w.accent = acc.join('');
      return `${TECH[c].name}を ${posName(cur, i)} → ${posName(cur, j)} に移動。ノリがどう変わったか聴き比べてみよう。`;
    }
    // 動かせなければ追加
    const empty = a.map((x, i) => (x === '.' || x === 'g' ? i : -1)).filter((i) => i >= 0 && i % cur.sub !== 0);
    if (!empty.length) return `${TECH[c].name}を動かせる場所がありません。`;
    const j = empty[Math.floor(Math.random() * empty.length)];
    a[j] = c;
    w.cajon = a.join('');
    return `${posName(cur, j)}に${TECH[c].name}を追加。`;
  }

  // --- 再生 ---
  const looper = new Looper({
    getPattern: () => (st.ab ? orig : cur),
    getBpm: () => (st.ab ? orig.bpm : cur.bpm),
    flags: () => ({ guide: true, metro: st.metro }),
    onVisual(ev) { if (ev.kind === 'step' && !st.ab) grid.setStep(ev.step); },
  });

  // --- イベント ---
  r.name.addEventListener('input', () => { w.name = r.name.value; st.dirty = true; });
  r.bpm.addEventListener('change', () => { w.bpm = Math.max(40, Math.min(240, +r.bpm.value || 100)); r.bpm.value = w.bpm; rebuild(false); });
  r.sig.addEventListener('change', () => { const s = SIGS.find((x) => x.id === r.sig.value); resize(s.beats, s.sub, cur.bars, s.groups); });
  r.bars.addEventListener('change', () => resize(cur.beats, cur.sub, +r.bars.value, cur.groups));
  r.swing.addEventListener('change', () => { w.swing = r.swing.checked ? 0.62 : 0; rebuild(false); });
  r.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-target]');
    if (!b) return;
    st.target = b.dataset.target;
    if (st.target === 'drums') { ensureDrums(); cur = normalize({ ...w, id: w.id || 'draft' }); grid.update(cur); }
    grid.setMode(st.target === 'drums' ? 'drums' : 'cajon');
    syncForm();
  });
  r.palette.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tool]');
    if (t) { st.tool = t.dataset.tool; renderPalette(); return; }
    if (e.target.closest('[data-convert]')) {
      const prev = snapshot();
      ensureDrums();
      w.cajon = deriveCajon(w.k, w.s, w.h);
      w.accent = [...w.cajon].map((c) => (c === 'S' ? 'x' : '.')).join('');
      rebuild(true, prev);
      toast('カホン譜に変換しました。「カホンを編集」で確認しよう');
    }
  });
  root.querySelector('.transforms').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tf]');
    if (!b) return;
    const k = b.dataset.tf;
    if (k === 'undo') {
      if (!history.length) { toast('これ以上戻せません'); return; }
      w = history.pop(); rebuild(false); syncForm(); return;
    }
    if (k === 'reset') { const prev = snapshot(); w = { ...toRaw(orig), id: w.id, name: w.name }; rebuild(true, prev); syncForm(); r.tfMsg.textContent = '最初の状態に戻しました。'; return; }
    const prev = snapshot();
    r.tfMsg.textContent = TF[k]();
    rebuild(true, prev);
  });
  r.play.addEventListener('click', () => { if (looper.playing) { looper.stop(); grid.setStep(-1); } else looper.start(false); syncForm(); });
  r.ab.addEventListener('click', () => { st.ab = !st.ab; if (!looper.playing) looper.start(false); syncForm(); toast(st.ab ? '元のパターンを再生中' : 'アレンジ後を再生中'); });
  r.metro.addEventListener('click', () => { st.metro = !st.metro; syncForm(); });

  function save() {
    if (!w.name.trim()) { toast('名前を入れてください'); return null; }
    if (!w.id) w.id = 'c_' + Date.now().toString(36);
    const raw = toRaw(normalize({ ...w }));
    raw.id = w.id; raw.name = w.name.trim();
    db.saveCustom(raw);
    st.dirty = false;
    return w.id;
  }
  r.save.addEventListener('click', () => { if (save()) toast('マイパターンに保存しました'); });
  function openIn(screen) {
    looper.stop();
    if (w.id && !st.dirty) { go(`${screen}/${w.id}`); return; }
    keepDraft();
    go(`${screen}/draft`);
  }
  r.practice.addEventListener('click', () => openIn('practice'));
  r.game.addEventListener('click', () => openIn('game'));
  r.del?.addEventListener('click', () => {
    if (!confirm('このマイパターンを削除しますか？')) return;
    db.removeCustom(w.id);
    toast('削除しました');
    go('list/custom');
  });

  const onPause = () => { looper.stop(); syncForm(); };
  window.addEventListener('app-pause', onPause);
  // 下書きから戻ってきた場合も同じ内容を保つ
  const keepDraft = () => {
    memory.draft = normalize({ ...w, id: 'draft', name: w.name || '下書き' });
    memory.draftSrcId = w.id || null;
    memory.draftOrig = toRaw(orig);
  };
  keepDraft();
  syncForm();
  renderChallenges();

  return () => {
    looper.stop();
    window.removeEventListener('app-pause', onPause);
    keepDraft();
  };
}

