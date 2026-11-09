// Web Audio API ラッパー。ブラウザの自動再生制限に対応し、最初のタップで起動する。
import { buildSounds } from './sounds.js';
import { db } from './storage.js';

let ctx = null;
let buf = {};
const bus = {};
const tracked = new Set();

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function track(node) {
  tracked.add(node);
  node.onended = () => tracked.delete(node);
}

export const Audio = {
  /** ユーザー操作のイベント内で呼ぶこと（iOS / Chrome の再生制限対策） */
  init() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      // iOS: マナーモードでも音を出す（対応ブラウザのみ）
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* noop */ }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 4;
      comp.attack.value = 0.002; comp.release.value = 0.12;
      comp.connect(ctx.destination);
      for (const k of ['tap', 'guide', 'drum', 'metro', 'back']) {
        bus[k] = ctx.createGain();
        bus[k].connect(comp);
      }
      this.applyVolumes();
      buf = buildSounds(ctx);
      // 無音を鳴らしてオーディオを確実にアンロック
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination);
      s.start(0);
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  },

  get ready() { return !!ctx && ctx.state === 'running'; },
  now() { return ctx ? ctx.currentTime : 0; },
  /** 出力遅延の推定値（秒） */
  latency() {
    if (!ctx) return 0;
    return Math.min(0.3, (ctx.outputLatency || 0) + (ctx.baseLatency || 0));
  },

  applyVolumes() {
    if (!ctx) return;
    const s = db.settings();
    bus.tap.gain.value = s.volTap;
    bus.guide.gain.value = s.volGuide;
    bus.drum.gain.value = s.volGuide;
    bus.metro.gain.value = s.volMetro;
    bus.back.gain.value = s.volBack;
  },

  /** バッファ音を再生。when=0 なら即時（タップ用、最小遅延） */
  play(name, when = 0, gain = 1, b = 'tap') {
    if (!ctx) this.init();
    if (!ctx || !buf[name]) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf[name];
    let out = src;
    if (gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g);
      out = g;
    }
    out.connect(bus[b] || bus.tap);
    if (when > 0) {
      src.start(Math.max(when, ctx.currentTime));
      if (b !== 'tap') track(src);
    } else {
      src.start();
    }
    return src;
  },

  /** 伴奏のコード（パッド） */
  chord(midis, when, dur) {
    if (!ctx) return;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1300; f.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.09, when + 0.05);
    g.gain.setTargetAtTime(0.05, when + 0.06, 0.4);
    g.gain.setTargetAtTime(0, when + dur - 0.06, 0.04);
    f.connect(g); g.connect(bus.back);
    for (const m of midis) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(m);
        o.detune.value = det;
        o.connect(f);
        o.start(when);
        o.stop(when + dur + 0.25);
        track(o);
      }
    }
  },

  /** 伴奏のベース音 */
  bass(midi, when, dur) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = mtof(midi);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.4, when + 0.01);
    g.gain.setTargetAtTime(0.22, when + 0.02, 0.15);
    g.gain.setTargetAtTime(0, when + dur - 0.04, 0.03);
    o.connect(g); g.connect(bus.back);
    o.start(when);
    o.stop(when + dur + 0.2);
    track(o);
  },

  /** 予約済みの音（お手本・メトロノーム・伴奏）をすべて止める */
  stopScheduled() {
    for (const n of tracked) { try { n.stop(); } catch { /* noop */ } }
    tracked.clear();
  },
};
