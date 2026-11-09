// ホーム・一覧・詳細・奏法ガイド・設定・曲から作成・フリー演奏
import { h, refs, esc, header, bindBack, toast, go, stars, rankBadge, memory } from './ui.js';
import { CATS, byCat, getPattern, TECH, TECH_ORDER, builtinCount, allPatterns, normalize } from './patterns.js';
import { createGrid, legendHtml } from './grid.js';
import { createCajon } from './cajon.js';
import { Audio } from './audio.js';
import { db } from './storage.js';
import { Looper } from './player.js';
import { PROGS } from './backing.js';
import { SIGS } from './editor.js';
import { inputOffset } from './judge.js';

export const APP_VERSION = '0.2（奏法ごとの音量）';

// ---------------- ホーム ----------------
export function homeScreen(app) {
  const all = allPatterns();
  const cleared = all.filter((p) => db.best(p.id)).length;
  const practiced = all.filter((p) => db.practice(p.id)).length;
  const firstTime = !practiced && !cleared;
  const root = h(`<div class="screen home">
    <div class="hero">
      <div class="logo">🥁</div>
      <h1>カホン・リズム道場</h1>
      <p>叩いて、聴いて、リズムの仕組みがわかる</p>
    </div>
    <div class="pad">
      <div class="summary">
        <div><b>${practiced}</b><span>練習した</span></div>
        <div><b>${cleared}</b><span>音ゲー記録</span></div>
        <div><b>${builtinCount}</b><span>収録パターン</span></div>
      </div>
      ${firstTime ? '<p class="hint-box">はじめての方は「奏法ガイド」でカホンの叩き方を確認しましょう。🔈 音量を上げ、マナーモードを解除してください。</p>' : ''}
      <nav class="menu">
        <button class="menu-btn main" data-go="list"><span>🎼</span><b>パターンで練習・音ゲー</b><small>8ビートからボカロまで</small></button>
        <button class="menu-btn" data-go="guide"><span>✋</span><b>奏法ガイド</b><small>5つの叩き方と聴き分けクイズ</small></button>
        <button class="menu-btn" data-go="edit"><span>🧪</span><b>リズム研究室</b><small>変形・アレンジ・ドラムから作る</small></button>
        <button class="menu-btn" data-go="song"><span>🎵</span><b>曲に合わせて作る</b><small>BPMと拍子からオリジナル譜面</small></button>
        <button class="menu-btn" data-go="free"><span>🎤</span><b>フリー演奏</b><small>伴奏に合わせて即興</small></button>
        <button class="menu-btn" data-go="settings"><span>⚙️</span><b>設定</b><small>音量・タイミング調整</small></button>
      </nav>
    </div>
  </div>`);
  app.appendChild(root);
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

// ---------------- 一覧 ----------------
export function listScreen(app, cat = 'basic') {
  const root = h(`<div class="screen list">
    ${header('パターン一覧', '')}
    <div class="tabs scroll" data-ref="tabs">${CATS.map((c) => `<button data-cat="${c.id}" class="${c.id === cat ? 'on' : ''}">${c.name}</button>`).join('')}</div>
    <div class="pad cards" data-ref="cards"></div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);
  const list = byCat(cat);
  r.cards.innerHTML = list.map((p) => {
    const best = db.best(p.id), pr = db.practice(p.id);
    return `<button class="card" data-id="${esc(p.id)}">
      <div class="card-main"><b>${esc(p.name)}</b>
        <small>${stars(p.level)} ・ ${esc(p.sig)} ・ BPM ${p.bpm}</small></div>
      <div class="card-side">${rankBadge(best)}${pr ? `<span class="pr" title="練習の最高正確さ">${Math.round(pr.bestAcc * 100)}%</span>` : ''}</div>
    </button>`;
  }).join('') + (cat === 'custom'
    ? `<button class="card add" data-new>＋ 新しいパターンを作る</button>${list.length ? '' : '<p class="small">研究室でアレンジしたり、「曲に合わせて作る」で作ったパターンがここに保存されます。</p>'}`
    : '');
  r.tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) go(`list/${b.dataset.cat}`); });
  r.cards.addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) { go('edit'); return; }
    const c = e.target.closest('[data-id]');
    if (c) go(`p/${c.dataset.id}`);
  });
}

// ---------------- 詳細 ----------------
export function detailScreen(app, id) {
  const p = getPattern(id);
  if (!p) { go('list'); return; }
  const best = db.best(id), pr = db.practice(id);
  const root = h(`<div class="screen detail">
    ${header(p.name, `list/${p.cat}`)}
    <div class="pad">
      <p class="meta">${stars(p.level)} ・ ${esc(p.sig)} ・ BPM ${p.bpm} ・ ${p.bars}小節${p.swing ? ' ・ ハネ' : ''}</p>
      <p>${esc(p.desc)}</p>
      <div data-ref="grid" class="grid-wrap"></div>
      ${legendHtml()}
      <div class="stats">
        <div><span>自己ベスト</span><b>${best ? `${best.score.toLocaleString()} ${rankBadge(best)}` : '—'}</b></div>
        <div><span>練習</span><b>${pr ? `${pr.loops}ループ / 最高${Math.round(pr.bestAcc * 100)}%` : '—'}</b></div>
        <div><span>クリアBPM</span><b>${pr?.clearBpm ? pr.clearBpm : '—'}</b></div>
      </div>
      <div class="btn-col">
        <button class="btn primary big" data-go="practice/${esc(id)}">🎼 練習する</button>
        <div class="game-row">
          <button class="btn big" data-go="game/${esc(id)}/100">🎮 音ゲー</button>
          <select data-ref="pct" aria-label="テンポ">
            <option value="70">70%</option><option value="85">85%</option><option value="100" selected>100%</option><option value="115">115%</option>
          </select>
        </div>
        ${p.drums ? `<button class="btn" data-go="practice/${esc(id)}/decomp">🥁 ドラムに分解して学ぶ</button>` : ''}
        <button class="btn" data-go="practice/${esc(id)}/ear">👂 耳コピに挑戦（譜面なし）</button>
        <button class="btn" data-go="edit/${esc(id)}">🧪 ${p.cat === 'custom' ? '編集する' : 'アレンジする'}</button>
      </div>
    </div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);
  createGrid(r.grid, p);
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
    let to = b.dataset.go;
    if (to.startsWith('game/')) to = `game/${id}/${r.pct.value}`;
    go(to);
  }));
}

// ---------------- 奏法ガイド ----------------
export function guideScreen(app) {
  const root = h(`<div class="screen guide">
    ${header('奏法ガイド', '')}
    <div class="upper pad">
      <p class="small">画面のカホンは、上が「上端（叩く面の上の縁）」、下が「足元側」です。叩く位置で音が変わります。</p>
      <ul class="tech-cards">${TECH_ORDER.map((k) => `<li style="--c:${TECH[k].color}">
        <div class="tc-head"><span class="cell n-${k} mini"><i></i></span><b>${TECH[k].name}</b>
        <button class="btn small" data-play="${k}">▶ 音</button></div>
        <p>${esc(TECH[k].how)}</p>
        <p class="small">アプリでは：${zoneText(k)}</p></li>`).join('')}</ul>
      <div class="quiz">
        <button class="btn primary" data-ref="quiz">👂 聴き分けクイズ</button>
        <span data-ref="quizMsg" class="small">音を聴いて、同じ奏法の場所を叩こう</span>
      </div>
    </div>
    <div class="cajon-wrap" data-ref="cajon"></div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);
  const quiz = { on: false, ans: null, n: 0, ok: 0 };
  const cajon = createCajon(r.cajon, {
    onHit(type) {
      if (!quiz.on || !quiz.ans) return;
      quiz.n++;
      if (type === quiz.ans) { quiz.ok++; r.quizMsg.textContent = `⭕ 正解！ ${TECH[type].name}（${quiz.ok}/${quiz.n}）`; }
      else r.quizMsg.textContent = `❌ 正解は ${TECH[quiz.ans].name}（${quiz.ok}/${quiz.n}）`;
      cajon.flash(quiz.ans, 600);
      quiz.ans = null;
      setTimeout(ask, 1200);
    },
  });
  function ask() {
    if (!quiz.on || !root.isConnected) return;
    const keys = TECH_ORDER;
    quiz.ans = keys[Math.floor(Math.random() * keys.length)];
    Audio.play(TECH[quiz.ans].sound, Audio.now() + 0.05, 1, 'guide');
    r.quizMsg.textContent = `第${quiz.n + 1}問：今の音はどれ？（もう一度聴く→ボタン）`;
  }
  r.quiz.addEventListener('click', () => {
    Audio.init();
    if (quiz.on && quiz.ans) { Audio.play(TECH[quiz.ans].sound, Audio.now() + 0.05, 1, 'guide'); return; }
    quiz.on = true;
    r.quiz.textContent = '🔁 もう一度聴く';
    ask();
  });
  root.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
    Audio.init();
    const k = b.dataset.play;
    Audio.play(TECH[k].sound, 0, 1, 'tap');
    cajon.flash(k, 400);
  }));
  return () => { quiz.on = false; cajon.destroy(); };
}

function zoneText(k) {
  return { B: 'カホンの中央', S: '一番上の帯', g: '上部の左右の端', O: '上から2番目の帯', M: '一番下の帯' }[k];
}

// ---------------- 設定 ----------------
export function settingsScreen(app) {
  const s = db.settings();
  const vol = (k, label) => `<label class="field">${label}<input type="range" min="0" max="1" step="0.05" data-set="${k}" value="${s[k]}"></label>`;
  const chk = (k, label) => `<label class="check"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''}> ${label}</label>`;
  const root = h(`<div class="screen settings">
    ${header('設定', '')}
    <div class="pad">
      <h3>音量</h3>
      ${vol('volTap', '自分のタップ音（全体）')}${vol('volGuide', 'お手本・ドラム')}${vol('volMetro', 'メトロノーム')}${vol('volBack', '伴奏')}
      <h3>奏法ごとの音量</h3>
      <p class="small">タップ音・お手本の両方に反映されます。100%が標準、最大200%。▶で試し聴き。</p>
      ${TECH_ORDER.map((k) => `<div class="tech-vol" style="--c:${TECH[k].color}">
        <span class="cell n-${k} mini"><i></i></span><b>${TECH[k].short}</b>
        <input type="range" min="0" max="2" step="0.05" data-set="vol${k}" value="${s['vol' + k] ?? 1}" aria-label="${TECH[k].name}の音量">
        <span class="tv-val" data-tv="vol${k}"></span>
        <button class="btn small" data-try="${k}">▶</button></div>`).join('')}
      <button class="btn small" data-ref="techReset">奏法ごとの音量を標準に戻す</button>
      <h3>タイミング調整</h3>
      <p class="small">タップの判定が「いつも遅い／早い」と感じたら調整します。Bluetoothイヤホンは遅延が大きいので有線かスピーカー推奨。</p>
      <label class="check"><input type="checkbox" data-ref="auto" ${s.offsetMs == null ? 'checked' : ''}> 自動（ブラウザの推定値：<span data-ref="autoVal"></span>ms）</label>
      <label class="field">補正 <b data-ref="offVal"></b>ms<input type="range" min="-80" max="300" step="1" data-ref="off"></label>
      <button class="btn" data-ref="calib">🎯 タップで自動測定</button>
      <div class="calib" data-ref="calibBox" hidden>
        <p data-ref="calibMsg">クリック音に合わせて、下のボタンを叩いてください（16回）</p>
        <button class="calib-pad" data-ref="calibPad">ここをタップ</button>
      </div>
      <h3>判定</h3>
      <label class="field">奏法の判定
        <select data-set="judgeMode">
          <option value="normal">ふつう（奏法も判定）</option>
          <option value="easy">かんたん（高い音／低い音だけ）</option>
          <option value="timing">タイミングのみ</option>
        </select></label>
      <h3>音ゲー</h3>
      <label class="field">ノーツの速さ <b data-ref="spdVal"></b><input type="range" min="0.5" max="2" step="0.1" data-set="noteSpeed" value="${s.noteSpeed}"></label>
      <label class="field">演奏の長さ
        <select data-set="gameBars"><option value="4">4小節</option><option value="8">8小節</option><option value="16">16小節</option></select></label>
      ${chk('metroInGame', 'メトロノームを鳴らす')}${chk('backInGame', '伴奏を鳴らす')}${chk('guideInGame', 'お手本の音を鳴らす')}
      <h3>表示</h3>
      ${chk('showLabels', 'カホンに奏法名を表示')}${chk('showHint', '叩く位置を光らせる（ガイド）')}
      <h3>データ</h3>
      <p class="small">進捗はこの端末のブラウザに保存されます。機種変更の前にバックアップしてください。</p>
      <div class="row2"><button class="btn" data-ref="exp">バックアップを表示</button><button class="btn" data-ref="imp">復元する</button></div>
      <textarea data-ref="ta" rows="4" hidden placeholder="バックアップの文字列"></textarea>
      <button class="btn danger" data-ref="reset">すべてのデータを消去</button>
      <p class="small credit">音色はすべてブラウザ内で合成しています。収録パターン・伴奏はすべてオリジナルです。<br>バージョン ${APP_VERSION}</p>
    </div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);
  root.querySelector('[data-set=judgeMode]').value = s.judgeMode;
  root.querySelector('[data-set=gameBars]').value = String(s.gameBars);

  function syncOffset() {
    const auto = db.settings().offsetMs == null;
    const autoMs = Math.round(Audio.latency() * 1000);
    r.autoVal.textContent = Audio.ready ? autoMs : '?';
    const v = auto ? autoMs : db.settings().offsetMs;
    r.off.value = v; r.offVal.textContent = v;
    r.off.disabled = auto;
    r.spdVal.textContent = db.settings().noteSpeed.toFixed(1);
    root.querySelectorAll('[data-tv]').forEach((e) => { e.textContent = Math.round((db.settings()[e.dataset.tv] ?? 1) * 100) + '%'; });
  }
  syncOffset();

  root.querySelectorAll('[data-set]').forEach((el) => el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
    const k = el.dataset.set;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'range' || k === 'gameBars') v = +v;
    db.set(k, v);
    Audio.applyVolumes();
    syncOffset();
  }));
  root.querySelectorAll('[data-try]').forEach((b) => b.addEventListener('click', () => {
    Audio.init();
    Audio.play(TECH[b.dataset.try].sound, 0, 1, 'tap');
  }));
  // スライダーを離したときに試し聴き
  root.querySelectorAll('.tech-vol input').forEach((el) => el.addEventListener('change', () => {
    Audio.play(TECH[el.dataset.set.slice(3)].sound, 0, 1, 'tap');
  }));
  r.techReset.addEventListener('click', () => {
    const def = { volB: 1.3, volS: 1, volg: 1, volO: 1, volM: 1 };
    for (const [k, v] of Object.entries(def)) { db.set(k, v); root.querySelector(`[data-set=${k}]`).value = v; }
    syncOffset();
    toast('標準の音量に戻しました');
  });
  r.auto.addEventListener('change', () => { db.set('offsetMs', r.auto.checked ? null : Math.round(Audio.latency() * 1000)); syncOffset(); });
  r.off.addEventListener('input', () => { db.set('offsetMs', +r.off.value); syncOffset(); });

  // 自動測定
  let cal = null;
  r.calib.addEventListener('click', () => {
    Audio.init();
    r.calibBox.hidden = false;
    const bd = 0.6, N = 16;
    const t0 = Audio.now() + 0.5;
    const clicks = [];
    for (let i = 0; i < N; i++) { clicks.push(t0 + i * bd); Audio.play(i % 4 === 0 ? 'clickHi' : 'clickLo', t0 + i * bd, 1, 'metro'); }
    cal = { clicks, taps: [] };
    r.calibMsg.textContent = '最初の4回は聴くだけ、5回目から合わせて叩いてください…';
    setTimeout(() => {
      if (!cal) return;
      const diffs = [];
      for (const t of cal.taps) {
        let best = null;
        for (let i = 4; i < N; i++) { const d = t - cal.clicks[i]; if (Math.abs(d) < 0.25 && (best == null || Math.abs(d) < Math.abs(best))) best = d; }
        if (best != null) diffs.push(best);
      }
      cal = null;
      if (diffs.length < 6) { r.calibMsg.textContent = 'うまく測れませんでした。もう一度お試しください。'; return; }
      diffs.sort((a, b) => a - b);
      const med = diffs[Math.floor(diffs.length / 2)];
      const ms = Math.round(med * 1000);
      db.set('offsetMs', ms);
      r.auto.checked = false;
      syncOffset();
      r.calibMsg.textContent = `測定完了：補正 ${ms}ms に設定しました（${diffs.length}回）`;
    }, (0.5 + N * bd + 0.4) * 1000);
  });
  r.calibPad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!cal) return;
    cal.taps.push(Audio.now());
    Audio.play('slap', 0, 0.6, 'tap');
    r.calibPad.classList.add('lit');
    setTimeout(() => r.calibPad.classList.remove('lit'), 80);
  });

  r.exp.addEventListener('click', () => { r.ta.hidden = false; r.ta.value = db.exportJSON(); r.ta.select(); toast('文字列をコピーして保管してください'); });
  r.imp.addEventListener('click', () => {
    if (r.ta.hidden) { r.ta.hidden = false; r.ta.value = ''; toast('バックアップの文字列を貼り付けて、もう一度「復元する」'); return; }
    try { db.importJSON(r.ta.value); toast('復元しました'); go(''); } catch { toast('文字列が正しくありません'); }
  });
  r.reset.addEventListener('click', () => { if (confirm('記録・マイパターン・設定をすべて消去しますか？')) { db.reset(); toast('消去しました'); go(''); } });
}

// ---------------- 曲に合わせて作る ----------------
const STYLES = {
  '8beat': { name: '8ビート（ロック・ポップス）', bar: 'B.g.S.g.B.B.S.g.' },
  '16beat': { name: '16ビート（J-POP）', bar: 'B.gBS.gBg.B.S.gg' },
  hane: { name: 'ハネる16ビート', bar: 'BgggSgBgBgggSggg', swing: 0.62 },
  '4uchi': { name: '4つ打ち（ダンス・アニソン）', bar: 'B.O.S.O.B.O.S.O.' },
  '2beat': { name: '疾走2ビート', bar: 'B.S.B.S.B.S.B.S.' },
  half: { name: 'ハーフタイム（ゆったり）', bar: 'B.g.g.gBS.B.g.g.' },
  ballad: { name: 'バラード', bar: 'B.g.S.gB..B.O.g.' },
};

function seeded(str) {
  let x = 2166136261;
  for (const ch of str) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  return () => { x = Math.imul(x ^ (x >>> 15), 2246822507); x = Math.imul(x ^ (x >>> 13), 3266489909); return ((x ^= x >>> 16) >>> 0) / 4294967296; };
}

function genBar(beats, sub, style) {
  const n = beats * sub;
  if (beats === 4) {
    const src = STYLES[style].bar; // 16分基準
    if (sub === 4) return src;
    if (sub === 2) return [...src].filter((_, i) => i % 2 === 0).join('');
    // 3連：拍ごとに頭・3つ目を使う
    let out = '';
    for (let b = 0; b < 4; b++) out += src[b * 4] + '.' + (src[b * 4 + 2] === '.' ? '.' : 'g');
    return out;
  }
  const a = Array(n).fill('.');
  for (let b = 0; b < beats; b++) {
    const i = b * sub;
    a[i] = b === 0 ? 'B' : beats === 2 ? 'S' : beats === 7 ? (b === 2 || b === 4 ? 'S' : b === 0 ? 'B' : 'g') : b % 2 ? 'S' : 'B';
    for (let k = 1; k < sub; k += sub === 4 ? 2 : 1) if (a[i + k] === '.') a[i + k] = 'g';
  }
  if (beats === 3) { a[2 * sub] = 'S'; }
  return a.join('');
}

export function songScreen(app) {
  const root = h(`<div class="screen song">
    ${header('曲に合わせて作る', '')}
    <div class="pad">
      <p class="small">好きな曲のテンポと拍子を入れると、その曲に合わせて叩ける<b>オリジナルの練習パターン</b>を作ります。市販楽曲の音源や譜面は使いません。</p>
      <label class="field">曲名（メモ） <input data-ref="title" maxlength="40" placeholder="例：好きなアニメのOP"></label>
      <div class="row2">
        <label class="field">BPM <input type="number" min="40" max="240" value="120" data-ref="bpm"></label>
        <button class="btn tap-tempo" data-ref="tap">👆 タップでBPM測定</button>
      </div>
      <p class="small" data-ref="tapMsg">曲を流しながら、拍に合わせて「タップでBPM測定」を4回以上押すとBPMを測れます。</p>
      <label class="field">拍子 <select data-ref="sig">${SIGS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select></label>
      <label class="field" data-ref="styleRow">スタイル <select data-ref="style">${Object.entries(STYLES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
      <label class="field">小節数 <select data-ref="bars"><option>1</option><option selected>2</option><option>4</option></select></label>
      <label class="check"><input type="checkbox" data-ref="fill" checked> 最後の小節にフィルインを入れる</label>
      <button class="btn primary big" data-ref="make">パターンを作る → 研究室で編集</button>
    </div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);
  const syncStyle = () => { r.styleRow.hidden = !r.sig.value.startsWith('4-'); };
  r.sig.addEventListener('change', syncStyle);
  syncStyle();

  let taps = [];
  r.tap.addEventListener('click', () => {
    Audio.init();
    Audio.play('clickHi', 0, 0.7, 'tap');
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps = [];
    taps.push(now);
    if (taps.length >= 4) {
      const span = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
      const bpm = Math.round(60000 / span);
      r.bpm.value = Math.max(40, Math.min(240, bpm));
      r.tapMsg.textContent = `測定中… BPM ${bpm}（${taps.length}回）`;
    } else r.tapMsg.textContent = `あと${4 - taps.length}回…`;
  });

  r.make.addEventListener('click', () => {
    const sig = SIGS.find((s) => s.id === r.sig.value);
    const style = sig.beats === 4 ? r.style.value : null;
    const bars = +r.bars.value;
    const title = r.title.value.trim();
    const rnd = seeded(`${title}|${r.bpm.value}|${sig.id}|${style}`);
    const base = genBar(sig.beats, sig.sub, style || '8beat');
    const n = sig.beats * sig.sub;
    let notes = '', accent = '';
    for (let b = 0; b < bars; b++) {
      const a = [...base];
      const acc = a.map((c) => (c === 'S' ? 'x' : '.'));
      // 2小節目以降は少し変化（曲名から決まるので同じ曲なら同じパターン）
      if (b % 2 === 1) {
        const empties = a.map((c, i) => (c === '.' || c === 'g' ? i : -1)).filter((i) => i > 0 && i % sig.sub !== 0);
        if (empties.length) a[empties[Math.floor(rnd() * empties.length)]] = 'B';
      }
      if (r.fill.checked && b === bars - 1) {
        const from = n - sig.sub;
        for (let i = from; i < n; i++) {
          const k = i - from;
          a[i] = sig.sub === 4 ? (k < 2 ? 'S' : 'O') : 'S';
          acc[i] = 'x';
        }
        if (sig.sub === 4 && bars > 1) { a[from - 2] = 'S'; acc[from - 2] = 'x'; }
      }
      notes += a.join(''); accent += acc.join('');
    }
    const raw = {
      id: 'draft', cat: 'custom', level: 2,
      name: title ? `${title} 用パターン` : `オリジナル（BPM ${r.bpm.value}）`,
      bpm: Math.max(40, Math.min(240, +r.bpm.value || 120)),
      beats: sig.beats, sub: sig.sub, groups: sig.groups, swing: style ? STYLES[style].swing || 0 : 0,
      cajon: notes, accent, prog: style === '4uchi' || style === '2beat' ? 'komuro' : 'ohdo',
      desc: `${title || 'この曲'}のテンポ・拍子に合わせて作ったオリジナル練習パターン（${style ? STYLES[style].name : sig.label}）`,
    };
    memory.draft = normalize(raw);
    memory.draftSrcId = null;
    memory.draftOrig = raw;
    go('edit/draft');
  });
}

// ---------------- フリー演奏 ----------------
export function freeScreen(app) {
  const st = { bpm: 100, sig: '4-4', metro: true, backing: true, prog: 'ohdo', res: 4, hits: 0, absSum: 0, n: 0 };
  const root = h(`<div class="screen free">
    ${header('フリー演奏', '')}
    <div class="upper pad">
      <div class="row3">
        <label class="field">BPM <input type="number" min="40" max="240" data-ref="bpm" value="100"></label>
        <label class="field">拍子 <select data-ref="sig"><option value="4-4">4/4</option><option value="3-4">3/4</option><option value="2-3">6/8</option></select></label>
        <label class="field">コード <select data-ref="prog">${Object.entries(PROGS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
      </div>
      <div class="controls">
        <button class="btn primary play" data-ref="play">▶ スタート</button>
        <div class="chips">
          <button class="chip on" data-ref="metro">メトロノーム</button>
          <button class="chip on" data-ref="backing">伴奏</button>
          <button class="chip" data-ref="res">ズレ基準：16分</button>
        </div>
      </div>
      <div class="meter"><div class="meter-bar"><i class="center"></i><i class="needle" data-ref="needle"></i></div>
        <div class="meter-txt"><span>早い</span><b data-ref="dev">—</b><span>遅い</span></div></div>
      <p class="small" data-ref="statTxt">伴奏に合わせて自由に叩こう。メーターは一番近い拍（16分）からのズレを表示します。</p>
    </div>
    <div class="cajon-wrap" data-ref="cajon"></div>
  </div>`);
  app.appendChild(root);
  bindBack(root);
  const r = refs(root);
  const pat = () => {
    const [beats, sub] = st.sig.split('-').map(Number);
    return normalize({ id: 'free', name: 'free', bpm: st.bpm, beats, sub, cajon: '.'.repeat(beats * sub), prog: st.prog });
  };
  let cur = pat();
  const looper = new Looper({
    getPattern: () => cur,
    getBpm: () => st.bpm,
    flags: () => ({ guide: false, metro: st.metro, backing: st.backing }),
  });
  function sync() {
    r.play.textContent = looper.playing ? '■ ストップ' : '▶ スタート';
    r.metro.classList.toggle('on', st.metro);
    r.backing.classList.toggle('on', st.backing);
    r.res.textContent = `ズレ基準：${st.res === 4 ? '16分' : '8分'}`;
  }
  const refresh = () => { st.bpm = Math.max(40, Math.min(240, +r.bpm.value || 100)); st.sig = r.sig.value; st.prog = r.prog.value; cur = pat(); };
  [r.bpm, r.sig, r.prog].forEach((e) => e.addEventListener('change', refresh));
  r.play.addEventListener('click', () => { if (looper.playing) looper.stop(); else { refresh(); looper.start(true); } sync(); });
  r.metro.addEventListener('click', () => { st.metro = !st.metro; sync(); });
  r.backing.addEventListener('click', () => { st.backing = !st.backing; sync(); });
  r.res.addEventListener('click', () => { st.res = st.res === 4 ? 2 : 4; sync(); });
  const cajon = createCajon(r.cajon, {
    onHit(type, time) {
      if (!looper.playing) return;
      const t = time - inputOffset();
      const l = [...looper.loops].reverse().find((x) => x.start <= t + 0.2);
      if (!l || t < l.start - 0.2) return;
      const g = (60 / l.bpm) * (cur.sub === 3 ? 1 / 3 : 1 / st.res);
      const rel = t - l.start;
      const d = rel - Math.round(rel / g) * g;
      st.n++; st.absSum += Math.abs(d);
      const ms = Math.round(d * 1000);
      r.dev.textContent = `${ms > 0 ? '+' : ''}${ms}ms`;
      const range = g / 2;
      r.needle.style.left = `${50 + Math.max(-1, Math.min(1, d / range)) * 50}%`;
      r.statTxt.textContent = `${st.n}打 ・ 平均ズレ ${Math.round((st.absSum / st.n) * 1000)}ms（小さいほど安定）`;
    },
  });
  sync();
  const onPause = () => { looper.stop(); sync(); };
  window.addEventListener('app-pause', onPause);
  return () => { looper.stop(); cajon.destroy(); window.removeEventListener('app-pause', onPause); };
}
