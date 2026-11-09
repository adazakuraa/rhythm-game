// カホン・ドラム音色をブラウザ内で合成する（音源ファイル不要）
// 起動時に AudioBuffer を一度だけ生成し、再生時はバッファを鳴らすだけなので遅延が小さい。

function biquad(x, type, f0, Q, sr) {
  const w = (2 * Math.PI * f0) / sr;
  const c = Math.cos(w), s = Math.sin(w), a = s / (2 * Q);
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
  else { b0 = a; b1 = 0; b2 = -a; } // band-pass
  const a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i];
    const y0 = (b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    x[i] = y0;
  }
  return x;
}

function noise(n, seed = 1) {
  const d = new Float32Array(n);
  let s = seed * 9301 + 49297;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    d[i] = (s / 0x7fffffff) * 2 - 1;
  }
  return d;
}

function normalize(d, level) {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= level / m;
  // 末尾のクリックノイズ防止
  const fade = Math.min(d.length, 200);
  for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
}

const att = (t, k = 1500) => 1 - Math.exp(-t * k);

const RECIPES = {
  // ベース：中央を叩く低音。ピッチが下がる胴鳴り＋打撃ノイズ
  bass: { dur: 0.5, level: 1.0, fn(d, sr, n) {
    const nz = biquad(noise(n, 3), 'lp', 700, 0.7, sr);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = 54 + 85 * Math.exp(-t * 26);
      ph += (2 * Math.PI * f) / sr;
      d[i] = att(t) * (Math.sin(ph) * Math.exp(-t * 7.5) + 0.22 * Math.sin(2 * ph) * Math.exp(-t * 18))
        + nz[i] * 0.45 * Math.exp(-t * 55);
    }
  } },
  // スラップ：上端を叩く高音。乾いたアタック＋スナッピー（響き線）
  slap: { dur: 0.36, level: 0.92, fn(d, sr, n) {
    const a = biquad(noise(n, 5), 'bp', 2600, 0.8, sr);
    const w = biquad(biquad(noise(n, 7), 'hp', 3800, 0.7, sr), 'lp', 9000, 0.7, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = att(t, 3000) * (a[i] * 1.2 * Math.exp(-t * 32) + w[i] * 0.55 * Math.exp(-t * 11)
        + 0.5 * Math.sin(2 * Math.PI * 330 * t) * Math.exp(-t * 45)
        + 0.25 * Math.sin(2 * Math.PI * 190 * t) * Math.exp(-t * 30));
    }
  } },
  // ゴーストノート：指先で弱く。小さく短いスラップ系
  ghost: { dur: 0.18, level: 0.3, fn(d, sr, n) {
    const a = biquad(noise(n, 11), 'bp', 1900, 0.9, sr);
    const w = biquad(noise(n, 13), 'hp', 4200, 0.7, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = att(t, 2500) * (a[i] * Math.exp(-t * 48) + w[i] * 0.35 * Math.exp(-t * 22));
    }
  } },
  // オープントーン：上端と中央の間を跳ね返すように。中音域がよく響く
  open: { dur: 0.55, level: 0.82, fn(d, sr, n) {
    const a = biquad(noise(n, 17), 'bp', 1100, 1.0, sr);
    const w = biquad(noise(n, 19), 'hp', 4500, 0.7, sr);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = 168 + 45 * Math.exp(-t * 40);
      ph += (2 * Math.PI * f) / sr;
      d[i] = att(t) * (Math.sin(ph) * Math.exp(-t * 6) + 0.35 * Math.sin(2.63 * ph) * Math.exp(-t * 14)
        + a[i] * 0.45 * Math.exp(-t * 35) + w[i] * 0.14 * Math.exp(-t * 14));
    }
  } },
  // ミュート：手を押し付けて響きを止める。短く詰まった音
  mute: { dur: 0.16, level: 0.75, fn(d, sr, n) {
    const nz = biquad(noise(n, 23), 'lp', 650, 0.7, sr);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = 75 + 70 * Math.exp(-t * 45);
      ph += (2 * Math.PI * f) / sr;
      d[i] = att(t) * (Math.sin(ph) * Math.exp(-t * 32) + nz[i] * 0.7 * Math.exp(-t * 70));
    }
  } },
  // --- ドラム（リズム分解用） ---
  kick: { dur: 0.45, level: 0.95, fn(d, sr, n) {
    const nz = biquad(noise(n, 29), 'lp', 2500, 0.7, sr);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const f = 46 + 120 * Math.exp(-t * 38);
      ph += (2 * Math.PI * f) / sr;
      d[i] = att(t) * Math.sin(ph) * Math.exp(-t * 6) + nz[i] * 0.3 * Math.exp(-t * 150);
    }
  } },
  snare: { dur: 0.3, level: 0.8, fn(d, sr, n) {
    const nz = biquad(noise(n, 31), 'hp', 1300, 0.7, sr);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      d[i] = att(t) * (nz[i] * Math.exp(-t * 16) + 0.6 * Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 26));
    }
  } },
  hat: { dur: 0.08, level: 0.32, fn(d, sr, n) {
    const nz = biquad(biquad(noise(n, 37), 'hp', 7000, 0.7, sr), 'hp', 7000, 0.7, sr);
    for (let i = 0; i < n; i++) { const t = i / sr; d[i] = nz[i] * Math.exp(-t * 60); }
  } },
  ohat: { dur: 0.4, level: 0.32, fn(d, sr, n) {
    const nz = biquad(biquad(noise(n, 41), 'hp', 6500, 0.7, sr), 'hp', 6500, 0.7, sr);
    for (let i = 0; i < n; i++) { const t = i / sr; d[i] = nz[i] * Math.exp(-t * 8); }
  } },
  // --- メトロノーム ---
  clickHi: { dur: 0.05, level: 0.6, fn(d, sr, n) {
    for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 1760 * t) * Math.exp(-t * 90); }
  } },
  clickLo: { dur: 0.05, level: 0.42, fn(d, sr, n) {
    for (let i = 0; i < n; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 1175 * t) * Math.exp(-t * 100); }
  } },
};

export function buildSounds(ctx) {
  const sr = ctx.sampleRate;
  const out = {};
  for (const [name, r] of Object.entries(RECIPES)) {
    const n = Math.floor(r.dur * sr);
    const b = ctx.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    r.fn(d, sr, n);
    normalize(d, r.level);
    out[name] = b;
  }
  return out;
}
