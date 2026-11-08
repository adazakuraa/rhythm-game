// パターンをループ再生するスケジューラ（先読みスケジューリング方式）
// 練習モード・研究室・フリー演奏で共通利用する。
import { Audio } from './audio.js';
import { TECH, stepTime } from './patterns.js';
import { progFor, scheduleBackingBar } from './backing.js';

const on = (c) => !!c && c !== '.';
const LOOKAHEAD = 0.2;

export class Looper {
  /**
   * @param {object} o
   *  getPattern(): pattern / getBpm(loopIdx): number
   *  flags(): { guide, metro, backing, drums:{k,s,h}|null, cajon }
   *  onVisual(ev) — 実際に音が聞こえるタイミングで呼ばれる
   *  onLoop(loop) — ループを予約したとき
   */
  constructor(o) {
    this.o = o;
    this.playing = false;
    this.vis = [];
    this.loops = [];
    this.barCount = 0;
  }

  start(countIn = true) {
    Audio.init();
    this.stop();
    this.playing = true;
    this.loops = [];
    this.idx = 0;
    this.barCount = 0;
    const p = this.o.getPattern();
    const bpm = this.o.getBpm(0);
    let t = Audio.now() + 0.12;
    if (countIn) {
      const bd = 60 / bpm;
      for (let b = 0; b < p.beats; b++) {
        const tt = t + b * bd;
        Audio.play(b === 0 ? 'clickHi' : 'clickLo', tt, 1, 'metro');
        this.vis.push({ t: tt, kind: 'count', n: b + 1, total: p.beats });
      }
      t += p.beats * bd;
    }
    this.next = t;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    const raf = () => {
      if (!this.playing) return;
      this.frame();
      this.raf = requestAnimationFrame(raf);
    };
    this.raf = requestAnimationFrame(raf);
  }

  stop() {
    const was = this.playing;
    this.playing = false;
    clearInterval(this.timer);
    cancelAnimationFrame(this.raf);
    this.vis = [];
    if (was) Audio.stopScheduled();
  }

  tick() {
    const now = Audio.now();
    while (this.next < now + LOOKAHEAD) this.scheduleLoop();
    this.o.onTick?.(now);
  }

  scheduleLoop() {
    const p = this.o.getPattern();
    const bpm = this.o.getBpm(this.idx);
    const f = this.o.flags();
    const sd = 60 / bpm / p.sub;
    const start = this.next;
    const loop = { idx: this.idx, start, bpm, sd, p, notes: [], end: start + p.steps * sd, done: false };
    this.vis.push({ t: start, kind: 'loop', loop });
    const groupStarts = new Set();
    if (p.groups) { let a = 0; for (const g of p.groups) { groupStarts.add(a); a += g; } }

    for (let i = 0; i < p.steps; i++) {
      const t = start + stepTime(p, i, sd);
      const c = p.notes[i];
      const acc = p.accent[i] !== '.';
      if (c !== '.') {
        loop.notes.push({ t, type: c, step: i, acc, j: null });
        if (f.guide && f.cajon !== false) Audio.play(TECH[c].sound, t, acc ? 1 : 0.78, 'guide');
      }
      if (f.drums && p.drums) {
        const d = p.drums;
        if (f.drums.k && on(d.k[i])) Audio.play('kick', t, 1, 'drum');
        if (f.drums.s && on(d.s[i])) Audio.play('snare', t, 1, 'drum');
        if (f.drums.h && on(d.h[i])) Audio.play(d.h[i] === 'o' ? 'ohat' : 'hat', t, 1, 'drum');
      }
      this.vis.push({ t, kind: 'step', step: i, type: c, loop });
    }
    const totalBeats = p.bars * p.beats;
    if (f.metro) {
      for (let b = 0; b < totalBeats; b++) {
        const inBar = b % p.beats;
        const hi = inBar === 0;
        const mid = groupStarts.has(inBar);
        Audio.play(hi ? 'clickHi' : 'clickLo', start + b * p.sub * sd, hi ? 1 : mid ? 1 : 0.8, 'metro');
      }
    }
    if (f.backing) {
      const prog = progFor(p);
      const barDur = p.barSteps * sd;
      for (let b = 0; b < p.bars; b++) scheduleBackingBar(prog, this.barCount + b, start + b * barDur, barDur, p.beats);
    }
    this.barCount += p.bars;
    this.loops.push(loop);
    if (this.loops.length > 4) this.loops.shift();
    this.next = loop.end;
    this.idx++;
    this.o.onLoop?.(loop);
  }

  frame() {
    const now = Audio.now() - Audio.latency();
    while (this.vis.length && this.vis[0].t <= now) this.o.onVisual?.(this.vis.shift());
  }

  /** 判定対象になりうるノーツ（直近のループ） */
  activeNotes() {
    const out = [];
    for (const l of this.loops) if (!l.done) out.push(...l.notes);
    return out;
  }
}
