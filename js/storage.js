// 端末内（localStorage）に設定・成績・マイパターンを保存する
const KEY = 'cajon-rhythm-dojo:v1';

const DEFAULT_SETTINGS = {
  volTap: 0.9,
  volGuide: 0.7,
  volMetro: 0.6,
  volBack: 0.35,
  offsetMs: null, // null = 自動（ブラウザの出力遅延を使用）
  judgeMode: 'normal', // normal | easy | timing
  noteSpeed: 1,
  gameBars: 8,
  showLabels: true,
  showHint: true,
  guideInGame: false,
  metroInGame: true,
  backInGame: true,
};

let state = null;

function fresh() {
  return { settings: { ...DEFAULT_SETTINGS }, best: {}, practice: {}, custom: [] };
}

function load() {
  if (state) return state;
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    state = fresh();
    if (s && typeof s === 'object') {
      state.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
      state.best = s.best || {};
      state.practice = s.practice || {};
      state.custom = Array.isArray(s.custom) ? s.custom : [];
    }
  } catch {
    state = fresh();
  }
  return state;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 容量不足・プライベートモード */ }
}

export const db = {
  settings() { return load().settings; },
  set(key, value) { load().settings[key] = value; save(); },

  best(id) { return load().best[id] || null; },
  /** 音ゲー結果を記録。自己ベスト更新なら true */
  recordGame(id, r) {
    const s = load();
    const prev = s.best[id];
    const plays = (prev?.plays || 0) + 1;
    const isNew = !prev || r.score > prev.score;
    s.best[id] = isNew
      ? { score: r.score, rank: r.rank, maxCombo: r.maxCombo, acc: r.acc, bpm: r.bpm, plays, date: Date.now() }
      : { ...prev, plays, maxCombo: Math.max(prev.maxCombo || 0, r.maxCombo) };
    save();
    return isNew;
  },

  practice(id) { return load().practice[id] || null; },
  recordPractice(id, { acc, bpm }) {
    const s = load();
    const p = s.practice[id] || { loops: 0, bestAcc: 0, clearBpm: 0 };
    p.loops += 1;
    p.bestAcc = Math.max(p.bestAcc, acc);
    if (acc >= 0.8) p.clearBpm = Math.max(p.clearBpm, bpm);
    s.practice[id] = p;
    save();
    return p;
  },

  customs() { return load().custom; },
  saveCustom(p) {
    const s = load();
    const i = s.custom.findIndex((c) => c.id === p.id);
    if (i >= 0) s.custom[i] = p; else s.custom.push(p);
    save();
  },
  removeCustom(id) {
    const s = load();
    s.custom = s.custom.filter((c) => c.id !== id);
    delete s.best[id];
    delete s.practice[id];
    save();
  },

  exportJSON() { return JSON.stringify(load()); },
  importJSON(text) {
    const s = JSON.parse(text);
    if (!s || typeof s !== 'object') throw new Error('invalid');
    state = null;
    localStorage.setItem(KEY, JSON.stringify(s));
    load();
  },
  reset() {
    state = fresh();
    save();
  },
};
