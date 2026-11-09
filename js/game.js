// 音ゲーモード：横に流れるノーツ＋判定＋スコア／結果画面
import { h, refs, esc, header, bindBack, go, memory } from './ui.js';
import { TECH, stepTime } from './patterns.js';
import { createCajon } from './cajon.js';
import { Audio } from './audio.js';
import { db } from './storage.js';
import { progFor, scheduleBackingBar } from './backing.js';
import { findNote, judgeDiff, techOk, withTech, inputOffset, WIN, POINTS, JCOLOR, rankOf } from './judge.js';
import { resolvePattern } from './practice.js';

const GLYPH = { B: 'ベ', S: 'ス', g: '・', O: 'オ', M: 'ミ' };

export function gameScreen(app, id, pctArg) {
  const p = resolvePattern(id);
  if (!p) { go('list'); return; }
  const s = db.settings();
  const pct = Math.max(30, Math.min(150, +pctArg || 100));
  const bpm = Math.round((p.bpm * pct) / 100);
  const sd = 60 / bpm / p.sub;
  const barDur = p.barSteps * sd;
  const loops = Math.max(1, Math.round(s.gameBars / p.bars));
  const totalBars = loops * p.bars;
  const prog = progFor(p);

  const root = h(`<div class="screen game">
    <div class="game-top">
      <button class="icon-btn" data-ref="quit" aria-label="やめる">✕</button>
      <div class="g-title">${esc(p.name)} <small>BPM ${bpm}</small></div>
      <div class="g-score" data-ref="score">0</div>
    </div>
    <div class="progress"><i data-ref="prog"></i></div>
    <div class="stage" data-ref="stage"><canvas data-ref="cv"></canvas>
      <div class="overlay" data-ref="ov">
        <div class="ov-box">
          <h2>${esc(p.name)}</h2>
          <p>${esc(p.sig)} ・ BPM ${bpm} ・ ${totalBars}小節</p>
          <p class="small">ノーツが左の線に重なった瞬間に、色に対応した位置を叩こう。</p>
          <div class="legend-inline">${Object.keys(TECH).map((k) => `<span style="color:${TECH[k].color}">● ${TECH[k].short}</span>`).join('')}</div>
          <button class="btn primary big" data-ref="startBtn">タップしてスタート</button>
        </div>
      </div>
    </div>
    <div class="cajon-wrap" data-ref="cajon"></div>
  </div>`);
  app.appendChild(root);
  const r = refs(root);
  const cv = r.cv;
  const g2 = cv.getContext('2d');

  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const b = r.stage.getBoundingClientRect();
    W = b.width; H = b.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- ゲーム状態 ----
  let notes = [];
  let start = 0, end = 0;
  let running = false, finished = false;
  let nextBar = -1;
  let timer = 0, raf = 0;
  const stats = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0, combo: 0, maxCombo: 0, sum: 0, wrongTech: 0, diffs: [] };
  const pops = [];
  const bursts = [];

  function build() {
    notes = [];
    for (let L = 0; L < loops; L++) {
      const base = start + L * p.steps * sd;
      for (let i = 0; i < p.steps; i++) {
        const c = p.notes[i];
        if (c === '.') continue;
        notes.push({ t: base + stepTime(p, i, sd), type: c, acc: p.accent[i] !== '.', j: null });
      }
    }
    end = start + totalBars * barDur;
  }

  function begin() {
    Audio.init();
    r.ov.hidden = true;
    start = Audio.now() + 0.6 + p.beats * (60 / bpm);
    build();
    running = true;
    nextBar = -1;
    timer = setInterval(tick, 25);
    tick();
    raf = requestAnimationFrame(frame);
  }

  function tick() {
    const now = Audio.now();
    while (nextBar < totalBars && start + nextBar * barDur < now + 0.3) {
      const bt = start + nextBar * barDur;
      if (nextBar < 0 || s.metroInGame) {
        for (let b = 0; b < p.beats; b++) Audio.play(b === 0 ? 'clickHi' : 'clickLo', bt + b * p.sub * sd, nextBar < 0 ? 1 : 0.7, 'metro');
      }
      if (nextBar >= 0) {
        if (s.backInGame) scheduleBackingBar(prog, nextBar, bt, barDur, p.beats);
        if (s.guideInGame) {
          for (const n of notes) if (n.t >= bt - 1e-6 && n.t < bt + barDur - 1e-6) Audio.play(TECH[n.type].sound, n.t, n.acc ? 0.9 : 0.6, 'guide');
        }
      }
      nextBar++;
    }
    // 見逃し判定
    const t = now - inputOffset();
    for (const n of notes) {
      if (n.j || t <= n.t + WIN.GOOD) continue;
      n.j = 'MISS';
      stats.MISS++;
      stats.combo = 0;
      pop('MISS');
    }
    if (!finished && now > end + 0.9) finish();
  }

  function pop(j, extra = '') {
    pops.push({ text: j, sub: extra, color: JCOLOR[j], born: performance.now() });
    if (pops.length > 4) pops.shift();
  }

  function onHit(type, time) {
    if (!running) return;
    const t = time - inputOffset();
    const n = findNote(notes, t, type);
    if (!n) return;
    const d = t - n.t;
    const ok = techOk(n.type, type);
    const j = withTech(judgeDiff(d), ok);
    n.j = j;
    stats[j]++;
    stats.sum += POINTS[j];
    stats.combo++;
    stats.maxCombo = Math.max(stats.maxCombo, stats.combo);
    stats.diffs.push(d);
    if (!ok) stats.wrongTech++;
    pop(j, ok ? (Math.abs(d) < 0.02 ? '' : d < 0 ? 'FAST' : 'SLOW') : '奏法');
    bursts.push({ color: TECH[n.type].color, born: performance.now() });
  }

  function score() {
    const N = notes.length || 1;
    return Math.round((900000 * stats.sum) / N + (100000 * stats.maxCombo) / N);
  }

  // ---- 描画 ----
  function drawNote(x, y, rad, n) {
    const col = TECH[n.type].color;
    g2.save();
    g2.translate(x, y);
    if (n.acc) { g2.beginPath(); g2.arc(0, 0, rad + 5, 0, Math.PI * 2); g2.strokeStyle = 'rgba(255,255,255,.8)'; g2.lineWidth = 2; g2.stroke(); }
    g2.beginPath();
    if (n.type === 'S') { const q = rad * 0.9; g2.roundRect ? g2.roundRect(-q, -q, q * 2, q * 2, 5) : g2.rect(-q, -q, q * 2, q * 2); }
    else if (n.type === 'M') { g2.moveTo(0, -rad); g2.lineTo(rad, 0); g2.lineTo(0, rad); g2.lineTo(-rad, 0); g2.closePath(); }
    else g2.arc(0, 0, n.type === 'g' ? rad * 0.55 : rad, 0, Math.PI * 2);
    if (n.type === 'O') { g2.fillStyle = 'rgba(0,0,0,.35)'; g2.fill(); g2.lineWidth = 5; g2.strokeStyle = col; g2.stroke(); }
    else { g2.fillStyle = col; g2.fill(); }
    if (n.type !== 'g') {
      g2.fillStyle = n.type === 'O' ? col : '#1a1208';
      g2.font = `bold ${Math.round(rad * 0.95)}px system-ui, sans-serif`;
      g2.textAlign = 'center'; g2.textBaseline = 'middle';
      g2.fillText(GLYPH[n.type], 0, 1);
    }
    g2.restore();
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const tv = Audio.now() - Audio.latency();
    const win = 1.9 / (s.noteSpeed || 1);
    g2.setTransform(dpr, 0, 0, dpr, 0, 0);
    g2.clearRect(0, 0, W, H);
    const jx = Math.max(56, W * 0.16);
    const ly = H * 0.56, lh = Math.min(96, H * 0.5);
    const px = (t) => jx + ((t - tv) / win) * (W - jx);

    // レーン
    g2.fillStyle = 'rgba(255,255,255,.05)';
    g2.fillRect(0, ly - lh / 2, W, lh);
    // 拍線
    const beatDur = p.sub * sd;
    const firstBeat = Math.floor((tv - start) / beatDur) - 1;
    for (let b = firstBeat; ; b++) {
      const t = start + b * beatDur;
      const x = px(t);
      if (x > W) break;
      if (x < 0 || b < 0 || t > end) continue;
      const isBar = b % p.beats === 0;
      g2.fillStyle = isBar ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.1)';
      g2.fillRect(x, ly - lh / 2, isBar ? 2 : 1, lh);
    }
    // 判定ライン
    g2.fillStyle = '#fff';
    g2.fillRect(jx - 2, ly - lh / 2 - 6, 4, lh + 12);
    const nowMs = performance.now();
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], a = (nowMs - b.born) / 250;
      if (a >= 1) { bursts.splice(i, 1); continue; }
      g2.beginPath(); g2.arc(jx, ly, 18 + a * 30, 0, Math.PI * 2);
      g2.strokeStyle = b.color; g2.globalAlpha = 1 - a; g2.lineWidth = 4; g2.stroke(); g2.globalAlpha = 1;
    }
    // ノーツ
    const rad = Math.min(22, lh * 0.3);
    let next = null;
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (n.j) continue;
      const x = px(n.t);
      if (x > W + rad || x < -rad) continue;
      drawNote(x, ly, rad, n);
    }
    for (const n of notes) { if (!n.j) { next = n; break; } }
    if (s.showHint) cajon.hint(next && next.t - tv < 0.45 ? next.type : null);
    // 判定表示
    for (let i = 0; i < pops.length; i++) {
      const pp = pops[i], age = (nowMs - pp.born) / 600;
      if (age >= 1) continue;
      if (i !== pops.length - 1) continue;
      g2.globalAlpha = 1 - age * age;
      g2.fillStyle = pp.color;
      g2.textAlign = 'center';
      g2.font = 'bold 22px system-ui, sans-serif';
      g2.fillText(pp.text, jx + 50, ly - lh / 2 - 18 - age * 8);
      if (pp.sub) { g2.font = 'bold 12px system-ui'; g2.fillText(pp.sub, jx + 50, ly - lh / 2 - 2 - age * 8); }
      g2.globalAlpha = 1;
    }
    // コンボ
    if (stats.combo >= 3) {
      g2.fillStyle = 'rgba(255,255,255,.85)';
      g2.textAlign = 'center';
      g2.font = 'bold 30px system-ui, sans-serif';
      g2.fillText(stats.combo, W * 0.62, ly + lh / 2 + 34);
      g2.font = '11px system-ui'; g2.fillStyle = 'rgba(255,255,255,.6)';
      g2.fillText('COMBO', W * 0.62, ly + lh / 2 + 50);
    }
    // カウントイン
    if (tv < start) {
      const left = Math.ceil((start - tv) / (60 / bpm));
      if (left <= p.beats) {
        g2.fillStyle = '#fff'; g2.textAlign = 'center'; g2.font = 'bold 40px system-ui';
        g2.fillText(left, W / 2, ly - lh / 2 - 14 > 40 ? ly - lh / 2 - 14 : 44);
      }
    }
    r.score.textContent = score().toLocaleString();
    r.prog.style.width = Math.max(0, Math.min(100, ((tv - start) / (end - start)) * 100)) + '%';
  }

  function stop() {
    running = false;
    clearInterval(timer);
    cancelAnimationFrame(raf);
    Audio.stopScheduled();
  }

  function finish() {
    finished = true;
    stop();
    const N = notes.length;
    const sc = score();
    const hitDiffs = stats.diffs;
    const avg = hitDiffs.length ? hitDiffs.reduce((a, b) => a + b, 0) / hitDiffs.length : 0;
    const res = {
      id, name: p.name, bpm, pct, N, score: sc, rank: rankOf(sc), acc: N ? stats.sum / N : 0,
      maxCombo: stats.maxCombo, counts: { PERFECT: stats.PERFECT, GREAT: stats.GREAT, GOOD: stats.GOOD, MISS: stats.MISS },
      wrongTech: stats.wrongTech, avg, fullCombo: stats.MISS === 0,
    };
    res.isNew = id !== 'draft' ? db.recordGame(id, res) : false;
    memory.result = res;
    go('result');
  }

  const cajon = createCajon(r.cajon, { onHit });
  r.startBtn.addEventListener('click', begin);
  r.quit.addEventListener('click', () => { stop(); go(id === 'draft' ? 'edit/draft' : `p/${id}`); });
  const onPause = () => {
    if (!running) return;
    stop();
    r.ov.hidden = false;
    r.ov.querySelector('.ov-box').innerHTML = `<h2>中断しました</h2><p>アプリが裏に回ったため演奏を止めました。</p>
      <button class="btn primary big" data-retry>最初からやり直す</button>`;
    r.ov.querySelector('[data-retry]').addEventListener('click', () => go(`game/${id}/${pct}`));
  };
  window.addEventListener('app-pause', onPause);

  return () => {
    stop();
    cajon.destroy();
    window.removeEventListener('resize', resize);
    window.removeEventListener('app-pause', onPause);
  };
}

export function resultScreen(app) {
  const res = memory.result;
  if (!res) { go(''); return; }
  const avgMs = Math.round(res.avg * 1000);
  const advice = [];
  if (res.counts.MISS > res.N * 0.3) advice.push('見逃しが多め。練習モードでテンポを落として、パターンを体に入れよう。');
  if (res.wrongTech > res.N * 0.15) advice.push('叩く位置（奏法）のちがいが多め。練習モードの「解説」で奏法を確認しよう。');
  if (avgMs > 18) advice.push(`平均 ${avgMs}ms 遅れ気味。音を「待たずに」、拍の頭を感じて叩こう。設定の「タイミング調整」も確認。`);
  if (avgMs < -18) advice.push(`平均 ${-avgMs}ms 早め（走り気味）。メトロノームをよく聴いて落ち着いて。`);
  if (!advice.length) advice.push(res.rank === 'SS' || res.rank === 'S' ? '素晴らしい！ テンポを上げるか、次のレベルに挑戦しよう。' : 'いい調子！ くり返すほど安定していきます。');
  const best = db.best(res.id);
  const root = h(`<div class="screen result">
    ${header('リザルト', res.id === 'draft' ? 'edit/draft' : `p/${res.id}`)}
    <div class="pad">
      <h2 class="r-name">${esc(res.name)} <small>BPM ${res.bpm}</small></h2>
      <div class="rank-big r-${res.rank}">${res.rank}</div>
      ${res.isNew ? '<div class="new-rec">NEW RECORD!</div>' : ''}
      ${res.fullCombo ? '<div class="fc">FULL COMBO</div>' : ''}
      <div class="score-big">${res.score.toLocaleString()}</div>
      <table class="res-table">
        ${Object.entries(res.counts).map(([k, v]) => `<tr><th style="color:${JCOLOR[k]}">${k}</th><td>${v}</td></tr>`).join('')}
        <tr><th>MAX COMBO</th><td>${res.maxCombo} / ${res.N}</td></tr>
        <tr><th>正確さ</th><td>${Math.round(res.acc * 100)}%</td></tr>
        <tr><th>奏法ちがい</th><td>${res.wrongTech}</td></tr>
        <tr><th>平均のズレ</th><td>${avgMs > 0 ? '+' : ''}${avgMs}ms</td></tr>
        ${best ? `<tr><th>自己ベスト</th><td>${best.score.toLocaleString()}（${best.rank}）</td></tr>` : ''}
      </table>
      <div class="advice">${advice.map((a) => `<p>💡 ${esc(a)}</p>`).join('')}</div>
      <div class="btn-col">
        <button class="btn primary big" data-ref="retry">もう一度</button>
        <button class="btn" data-ref="practice">練習モードへ</button>
        <button class="btn" data-ref="list">パターン一覧へ</button>
      </div>
    </div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);
  r.retry.addEventListener('click', () => go(`game/${res.id}/${res.pct}`));
  r.practice.addEventListener('click', () => go(`practice/${res.id}`));
  r.list.addEventListener('click', () => go('list'));
}
