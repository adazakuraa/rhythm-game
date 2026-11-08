// シンプルなオリジナル伴奏（コード進行のパッド＋ベース）。著作権フリーで使える。
import { Audio } from './audio.js';

const CH = {
  C: [60, 64, 67], Dm: [62, 65, 69], Em: [64, 67, 71], F: [65, 69, 72],
  G: [67, 71, 74], Am: [69, 72, 76], Bb: [70, 74, 77], E: [64, 68, 71],
};

export const PROGS = {
  ohdo: { name: '王道進行（IV→V→iii→vi）', chords: ['F', 'G', 'Em', 'Am'] },
  komuro: { name: '小室進行（vi→IV→V→I）', chords: ['Am', 'F', 'G', 'C'] },
  pop: { name: 'ポップ進行（I→V→vi→IV）', chords: ['C', 'G', 'Am', 'F'] },
  jazz: { name: 'ツーファイブ（ii→V→I→vi）', chords: ['Dm', 'G', 'C', 'Am'] },
  minor: { name: 'マイナー（vi→IV→V→III）', chords: ['Am', 'F', 'G', 'E'] },
};

export function progFor(p) {
  return PROGS[p?.prog] || PROGS[p?.cat === 'jpop' ? 'ohdo' : 'pop'];
}

export function scheduleBackingBar(prog, barNo, t, dur, beats) {
  const name = prog.chords[((barNo % prog.chords.length) + prog.chords.length) % prog.chords.length];
  const n = CH[name];
  Audio.chord(n.map((m) => m - 12), t, dur);
  const beatDur = dur / beats;
  for (let b = 0; b < beats; b++) {
    if (beats >= 4 && b % 2) continue;
    const len = beats >= 4 ? beatDur * 2 : beatDur;
    Audio.bass(n[0] - 24, t + b * beatDur, len * 0.9);
  }
}
