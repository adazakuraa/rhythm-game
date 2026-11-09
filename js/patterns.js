// リズムパターン定義
// すべてオリジナルのパターン（市販楽曲の譜面は収録していません）。
//
// 記法：1文字 = 1ステップ。空白と | は読みやすさのための区切りで無視される。
//   カホン (cajon) : B=ベース S=スラップ g=ゴースト O=オープントーン M=ミュート .=休み
//   ドラム (k/s/h) : x=叩く o=オープンハイハット .=休み
//   アクセント     : x=アクセント
// beats = 1小節の拍数、sub = 1拍の分割数（2=8分, 4=16分, 3=3連）
// cajon を省略すると、ドラム譜から自動変換する（スネア→スラップ, キック→ベース, ハイハット→ゴースト）。

import { db } from './storage.js';

export const TECH = {
  B: { key: 'B', name: 'ベース', short: 'ベース', sound: 'bass', color: '#ff8a3d', family: 'low',
    how: 'カホン前面の中央より少し上を、手のひら全体で叩いてすぐ離す。「ドン」という低音。キックドラムの代わり。' },
  S: { key: 'S', name: 'スラップ', short: 'スラップ', sound: 'slap', color: '#3db8ff', family: 'high',
    how: '上端（角から5〜10cm）を指の付け根〜指先で鋭く叩く。「パン」という高音。スネアドラムの代わり。' },
  g: { key: 'g', name: 'ゴースト', short: 'ゴースト', sound: 'ghost', color: '#a7b0c0', family: 'high',
    how: '上端の左右の角を、指先で軽く触れるように叩く小さな音。ハイハットの刻みや、リズムのすき間を埋める。' },
  O: { key: 'O', name: 'オープントーン', short: 'オープン', sound: 'open', color: '#ffd23f', family: 'mid',
    how: '上端と中央の間を、手を跳ね返すように叩いて響かせる中音。タムやオープンハイハットの雰囲気。' },
  M: { key: 'M', name: 'ミュート', short: 'ミュート', sound: 'mute', color: '#c08bff', family: 'low',
    how: '叩いた手をそのまま面に押し付けて響きを止める。「ドッ」と詰まった音。キメや静かな場面に。' },
};
export const TECH_ORDER = ['B', 'S', 'g', 'O', 'M'];

export const CATS = [
  { id: 'basic', name: '基本リズム' },
  { id: 'genre', name: 'ジャンル別' },
  { id: 'jpop', name: 'J-POP・アニソン・ボカロ' },
  { id: 'custom', name: 'マイパターン' },
];

export const DRUM_ROWS = [
  { key: 'h', name: 'ハイハット', short: 'HH', sound: 'hat', cajon: 'g',
    role: 'リズムの「細かさ」とテンポ感を刻む。8分なら8ビート、16分なら16ビート。カホンではゴーストノートで弱く刻む。' },
  { key: 's', name: 'スネア', short: 'SD', sound: 'snare', cajon: 'S',
    role: '2拍目・4拍目の「バックビート」が基本。曲のノリの芯。カホンではスラップで鋭く叩く。' },
  { key: 'k', name: 'キック', short: 'BD', sound: 'kick', cajon: 'B',
    role: '曲の重心。ベースラインと連動して位置が変わる。カホンではベース（中央の低音）。' },
];

const RAW = [
  // ---------------- 基本リズム ----------------
  { id: 'b-4beat', cat: 'basic', level: 1, name: '4ビート（ドン・パン）', bpm: 80, beats: 4, sub: 2,
    k: 'x... x...', s: '..x. ..x.', h: 'x.x. x.x.',
    desc: '1・3拍目にベース、2・4拍目にスラップ。ほぼすべてのリズムの土台になる「ドン・パン・ドン・パン」。',
    tips: ['まずは手を大きく動かさず、一定の音量で。', '「ドン」は手を面に残さずすぐ離すと低音がよく響く。'] },
  { id: 'b-8beat', cat: 'basic', level: 1, name: '8ビート基本', bpm: 90, beats: 4, sub: 2,
    k: 'x... x...', s: '..x. ..x.', h: 'xxxx xxxx',
    desc: 'ハイハットの8分刻みをゴーストノートで埋めた基本の8ビート。ロック・ポップスの出発点。',
    tips: ['ゴーストは「聴こえるか聴こえないか」くらいの小ささでOK。', 'ベース・スラップとの音量差を意識しよう。'] },
  { id: 'b-8beat-2', cat: 'basic', level: 2, name: '8ビート（3拍目裏のキック）', bpm: 95, beats: 4, sub: 2,
    k: 'x... xx..', s: '..x. ..x.', h: 'xxxx xxxx',
    desc: '3拍目の裏（「エン」）にベースを追加。前へ進む推進力が生まれる、最頻出の変化形。',
    tips: ['ベースが2回続くところで手がもつれやすい。ゆっくり練習しよう。'] },
  { id: 'b-8beat-3', cat: 'basic', level: 2, name: '8ビート（2拍目裏のキック）', bpm: 100, beats: 4, sub: 2,
    k: 'x..x x...', s: '..x. ..x.', h: 'xxxx xxxx',
    desc: '2拍目の裏にベースを入れて、スラップ直後に低音が来る形。ポップスで多用される。',
    tips: ['スラップ→ベースの移動を素早く。'] },
  { id: 'b-16beat', cat: 'basic', level: 2, name: '16ビート基本', bpm: 80, beats: 4, sub: 4,
    k: 'x... .... x.x. ....', s: '.... x... .... x...', h: 'xxxx xxxx xxxx xxxx',
    desc: 'ハイハットが16分音符になると16ビート。カホンではゴーストで細かく刻み、ベースとスラップを浮かび上がらせる。',
    tips: ['両手を交互に動かす「オルタネイト」を意識すると安定する。', 'テンポを落として粒をそろえよう。'] },
  { id: 'b-16beat-2', cat: 'basic', level: 3, name: '16ビート（裏のキック）', bpm: 85, beats: 4, sub: 4,
    k: 'x..x ..x. x... ..x.', s: '.... x... .... x...', h: 'x.x. x.x. x.x. x.x.',
    desc: '16分の裏にベースが入る形。J-POPやファンクの基礎になるシンコペーション感覚を養う。',
    tips: ['「1 e & a」と16分を数えながら叩こう。'] },
  { id: 'b-halftime', cat: 'basic', level: 2, name: 'ハーフタイム', bpm: 140, beats: 4, sub: 4,
    k: 'x... ...x ..x. ....', s: '.... .... x... ....', h: 'x.x. x.x. x.x. x.x.',
    desc: 'スラップを3拍目だけにすると、テンポはそのままでゆったり大きなノリになる。サビ前やバラードで多用。',
    tips: ['BPMが速くても慌てない。スラップは1小節に1回。'] },
  { id: 'b-shuffle', cat: 'basic', level: 2, name: 'シャッフル', bpm: 90, beats: 4, sub: 3,
    k: 'x.. ... x.. ...', s: '... x.. ... x..', h: 'x.x x.x x.x x.x',
    desc: '3連符の1つ目と3つ目を使う、跳ねたリズム。「タッカ・タッカ」。ブルースやロックンロールの定番。',
    tips: ['3連の真ん中は叩かない。', '「タッカ」の「カ」が遅れすぎないように。'] },
  { id: 'b-triplet', cat: 'basic', level: 2, name: '三連符', bpm: 75, beats: 4, sub: 3,
    k: 'x.. ... x.. ...', s: '... x.. ... x..', h: 'xxx xxx xxx xxx',
    desc: '1拍を3等分する三連符を刻む。6/8系バラードやロッカバラードの基礎。',
    tips: ['3つの粒を均等に。左右交互だと拍頭の手が入れ替わることに注意。'] },
  { id: 'b-waltz', cat: 'basic', level: 1, name: 'ワルツ（3/4拍子）', bpm: 100, beats: 3, sub: 2,
    k: 'x. .. ..', s: '.. x. x.', h: 'x. x. x.',
    desc: '1小節3拍の「ズン・チャッ・チャッ」。3拍子の感覚をつかもう。' },
  { id: 'b-68', cat: 'basic', level: 1, name: '6/8拍子', bpm: 60, beats: 2, sub: 3,
    k: 'x.. ...', s: '... x..', h: 'xxx xxx',
    desc: '8分音符6つを3つずつ2拍で感じる拍子。BPMは付点4分音符（3つで1拍）基準。',
    tips: ['「1 2 3 4 5 6」の1と4が強拍。'] },
  { id: 'b-fill-1', cat: 'basic', level: 2, name: 'フィルイン（スラップ連打）', bpm: 85, beats: 4, sub: 4,
    k: 'x... .... x... .... | x... .... .... ....', s: '.... x... .... x... | .... x... x.x. xxxx',
    h: 'x.x. x.x. x.x. x.x. | x.x. x.x. .... ....',
    desc: '2小節目の後半で8分→16分とスラップを連打する、もっとも基本的なフィルイン。曲の区切りを知らせる。',
    tips: ['フィルの後の1拍目のベースを必ず戻すこと。', 'フィルで走らない（速くならない）ように。'] },
  { id: 'b-fill-2', cat: 'basic', level: 3, name: 'フィルイン（タム回し風）', bpm: 85, beats: 4, sub: 4,
    cajon: 'B.g. S.g. B.g. S.g. | B.g. S.g. SSOO OOBB',
    accent: '.... x... .... x... | .... x... x.x. x.x.',
    desc: 'スラップ→オープントーン→ベースと、高い音から低い音へ下りていく。ドラムのタム回しをカホンで再現。',
    tips: ['叩く位置を上から下へ移動させるイメージ。'] },

  // ---------------- ジャンル別 ----------------
  { id: 'g-rock', cat: 'genre', level: 2, name: 'ロック 8ビート', bpm: 120, beats: 4, sub: 4, prog: 'pop',
    k: 'x... ..x. x.x. ....', s: '.... x... .... x...', h: 'x.x. x.x. x.x. x.x.',
    desc: '力強いベースとはっきりしたスラップ。ロックの基本形。3拍目周辺のベース連打で勢いを出す。' },
  { id: 'g-pops', cat: 'genre', level: 2, name: 'ポップス', bpm: 100, beats: 4, sub: 4, prog: 'pop',
    k: 'x... ..x. ..x. ....', s: '.... x... .... x...', h: 'x.x. x.x. x.x. x.x.',
    desc: '2拍目裏・3拍目裏にベースを置いた、軽やかで歌を邪魔しないパターン。' },
  { id: 'g-ballad', cat: 'genre', level: 2, name: 'バラード', bpm: 72, beats: 4, sub: 4, prog: 'pop',
    cajon: 'B.g. S.gB ..B. O.g.', accent: '.... x... .... x...',
    desc: '4拍目をオープントーンにして余韻を残す。音数を減らして「間」を聴かせる。',
    tips: ['ゆっくりなほどリズムがよれやすい。メトロノームをよく聴こう。'] },
  { id: 'g-funk', cat: 'genre', level: 3, name: 'ファンク', bpm: 96, beats: 4, sub: 4, prog: 'jazz',
    cajon: 'B.Bg S.gB g.Bg S.gg', accent: '.... x... .... x...',
    k: 'x.x. ...x ..x. ....', s: '.... x... .... x...', h: 'xxxx xxxx xxxx xxxx',
    desc: '16分のゴーストノートとシンコペーションしたベースで「グルーヴ」を作る。ゴーストの小ささが命。',
    tips: ['アクセント（スラップ）とゴーストの音量差を最大に。'] },
  { id: 'g-4uchi', cat: 'genre', level: 2, name: '4つ打ち（ダンス）', bpm: 124, beats: 4, sub: 4, prog: 'komuro',
    cajon: 'B.O. B.O. B.O. B.O.',
    k: 'x... x... x... x...', s: '.... x... .... x...', h: '..o. ..o. ..o. ..o.',
    desc: '毎拍ベースを打ち、裏拍をオープントーンで「開いたハイハット」のように響かせる。ダンスミュージックの基本。',
    tips: ['表のベースと裏のオープンで「ドッ・ツ・ドッ・ツ」。'] },
  { id: 'g-bossa', cat: 'genre', level: 3, name: 'ボサノバ', bpm: 120, beats: 4, sub: 4, prog: 'jazz',
    k: 'x... ..x. x... ..x. | x... ..x. x... ..x.', s: 'x... ..x. .... x... | .... x... ..x. ....',
    h: 'x.x. x.x. x.x. x.x. | x.x. x.x. x.x. x.x.',
    desc: 'スネア行はリムで叩く「クラーベ」のリズム。2小節で1周する。ベースは一定、スラップが歌うように動く。' },
  { id: 'g-reggae', cat: 'genre', level: 2, name: 'レゲエ（ワンドロップ）', bpm: 76, beats: 4, sub: 4, prog: 'minor',
    cajon: 'g.g. g.g. B.g. g.g.', accent: '.... .... x... ....',
    k: '.... .... x... ....', s: '.... .... x... ....', h: 'x.x. x.x. x.x. x.x.',
    desc: '1拍目を叩かず、3拍目にだけ重心を置く独特のノリ。「1拍目を休む」勇気が大切。' },
  { id: 'g-jazz', cat: 'genre', level: 3, name: 'ジャズ（スウィング）', bpm: 120, beats: 4, sub: 3, prog: 'jazz',
    k: 'x.. ... x.. ...', s: '... x.. ... x..', h: 'x.. x.x x.. x.x',
    desc: 'ライドシンバルの「チーン・チッキ」をカホンで。2・4拍目を軽いスラップで支える。',
    tips: ['ベースはごく軽く（フェザリング）。主役はシンバルのレガート。'] },
  { id: 'g-peru', cat: 'genre', level: 3, name: '6/8 ラテン（ペルー風）', bpm: 70, beats: 2, sub: 3, prog: 'minor',
    cajon: 'BgS BSg | BgS BSS', accent: 'x.x x.. | x.x x.x',
    desc: 'カホン発祥の地ペルーの音楽をイメージした6/8のオリジナルパターン。2拍子と3拍子が交差するような揺れが特徴。' },

  // ---------------- J-POP・アニソン・ボカロ ----------------
  { id: 'j-8beat', cat: 'jpop', level: 2, name: 'J-POP 王道8ビート', bpm: 120, beats: 4, sub: 4, prog: 'ohdo',
    k: 'x... ...x x.x. ....', s: '.... x... .... x...', h: 'x.x. x.x. x.x. x.x.',
    desc: '2拍目最後の16分にベースが入り、3拍目へ「転がり込む」。J-POPのAメロ〜サビで非常によく使われる形。' },
  { id: 'j-16beat', cat: 'jpop', level: 3, name: 'J-POP 16ビート', bpm: 95, beats: 4, sub: 4, prog: 'ohdo',
    k: 'x..x ..x. .... x..x', s: '.... x... .... x...', h: 'x.x. x.x. x.x. x.x.',
    desc: '最後の16分のベースが次の小節の頭を先取りする「食い」を含む16ビート。おしゃれなJ-POPの定番。',
    tips: ['小節の最後のベースが走らないように。'] },
  { id: 'j-hane', cat: 'jpop', level: 3, name: 'ハネる16ビート', bpm: 92, beats: 4, sub: 4, prog: 'ohdo', swing: 0.62,
    k: 'x... ..x. x... ....', s: '.... x... .... x...', h: 'xxxx xxxx xxxx xxxx',
    desc: '16分の裏を少し遅らせて「跳ねる」ノリ。シティポップや軽快なアニメOPでよく聴かれる。',
    tips: ['「タッカタッカ」と口で歌いながら叩こう。'] },
  { id: 'j-kui', cat: 'jpop', level: 3, name: '食い（シンコペーション）', bpm: 130, beats: 4, sub: 4, prog: 'ohdo',
    cajon: 'B.g. S.g. B.g. S.g. | B.g. S.g. B.S. ..S.', accent: '.... x... .... x... | .... x... ..x. ..x.',
    desc: '2小節目でスラップを拍の裏に前倒しする。サビ前や決めのフレーズで頻出するJ-POPらしい「食い」。',
    tips: ['食った後の休符をしっかり感じること。'] },
  { id: 'j-2beat', cat: 'jpop', level: 3, name: '疾走2ビート', bpm: 180, beats: 4, sub: 2, prog: 'komuro',
    k: 'x.x. x.x.', s: '.x.x .x.x', h: '....  ....',
    desc: '表拍ベース・裏拍スラップを高速で繰り返す。アニソンやメロコアの疾走感あるサビの定番。',
    tips: ['速いので最初はBPM120くらいから。テンポアップ機能を活用しよう。'] },
  { id: 'j-4uchi', cat: 'jpop', level: 3, name: 'アニソン 4つ打ちサビ', bpm: 150, beats: 4, sub: 4, prog: 'komuro',
    cajon: 'B.O. S.O. B.OB S.O.', accent: '.... x... .... x...',
    desc: '4つ打ちの「ドッ・ツ」にスラップの2・4拍目を合わせたダンスロック系パターン。アニソンのサビで高揚感を出す。' },
  { id: 'j-kime', cat: 'jpop', level: 4, name: 'キメ（3・3・2）', bpm: 140, beats: 4, sub: 4, prog: 'komuro',
    cajon: 'B.g. S.g. B.gB S.g. | S..S ..S. ..M. M...', accent: '.... x... .... x... | x..x ..x. ..x. x...',
    desc: '2小節目はバンド全員で合わせる「キメ」。3+3+2の分け方は、アニソン・ボカロで最頻出。最後はミュートで止める。',
    tips: ['キメの休符も演奏の一部。数えながら叩こう。'] },
  { id: 'j-332', cat: 'jpop', level: 3, name: '3・3・2 のリズム', bpm: 120, beats: 4, sub: 4, prog: 'ohdo',
    cajon: 'B.gB .gS. B.gB .gS.', accent: 'x..x ..x. x..x ..x.',
    desc: '16分8つを3+3+2に分ける「トレシージョ」。拍とずれたアクセントが、J-POPやボカロ曲に独特のノリを与える。' },
  { id: 'v-fast', cat: 'jpop', level: 4, name: 'ボカロ高速ロック', bpm: 180, beats: 4, sub: 4, prog: 'komuro',
    k: 'x... ..x. x... ..x.', s: '.... x... .... x...', h: 'x.x. x.x. x.x. x.x.',
    desc: 'BPM180前後の高速8ビート。4拍目裏のベースで次の小節へ駆け込む。ボカロロックで定番の疾走感。',
    tips: ['まずはBPM120で正確に。手の動きを小さくするのがコツ。'] },
  { id: 'v-dense', cat: 'jpop', level: 4, name: 'ボカロ 細かい16ビート', bpm: 150, beats: 4, sub: 4, prog: 'komuro',
    cajon: 'BgBg SgBg gBBg SgSg', accent: '.... x... .... x.x.',
    desc: 'キックとスネアが16分単位で細かく配置された、手数の多いボカロ系パターン。',
    tips: ['ゴーストを弱くしないと、主要な音が埋もれてしまう。'] },
  { id: 'v-poly', cat: 'jpop', level: 5, name: '3つ割りアクセント', bpm: 110, beats: 4, sub: 4, prog: 'minor',
    cajon: 'BggS ggSg gSgg SggS | ggSg gSgg SggS ggSg',
    accent: 'x..x ..x. .x.. x..x | ..x. .x.. x..x ..x.',
    desc: '16分音符を3つずつ区切ってアクセントを置き、4拍子の上に3拍子を重ねる（ポリリズム）。変則的なアクセントの練習。',
    tips: ['ゴーストは一定に刻み、スラップの位置だけ意識する。'] },
  { id: 'v-78', cat: 'jpop', level: 5, name: '変拍子 7/8', bpm: 180, beats: 7, sub: 2, groups: [2, 2, 3], prog: 'minor',
    cajon: 'B.g. S.g. B.gS g.', accent: 'x... x... x... ..',
    desc: '8分音符7つを2+2+3で数える変拍子。ボカロやプログレ系で登場する。BPMは8分音符基準。',
    tips: ['「イチ・ニ / イチ・ニ / イチ・ニ・サン」と数える。'] },
];

function clean(s) { return (s || '').replace(/[\s|]/g, ''); }
const on = (c) => !!c && c !== '.';

export function deriveCajon(k, s, h) {
  const n = Math.max(k.length, s.length, h.length);
  let out = '';
  for (let i = 0; i < n; i++) out += on(s[i]) ? 'S' : on(k[i]) ? 'B' : on(h[i]) ? (h[i] === 'o' ? 'O' : 'g') : '.';
  return out;
}

export function sigOf(p) {
  if (p.beats === 2 && p.sub === 3) return '6/8';
  if (p.beats === 7 && p.sub === 2) return '7/8';
  const base = `${p.beats}/4`;
  return p.sub === 3 ? `${base}（3連）` : base;
}

export function subName(sub) {
  return sub === 2 ? '8分' : sub === 4 ? '16分' : sub === 3 ? '3連' : `${sub}分割`;
}

/** 生データを再生可能な形に整える */
export function normalize(r) {
  const p = { level: 1, bpm: 100, beats: 4, sub: 4, swing: 0, ...r };
  const k = clean(r.k), s = clean(r.s), h = clean(r.h);
  p.notes = clean(r.cajon || r.notes) || deriveCajon(k, s, h);
  p.steps = p.notes.length;
  p.barSteps = p.beats * p.sub;
  p.bars = Math.max(1, Math.round(p.steps / p.barSteps));
  const pad = (x) => (x + '.'.repeat(p.steps)).slice(0, p.steps);
  p.accent = pad(clean(r.accent));
  p.drums = k || s || h ? { k: pad(k), s: pad(s), h: pad(h) } : null;
  p.sig = sigOf(p);
  p.tips = r.tips || [];
  p.desc = r.desc || '';
  if (p.steps % p.barSteps !== 0) console.warn('pattern length mismatch', p.id, p.steps, p.barSteps);
  return p;
}

const BUILTIN = RAW.map(normalize);

export function allPatterns() {
  return [...BUILTIN, ...db.customs().map(normalize)];
}
export function byCat(cat) {
  return cat === 'custom' ? db.customs().map(normalize) : BUILTIN.filter((p) => p.cat === cat);
}
export function getPattern(id) {
  return allPatterns().find((p) => p.id === id) || null;
}
export const builtinCount = BUILTIN.length;

/** スウィングを考慮した、ループ先頭からのステップ時刻 */
export function stepTime(p, i, sd) {
  let t = i * sd;
  if (p.swing && p.sub % 2 === 0 && i % 2 === 1) t += (2 * p.swing - 1) * sd;
  return t;
}

/** パターンを編集用の生データに戻す */
export function toRaw(p) {
  const r = { id: p.id, cat: 'custom', level: p.level || 1, name: p.name, bpm: p.bpm, beats: p.beats, sub: p.sub,
    swing: p.swing || 0, cajon: p.notes, accent: p.accent, desc: p.desc || '', prog: p.prog };
  if (p.groups) r.groups = p.groups;
  if (p.drums) { r.k = p.drums.k; r.s = p.drums.s; r.h = p.drums.h; }
  return r;
}
