// タイミング判定・奏法判定
import { TECH } from './patterns.js';
import { db } from './storage.js';
import { Audio } from './audio.js';

export const WIN = { PERFECT: 0.045, GREAT: 0.09, GOOD: 0.14 };
export const POINTS = { PERFECT: 1, GREAT: 0.7, GOOD: 0.4, MISS: 0 };
export const JCOLOR = { PERFECT: '#ffe066', GREAT: '#5ce1a0', GOOD: '#6cb6ff', MISS: '#ff6b6b' };

export function judgeDiff(d) {
  const a = Math.abs(d);
  return a <= WIN.PERFECT ? 'PERFECT' : a <= WIN.GREAT ? 'GREAT' : a <= WIN.GOOD ? 'GOOD' : null;
}

/** 期待した奏法と叩いた奏法が一致するか（判定モード依存） */
export function techOk(expected, got, mode = db.settings().judgeMode) {
  if (mode === 'timing' || expected === got) return true;
  if (mode === 'easy') {
    const a = TECH[expected]?.family, b = TECH[got]?.family;
    return a === b || a === 'mid' || b === 'mid';
  }
  return false;
}

/** 奏法ちがいは GOOD 止まり */
export function withTech(j, ok) {
  return ok ? j : j === 'PERFECT' || j === 'GREAT' ? 'GOOD' : j;
}

/** 判定対象のノーツを探す（未判定・判定窓内・奏法が合うものを優先） */
export function findNote(notes, t, tech) {
  let best = null, bs = Infinity;
  for (const n of notes) {
    if (n.j) continue;
    const d = Math.abs(t - n.t);
    if (d > WIN.GOOD) continue;
    const score = d + (techOk(n.type, tech) ? 0 : 0.06);
    if (score < bs) { bs = score; best = n; }
  }
  return best;
}

/** タップ入力の補正値（秒）。設定がなければブラウザの出力遅延を使う */
export function inputOffset() {
  const ms = db.settings().offsetMs;
  return (ms == null ? Math.round(Audio.latency() * 1000) : ms) / 1000;
}

export function rankOf(score) {
  return score >= 980000 ? 'SS' : score >= 950000 ? 'S' : score >= 900000 ? 'A'
    : score >= 800000 ? 'B' : score >= 700000 ? 'C' : 'D';
}

export function fmtMs(d) {
  const ms = Math.round(d * 1000);
  return (ms > 0 ? '+' : '') + ms + 'ms';
}
