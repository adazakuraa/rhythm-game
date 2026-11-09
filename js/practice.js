// 練習モード：マス目譜面・お手本再生・BPM変更・段階的テンポアップ・リズム分解・耳コピ
import { h, refs, esc, header, bindBack, toast, memory } from './ui.js';
import { getPattern, TECH, DRUM_ROWS, subName } from './patterns.js';
import { createGrid, legendHtml } from './grid.js';
import { createCajon } from './cajon.js';
import { Looper } from './player.js';
import { db } from './storage.js';
import { findNote, judgeDiff, techOk, withTech, inputOffset, WIN, POINTS, JCOLOR, fmtMs } from './judge.js';

export function resolvePattern(id) {
  return id === 'draft' ? memory.draft : getPattern(id);
}

const LESSONS = [
  { label: '① ハイハット', drums: { h: true, s: false, k: false }, cajon: false,
    text: 'まずハイハットだけ。リズムの「細かさ」（8分か16分か）とテンポを感じよう。' },
  { label: '② ＋キック', drums: { h: true, s: false, k: true }, cajon: false,
    text: 'キックを加える。どこで低音が鳴っているか、カホンのベースの位置を確認。' },
  { label: '③ ＋スネア', drums: { h: true, s: true, k: true }, cajon: false,
    text: 'スネアを加えてドラム全体。2・4拍目のバックビートが曲のノリを作る。' },
  { label: '④ カホンへ', drums: { h: false, s: false, k: false }, cajon: true,
    text: 'カホンに置き換え：キック→ベース、スネア→スラップ、ハイハット→ゴースト。実際に叩いてみよう！' },
];

export function practiceScreen(app, id, mode) {
  const p = resolvePattern(id);
  if (!p) { app.innerHTML = header('見つかりません', 'list') + '<p class="pad">パターンが見つかりません。</p>'; bindBack(app); return; }
  const settings = db.settings();
  const backTo = id === 'draft' ? 'edit/draft' : `p/${id}`;
  const st = {
    bpm: p.bpm, guide: mode !== 'ear', metro: true, backing: false,
    hidden: mode === 'ear', tab: mode === 'decomp' && p.drums ? 'decomp' : 'score',
    drums: { h: true, s: true, k: true }, cajonGuide: false,
    tu: { on: false, from: Math.max(40, Math.round(p.bpm * 0.7 / 5) * 5), to: p.bpm, inc: 5, every: 2, needOk: true },
    loopsAtBpm: 0, curLoop: null,
  };

  const root = h(`<div class="screen practice">
    ${header(p.name, backTo)}
    <div class="upper">
      <div class="tabs" data-ref="tabs">
        <button data-tab="score">カホン譜</button>
        ${p.drums ? '<button data-tab="decomp">ドラム分解</button>' : ''}
        <button data-tab="info">解説</button>
      </div>
      <div data-ref="gridWrap" class="grid-wrap"></div>
      <div data-ref="legend">${legendHtml()}</div>
      <div data-ref="decomp" class="decomp"></div>
      <div data-ref="info" class="info"></div>
      <div class="feedback"><span data-ref="judge" class="fb-judge"></span><span data-ref="detail" class="fb-detail"></span></div>
      <div class="loop-info" data-ref="loopInfo">▶ を押すと1小節のカウントのあとに始まります</div>
      <div class="controls">
        <button class="btn primary play" data-ref="play">▶ スタート</button>
        <div class="chips">
          <button class="chip" data-flag="guide">お手本</button>
          <button class="chip" data-flag="metro">メトロノーム</button>
          <button class="chip" data-flag="backing">伴奏</button>
          <button class="chip" data-flag="hidden">譜面かくす</button>
        </div>
      </div>
      <div class="bpm-row">
        <button class="icon-btn" data-ref="minus">−</button>
        <input type="range" min="40" max="240" step="1" data-ref="bpmRange">
        <button class="icon-btn" data-ref="plus">＋</button>
        <span class="bpm-val"><b data-ref="bpmVal"></b> BPM</span>
      </div>
      <details class="tempo-up" data-ref="tuBox">
        <summary>段階的テンポアップ <span data-ref="tuState"></span></summary>
        <div class="tu-grid">
          <label>開始 <input type="number" min="40" max="240" data-tu="from"></label>
          <label>目標 <input type="number" min="40" max="240" data-tu="to"></label>
          <label>上げ幅 <input type="number" min="1" max="30" data-tu="inc"></label>
          <label>何ループごと <input type="number" min="1" max="16" data-tu="every"></label>
          <label class="wide"><input type="checkbox" data-tu="needOk"> 正確さ80%以上のときだけ上げる</label>
          <button class="btn" data-ref="tuToggle"></button>
        </div>
      </details>
    </div>
    <div class="cajon-wrap" data-ref="cajon"></div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);

  // --- 譜面 ---
  const grid = createGrid(r.gridWrap, p, { mode: st.tab === 'decomp' ? 'drums' : 'cajon', hidden: st.hidden });

  // --- 解説 ---
  const used = [...new Set(p.notes.replace(/\./g, ''))].filter((c) => TECH[c]);
  r.info.innerHTML = `
    <p class="meta">${esc(p.sig)} ・ ${subName(p.sub)}の細かさ ・ ${p.bars}小節 ・ 目安 BPM ${p.bpm}${p.swing ? ' ・ ハネ' : ''}</p>
    <p>${esc(p.desc)}</p>
    ${p.tips.length ? `<h3>コツ</h3><ul>${p.tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <h3>使う奏法</h3>
    <ul class="tech-list">${used.map((c) => `<li><span class="cell n-${c} mini"><i></i></span><b>${TECH[c].name}</b>：${esc(TECH[c].how)}</li>`).join('')}</ul>
    <h3>譜面の見かた</h3>
    <p>1マス＝${subName(p.sub)}音符。太い線が拍の区切り。「›」はアクセント（強く）。小さい点はゴースト（弱く）。</p>`;

  // --- 分解 ---
  if (p.drums) {
    r.decomp.innerHTML = `
      <div class="chips">
        ${DRUM_ROWS.map((d) => `<button class="chip" data-drum="${d.key}">${d.name}</button>`).join('')}
        <button class="chip" data-drum="cajon">カホン</button>
      </div>
      <div class="lessons">${LESSONS.map((l, i) => `<button class="btn small" data-lesson="${i}">${l.label}</button>`).join('')}</div>
      <p class="lesson-text" data-ref="lessonText">ドラムの3つのパーツに分けて聴き、カホンにどう置き換わるか理解しよう。</p>
      <ul class="roles">${DRUM_ROWS.map((d) => `<li><b>${d.name}（${d.short}）→ ${TECH[d.cajon].name}</b><br>${esc(d.role)}</li>`).join('')}</ul>`;
  }
  const lessonText = r.decomp.querySelector('[data-ref=lessonText]');

  function syncUI() {
    r.tabs.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === st.tab));
    r.gridWrap.hidden = st.tab === 'info';
    r.legend.hidden = st.tab !== 'score';
    r.decomp.hidden = st.tab !== 'decomp';
    r.info.hidden = st.tab !== 'info';
    root.querySelectorAll('[data-flag]').forEach((b) => {
      const k = b.dataset.flag;
      b.classList.toggle('on', !!st[k]);
      if (k === 'guide') b.hidden = st.tab === 'decomp';
    });
    r.decomp.querySelectorAll('[data-drum]').forEach((b) => {
      const k = b.dataset.drum;
      b.classList.toggle('on', k === 'cajon' ? st.cajonGuide : st.drums[k]);
    });
    r.bpmRange.value = st.bpm;
    r.bpmVal.textContent = st.bpm;
    r.play.textContent = looper.playing ? '■ ストップ' : '▶ スタート';
    r.play.classList.toggle('stop', looper.playing);
    root.querySelectorAll('[data-tu]').forEach((i) => {
      const k = i.dataset.tu;
      if (i.type === 'checkbox') i.checked = st.tu[k]; else i.value = st.tu[k];
    });
    r.tuToggle.textContent = st.tu.on ? 'テンポアップをやめる' : 'この設定でテンポアップ開始';
    r.tuState.textContent = st.tu.on ? `ON（${st.tu.from}→${st.tu.to}）` : '';
  }

  // --- 再生 ---
  const looper = new Looper({
    getPattern: () => p,
    getBpm: () => st.bpm,
    flags: () => ({
      guide: st.tab === 'decomp' ? st.cajonGuide : st.guide,
      drums: st.tab === 'decomp' ? st.drums : null,
      metro: st.metro,
      backing: st.backing,
    }),
    onVisual(ev) {
      if (ev.kind === 'count') {
        showJudge(String(ev.n), '#fff');
        r.detail.textContent = ev.n === ev.total ? 'スタート！' : 'カウント';
      } else if (ev.kind === 'loop') {
        st.curLoop = ev.loop;
        grid.clearMarks();
        for (const n of ev.loop.notes) if (n.j) grid.mark(n.step, n.j);
      } else if (ev.kind === 'step') {
        grid.setStep(ev.step);
        const guideOn = st.tab === 'decomp' ? st.cajonGuide : st.guide;
        if (ev.type !== '.' && guideOn && settings.showHint && !st.hidden) cajon.flash(ev.type, 110);
      }
    },
    onTick(now) {
      const t = now - inputOffset();
      for (const l of looper.loops) if (!l.done && t > l.end + WIN.GOOD + 0.02) finalize(l);
    },
  });

  function finalize(l) {
    l.done = true;
    const hits = l.notes.filter((n) => n.j);
    if (st.tu.on) st.loopsAtBpm++;
    if (!hits.length) {
      if (st.tu.on && !st.tu.needOk) maybeTempoUp(1);
      return;
    }
    const c = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    let sum = 0;
    for (const n of l.notes) { const j = n.j || 'MISS'; c[j]++; sum += POINTS[j]; }
    const acc = l.notes.length ? sum / l.notes.length : 0;
    const pct = Math.round(acc * 100);
    r.loopInfo.innerHTML = `ループ${l.idx + 1}（BPM ${l.bpm}）：<b class="${acc >= 0.8 ? 'good' : ''}">${pct}%</b>
      <span class="cnt">P${c.PERFECT} G${c.GREAT} Go${c.GOOD} M${c.MISS}</span>`;
    if (id !== 'draft') db.recordPractice(id, { acc, bpm: l.bpm });
    if (st.tu.on) maybeTempoUp(acc);
  }

  function maybeTempoUp(acc) {
    if (st.loopsAtBpm < st.tu.every) return;
    if (st.tu.needOk && acc < 0.8) return;
    st.loopsAtBpm = 0;
    if (st.bpm < st.tu.to) {
      st.bpm = Math.min(st.tu.to, st.bpm + st.tu.inc);
      toast(`テンポアップ！ BPM ${st.bpm}`);
      syncUI();
    } else {
      toast(`🎉 目標テンポ ${st.tu.to} をクリア！`, 2500);
      st.tu.on = false;
      syncUI();
    }
  }

  let judgeTimer;
  function showJudge(text, color) {
    r.judge.textContent = text;
    r.judge.style.color = color;
    r.judge.classList.remove('pop');
    void r.judge.offsetWidth;
    r.judge.classList.add('pop');
    clearTimeout(judgeTimer);
    judgeTimer = setTimeout(() => { r.judge.textContent = ''; }, 900);
  }

  // --- カホン ---
  const cajon = createCajon(r.cajon, {
    onHit(type, time) {
      if (!looper.playing) return;
      const t = time - inputOffset();
      const n = findNote(looper.activeNotes(), t, type);
      if (!n) return;
      const d = t - n.t;
      const ok = techOk(n.type, type);
      const j = withTech(judgeDiff(d), ok);
      n.j = j; n.d = d;
      if (n.loop === st.curLoop) grid.mark(n.step, j);
      showJudge(j, JCOLOR[j]);
      const when = Math.abs(d) < 0.02 ? 'ジャスト' : d < 0 ? '早い' : '遅い';
      r.detail.textContent = `${fmtMs(d)} ${when}` + (ok ? '' : ` ／ 奏法：${TECH[n.type].name}を叩こう`);
    },
  });

  // --- イベント ---
  r.play.addEventListener('click', () => {
    if (looper.playing) {
      looper.stop();
      grid.setStep(-1);
    } else {
      if (st.tu.on) { st.bpm = st.tu.from; st.loopsAtBpm = 0; }
      looper.start(true);
    }
    syncUI();
  });
  r.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    st.tab = b.dataset.tab;
    grid.setMode(st.tab === 'decomp' ? 'drums' : 'cajon');
    grid.setHidden(st.hidden && st.tab !== 'decomp');
    syncUI();
  });
  root.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.flag;
    st[k] = !st[k];
    if (k === 'hidden') {
      grid.setHidden(st.hidden);
      if (st.hidden) toast('耳コピ練習：お手本を聴いて、譜面を見ずに叩いてみよう');
    }
    syncUI();
  }));
  r.decomp.addEventListener('click', (e) => {
    const d = e.target.closest('[data-drum]');
    if (d) {
      const k = d.dataset.drum;
      if (k === 'cajon') st.cajonGuide = !st.cajonGuide; else st.drums[k] = !st.drums[k];
      syncUI();
      return;
    }
    const l = e.target.closest('[data-lesson]');
    if (l) {
      const ls = LESSONS[+l.dataset.lesson];
      st.drums = { ...ls.drums };
      st.cajonGuide = ls.cajon;
      if (lessonText) lessonText.textContent = ls.text;
      if (!looper.playing) looper.start(true);
      syncUI();
    }
  });
  const setBpm = (v) => { st.bpm = Math.max(40, Math.min(240, Math.round(v))); syncUI(); };
  r.bpmRange.addEventListener('input', () => setBpm(+r.bpmRange.value));
  r.minus.addEventListener('click', () => setBpm(st.bpm - 1));
  r.plus.addEventListener('click', () => setBpm(st.bpm + 1));
  root.querySelectorAll('[data-tu]').forEach((i) => i.addEventListener('change', () => {
    const k = i.dataset.tu;
    st.tu[k] = i.type === 'checkbox' ? i.checked : Math.max(1, Math.min(240, +i.value || 1));
    syncUI();
  }));
  r.tuToggle.addEventListener('click', () => {
    st.tu.on = !st.tu.on;
    if (st.tu.on) {
      if (st.tu.from > st.tu.to) [st.tu.from, st.tu.to] = [st.tu.to, st.tu.from];
      st.bpm = st.tu.from;
      st.loopsAtBpm = 0;
      toast(`BPM ${st.tu.from} から ${st.tu.every}ループごとに +${st.tu.inc}`);
      if (!looper.playing) looper.start(true);
    }
    syncUI();
  });

  const onPause = () => { looper.stop(); grid.setStep(-1); syncUI(); };
  window.addEventListener('app-pause', onPause);
  syncUI();

  return () => {
    looper.stop();
    cajon.destroy();
    window.removeEventListener('app-pause', onPause);
  };
}
