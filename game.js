/* =========================================================
   きのぴー、8時50分発。
   成田空港でなくしたパスポートをさがすゲーム
   ========================================================= */
(() => {
'use strict';

/* ---------- 便利関数 ---------- */
const $ = s => document.querySelector(s);
const rnd = n => Math.floor(Math.random() * n);
const rr = (a, b) => a + rnd(b - a + 1);
const pick = a => a[rnd(a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const now = () => performance.now();
const reduceMotion = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
const fmt = sec => { sec = Math.floor(sec); return String(Math.floor(sec / 3600)).padStart(2, '0') + ':' + String(Math.floor(sec / 60) % 60).padStart(2, '0'); };

/* ---------- 基本設定 ---------- */
const W = 44, H = 28;                 // 1フロアの大きさ（マス）
const WALL = 0, ROOM = 1, CORR = 2;
const START = 7 * 3600 + 20 * 60;     // 7:20 スタート
const DEAD  = 8 * 3600 + 50 * 60;     // 8:50 出発
const STEP  = 15;                     // 1歩 = 15秒
const MOVE_MS = 110;
const MAX_INV = 14;
const DIRS = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
const idx = (x, y) => x + y * W;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

const FLOORS = [
  { no: 'B1F', title: '駅改札' },
  { no: '1F',  title: '到着ロビー' },
  { no: '2F',  title: '連絡通路' },
  { no: '3F',  title: 'ショップ・レストラン' },
  { no: '4F',  title: '出発ロビー' },
];
const TOP = 4; // スタートとゴールの階

const ROOM_NAMES = ['ベンチしかない部屋','誰もいない免税店','観葉植物の部屋','なぜか畳の部屋','止まった回転台','ガチャガチャ売り場','コインロッカーの林','マッサージチェアの部屋','巨大な時計の部屋','大きな窓の部屋','自販機の部屋','迷子センター','無人のフードコート','閉まった両替所','床がやけに光る部屋','カートの墓場','ずっと工事中の部屋','ハトの多い部屋','空のベルトコンベア','忘れ物の部屋','説明のない展示室','止まった動く歩道','時計が全部ちがう部屋','誰かの帽子の部屋','傘立てだけの部屋','巨大な地球儀の部屋','キッズスペース（無人）','記念撮影スポット','ベビーカー置き場','謎の行列の部屋'];
// めずらしい部屋（たまにしか出ない）
const RARE_ROOMS = ['ハトの会議室','金色の自販機の部屋','ずっと8時50分の部屋','誰も知らない搭乗口','時刻表の墓場','誰かが住んでいる部屋','雲の上みたいな部屋','きのぴーの部屋'];
const ALL_ROOMS = ROOM_NAMES.concat(RARE_ROOMS);

/* ---------- アイテム ---------- */
const ITEMS = {
  onigiri:  { name: 'おにぎり', kind: 'food', heal: 25, desc: '体力が25回復する。中身は梅。' },
  pan:      { name: '菓子パン', kind: 'food', heal: 40, desc: '体力が40回復する。甘い。' },
  coffee:   { name: '缶コーヒー', kind: 'drink', desc: 'しばらく早歩きになる。1歩にかかる時間が半分になる。' },
  map:      { name: '館内マップ', kind: 'paper', fx: 'map', desc: 'いまいる階の間取りがわかる。' },
  call:     { name: 'お呼び出し券', kind: 'paper', fx: 'call', desc: '館内放送で、パスポートの行方をたずねる。' },
  shiori:   { name: '搭乗のしおり', kind: 'paper', fx: 'none', desc: '読むと落ち着くかもしれない。' },
  folding:  { name: '折り畳み傘', kind: 'weapon', pow: 2, desc: '攻撃+2。軽くて、短い。' },
  vinyl:    { name: 'ビニール傘', kind: 'weapon', pow: 3, desc: '攻撃+3。コンビニで買った。' },
  sturdy:   { name: 'しっかりした傘', kind: 'weapon', pow: 5, desc: '攻撃+5。骨が16本ある。' },
  shikomi:  { name: '仕込み傘', kind: 'weapon', pow: 7, desc: '攻撃+7。何が仕込まれているかは、言えない。' },
  magazine: { name: '機内誌', kind: 'armor', pow: 1, desc: '防御+1。先月号。' },
  neck:     { name: 'ネックピロー', kind: 'armor', pow: 2, desc: '防御+2。首が楽。' },
  ipad:     { name: 'アイパッド', kind: 'armor', pow: 3, desc: '防御+3。画面は割れている。' },
  coat:     { name: '厚手のコート', kind: 'armor', pow: 4, desc: '防御+4。空港の中は少し暑い。' },
  ticket:   { name: '搭乗券', kind: 'ticket', desc: '8:50発 KP 850 台北（桃園）行き。座席は窓側。' },
};
// [種類, 出やすさ, 出る深さ(最小), 出る深さ(最大)]  深さ＝4Fからいくつ下か
const POOL = [
  ['onigiri',14,0,4],['pan',8,0,4],['coffee',6,0,4],
  ['map',6,0,4],['call',4,0,4],['shiori',3,0,4],
  ['folding',5,0,2],['vinyl',4,0,3],['sturdy',3,1,4],['shikomi',1,2,4],
  ['magazine',5,0,2],['neck',4,0,3],['ipad',3,1,4],['coat',2,2,4],
];
const mkItem = key => Object.assign({ key }, ITEMS[key]);
const FAKES = [
  { name: '2026年の手帳', text: '予定がびっしり書いてある。2026年も、もうすぐ終わる。' },
  { name: '御朱印帳', text: 'まだ一つも押されていない。' },
  { name: 'パスポートそっくりのメモ帳', text: '表紙だけ立派だ。中は白紙。' },
  { name: '赤い通帳', text: '見なかったことにした。' },
];
const redNote = () => ({ key: 'note', kind: 'note', name: '赤い手帳', desc: '拾ってみないとわからない。' });

/* ---------- 空港のひとたち ---------- */
const MOBS = {
  hato:     { name: 'ハト', hp: 6, atk: 2, xp: 2, move: 'erratic', depth: [0,1,2], verb: 'つついてきた', bye: 'ハトは飛んでいった。' },
  case:     { name: '走るスーツケース', hp: 7, atk: 2, xp: 4, speed: 2, depth: [0,1,2,3], verb: 'ぶつかってきた', bye: 'スーツケースは持ち主のもとへ帰っていった。' },
  shishoku: { name: '試食のおばさん', hp: 10, atk: 0, xp: 5, special: 'time', depth: [1,2,3], verb: '', bye: 'おばさんは次のお客を探しにいった。' },
  pillow:   { name: '動くネックピロー', hp: 9, atk: 2, xp: 5, special: 'sleep', depth: [1,2,3,4], verb: '首に巻きついてきた', bye: 'ネックピローはしぼんだ。' },
  tour:     { name: 'ツアー客の群れ', hp: 14, atk: 3, xp: 7, slow: true, depth: [2,3,4], verb: '押し寄せてきた', bye: 'ツアー客は旗について行ってしまった。' },
  cart:     { name: '暴走カート', hp: 11, atk: 4, xp: 9, depth: [2,3,4], verb: '突っ込んできた', bye: 'カートは列に戻っていった。' },
  robo:     { name: '警備ロボ', hp: 16, atk: 5, xp: 13, depth: [4], verb: '職務質問してきた', bye: '警備ロボは充電に戻った。' },
};
const XP = [0, 10, 25, 45, 75, 115, 170, 240, 330, 450, 600];

/* ---------- 館内放送 ---------- */
const ANN = [
  [7 * 3600 + 30 * 60, 'ハトの持ち込みは、ご遠慮ください。'],
  [8 * 3600,           '8時50分発 台北（桃園）行きにご搭乗のお客様は、お早めに出国審査へお進みください。'],
  [8 * 3600 + 15 * 60, '落とし物のお知らせです。赤い手帳が、いくつか見つかっております。'],
  [8 * 3600 + 30 * 60, '8時50分発 台北（桃園）行き、ただいまより搭乗を開始いたします。'],
  [8 * 3600 + 40 * 60, 'きのぴー様、きのぴー様。8時50分発 台北行きにご搭乗のきのぴー様。至急、搭乗口までお越しください。'],
  [8 * 3600 + 47 * 60, 'まもなく搭乗口を閉めさせていただきます。'],
];

/* =========================================================
   記録（ブラウザに保存）・称号・きのぴーの服
   ========================================================= */
const SAVE_KEY = 'kinopi0850-save-v1';
const RANKS = [
  { min: 50 * 60, name: '優雅な旅人',   text: 'ラウンジでコーヒーを飲む時間まであった。' },
  { min: 35 * 60, name: '余裕の旅人',   text: '免税店をのぞく時間があった。' },
  { min: 20 * 60, name: 'ふつうの旅人', text: 'ちょうどいい時間に着いた。' },
  { min: 10 * 60, name: '急ぎ足の旅人', text: '少し息が上がっていた。' },
  { min: 3 * 60,  name: '駆け込み乗車', text: '最後の一人だった。' },
  { min: 0,       name: '8時49分の奇跡', text: '扉は、きのぴーのすぐ後ろで閉まった。' },
];
const COLORS = [
  { id: 'beige',  name: 'ベージュ', hex: '#D2B48C', cond: 'はじめから',                ok: () => true },
  { id: 'navy',   name: '紺',       hex: '#3F5584', cond: '1回クリアする',             ok: s => s.clears >= 1 },
  { id: 'green',  name: '緑',       hex: '#6E9A6A', cond: '3回クリアする',             ok: s => s.clears >= 3 },
  { id: 'red',    name: '赤',       hex: '#C0504A', cond: '赤い手帳を全種類集める',   ok: s => s.items.includes('passport') && FAKES.every(f => s.fakes.includes(f.name)) },
  { id: 'yellow', name: '黄',       hex: '#E2B93B', cond: '「優雅な旅人」の称号をとる', ok: s => s.titles.includes('優雅な旅人') },
];
const SHIKOMI_CLEARS = 3;
const SHIKOMI_TRUTH = '中には、もう1本の小さな傘が仕込まれていた。';
function defaultSave() { return { v: 1, plays: 0, clears: 0, best: null, titles: [], items: [], fakes: [], rooms: [], met: [], beat: {}, color: 'beige', shikomi: false }; }
function loadSave() {
  try { const raw = localStorage.getItem(SAVE_KEY); if (raw) return Object.assign(defaultSave(), JSON.parse(raw)); } catch (e) {}
  return defaultSave();
}
let SAVE = loadSave(), saveDirty = false;
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} saveDirty = false; }
function addTo(list, v) { if (!SAVE[list].includes(v)) { SAVE[list].push(v); saveDirty = true; return true; } return false; }
const unlockedColors = () => COLORS.filter(c => c.ok(SAVE)).map(c => c.id);
const stripeHex = () => { const c = COLORS.find(c => c.id === SAVE.color && c.ok(SAVE)); return (c || COLORS[0]).hex; };
const rankFor = remain => RANKS.find(r => remain >= r.min) || RANKS[RANKS.length - 1];
function itemDesc(it) { if (it.key === 'shikomi' && SAVE.shikomi) return '攻撃+7。' + SHIKOMI_TRUTH; return it.desc || ''; }
const mins = sec => Math.floor(sec / 60);

/* =========================================================
   サウンド（Web Audio APIで全部その場で鳴らす）
   ========================================================= */
const Sound = (() => {
  let ac = null, master, bgmBus, seBus, rev, noiseBuf, amb = null;
  let mode = 0;               // 0: 音あり / 1: BGMなし / 2: 消音
  let playing = false, timer = null, next = 0, step = 0, level = 0;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination);
    master = ac.createGain(); master.gain.value = 0.9; master.connect(comp);
    bgmBus = ac.createGain(); bgmBus.connect(master);
    seBus = ac.createGain(); seBus.connect(master);
    rev = ac.createConvolver();
    const len = Math.floor(ac.sampleRate * 2.6), ib = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ib.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    rev.buffer = ib;
    const rg = ac.createGain(); rg.gain.value = 0.5; rev.connect(rg); rg.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    apply();
  }
  function apply() {
    if (!ac) return;
    const t = ac.currentTime;
    bgmBus.gain.setTargetAtTime(mode === 0 ? 0.55 : 0, t, 0.15);
    seBus.gain.setTargetAtTime(mode === 2 ? 0 : 0.8, t, 0.05);
  }
  function send(node, amt) { if (!amt) return; const s = ac.createGain(); s.gain.value = amt; node.connect(s); s.connect(rev); }
  function tone({ f, t, dur = 0.3, type = 'sine', vol = 0.1, att = 0.005, bus = seBus, rv = 0.15, f2 = null }) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); send(g, rv);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function bell(f, t, vol, dur = 1.2, bus = seBus) {
    tone({ f, t, dur, vol, bus, rv: 0.35 });
    tone({ f: f * 2, t, dur: dur * 0.5, vol: vol * 0.3, bus, rv: 0.3 });
    tone({ f: f * 3.01, t, dur: dur * 0.25, vol: vol * 0.12, bus, rv: 0.3 });
  }
  function noise(t, dur, vol, { type = 'bandpass', freq = 1000, q = 1, freq2 = null, bus = seBus, rv = 0 } = {}) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q;
    if (freq2) fl.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(bus); send(g, rv);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  const SE = {
    step:     t => noise(t, 0.05, 0.05, { type: 'lowpass', freq: 700 }),
    swing:    t => noise(t, 0.13, 0.22, { freq: 2200, freq2: 700, q: 0.8 }),
    hit:      t => { tone({ f: 170, f2: 55, t, dur: 0.16, vol: 0.45, rv: 0 }); noise(t, 0.05, 0.15, { type: 'highpass', freq: 2500 }); },
    hurt:     t => { tone({ f: 300, f2: 120, t, dur: 0.2, type: 'square', vol: 0.08, rv: 0.05 }); noise(t, 0.08, 0.12, { type: 'lowpass', freq: 600 }); },
    miss:     t => noise(t, 0.16, 0.08, { freq: 800, freq2: 2600, q: 0.6 }),
    pickup:   t => { bell(mtof(88), t, 0.08, 0.5); bell(mtof(95), t + 0.08, 0.08, 0.6); },
    fake:     t => { bell(mtof(84), t, 0.08, 0.4); bell(mtof(79), t + 0.14, 0.07, 0.6); },
    passport: t => [72, 76, 79, 84, 88, 91].forEach((m, i) => bell(mtof(m), t + i * 0.1, 0.09, 1.6)),
    elevator: t => { bell(mtof(81), t, 0.12, 1.8); bell(mtof(76), t + 0.4, 0.12, 2.0); },
    chime:    t => [77, 81, 84, 89].forEach((m, i) => bell(mtof(m), t + i * 0.3, 0.09, 1.5)),
    levelup:  t => [79, 83, 86, 91].forEach((m, i) => tone({ f: mtof(m), t: t + i * 0.07, dur: 0.3, type: 'triangle', vol: 0.08 })),
    eat:      t => { noise(t, 0.06, 0.12, { type: 'lowpass', freq: 1200 }); noise(t + 0.16, 0.06, 0.12, { type: 'lowpass', freq: 1100 }); },
    drink:    t => { noise(t, 0.25, 0.14, { type: 'highpass', freq: 3000 }); [0.32, 0.46, 0.6].forEach(d => tone({ f: 320, f2: 180, t: t + d, dur: 0.1, vol: 0.06, rv: 0 })); },
    paper:    t => noise(t, 0.22, 0.08, { freq: 3000, freq2: 1400, q: 0.5 }),
    equip:    t => { tone({ f: 600, t, dur: 0.06, type: 'triangle', vol: 0.06, rv: 0 }); tone({ f: 900, t: t + 0.06, dur: 0.08, type: 'triangle', vol: 0.06, rv: 0 }); },
    tap:      t => tone({ f: 1400, t, dur: 0.04, vol: 0.04, rv: 0 }),
    blip:     t => tone({ f: 700 + Math.random() * 60, t, dur: 0.035, type: 'square', vol: 0.018, rv: 0 }),
    deny:     t => { tone({ f: 220, t, dur: 0.12, type: 'square', vol: 0.05, rv: 0 }); tone({ f: 196, t: t + 0.14, dur: 0.16, type: 'square', vol: 0.05, rv: 0 }); },
    shock:    t => { tone({ f: 990, f2: 400, t, dur: 0.6, type: 'triangle', vol: 0.09 }); },
    win:      t => { noise(t, 3, 0.16, { type: 'lowpass', freq: 200, freq2: 1800, q: 0.7 }); [72, 79, 84, 88].forEach((m, i) => bell(mtof(m), t + 1.3 + i * 0.25, 0.08, 2)); },
    lose:     t => [76, 72, 69, 64].forEach((m, i) => bell(mtof(m), t + i * 0.45, 0.08, 1.8)),
  };
  function se(name) { if (!ac || mode === 2) return; const f = SE[name]; if (f) f(ac.currentTime + 0.01); }

  // BGM：空港ラウンジ風のゆったりしたコード。時間がせまると早く、短調になる
  const CALM = [[41,57,60,64,67],[40,55,59,62,69],[38,53,57,60,64],[36,55,59,62,64]];
  const TENSE = [[38,53,57,60,64],[34,53,57,60,62],[43,53,58,62,65],[45,55,57,61,64]];
  function pad(f, t, dur) {
    [-6, 6].forEach(det => {
      const o = ac.createOscillator(), g = ac.createGain(), fl = ac.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
      fl.type = 'lowpass'; fl.frequency.value = 1400;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.02, t + 0.8);
      g.gain.setValueAtTime(0.02, t + Math.max(0.9, dur - 0.5)); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
      o.connect(fl); fl.connect(g); g.connect(bgmBus); send(g, 0.4);
      o.start(t); o.stop(t + dur + 0.5);
    });
  }
  function ep(f, t, vol) { tone({ f, t, dur: 1.4, vol, bus: bgmBus, rv: 0.45, att: 0.004 }); tone({ f: f * 2, t, dur: 0.4, vol: vol * 0.25, bus: bgmBus, rv: 0.3 }); }
  function sched() {
    if (!playing || !ac) return;
    const bpm = [70, 92, 116][level], e = 60 / bpm / 2;
    while (next < ac.currentTime + 0.2) {
      const prog = level ? TENSE : CALM;
      const bar = Math.floor(step / 8) % 4, pos = step % 8, ch = prog[bar];
      if (pos === 0) { ch.slice(1).forEach(m => pad(mtof(m), next, e * 8)); tone({ f: mtof(ch[0]), t: next, dur: e * 6, vol: 0.09, bus: bgmBus, rv: 0.05, att: 0.02 }); }
      if (pos !== 0 && Math.random() < (level ? 0.55 : 0.36)) ep(mtof(ch[1 + rnd(4)] + 12), next, 0.045);
      if (level >= 1) noise(next, 0.03, level === 2 ? 0.045 : 0.022, { type: 'highpass', freq: 7000, bus: bgmBus });
      if (level === 2 && pos % 2 === 0) tone({ f: 1760, t: next, dur: 0.03, vol: 0.014, bus: bgmBus, rv: 0 });
      next += e; step++;
    }
  }
  function startAmb() {
    if (amb) return;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 320;
    const g = ac.createGain(); g.gain.value = 0.05;
    src.connect(fl); fl.connect(g); g.connect(bgmBus); src.start();
    amb = src;
  }
  function bgm(on) {
    if (!ac) return;
    if (on && !playing) { playing = true; next = ac.currentTime + 0.1; step = 0; timer = setInterval(sched, 40); startAmb(); }
    else if (!on && playing) { playing = false; clearInterval(timer); if (amb) { try { amb.stop(); } catch (e) {} amb = null; } }
  }
  return {
    init, se, bgm,
    setLevel(n) { level = n; },
    cycle() { mode = (mode + 1) % 3; apply(); return mode; },
    get mode() { return mode; },
  };
})();

/* =========================================================
   フロアをつくる
   ========================================================= */
function genLevel(fi) {
  for (let t = 0; t < 100; t++) { const lv = tryGen(fi); if (lv) return lv; }
  throw new Error('フロアを作れませんでした');
}
function tryGen(fi) {
  const tiles = new Uint8Array(W * H), rid = new Int16Array(W * H).fill(-1);
  const C = 3, R = 3, sw = Math.floor(W / C), sh = Math.floor(H / R);
  const cells = [];
  for (let cy = 0; cy < R; cy++) for (let cx = 0; cx < C; cx++) {
    const x0 = cx * sw, y0 = cy * sh;
    if (Math.random() < 0.8) {
      const w = rr(4, sw - 3), h = rr(3, sh - 3);
      cells.push({ room: true, x: x0 + rr(1, sw - w - 1), y: y0 + rr(1, sh - h - 1), w, h });
    } else {
      cells.push({ room: false, x: x0 + rr(2, sw - 3), y: y0 + rr(2, sh - 3), w: 1, h: 1 });
    }
  }
  const rooms = cells.filter(c => c.room);
  if (rooms.length < 5) return null;
  rooms.forEach((r, i) => {
    r.id = i; r.visited = false;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { tiles[idx(x, y)] = ROOM; rid[idx(x, y)] = i; }
  });
  cells.forEach(c => { if (!c.room) tiles[idx(c.x, c.y)] = CORR; });
  const nb = i => { const cx = i % 3, cy = (i / 3) | 0, o = []; if (cx > 0) o.push(i - 1); if (cx < 2) o.push(i + 1); if (cy > 0) o.push(i - 3); if (cy < 2) o.push(i + 3); return o; };
  const tree = new Set([rnd(9)]), edges = [];
  while (tree.size < 9) {
    const cand = [];
    tree.forEach(a => nb(a).forEach(b => { if (!tree.has(b)) cand.push([a, b]); }));
    const e = pick(cand); tree.add(e[1]); edges.push(e);
  }
  for (let k = 0; k < 3; k++) {
    const a = rnd(9), b = pick(nb(a));
    if (!edges.some(e => (e[0] === a && e[1] === b) || (e[0] === b && e[1] === a))) edges.push([a, b]);
  }
  const pt = c => ({ x: c.x + rnd(c.w), y: c.y + rnd(c.h) });
  const carve = (x, y) => { if (tiles[idx(x, y)] === WALL) tiles[idx(x, y)] = CORR; };
  edges.forEach(([a, b]) => {
    const p = pt(cells[a]), q = pt(cells[b]);
    let x = p.x, y = p.y;
    if (Math.random() < 0.5) {
      while (x !== q.x) { x += Math.sign(q.x - x); carve(x, y); }
      while (y !== q.y) { y += Math.sign(q.y - y); carve(x, y); }
    } else {
      while (y !== q.y) { y += Math.sign(q.y - y); carve(x, y); }
      while (x !== q.x) { x += Math.sign(q.x - x); carve(x, y); }
    }
  });
  const depth = TOP - fi;
  const lv = { fi, depth, tiles, rid, rooms, feats: [], items: [], mobs: [], seen: new Uint8Array(W * H), vis: new Uint8Array(W * H), dm: new Map(), ppMark: null };
  const names = shuffle(ROOM_NAMES.slice());
  rooms.forEach((r, i) => r.name = names[i % names.length]);
  if (Math.random() < 0.3) { const r = pick(rooms); r.name = pick(RARE_ROOMS); r.rare = true; }
  const order = shuffle(rooms.slice());
  if (!placeFeat(lv, order[0], 'elev')) return null;
  if (fi === TOP && !placeFeat(lv, order[1], 'gate')) return null;
  const n = rr(5, 7);
  for (let i = 0; i < n; i++) { const t = freeTile(lv); if (t) lv.items.push({ x: t.x, y: t.y, it: rollItem(depth) }); }
  for (let i = 0; i < 1 + depth; i++) spawnMob(lv, false);
  return lv;
}
function placeFeat(lv, room, type) {
  const cand = [];
  for (let y = room.y; y < room.y + room.h; y++) for (let x = room.x; x < room.x + room.w; x++) {
    if (featAt(lv, x, y) || lv.items.some(o => o.x === x && o.y === y)) continue;
    if (type === 'info') {
      let ok = true;
      for (const [dx, dy] of DIRS) if (lv.tiles[idx(x + dx, y + dy)] === CORR || featAt(lv, x + dx, y + dy)) ok = false;
      if (room.h < 4 && room.w < 5) ok = false;
      if (!ok) continue;
    }
    cand.push({ x, y });
  }
  if (!cand.length) return false;
  const c = pick(cand); lv.feats.push({ x: c.x, y: c.y, type }); return true;
}
function rollItem(depth) {
  const c = POOL.filter(p => depth >= p[2] && depth <= p[3]);
  let r = Math.random() * c.reduce((s, p) => s + p[1], 0);
  for (const p of c) { r -= p[1]; if (r <= 0) return mkItem(p[0]); }
  return mkItem('onigiri');
}
const featAt = (lv, x, y) => lv.feats.find(f => f.x === x && f.y === y);
const mobAt = (lv, x, y) => lv.mobs.find(m => m.hp > 0 && m.x === x && m.y === y);
function freeTile(lv, opt = {}) {
  for (let t = 0; t < 400; t++) {
    const r = pick(lv.rooms), x = r.x + rnd(r.w), y = r.y + rnd(r.h);
    if (featAt(lv, x, y) || mobAt(lv, x, y) || lv.items.some(o => o.x === x && o.y === y)) continue;
    if (P && L === lv && P.x === x && P.y === y) continue;
    if (opt.hidden && lv.vis[idx(x, y)]) continue;
    if (opt.safe && lv.mobs.some(m => m.hp > 0 && Math.max(Math.abs(m.x - x), Math.abs(m.y - y)) < 6)) continue;
    return { x, y };
  }
  return null;
}
function spawnMob(lv, hidden) {
  if (lv.mobs.length >= 2 + lv.depth) return;
  const types = Object.keys(MOBS).filter(k => MOBS[k].depth.includes(lv.depth));
  const type = pick(types), d = MOBS[type];
  const t = freeTile(lv, { hidden, safe: hidden && L === lv });
  if (!t) return;
  const hp = Math.round(d.hp * (1 + 0.07 * lv.depth));
  lv.mobs.push({ type, def: d, name: d.name, hp, maxHp: hp, atk: Math.round(d.atk * (1 + 0.05 * lv.depth)), x: t.x, y: t.y, asleep: Math.random() < 0.3 ? rr(10, 40) : 0, tx: null, ty: null, tick: false, ax: 0, ay: 0, at: 0, lx: 0, ly: 0, lt: 0, ft: 0 });
}

/* =========================================================
   ゲームの状態
   ========================================================= */
let G = null, P = null, L = null;
let MODE = 'title';           // title / how / scene / play / inv / elev / ending / end
let showMini = true;

function newGame() {
  G = { levels: [], fi: TOP, sec: 0, turns: 0, log: [], over: false, result: null, pf: rr(0, 3), hint: null, ann: 0, kills: 0, rooms: 0, half: false, sel: 0, fx: [], shakeT: 0, auto: null, cam: { x: 0, y: 0 }, picked: false, autoMark: null };
  P = null; L = null;
  for (let i = 0; i < FLOORS.length; i++) G.levels.push(genLevel(i));
  // 案内所：4Fは必ず。ほかは2つの階にだけ
  const infoFloors = [TOP, ...shuffle([0, 1, 2, 3]).slice(0, 2)];
  infoFloors.forEach(fi => { const lv = G.levels[fi]; for (const r of shuffle(lv.rooms.slice())) { if (lv.feats.some(f => f.type === 'elev' && lv.rid[idx(f.x, f.y)] === r.id)) continue; if (placeFeat(lv, r, 'info')) break; } });
  // パスポートと、まぎらわしい赤い手帳
  const put = (fi, it) => { const lv = G.levels[fi]; const t = freeTile(lv); if (t) lv.items.push({ x: t.x, y: t.y, it }); };
  put(G.pf, Object.assign(redNote(), { real: true }));
  [FAKES[0], ...shuffle(FAKES.slice(1)).slice(0, 2)].forEach(f => put(rr(0, 3), Object.assign(redNote(), { real: false, fake: f })));
  L = G.levels[TOP];
  L.mobs = L.mobs.slice(0, 2);
  const t = freeTile(L, { safe: true }) || freeTile(L);
  P = { x: t.x, y: t.y, hp: 50, maxHp: 50, lv: 1, xp: 0, base: 3, weapon: null, armor: null, inv: [mkItem('ticket'), mkItem('onigiri')], haste: 0, sleep: 0, hasPassport: false, face: 1, ax: 0, ay: 0, at: 0, lx: 0, ly: 0, lt: 0, ft: 0 };
  const r = L.rid[idx(P.x, P.y)];
  if (r >= 0) { L.rooms[r].visited = true; G.rooms = 1; addTo('rooms', L.rooms[r].name); }
  G.colorsAtStart = unlockedColors();
  SAVE.plays++; persist();
  updateVis();
}

/* ---------- 視界 ---------- */
const isWall = (lv, x, y) => !inb(x, y) || lv.tiles[idx(x, y)] === WALL;
function walkable(lv, x, y) { if (isWall(lv, x, y)) return false; const f = featAt(lv, x, y); return !(f && f.type === 'info'); }
const cornerOK = (lv, x, y, dx, dy) => !(dx && dy) || (!isWall(lv, x + dx, y) && !isWall(lv, x, y + dy));
function canMove(lv, x, y, dx, dy) {
  const nx = x + dx, ny = y + dy;
  if (!walkable(lv, nx, ny) || !cornerOK(lv, x, y, dx, dy)) return false;
  if (mobAt(lv, nx, ny)) return false;
  if (lv === L && P.x === nx && P.y === ny) return false;
  return true;
}
function canAttack(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return Math.max(Math.abs(dx), Math.abs(dy)) === 1 && cornerOK(L, ax, ay, dx, dy);
}
function updateVis() {
  L.vis.fill(0);
  const mark = (x, y) => { if (inb(x, y)) { L.vis[idx(x, y)] = 1; L.seen[idx(x, y)] = 1; } };
  const r = L.rid[idx(P.x, P.y)];
  if (r >= 0) { const rm = L.rooms[r]; for (let y = rm.y - 1; y <= rm.y + rm.h; y++) for (let x = rm.x - 1; x <= rm.x + rm.w; x++) mark(x, y); }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(P.x + dx, P.y + dy);
}
function getDM(lv, tx, ty) {
  const key = tx + ',' + ty;
  if (lv.dm.has(key)) return lv.dm.get(key);
  const d = new Int16Array(W * H).fill(-1), q = [idx(tx, ty)]; d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % W, y = (c / W) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(lv, nx, ny) || !cornerOK(lv, x, y, dx, dy)) continue;
      const ni = idx(nx, ny); if (d[ni] >= 0) continue;
      d[ni] = d[c] + 1; q.push(ni);
    }
  }
  lv.dm.set(key, d); return d;
}

/* ---------- メッセージ ---------- */
function log(text, cls = '') { G.log.push({ text, cls }); if (G.log.length > 40) G.log.shift(); renderLog(); }
function renderLog() {
  if (!G) return;
  const n = innerHeight < 700 ? 2 : 3;
  $('#log').innerHTML = G.log.slice(-n).map(l => `<li class="${l.cls}">${l.text}</li>`).join('');
}
function fx(x, y, text, color) { G.fx.push({ x, y, text, color, t: now() }); }

/* =========================================================
   1ターンの処理
   ========================================================= */
function act(a) {
  if (!G || MODE !== 'play' || G.over) return false;
  let used = false;
  if (a.type === 'move') used = tryMove(a.dx, a.dy);
  else if (a.type === 'wait') { used = true; if (Math.random() < 0.08) log(pick(['きのぴーは天井を見上げた。', 'きのぴーは時計を見た。まだ大丈夫な気がした。', 'きのぴーは深呼吸した。']), 'dim'); }
  else if (a.type === 'context') return contextAction();
  if (used) endTurn(); else updateHUD();
  return used;
}
function contextAction() {
  const f = featAt(L, P.x, P.y);
  if (f && f.type === 'elev') { openElevator(); return false; }
  if (f && f.type === 'gate') { checkGate(); endTurn(); return true; }
  return act({ type: 'wait' });
}
function setMoveAnim(e, fx0, fy0) { e.ax = fx0 - e.x; e.ay = fy0 - e.y; e.at = now(); }
function tryMove(dx, dy) {
  const nx = P.x + dx, ny = P.y + dy;
  if (dx) P.face = dx;
  if (!inb(nx, ny)) return false;
  const m = mobAt(L, nx, ny);
  if (m) {
    if (!cornerOK(L, P.x, P.y, dx, dy)) return false;
    P.lx = dx; P.ly = dy; P.lt = now();
    playerAttack(m); return true;
  }
  const f = featAt(L, nx, ny);
  if (f && f.type === 'info') { talkInfo(); return true; }
  if (isWall(L, nx, ny) || !cornerOK(L, P.x, P.y, dx, dy)) return false;
  const ox = P.x, oy = P.y;
  P.x = nx; P.y = ny; setMoveAnim(P, ox, oy);
  Sound.se('step');
  afterMove();
  return true;
}
function enterRoomMsg() {
  const r = L.rid[idx(P.x, P.y)];
  if (r >= 0 && !L.rooms[r].visited) {
    L.rooms[r].visited = true; G.rooms++;
    const first = addTo('rooms', L.rooms[r].name);
    if (L.rooms[r].rare) { Sound.se('fake'); log(`めずらしい部屋「${L.rooms[r].name}」に入った。${first ? '（忘れ物センターに記録）' : ''}`, 'good'); }
    else log(`「${L.rooms[r].name}」に入った。${first ? '（忘れ物センターに記録）' : ''}`, 'dim');
  }
}
function afterMove() {
  enterRoomMsg();
  const k = L.items.findIndex(o => o.x === P.x && o.y === P.y);
  if (k >= 0) pickup(k);
  const f = featAt(L, P.x, P.y);
  if (f && f.type === 'elev') log('エレベーターの前に来た。「エレベーターに乗る」で好きな階へ行ける。');
  else if (f && f.type === 'gate') checkGate();
}
function pickup(k) {
  const o = L.items[k], it = o.it;
  if (P.inv.length >= MAX_INV) { log(`${it.name}が落ちている。持ち物がいっぱいで拾えない。`); return; }
  L.items.splice(k, 1);
  G.picked = true;
  if (it.kind === 'note') {
    if (it.real) {
      it.name = 'パスポート'; it.kind = 'passport'; it.desc = '本物だ。写真のきのぴーは、少し若い。';
      P.hasPassport = true; L.ppMark = null; P.inv.unshift(it); addTo('items', 'passport');
      Sound.se('passport'); fx(P.x, P.y, 'パスポート！', '#B3261E');
      log('赤い手帳を拾った。……パスポートだ！', 'good');
      log('エレベーターで4Fに戻って、出国審査へ。', 'good');
      return;
    }
    it.name = it.fake.name; it.kind = 'fake'; it.desc = it.fake.text;
    P.inv.push(it); Sound.se('fake');
    const first = addTo('fakes', it.name);
    log(`赤い手帳を拾った。……${it.name}だった。${first ? '（忘れ物センターに記録）' : ''}`, 'dim');
    return;
  }
  P.inv.push(it); Sound.se('pickup');
  const first = addTo('items', it.key);
  log(`${it.name}を拾った。${first ? '（忘れ物センターに記録）' : ''}`);
}
function checkGate() {
  if (P.hasPassport) { G.over = true; G.result = 'win'; return; }
  Sound.se('deny');
  log('審査官「パスポートを拝見します」', 'ann');
  log(pick(['きのぴーは搭乗券を見せた。だめだった。', 'きのぴーはポケットを裏返した。何も出てこなかった。', '審査官は、ゆっくり首を横にふった。']), 'bad');
}
function talkInfo() {
  Sound.se('blip');
  if (P.hasPassport) { log('案内係「お気をつけて、いってらっしゃいませ」'); return; }
  if (G.fi === TOP) { log('案内係「パスポートの落とし物は、ここには届いていません。下の階で落とされたのでは？」'); return; }
  G.hint = G.pf;
  if (G.pf === G.fi) log('案内係「赤い手帳なら、この階で見たという方がいらっしゃいました」', 'good');
  else log(`案内係「パスポートですか。${FLOORS[G.pf].no}で、それらしい物を見たと聞いています」`, 'good');
}

/* ---------- 戦い ---------- */
const atkVal = () => P.base + (P.weapon ? P.weapon.pow : 0);
const defVal = () => (P.armor ? P.armor.pow : 0);
function playerAttack(m) {
  m.asleep = 0;
  if (Math.random() < 0.1) { Sound.se('miss'); fx(m.x, m.y, 'ミス', '#9AA1A9'); log('きのぴーの攻撃。空振りした。', 'dim'); return; }
  const d = Math.max(1, Math.round(atkVal() * (0.8 + Math.random() * 0.45)));
  m.hp -= d; m.ft = now();
  Sound.se('swing'); setTimeout(() => Sound.se('hit'), 60);
  fx(m.x, m.y, String(d), '#F2C230');
  log(`きのぴーの攻撃。${m.name}に${d}のダメージ。`);
  if (m.hp <= 0) {
    log(m.def.bye);
    G.kills++;
    addTo('met', m.type); SAVE.beat[m.type] = (SAVE.beat[m.type] || 0) + 1; saveDirty = true;
    L.mobs = L.mobs.filter(o => o.hp > 0);
    gainXp(m.def.xp);
  }
}
function gainXp(n) {
  P.xp += n;
  while (P.lv < XP.length && P.xp >= XP[P.lv]) {
    P.lv++; P.maxHp += 5; P.hp = P.maxHp; P.base += 1;
    Sound.se('levelup'); fx(P.x, P.y, 'レベルアップ', '#2F8A50');
    log(`きのぴーはレベル${P.lv}になった。体力が全回復して、攻撃が上がった。`, 'good');
  }
}
function mobAttack(m) {
  const d = m.def;
  m.lx = clamp(P.x - m.x, -1, 1); m.ly = clamp(P.y - m.y, -1, 1); m.lt = now();
  if (Math.random() < 0.15) { Sound.se('miss'); fx(P.x, P.y, 'ミス', '#9AA1A9'); log(`${m.name}の攻撃は外れた。`, 'dim'); return; }
  if (d.special === 'time') {
    Sound.se('eat'); fx(P.x, P.y, '-1分', '#C9332B');
    log(`${m.name}に試食をすすめられた。断れなかった。（1分たった）`, 'bad');
    passTime(60); return;
  }
  if (d.special === 'sleep' && Math.random() < 0.45 && P.sleep === 0) {
    P.sleep = 3; fx(P.x, P.y, 'Zzz', '#5A7FA8');
    log(`${m.name}が${d.verb}。きのぴーは眠ってしまった。`, 'bad'); return;
  }
  const dmg = Math.max(1, Math.round(m.atk * (0.8 + Math.random() * 0.45)) - defVal());
  P.hp -= dmg; P.ft = now(); G.shakeT = now();
  Sound.se('hurt'); fx(P.x, P.y, String(dmg), '#E5534B');
  log(`${m.name}が${d.verb}。${dmg}のダメージ。`, 'bad');
  if (P.hp <= 0) { P.hp = 0; G.over = true; G.result = 'down'; G.downBy = m.name; }
}
function randomStep(m) {
  const opts = DIRS.filter(([dx, dy]) => canMove(L, m.x, m.y, dx, dy));
  if (!opts.length) return false;
  const [dx, dy] = pick(opts); m.x += dx; m.y += dy; return true;
}
function stepVia(m, dm) {
  const cur = dm[idx(m.x, m.y)];
  let best = null, bd = cur < 0 ? 9999 : cur;
  for (const [dx, dy] of DIRS) {
    if (!canMove(L, m.x, m.y, dx, dy)) continue;
    const v = dm[idx(m.x + dx, m.y + dy)];
    if (v >= 0 && v < bd) { bd = v; best = [dx, dy]; }
  }
  if (!best) return false;
  m.x += best[0]; m.y += best[1]; return true;
}
function mobStep(m) {
  if (m.hp <= 0 || G.over) return;
  if (canAttack(m.x, m.y, P.x, P.y)) { mobAttack(m); return; }
  const sees = L.vis[idx(m.x, m.y)];
  if (sees) { m.tx = P.x; m.ty = P.y; }
  if (m.def.move === 'erratic' && Math.random() < 0.4) { randomStep(m); return; }
  if (m.tx == null || (m.x === m.tx && m.y === m.ty)) {
    const r = pick(L.rooms); m.tx = r.x + rnd(r.w); m.ty = r.y + rnd(r.h);
    if (!walkable(L, m.tx, m.ty)) { m.tx = null; return; }
  }
  if (!stepVia(m, getDM(L, m.tx, m.ty))) { if (Math.random() < 0.5) randomStep(m); if (!sees) m.tx = null; }
}
function mobsAct() {
  for (const m of L.mobs) {
    if (G.over) break;
    if (m.hp <= 0) continue;
    const sx = m.x, sy = m.y;
    if (m.asleep > 0) { m.asleep--; if (L.vis[idx(m.x, m.y)] && Math.random() < 0.12) m.asleep = 0; continue; }
    if (m.def.slow) { m.tick = !m.tick; if (m.tick) continue; }
    const n = m.def.speed || 1;
    for (let i = 0; i < n; i++) mobStep(m);
    if (m.x !== sx || m.y !== sy) setMoveAnim(m, sx, sy);
  }
}
function passTime(s) {
  G.sec += s;
  const t = START + G.sec;
  while (G.ann < ANN.length && t >= ANN[G.ann][0]) { Sound.se('chime'); log(ANN[G.ann][1], 'ann'); G.ann++; }
  Sound.setLevel(t >= 8 * 3600 + 40 * 60 ? 2 : t >= 8 * 3600 + 30 * 60 ? 1 : 0);
  if (t >= DEAD && !G.over) { G.sec = DEAD - START; G.over = true; G.result = 'time'; }
}
function endTurn(sec) {
  if (!G.over) {
    const dt = sec != null ? sec : (P.haste > 0 ? STEP / 2 : STEP);
    passTime(dt);
    if (P.haste > 0 && sec == null) { P.haste--; if (!P.haste) log('早歩きが終わった。', 'dim'); }
    G.turns++;
    updateVis();
    G.half = !G.half;
    if (!G.over && !(P.haste > 0 && G.half)) mobsAct();
    if (G.turns % 50 === 0) spawnMob(L, true);
    let guard = 0;
    while (P.sleep > 0 && !G.over && guard++ < 10) {
      P.sleep--; passTime(STEP); G.turns++; updateVis(); mobsAct();
      if (!P.sleep && !G.over) log('きのぴーは目を覚ました。');
    }
    updateVis();
    for (const m of L.mobs) if (m.hp > 0 && L.vis[idx(m.x, m.y)]) addTo('met', m.type);
    if (saveDirty) persist();
  }
  updateHUD();
  if (G.over) finish();
}

/* ---------- エレベーター ---------- */
function openElevator() {
  stopAuto();
  Sound.se('tap');
  const rows = FLOORS.map((f, i) => i).reverse().map(i => {
    const cur = i === G.fi;
    const hint = (!P.hasPassport && G.hint === i) ? '<span class="hint">パスポート？</span>' : (i === TOP && P.hasPassport ? '<span class="hint">出国審査</span>' : '');
    return `<button class="ebtn ${cur ? 'cur' : ''}" data-floor="${i}" ${cur ? 'disabled' : ''}><span class="en">${FLOORS[i].no.replace('F', '')}</span><span class="et">${FLOORS[i].no} ${FLOORS[i].title}${i === TOP ? '（出国審査）' : ''}</span>${cur ? '<span class="ec">いまここ</span>' : hint}</button>`;
  }).join('');
  openSheet(`<div class="elev">
    <div class="elev-disp"><span>▲▼</span><b>${FLOORS[G.fi].no}</b></div>
    <p class="elev-note">行き先の階を押してください。1階分で20秒かかります。エレベーターを待つこともあります。</p>
    <div class="elev-btns">${rows}</div>
  </div>
  <div class="btn-row"><button class="btn-line" data-a="close">乗らない</button></div>`, 'elev');
}
function ride(target) {
  closeSheet();
  MODE = 'play';
  const wait = pick([0, 0, 15, 15, 30, 60]);
  const total = wait + 20 * Math.abs(target - G.fi);
  if (wait >= 30) log('エレベーターがなかなか来なかった。', 'dim');
  G.fi = target; L = G.levels[G.fi];
  const ev = L.feats.find(f => f.type === 'elev');
  const blocker = mobAt(L, ev.x, ev.y);
  if (blocker) { const t = freeTile(L, { hidden: true }); if (t) { blocker.x = t.x; blocker.y = t.y; } }
  P.x = ev.x; P.y = ev.y; P.ax = P.ay = 0;
  Sound.se('elevator');
  log(`ポーン。${FLOORS[G.fi].no} ${FLOORS[G.fi].title}に着いた。`);
  updateVis(); enterRoomMsg();
  endTurn(total);
}

/* ---------- 持ち物 ---------- */
function primaryLabel(it) {
  if (it.kind === 'food') return '食べる';
  if (it.kind === 'drink') return '飲む';
  if (it.kind === 'paper') return '読む';
  if (it.kind === 'weapon' || it.kind === 'armor') return (P.weapon === it || P.armor === it) ? '外す' : '装備する';
  return '見る';
}
const canDrop = it => it.kind !== 'ticket' && it.kind !== 'passport';
function useItem(i) {
  const it = P.inv[i]; if (!it) return;
  closeSheet(); MODE = 'play';
  let turn = true;
  if (it.kind === 'food') {
    P.inv.splice(i, 1);
    const h = Math.min(it.heal, P.maxHp - P.hp); P.hp += h;
    Sound.se('eat'); fx(P.x, P.y, '+' + h, '#2F8A50');
    log(`${it.name}を食べた。体力が${h}回復した。`, 'good');
  } else if (it.kind === 'drink') {
    P.inv.splice(i, 1); P.haste = 30;
    Sound.se('drink'); log('缶コーヒーを飲んだ。きのぴーは早歩きになった。', 'good');
  } else if (it.kind === 'paper') {
    P.inv.splice(i, 1); Sound.se('paper'); readPaper(it);
  } else if (it.kind === 'weapon') {
    if (P.weapon === it) { P.weapon = null; log(`${it.name}を外した。`); } else { P.weapon = it; log(`${it.name}を装備した。攻撃が${atkVal()}になった。`); }
    Sound.se('equip');
  } else if (it.kind === 'armor') {
    if (P.armor === it) { P.armor = null; log(`${it.name}を外した。`); } else { P.armor = it; log(`${it.name}を装備した。防御が${defVal()}になった。`); }
    Sound.se('equip');
  } else {
    log(`${it.name}：${itemDesc(it)}`); turn = false;
  }
  if (turn) endTurn(); else updateHUD();
}
function readPaper(it) {
  if (it.fx === 'map') {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (L.tiles[idx(x, y)] === WALL) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inb(x + dx, y + dy)) L.seen[idx(x + dx, y + dy)] = 1;
    }
    log('館内マップを広げた。この階の間取りがわかった。', 'good');
  } else if (it.fx === 'call') {
    Sound.se('chime');
    log('パスポートをお探しの、きのぴー様……', 'ann');
    if (P.hasPassport) log('……パスポートは手の中にあった。呼ばれていたのは自分だった。', 'dim');
    else if (G.pf === G.fi) {
      const o = L.items.find(o => o.it.real);
      if (o) { L.seen[idx(o.x, o.y)] = 1; L.ppMark = { x: o.x, y: o.y }; }
      G.hint = G.fi;
      log('「この階で見たというお客様がいらっしゃいます」地図にしるしがついた。', 'good');
    } else { G.hint = G.pf; log(`「${FLOORS[G.pf].no}で、それらしい物を見たというお客様がいらっしゃいます」`, 'good'); }
  } else {
    log(pick(['搭乗のしおりを読んだ。「時間に余裕をもってお越しください」と書いてある。', '搭乗のしおりを読んだ。最後のページに小さく「がんばれ」と書いてある。']), 'dim');
  }
}
function dropItem(i) {
  const it = P.inv[i]; closeSheet(); MODE = 'play';
  if (!it) return;
  if (!canDrop(it)) { log('これは手放せない。', 'dim'); return; }
  if (L.items.some(o => o.x === P.x && o.y === P.y) || featAt(L, P.x, P.y)) { log('ここには置けない。', 'dim'); return; }
  if (P.weapon === it) P.weapon = null;
  if (P.armor === it) P.armor = null;
  P.inv.splice(i, 1); L.items.push({ x: P.x, y: P.y, it });
  log(`${it.name}を置いた。`);
  endTurn();
}
function openInv() {
  if (MODE !== 'play' || !G || G.over) return;
  stopAuto();
  G.sel = clamp(G.sel, 0, P.inv.length - 1);
  Sound.se('tap');
  MODE = 'inv'; renderInv(); modal.hidden = false;
}
function renderInv() {
  const rows = P.inv.map((it, i) => {
    const tag = (P.weapon === it || P.armor === it) ? '<span class="tag">装備中</span>' : (it.kind === 'passport' || it.kind === 'ticket') ? '<span class="tag key">大事なもの</span>' : '';
    const sel = i === G.sel;
    return `<li class="${sel ? 'sel' : ''}">
      <button class="irow" data-i="${i}" aria-expanded="${sel}"><canvas class="ico" data-icon="${i}" width="72" height="72"></canvas><span class="iname">${it.name}</span>${tag}</button>
      ${sel ? `<div class="idesc">${itemDesc(it)}</div><div class="iacts"><button class="go" data-a="use">${primaryLabel(it)}</button>${canDrop(it) ? '<button data-a="drop">置く</button>' : ''}</div>` : ''}
    </li>`;
  }).join('');
  sheet.innerHTML = `<h2>持ち物 <small>${P.inv.length} / ${MAX_INV}</small></h2>
    <dl class="equip"><dt>武器</dt><dd>${P.weapon ? `${P.weapon.name}（攻撃+${P.weapon.pow}）` : 'なし'}</dd><dt>防具</dt><dd>${P.armor ? `${P.armor.name}（防御+${P.armor.pow}）` : 'なし'}</dd></dl>
    <ul class="inv">${rows}</ul>
    <div class="btn-row"><button class="btn-line" data-a="close">閉じる</button></div>`;
  sheet.querySelectorAll('canvas[data-icon]').forEach(c => {
    const g = c.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, 72, 72); drawItem(g, P.inv[+c.dataset.icon], 36, 36, 72);
  });
  const s = sheet.querySelector('li.sel .go');
  if (s) s.focus({ preventScroll: false });
}

/* ---------- 自動で歩く（タップ移動） ---------- */
function findPath(sx, sy, tx, ty) {
  const prev = new Int32Array(W * H).fill(-2); prev[idx(sx, sy)] = -1;
  const q = [idx(sx, sy)];
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = c % W, y = (c / W) | 0;
    if (x === tx && y === ty) break;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny) || !L.seen[idx(nx, ny)] || !walkable(L, nx, ny) || !cornerOK(L, x, y, dx, dy)) continue;
      const ni = idx(nx, ny); if (prev[ni] !== -2) continue;
      prev[ni] = c; q.push(ni);
    }
  }
  if (prev[idx(tx, ty)] === -2) return null;
  const path = []; let c = idx(tx, ty);
  while (c !== idx(sx, sy)) { path.unshift([c % W, (c / W) | 0]); c = prev[c]; }
  return path;
}
const visMobs = () => L.mobs.filter(m => m.hp > 0 && L.vis[idx(m.x, m.y)] && !m.asleep).length;
function startAuto(tx, ty) {
  stopAuto();
  if (!inb(tx, ty)) return;
  const dx = tx - P.x, dy = ty - P.y;
  if (!dx && !dy) { act({ type: 'context' }); return; }
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 1) { act({ type: 'move', dx, dy }); return; }
  if (!L.seen[idx(tx, ty)] || !walkable(L, tx, ty)) return;
  const path = findPath(P.x, P.y, tx, ty);
  if (!path || !path.length) return;
  G.auto = { path, timer: null };
  G.autoMark = { x: tx, y: ty, t: now() };
  autoStep();
}
function autoStep() {
  if (!G || !G.auto) return;
  if (MODE !== 'play' || G.over || !G.auto.path.length) { stopAuto(); return; }
  const [nx, ny] = G.auto.path.shift();
  if (mobAt(L, nx, ny)) { stopAuto(); return; }
  const before = visMobs(), hp = P.hp; G.picked = false;
  const used = act({ type: 'move', dx: nx - P.x, dy: ny - P.y });
  const adj = L.mobs.some(m => m.hp > 0 && !m.asleep && Math.max(Math.abs(m.x - P.x), Math.abs(m.y - P.y)) === 1);
  if (!used || !G.auto || !G.auto.path.length || visMobs() > before || adj || P.hp < hp || G.picked || P.sleep || featAt(L, P.x, P.y)) { stopAuto(); return; }
  G.auto.timer = setTimeout(autoStep, MOVE_MS + 25);
}
function stopAuto() { if (G && G.auto) { clearTimeout(G.auto.timer); G.auto = null; G.autoMark = null; } }

/* =========================================================
   描画（キャラクター・アイテム・設備）
   ========================================================= */
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function ell(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function eyes(g, cx, cy, s, gap = 0.08, r = 0.03) { g.fillStyle = '#1D2125'; circ(g, cx - s * gap, cy, s * r); circ(g, cx + s * gap, cy, s * r); }
function whiteEyes(g, cx, cy, s) { g.fillStyle = '#fff'; circ(g, cx - s * .08, cy, s * .055); circ(g, cx + s * .08, cy, s * .055); g.fillStyle = '#1D2125'; circ(g, cx - s * .07, cy + s * .01, s * .025); circ(g, cx + s * .09, cy + s * .01, s * .025); }
function shadow(g, cx, y, s) { g.fillStyle = 'rgba(0,0,0,.15)'; ell(g, cx, y + s * .9, s * .24, s * .055); }

/* きのぴー：ベージュと白のしましまの服の男の子 */
function drawBoy(g, x, y, s, o = {}) {
  const cx = x + s / 2, face = o.face || 0, ph = o.walk || 0;
  const bob = Math.abs(Math.sin(ph * Math.PI)) * s * 0.035;
  shadow(g, cx, y, s);
  const sw = Math.sin(ph * Math.PI * 2) * s * 0.045;
  const legY = y + s * 0.71 - bob;
  g.fillStyle = '#3C4250';
  g.fillRect(cx - s * .11 + sw, legY, s * .09, s * .15); g.fillRect(cx + s * .02 - sw, legY, s * .09, s * .15);
  g.fillStyle = '#F4F4F2';
  g.fillRect(cx - s * .13 + sw, legY + s * .13, s * .12, s * .045); g.fillRect(cx + s * .01 - sw, legY + s * .13, s * .12, s * .045);
  // しましまの服
  const bx = cx - s * .18, by = y + s * .43 - bob, bw = s * .36, bh = s * .31;
  g.save(); rrect(g, bx, by, bw, bh, s * .08); g.clip();
  g.fillStyle = '#FFFFFF'; g.fillRect(bx, by, bw, bh);
  g.fillStyle = o.stripe || stripeHex();
  for (let i = 0; i < 5; i++) g.fillRect(bx, by + i * bh / 5 + bh / 10, bw, bh / 10);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = Math.max(1, s * .02); rrect(g, bx, by, bw, bh, s * .08); g.stroke();
  // 腕
  const armSw = o.pose === 'search' ? -s * .05 : 0;
  g.fillStyle = '#F1D3B5'; circ(g, cx - s * .21, by + s * .17 + armSw, s * .05); circ(g, cx + s * .21, by + s * .17 + armSw, s * .05);
  if (o.passport) { g.fillStyle = '#B3261E'; g.fillRect(cx + s * .19, by + s * .08, s * .1, s * .13); g.fillStyle = '#E2C15A'; g.fillRect(cx + s * .22, by + s * .13, s * .04, s * .02); }
  // 頭
  const hy = y + s * .27 - bob;
  g.fillStyle = '#F1D3B5'; circ(g, cx, hy, s * .2);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = Math.max(1, s * .015); g.beginPath(); g.arc(cx, hy, s * .2, 0, Math.PI * 2); g.stroke();
  // 髪
  g.fillStyle = '#3B2F2A';
  g.beginPath(); g.arc(cx, hy, s * .21, Math.PI * 1.0, Math.PI * 2.0); g.lineTo(cx + s * .2, hy - s * .02);
  g.quadraticCurveTo(cx + s * .1, hy - s * .07, cx, hy - s * .05); g.quadraticCurveTo(cx - s * .12, hy - s * .08, cx - s * .2, hy - s * .02); g.closePath(); g.fill();
  // 顔
  if (face !== 'back') {
    const ex = (typeof face === 'number' ? face : 0) * s * .035;
    eyes(g, cx + ex, hy + s * .05, s, .07, .022);
    g.fillStyle = 'rgba(230,120,110,.35)'; circ(g, cx - s * .12 + ex, hy + s * .1, s * .03); circ(g, cx + s * .12 + ex, hy + s * .1, s * .03);
    if (o.pose === 'shock') { g.strokeStyle = '#1D2125'; g.lineWidth = Math.max(1, s * .015); g.beginPath(); g.arc(cx + ex, hy + s * .13, s * .03, 0, Math.PI * 2); g.stroke(); }
  }
}

function drawMob(g, m, x, y, s) {
  const cx = x + s / 2, cy = y + s / 2;
  shadow(g, cx, y, s);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1;
  switch (m.type) {
    case 'hato':
      g.fillStyle = '#8E949B'; g.beginPath(); g.ellipse(cx - s * .04, cy + s * .1, s * .25, s * .17, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#5E8F7A'; circ(g, cx + s * .1, cy - s * .03, s * .08);
      g.fillStyle = '#6E747B'; circ(g, cx + s * .14, cy - s * .12, s * .1);
      g.fillStyle = '#E0A030'; g.beginPath(); g.moveTo(cx + s * .23, cy - s * .14); g.lineTo(cx + s * .32, cy - s * .1); g.lineTo(cx + s * .23, cy - s * .07); g.fill();
      g.fillStyle = '#E0662C'; circ(g, cx + s * .16, cy - s * .14, s * .03);
      g.strokeStyle = '#C66'; g.lineWidth = s * .03; g.beginPath(); g.moveTo(cx - s * .04, cy + s * .26); g.lineTo(cx - s * .04, cy + s * .34); g.moveTo(cx + s * .05, cy + s * .26); g.lineTo(cx + s * .05, cy + s * .34); g.stroke();
      break;
    case 'case':
      g.strokeStyle = '#3A3F45'; g.lineWidth = s * .04; g.strokeRect(cx - s * .08, cy - s * .32, s * .16, s * .1);
      g.fillStyle = '#3E7C8C'; rrect(g, cx - s * .21, cy - s * .22, s * .42, s * .48, s * .06); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = s * .03; g.beginPath(); g.moveTo(cx - s * .08, cy - s * .18); g.lineTo(cx - s * .08, cy + s * .22); g.moveTo(cx + s * .08, cy - s * .18); g.lineTo(cx + s * .08, cy + s * .22); g.stroke();
      g.fillStyle = '#2A2E33'; circ(g, cx - s * .14, cy + s * .3, s * .04); circ(g, cx + s * .14, cy + s * .3, s * .04);
      whiteEyes(g, cx, cy - s * .04, s);
      break;
    case 'shishoku':
      g.fillStyle = '#F4F4F2'; g.beginPath(); g.moveTo(cx - s * .14, cy - s * .02); g.lineTo(cx + s * .14, cy - s * .02); g.lineTo(cx + s * .2, cy + s * .32); g.lineTo(cx - s * .2, cy + s * .32); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#E9C8A6'; circ(g, cx, cy - s * .16, s * .13);
      g.fillStyle = '#4A3A33'; g.beginPath(); g.arc(cx, cy - s * .2, s * .14, Math.PI, 0); g.fill();
      eyes(g, cx, cy - s * .13, s, .05, .022);
      g.strokeStyle = '#2A2E33'; g.lineWidth = s * .035; g.beginPath(); g.moveTo(cx - s * .3, cy + s * .08); g.lineTo(cx + s * .3, cy + s * .08); g.stroke();
      g.fillStyle = '#E8C547'; for (const o of [-.2, -.05, .1, .24]) g.fillRect(cx + s * o - s * .03, cy + s * .02, s * .06, s * .05);
      break;
    case 'pillow':
      g.strokeStyle = '#8FB3D9'; g.lineWidth = s * .17; g.lineCap = 'round';
      g.beginPath(); g.arc(cx, cy - s * .04, s * .19, Math.PI * 0.02, Math.PI * 0.98); g.stroke();
      g.lineCap = 'butt';
      eyes(g, cx, cy + s * .14, s, .06, .025);
      break;
    case 'tour': {
      const cols = ['#B5654A', '#5A7FA8', '#7C9A5B'];
      [[-.17, .06], [.17, .06], [0, -.04]].forEach(([ox, oy], i) => {
        g.fillStyle = cols[i]; rrect(g, cx + s * ox - s * .1, cy + s * oy, s * .2, s * .24, s * .06); g.fill();
        g.fillStyle = '#E9C8A6'; circ(g, cx + s * ox, cy + s * oy - s * .06, s * .08);
        eyes(g, cx + s * ox, cy + s * oy - s * .06, s, .03, .015);
      });
      g.strokeStyle = '#3A3F45'; g.lineWidth = s * .025; g.beginPath(); g.moveTo(cx - s * .32, cy + s * .3); g.lineTo(cx - s * .32, cy - s * .34); g.stroke();
      g.fillStyle = '#F2C230'; g.beginPath(); g.moveTo(cx - s * .32, cy - s * .34); g.lineTo(cx - s * .1, cy - s * .27); g.lineTo(cx - s * .32, cy - s * .2); g.fill();
      break;
    }
    case 'cart':
      g.strokeStyle = '#8C949C'; g.lineWidth = s * .045; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(cx - s * .3, cy - s * .2); g.lineTo(cx - s * .22, cy + s * .18); g.lineTo(cx + s * .26, cy + s * .18); g.stroke();
      g.fillStyle = 'rgba(140,148,156,.45)'; g.fillRect(cx - s * .16, cy - s * .12, s * .4, s * .26); g.strokeRect(cx - s * .16, cy - s * .12, s * .4, s * .26);
      g.fillStyle = '#2A2E33'; circ(g, cx - s * .16, cy + s * .28, s * .055); circ(g, cx + s * .2, cy + s * .28, s * .055);
      whiteEyes(g, cx + s * .04, cy + s * .01, s);
      break;
    case 'robo':
      g.strokeStyle = '#5E656D'; g.lineWidth = s * .03; g.beginPath(); g.moveTo(cx, cy - s * .24); g.lineTo(cx, cy - s * .36); g.stroke();
      g.fillStyle = '#C9332B'; circ(g, cx, cy - s * .37, s * .04);
      g.fillStyle = '#C7CCD1'; rrect(g, cx - s * .22, cy - s * .24, s * .44, s * .52, s * .1); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#1D2125'; rrect(g, cx - s * .15, cy - s * .14, s * .3, s * .1, s * .04); g.fill();
      g.fillStyle = '#5FE0E8'; circ(g, cx + s * .06, cy - s * .09, s * .025);
      g.fillStyle = '#2B3A67'; g.fillRect(cx - s * .1, cy + s * .06, s * .2, s * .04);
      break;
  }
}

function drawUmbrella(g, cx, cy, s, k) {
  const canopy = { folding: '#2E4A7A', vinyl: 'rgba(232,238,244,.9)', sturdy: '#1F2328', shikomi: '#7A1F2B' }[k];
  const len = k === 'folding' ? .24 : .34;
  g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 4);
  g.strokeStyle = k === 'sturdy' ? '#3A3F45' : '#9AA1A9'; g.lineWidth = Math.max(1.5, s * .035);
  g.beginPath(); g.moveTo(0, -s * len - s * .04); g.lineTo(0, s * len * .8); g.stroke();
  g.strokeStyle = (k === 'sturdy' || k === 'shikomi') ? '#7A5534' : (k === 'vinyl' ? '#E9ECEF' : '#3A3F45'); g.lineWidth = Math.max(2, s * .05);
  g.beginPath(); g.arc(-s * .06, s * len * .8, s * .06, 0, Math.PI); g.stroke();
  g.fillStyle = canopy;
  g.beginPath(); g.moveTo(0, -s * len); g.lineTo(s * .075, -s * len * .1); g.lineTo(0, s * len * .4); g.lineTo(-s * .075, -s * len * .1); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.stroke();
  if (k === 'vinyl') { g.fillStyle = '#FFFFFF'; g.fillRect(-s * .04, -s * len * .05, s * .08, s * .03); }
  if (k === 'shikomi') { g.fillStyle = '#D9B54A'; g.fillRect(-s * .035, s * len * .38, s * .07, s * .045); g.fillRect(-s * .015, -s * len - s * .06, s * .03, s * .04); }
  if (k === 'folding') { g.fillStyle = '#E9ECEF'; g.fillRect(-s * .06, -s * len * .2, s * .12, s * .025); }
  g.restore();
}
function drawItem(g, it, cx, cy, s) {
  if (!it) return;
  g.save(); g.lineWidth = Math.max(1, s * .02); g.strokeStyle = 'rgba(0,0,0,.35)';
  const k = it.key;
  if (k === 'onigiri') {
    g.fillStyle = '#FAFAF7'; g.beginPath(); g.moveTo(cx, cy - s * .2); g.quadraticCurveTo(cx + s * .05, cy - s * .2, cx + s * .21, cy + s * .12); g.quadraticCurveTo(cx + s * .22, cy + s * .17, cx + s * .16, cy + s * .17); g.lineTo(cx - s * .16, cy + s * .17); g.quadraticCurveTo(cx - s * .22, cy + s * .17, cx - s * .21, cy + s * .12); g.quadraticCurveTo(cx - s * .05, cy - s * .2, cx, cy - s * .2); g.fill(); g.stroke();
    g.fillStyle = '#26332B'; g.fillRect(cx - s * .09, cy + s * .03, s * .18, s * .14);
  } else if (k === 'pan') {
    g.fillStyle = '#D9A24A'; ell(g, cx, cy + s * .04, s * .23, s * .16); g.stroke();
    g.fillStyle = '#F0CF85'; ell(g, cx, cy, s * .19, s * .1);
    g.strokeStyle = 'rgba(160,110,40,.55)'; g.lineWidth = Math.max(1, s * .015);
    g.beginPath(); for (const o of [-.1, 0, .1]) { g.moveTo(cx + s * o - s * .05, cy - s * .08); g.lineTo(cx + s * o + s * .05, cy + s * .08); } g.stroke();
  } else if (k === 'coffee') {
    g.fillStyle = '#6E4428'; rrect(g, cx - s * .11, cy - s * .2, s * .22, s * .4, s * .04); g.fill(); g.stroke();
    g.fillStyle = '#EDE0CB'; g.fillRect(cx - s * .11, cy - s * .05, s * .22, s * .1);
    g.fillStyle = '#B9BFC5'; g.fillRect(cx - s * .09, cy - s * .22, s * .18, s * .03);
  } else if (k === 'map') {
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.moveTo(cx - s * .22, cy - s * .15); g.lineTo(cx - s * .07, cy - s * .19); g.lineTo(cx + s * .07, cy - s * .15); g.lineTo(cx + s * .22, cy - s * .19); g.lineTo(cx + s * .22, cy + s * .17); g.lineTo(cx + s * .07, cy + s * .21); g.lineTo(cx - s * .07, cy + s * .17); g.lineTo(cx - s * .22, cy + s * .21); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#9DC3A0'; g.fillRect(cx - s * .16, cy - s * .08, s * .1, s * .08);
    g.fillStyle = '#F2C230'; g.fillRect(cx + s * .02, cy + s * .02, s * .12, s * .08);
  } else if (k === 'call') {
    g.fillStyle = '#F2C230'; rrect(g, cx - s * .22, cy - s * .12, s * .44, s * .24, s * .03); g.fill(); g.stroke();
    g.fillStyle = '#23272C'; g.beginPath(); g.moveTo(cx - s * .12, cy - s * .04); g.lineTo(cx - s * .06, cy - s * .04); g.lineTo(cx + s * .02, cy - s * .09); g.lineTo(cx + s * .02, cy + s * .09); g.lineTo(cx - s * .06, cy + s * .04); g.lineTo(cx - s * .12, cy + s * .04); g.closePath(); g.fill();
    g.strokeStyle = '#23272C'; g.beginPath(); g.arc(cx + s * .04, cy, s * .08, -0.7, 0.7); g.stroke();
  } else if (k === 'shiori') {
    g.fillStyle = '#9CC3E0'; rrect(g, cx - s * .15, cy - s * .2, s * .3, s * .4, s * .02); g.fill(); g.stroke();
    g.fillStyle = '#FFFFFF'; for (let i = 0; i < 3; i++) g.fillRect(cx - s * .1, cy - s * .1 + i * s * .08, s * .2, s * .03);
  } else if (it.kind === 'weapon') {
    drawUmbrella(g, cx, cy, s, k);
  } else if (k === 'magazine') {
    g.fillStyle = '#EEE6D6'; rrect(g, cx - s * .16, cy - s * .21, s * .32, s * .42, s * .02); g.fill(); g.stroke();
    g.fillStyle = '#5A7FA8'; g.fillRect(cx - s * .16, cy - s * .21, s * .32, s * .1);
    g.fillStyle = '#C9A46A'; g.fillRect(cx - s * .1, cy - s * .04, s * .2, s * .14);
  } else if (k === 'neck') {
    g.strokeStyle = '#8FB3D9'; g.lineWidth = s * .12; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy - s * .03, s * .14, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
  } else if (k === 'ipad') {
    g.fillStyle = '#2A2E33'; rrect(g, cx - s * .16, cy - s * .21, s * .32, s * .42, s * .04); g.fill();
    g.fillStyle = '#9FC6E6'; g.fillRect(cx - s * .13, cy - s * .17, s * .26, s * .34);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = Math.max(1, s * .012); g.beginPath(); g.moveTo(cx - s * .1, cy - s * .12); g.lineTo(cx + s * .02, cy); g.lineTo(cx - s * .04, cy + s * .12); g.moveTo(cx + s * .02, cy); g.lineTo(cx + s * .12, cy - s * .04); g.stroke();
  } else if (k === 'coat') {
    g.fillStyle = '#B08A5A'; g.beginPath(); g.moveTo(cx - s * .08, cy - s * .22); g.lineTo(cx + s * .08, cy - s * .22); g.lineTo(cx + s * .22, cy - s * .12); g.lineTo(cx + s * .2, cy + s * .22); g.lineTo(cx - s * .2, cy + s * .22); g.lineTo(cx - s * .22, cy - s * .12); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#6E5434'; g.beginPath(); g.moveTo(cx, cy - s * .22); g.lineTo(cx, cy + s * .22); g.stroke();
    g.fillStyle = '#4A3A28'; for (const o of [-.08, .02, .12]) circ(g, cx + s * .04, cy + s * o, s * .018);
  } else if (k === 'ticket') {
    g.fillStyle = '#FFFFFF'; rrect(g, cx - s * .23, cy - s * .12, s * .46, s * .24, s * .02); g.fill(); g.stroke();
    g.fillStyle = '#2B3A67'; g.fillRect(cx - s * .23, cy - s * .12, s * .46, s * .06);
    g.fillStyle = '#9AA1A9'; g.fillRect(cx - s * .17, cy, s * .2, s * .025); g.fillRect(cx - s * .17, cy + s * .05, s * .14, s * .025);
  } else {
    // 赤い手帳（パスポートも、まぎらわしい手帳も同じ見た目）
    g.fillStyle = '#B3261E'; rrect(g, cx - s * .15, cy - s * .2, s * .3, s * .4, s * .03); g.fill(); g.stroke();
    g.strokeStyle = '#E2C15A'; g.lineWidth = Math.max(1, s * .022); g.beginPath(); g.arc(cx, cy - s * .03, s * .065, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#E2C15A'; g.fillRect(cx - s * .08, cy + s * .09, s * .16, s * .022);
  }
  g.restore();
}

function drawFeat(g, f, x, y, s, c) {
  const cx = x + s / 2;
  if (f.type === 'elev') {
    const m = s * .06;
    g.fillStyle = '#8A939C'; rrect(g, x + m, y + m, s - 2 * m, s - 2 * m, s * .06); g.fill();
    g.fillStyle = '#D3D9DE'; g.fillRect(x + s * .17, y + s * .3, s * .32, s * .6); g.fillRect(x + s * .51, y + s * .3, s * .32, s * .6);
    g.fillStyle = '#6E7780'; g.fillRect(x + s * .49, y + s * .3, s * .02, s * .6);
    g.fillStyle = '#23272C'; rrect(g, x + s * .28, y + s * .1, s * .44, s * .15, s * .03); g.fill();
    g.fillStyle = '#F2C230';
    g.beginPath(); g.moveTo(cx - s * .12, y + s * .21); g.lineTo(cx - s * .07, y + s * .13); g.lineTo(cx - s * .02, y + s * .21); g.fill();
    g.beginPath(); g.moveTo(cx + s * .02, y + s * .14); g.lineTo(cx + s * .12, y + s * .14); g.lineTo(cx + s * .07, y + s * .22); g.fill();
  } else if (f.type === 'gate') {
    g.fillStyle = '#23272C'; rrect(g, x + s * .04, y + s * .05, s * .92, s * .34, s * .05); g.fill();
    g.fillStyle = '#F2C230'; g.font = `700 ${Math.max(7, s * .19)}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('出国審査', cx, y + s * .225);
    g.fillStyle = '#8A939C'; g.fillRect(x + s * .12, y + s * .45, s * .12, s * .45); g.fillRect(x + s * .76, y + s * .45, s * .12, s * .45);
    g.fillStyle = '#C9332B'; g.fillRect(x + s * .24, y + s * .6, s * .52, s * .07);
    g.fillStyle = '#FFFFFF'; g.fillRect(x + s * .36, y + s * .6, s * .1, s * .07); g.fillRect(x + s * .56, y + s * .6, s * .1, s * .07);
  } else if (f.type === 'info') {
    g.fillStyle = '#B9A385'; g.fillRect(x + s * .08, y + s * .58, s * .84, s * .32);
    g.fillStyle = '#9C8768'; g.fillRect(x + s * .08, y + s * .58, s * .84, s * .06);
    g.fillStyle = '#23272C'; rrect(g, x + s * .24, y + s * .06, s * .52, s * .46, s * .06); g.fill();
    g.fillStyle = '#F2C230'; g.font = `700 ${s * .38}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('?', cx, y + s * .3);
  }
}

/* =========================================================
   ゲーム画面の描画
   ========================================================= */
const cv = $('#cv'), ctx = cv.getContext('2d');
const mini = $('#mini'), mctx = mini.getContext('2d');
const modal = $('#modal'), sheet = $('#sheet');
let VW = 11, VH = 11, TS = 32, MS = 2, COL = {};

function readColors() {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  COL = { floor: v('--floor'), grid: v('--grid'), corr: v('--corr'), wall: v('--wall'), wallEdge: v('--walledge'), void: v('--void'), fog: v('--fog'), ink: v('--ink') };
}
function setup() {
  const st = $('#stage');
  if (!st || $('#app').hidden) return;
  const w = st.clientWidth, h = st.clientHeight;
  if (!w || !h) return;
  VW = w < 520 ? 11 : 17;
  TS = Math.max(18, Math.floor(w / VW));
  VH = Math.floor(h / TS); if (VH % 2 === 0) VH--;
  if (VH < 7) { VH = 7; TS = Math.max(16, Math.floor(h / VH)); VW = Math.floor(w / TS); if (VW % 2 === 0) VW--; }
  const dpr = window.devicePixelRatio || 1;
  const cw = TS * VW, ch = TS * VH;
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  cv.style.left = Math.floor((w - cw) / 2) + 'px'; cv.style.top = Math.floor((h - ch) / 2) + 'px';
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  MS = w < 520 ? 2 : 3;
  mini.style.width = W * MS + 'px'; mini.style.height = H * MS + 'px';
  mini.width = W * MS * dpr; mini.height = H * MS * dpr;
  if (mctx) mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  readColors();
  renderLog();
}
function rpos(e, t) {
  const p = clamp((t - e.at) / MOVE_MS, 0, 1), off = (1 - p) * (1 - p);
  const q = clamp((t - e.lt) / 170, 0, 1), l = Math.sin(Math.PI * q) * 0.35;
  return { x: e.x + e.ax * off + e.lx * l, y: e.y + e.ay * off + e.ly * l, moving: p < 1, p };
}
function draw() {
  if (!G || !L || !ctx) return;
  const t = now(), s = TS, c = COL;
  ctx.save();
  ctx.fillStyle = c.void; ctx.fillRect(0, 0, VW * s, VH * s);
  if (!reduceMotion && t - G.shakeT < 220) { const k = (1 - (t - G.shakeT) / 220) * 4; ctx.translate((Math.random() - .5) * k, (Math.random() - .5) * k); }
  const pp = rpos(P, t);
  const camX = pp.x - (VW - 1) / 2, camY = pp.y - (VH - 1) / 2;
  G.cam = { x: camX, y: camY };
  const X = tx => Math.floor((tx - camX) * s), Y = ty => Math.floor((ty - camY) * s);
  const x0 = Math.floor(camX), y0 = Math.floor(camY);
  for (let ty = y0; ty <= y0 + VH; ty++) for (let tx = x0; tx <= x0 + VW; tx++) {
    if (!inb(tx, ty)) continue;
    const i = idx(tx, ty); if (!L.seen[i]) continue;
    const px = X(tx), py = Y(ty), tt = L.tiles[i];
    if (tt === WALL) {
      ctx.fillStyle = c.wall; ctx.fillRect(px, py, s + 1, s + 1);
      if (ty + 1 < H && L.tiles[idx(tx, ty + 1)] !== WALL) { ctx.fillStyle = c.wallEdge; ctx.fillRect(px, py + Math.floor(s * .7), s + 1, Math.ceil(s * .3) + 1); }
    } else {
      ctx.fillStyle = tt === ROOM ? c.floor : c.corr; ctx.fillRect(px, py, s + 1, s + 1);
      if (tt === ROOM) { ctx.strokeStyle = c.grid; ctx.lineWidth = 1; ctx.strokeRect(px + .5, py + .5, s - 1, s - 1); }
    }
  }
  const onScr = (x, y) => x >= x0 - 1 && y >= y0 - 1 && x <= x0 + VW + 1 && y <= y0 + VH + 1;
  for (const f of L.feats) if (L.seen[idx(f.x, f.y)] && onScr(f.x, f.y)) drawFeat(ctx, f, X(f.x), Y(f.y), s, c);
  for (const o of L.items) if (L.seen[idx(o.x, o.y)] && onScr(o.x, o.y)) drawItem(ctx, o.it, X(o.x) + s / 2, Y(o.y) + s / 2, s);
  for (let ty = y0; ty <= y0 + VH; ty++) for (let tx = x0; tx <= x0 + VW; tx++) {
    if (!inb(tx, ty)) continue;
    const i = idx(tx, ty);
    if (L.seen[i] && !L.vis[i]) { ctx.fillStyle = c.fog; ctx.fillRect(X(tx), Y(ty), s + 1, s + 1); }
  }
  if (L.ppMark) { ctx.strokeStyle = '#F2C230'; ctx.lineWidth = 3; ctx.strokeRect(X(L.ppMark.x) + 2, Y(L.ppMark.y) + 2, s - 4, s - 4); }
  if (G.autoMark) { ctx.strokeStyle = 'rgba(43,108,212,.8)'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.strokeRect(X(G.autoMark.x) + 3, Y(G.autoMark.y) + 3, s - 6, s - 6); ctx.setLineDash([]); }
  // 空港のひとたち
  for (const m of L.mobs) {
    if (m.hp <= 0 || !L.vis[idx(m.x, m.y)]) continue;
    const r = rpos(m, t), px = (r.x - camX) * s, py = (r.y - camY) * s;
    ctx.save();
    if (t - m.ft < 240 && Math.floor((t - m.ft) / 60) % 2 === 0) ctx.globalAlpha = 0.35;
    drawMob(ctx, m, px, py, s);
    ctx.restore();
    if (m.hp < m.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(px + s * .15, py + s * .02, s * .7, Math.max(3, s * .06));
      ctx.fillStyle = '#E5534B'; ctx.fillRect(px + s * .15, py + s * .02, s * .7 * Math.max(0, m.hp / m.maxHp), Math.max(3, s * .06));
    }
    if (m.asleep > 0) zzz(ctx, px, py, s);
  }
  // きのぴー
  {
    const px = (pp.x - camX) * s, py = (pp.y - camY) * s;
    ctx.save();
    if (t - P.ft < 300 && Math.floor((t - P.ft) / 60) % 2 === 0) ctx.globalAlpha = 0.4;
    drawBoy(ctx, px, py, s, { face: P.face, walk: pp.moving ? pp.p : 0, passport: P.hasPassport });
    ctx.restore();
    if (P.sleep > 0) zzz(ctx, px, py, s);
  }
  // 数字などのポップアップ
  G.fx = G.fx.filter(f => t - f.t < 800);
  for (const f of G.fx) {
    const k = (t - f.t) / 800;
    ctx.globalAlpha = 1 - k * k;
    ctx.font = `700 ${Math.max(12, s * .36)}px "BIZ UDPGothic", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const px = (f.x - camX + .5) * s, py = (f.y - camY + .1 - k * .6) * s;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(f.text, px, py);
    ctx.fillStyle = f.color; ctx.fillText(f.text, px, py);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (showMini) drawMini();
}
function zzz(g, x, y, s) { g.fillStyle = '#5A7FA8'; g.font = `700 ${s * .28}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('z', x + s * .84, y + s * .14); }
function drawMini() {
  if (!mctx) return;
  const m = MS;
  mctx.clearRect(0, 0, W * m, H * m);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y); if (!L.seen[i] || L.tiles[i] === WALL) continue;
    mctx.fillStyle = L.tiles[i] === ROOM ? 'rgba(110,120,130,.6)' : 'rgba(110,120,130,.38)';
    mctx.fillRect(x * m, y * m, m, m);
  }
  for (const f of L.feats) if (L.seen[idx(f.x, f.y)]) { mctx.fillStyle = f.type === 'info' ? '#5A7FA8' : f.type === 'gate' ? '#C9332B' : '#E0A800'; mctx.fillRect(f.x * m - 1, f.y * m - 1, m + 2, m + 2); }
  if (L.ppMark) { mctx.fillStyle = '#B3261E'; mctx.fillRect(L.ppMark.x * m - 1, L.ppMark.y * m - 1, m + 2, m + 2); }
  for (const o of L.items) if (L.vis[idx(o.x, o.y)]) { mctx.fillStyle = '#4C9BC9'; mctx.fillRect(o.x * m, o.y * m, m, m); }
  for (const mo of L.mobs) if (mo.hp > 0 && L.vis[idx(mo.x, mo.y)]) { mctx.fillStyle = '#2A2E33'; mctx.fillRect(mo.x * m, mo.y * m, m, m); }
  mctx.fillStyle = '#C9332B'; mctx.fillRect(P.x * m - 1, P.y * m - 1, m + 2, m + 2);
}

/* ---------- 画面上部の表示 ---------- */
function goalText() {
  if (P.hasPassport) return G.fi === TOP ? 'パスポートがある。出国審査のゲートへ向かおう。' : 'パスポートがある。エレベーターで4F 出発ロビーに戻り、出国審査へ。';
  if (G.hint != null) return `赤い手帳（パスポート）を探そう。${FLOORS[G.hint].no}にあるらしい。`;
  return '赤い手帳（パスポート）を探そう。「？」の案内所で聞くと手がかりがもらえる。';
}
function updateHUD() {
  if (!G || !P) return;
  const t = START + G.sec;
  $('#clock').textContent = fmt(t);
  const st = $('#fstatus');
  if (G.over && G.result === 'win') { st.textContent = '出発'; st.className = 'chip boarding'; }
  else if (G.over) { st.textContent = '出発済み'; st.className = 'chip'; }
  else if (t >= 8 * 3600 + 40 * 60) { st.textContent = '最終案内'; st.className = 'chip final'; }
  else if (t >= 8 * 3600 + 30 * 60) { st.textContent = '搭乗中'; st.className = 'chip boarding'; }
  else { st.textContent = '搭乗手続中'; st.className = 'chip'; }
  $('#floorNo').textContent = FLOORS[G.fi].no;
  $('#floorTitle').textContent = FLOORS[G.fi].title;
  $('#hp').textContent = `${Math.max(0, P.hp)}/${P.maxHp}`;
  $('#hpfill').style.width = (100 * Math.max(0, P.hp) / P.maxHp) + '%';
  $('#hpbar').classList.toggle('low', P.hp <= P.maxHp * 0.3);
  $('#lv').textContent = P.lv;
  $('#invCount').textContent = P.inv.length;
  const goal = $('#goal'); goal.textContent = goalText(); goal.classList.toggle('ok', P.hasPassport);
  const f = featAt(L, P.x, P.y), b = $('#bAction');
  if (f && f.type === 'elev') { b.textContent = 'エレベーターに乗る'; b.classList.add('hot'); }
  else if (f && f.type === 'gate') { b.textContent = '出国審査を受ける'; b.classList.add('hot'); }
  else { b.textContent = P.haste > 0 ? 'その場で待つ（早歩き中）' : 'その場で待つ'; b.classList.remove('hot'); }
}

/* =========================================================
   シート（持ち物・エレベーター・遊び方・結果）
   ========================================================= */
function openSheet(html, mode) {
  sheet.innerHTML = html; modal.hidden = false; MODE = mode;
  const b = sheet.querySelector('.btn-dark, .ebtn:not(:disabled), button');
  if (b) b.focus({ preventScroll: true });
}
function closeSheet() {
  modal.hidden = true;
  if (MODE === 'inv' || MODE === 'elev') MODE = 'play';
  else if (MODE === 'how' || MODE === 'center' || MODE === 'closet') { MODE = 'title'; updateTitleBest(); }
  if (G && MODE === 'play') updateHUD();
}
sheet.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const a = b.dataset.a;
  if (MODE === 'inv') {
    if (b.dataset.i != null) { G.sel = +b.dataset.i; Sound.se('tap'); renderInv(); }
    else if (a === 'use') useItem(G.sel);
    else if (a === 'drop') dropItem(G.sel);
    else if (a === 'close') closeSheet();
  } else if (MODE === 'elev') {
    if (b.dataset.floor != null) ride(+b.dataset.floor);
    else if (a === 'close') closeSheet();
  } else if (MODE === 'how' || MODE === 'center') {
    if (a === 'close') { Sound.se('tap'); closeSheet(); }
  } else if (MODE === 'closet') {
    if (b.dataset.color) { SAVE.color = b.dataset.color; persist(); Sound.se('equip'); showCloset(); }
    else if (a === 'close') { Sound.se('tap'); closeSheet(); }
  } else if (MODE === 'end') {
    if (a === 'again') { modal.hidden = true; startScene(true); }
    else if (a === 'title') { modal.hidden = true; toTitle(); }
  }
});
modal.addEventListener('click', e => { if (e.target === modal && ['inv', 'elev', 'how', 'center', 'closet'].includes(MODE)) closeSheet(); });

/* ---------- 忘れ物センター ---------- */
function showCenter() {
  const notes = [{ name: 'パスポート', text: '本物だ。写真のきのぴーは、少し若い。', got: SAVE.items.includes('passport') }]
    .concat(FAKES.map(f => ({ name: f.name, text: f.text, got: SAVE.fakes.includes(f.name) })));
  const itemKeys = Object.keys(ITEMS).filter(k => k !== 'ticket');
  const mobKeys = Object.keys(MOBS);
  const cnt = { notes: notes.filter(n => n.got).length, items: itemKeys.filter(k => SAVE.items.includes(k)).length, mobs: mobKeys.filter(k => SAVE.met.includes(k)).length, rooms: ALL_ROOMS.filter(n => SAVE.rooms.includes(n)).length };
  const total = notes.length + itemKeys.length + mobKeys.length + ALL_ROOMS.length;
  const got = cnt.notes + cnt.items + cnt.mobs + cnt.rooms;
  const unknown = '<span class="zk-name unknown">？？？</span>';
  const noteHTML = notes.map((n, i) => `<li class="zk ${n.got ? '' : 'off'}"><canvas width="72" height="72" data-draw="${n.got ? 'note' : ''}"></canvas><div>${n.got ? `<span class="zk-name">${n.name}</span><span class="zk-desc">${n.text}</span>` : unknown}</div></li>`).join('');
  const itemHTML = itemKeys.map(k => {
    const ok = SAVE.items.includes(k), it = ITEMS[k];
    let desc = ok ? itemDesc(Object.assign({ key: k }, it)) : '';
    if (ok && k === 'shikomi' && !SAVE.shikomi) desc += `（${SHIKOMI_CLEARS}回クリアすると、中身がわかる）`;
    return `<li class="zk ${ok ? '' : 'off'}"><canvas width="72" height="72" data-draw="${ok ? 'item:' + k : ''}"></canvas><div>${ok ? `<span class="zk-name">${it.name}</span><span class="zk-desc">${desc}</span>` : unknown}</div></li>`;
  }).join('');
  const mobHTML = mobKeys.map(k => {
    const ok = SAVE.met.includes(k);
    return `<li class="zk ${ok ? '' : 'off'}"><canvas width="72" height="72" data-draw="${ok ? 'mob:' + k : ''}"></canvas><div>${ok ? `<span class="zk-name">${MOBS[k].name}</span><span class="zk-desc">やっつけた数：${SAVE.beat[k] || 0}</span>` : unknown}</div></li>`;
  }).join('');
  const roomHTML = ROOM_NAMES.map(n => SAVE.rooms.includes(n) ? `<li class="chip-room">${n}</li>` : '<li class="chip-room off">？？？</li>').join('')
    + RARE_ROOMS.map(n => SAVE.rooms.includes(n) ? `<li class="chip-room rare">${n}</li>` : '<li class="chip-room rare off">めずらしい部屋</li>').join('');
  openSheet(`<h2>忘れ物センター <small>${got} / ${total}</small></h2>
    <p class="note">空港で拾ったもの、入った部屋、出会ったひとたちが記録されます。</p>
    <h3 class="zk-h">赤い手帳 <small>${cnt.notes} / ${notes.length}</small></h3>
    <p class="zk-hint">全種類集めると、きのぴーの服が1着増えます。</p>
    <ul class="zk-grid">${noteHTML}</ul>
    <h3 class="zk-h">拾ったもの <small>${cnt.items} / ${itemKeys.length}</small></h3>
    <ul class="zk-grid">${itemHTML}</ul>
    <h3 class="zk-h">空港のひとたち <small>${cnt.mobs} / ${mobKeys.length}</small></h3>
    <ul class="zk-grid">${mobHTML}</ul>
    <h3 class="zk-h">入った部屋 <small>${cnt.rooms} / ${ALL_ROOMS.length}</small></h3>
    <p class="zk-hint">めずらしい部屋は、たまにしか現れません。</p>
    <ul class="zk-rooms">${roomHTML}</ul>
    <div class="btn-row"><button class="btn-dark" data-a="close">閉じる</button></div>`, 'center');
  sheet.querySelectorAll('canvas[data-draw]').forEach(c => {
    const g = c.getContext('2d'); if (!g) return;
    const d = c.dataset.draw;
    g.clearRect(0, 0, 72, 72);
    if (!d) { g.fillStyle = 'rgba(128,128,128,.35)'; g.font = '700 30px "BIZ UDPGothic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('？', 36, 38); return; }
    if (d === 'note') drawItem(g, { key: 'note' }, 36, 36, 72);
    else if (d.startsWith('item:')) drawItem(g, Object.assign({ key: d.slice(5) }, ITEMS[d.slice(5)]), 36, 36, 72);
    else if (d.startsWith('mob:')) drawMob(g, { type: d.slice(4) }, 4, 2, 64);
  });
}

/* ---------- きのぴーの服 ---------- */
function showCloset() {
  const un = unlockedColors();
  const html = COLORS.map(c => {
    const ok = un.includes(c.id), cur = SAVE.color === c.id || (!un.includes(SAVE.color) && c.id === 'beige');
    return `<li><button class="cl ${cur ? 'cur' : ''}" ${ok ? `data-color="${c.id}"` : 'disabled'} aria-pressed="${cur}">
      <canvas width="96" height="96" data-col="${ok ? c.hex : ''}"></canvas>
      <span class="cl-name">${ok ? c.name : '？？？'}</span>
      <span class="cl-cond">${ok ? (cur ? '着ている' : '着替える') : c.cond}</span>
    </button></li>`;
  }).join('');
  openSheet(`<h2>きのぴーの服 <small>${un.length} / ${COLORS.length}</small></h2>
    <p class="note">しましまの色を選べます。条件を満たすと、服が増えます。</p>
    <ul class="closet">${html}</ul>
    <div class="btn-row"><button class="btn-dark" data-a="close">閉じる</button></div>`, 'closet');
  sheet.querySelectorAll('canvas[data-col]').forEach(c => {
    const g = c.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, 96, 96);
    if (c.dataset.col) drawBoy(g, 8, 4, 80, { face: 0, stripe: c.dataset.col });
    else { g.globalAlpha = 0.25; drawBoy(g, 8, 4, 80, { face: 0, stripe: '#888' }); g.globalAlpha = 1; }
  });
}
function updateTitleBest() {
  const el = $('#tbest'); if (!el) return;
  if (SAVE.best) el.innerHTML = `<span>自己ベスト　出発の${mins(SAVE.best.remain)}分前（${SAVE.best.title}）</span><span>クリア ${SAVE.clears}回</span>`;
  else el.innerHTML = SAVE.plays ? `<span>まだクリアしていません</span>` : '';
}

function showHow() {
  openSheet(`<h2>遊び方</h2>
    <p>赤い手帳（パスポート）を見つけて、4F 出発ロビーの「出国審査」へ。8:50を過ぎると、飛行機は出発してしまいます。</p>
    <table class="howto">
      <tr><th>時間</th><td>1歩ごとに15秒すすみます。エレベーターは1階分で20秒です。</td></tr>
      <tr><th>体力</th><td>歩いても回復しません。おにぎりや菓子パン、レベルアップで回復します。0になるとゲームオーバー。</td></tr>
      <tr><th>エレベーター</th><td>扉の絵のマス。乗ると好きな階へ行けます。</td></tr>
      <tr><th>案内所</th><td>「？」の看板。話しかけると、パスポートの手がかりがもらえます。</td></tr>
      <tr><th>赤い手帳</th><td>パスポートのほかにも、よく似た手帳が落ちています。</td></tr>
      <tr><th>スマホ</th><td>十字ボタンで移動。地図をタップすると、その場所まで歩きます。相手のほうへ進むと攻撃。</td></tr>
      <tr><th>記録</th><td>拾ったものや入った部屋は「忘れ物センター」に残ります。クリアすると、出発まで残った時間で称号がつきます。</td></tr>
      <tr><th>パソコン</th><td>矢印キー／WASDで移動、斜めはQ E Z C。Enterで決定、Spaceで待つ、Iで持ち物、Mで地図。</td></tr>
    </table>
    <div class="btn-row"><button class="btn-dark" data-a="close">わかった</button></div>`, 'how');
}

function finish() {
  stopAuto();
  if (MODE === 'ending' || MODE === 'end') return;
  MODE = 'ending';
  Sound.bgm(false);
  const info = { newColors: [], reveal: false, newBest: false };
  if (G.result === 'win') {
    const remain = Math.max(0, DEAD - (START + G.sec));
    const rank = rankFor(remain);
    info.remain = remain; info.rank = rank;
    SAVE.clears++;
    addTo('titles', rank.name);
    if (!SAVE.best || remain > SAVE.best.remain) { info.newBest = true; info.firstBest = !SAVE.best; SAVE.best = { remain, title: rank.name }; }
    if (SAVE.clears >= SHIKOMI_CLEARS && !SAVE.shikomi) { SAVE.shikomi = true; info.reveal = true; }
  }
  info.newColors = COLORS.filter(c => c.ok(SAVE) && !G.colorsAtStart.includes(c.id));
  G.endInfo = info;
  persist();
  Sound.se(G.result === 'win' ? 'win' : 'lose');
  if (G.result === 'down') log(`きのぴーは倒れた。`, 'bad');
  setTimeout(showEnd, G.result === 'win' ? 1200 : 900);
}
function depRowHTML(cols, cls) {
  return `<div class="dep-row ${cls || ''}">${cols.map((txt, ci) => `<span class="cell ${ci === 3 ? 'st' : ''}">${[...txt].map(ch => `<span class="fl">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('')}</span>`).join('')}</div>`;
}
function showEnd() {
  const r = G.result;
  const time = fmt(START + G.sec);
  let head, body;
  if (r === 'win') {
    head = 'いってらっしゃい。';
    body = '<p>きのぴーは台湾へ飛び立った。</p><p>シートベルトを締めて、パスポートを3回確かめた。ちゃんとあった。</p>';
  } else if (r === 'time') {
    head = '間に合わなかった。';
    body = `<p>飛行機は定刻通りに飛び立った。</p><p>${P.hasPassport ? 'パスポートは手の中にあったのに。' : 'パスポートは、まだどこかで眠っている。'}きのぴーは大きな窓からそれを見送った。となりにはハトがいた。</p>`;
  } else {
    head = 'きのぴーは倒れた。';
    body = `<p>${G.downBy || '何か'}にやられてしまった。</p><p>気がつくと医務室のベッドの上だった。窓の外を、KP 850が飛んでいった。</p>`;
  }
  const status = r === 'win' ? '出発' : '出発済';
  const info = G.endInfo || { newColors: [] };
  let rankHTML = '';
  if (r === 'win') {
    rankHTML = `<div class="rank">
      <span class="rank-time">出発の${mins(info.remain)}分前に搭乗</span>
      <b class="rank-name">${info.rank.name}</b>
      <span class="rank-text">${info.rank.text}</span>
      ${info.newBest ? `<span class="rank-best">${info.firstBest ? 'はじめての記録' : '自己ベスト更新'}</span>` : `<span class="rank-sub">自己ベスト：出発の${mins(SAVE.best.remain)}分前（${SAVE.best.title}）</span>`}
    </div>`;
  }
  const unlocks = [];
  info.newColors.forEach(c => unlocks.push(`きのぴーの服に「${c.name}」が増えた。`));
  if (info.reveal) unlocks.push(`仕込み傘の謎が解けた。${SHIKOMI_TRUTH}`);
  else if (r === 'win' && !SAVE.shikomi) unlocks.push(`仕込み傘の謎が解けるまで、あと${SHIKOMI_CLEARS - SAVE.clears}回。`);
  const unlockHTML = unlocks.length ? `<ul class="unlocks">${unlocks.map(u => `<li>${u}</li>`).join('')}</ul>` : '';
  openSheet(`<div class="rboard">${depRowHTML([time, 'KP850', '台北桃園', status], 'me')}</div>
    <h2>${head}</h2>${rankHTML}${body}${unlockHTML}
    <dl class="stat"><dt>時刻</dt><dd>${time}</dd><dt>レベル</dt><dd>${P.lv}</dd><dt>やっつけた相手</dt><dd>${G.kills}</dd><dt>見つけた部屋</dt><dd>${G.rooms}</dd><dt>クリア回数</dt><dd>${SAVE.clears}</dd></dl>
    <div class="btn-row"><button class="btn-dark" data-a="again">もう一度、空港へ</button><button class="btn-line" data-a="title">タイトルにもどる</button></div>`, 'end');
}

/* =========================================================
   タイトル画面
   ========================================================= */
const FLAP_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニハヒフヘホマミムメモヤユヨラリルレロワン0123456789';
const BOARD = [
  ['07:10', 'NJ211', 'ソウル', '出発'],
  ['07:55', 'TA106', 'ホノルル', '搭乗中'],
  ['08:15', 'MK330', 'ヘルシンキ', '定刻'],
  ['08:50', 'KP850', '台北桃園', '要確認'],
  ['09:40', 'SB402', 'シンガポール', '定刻'],
  ['25:00', 'ZZ000', 'どこでもない', '欠航'],
];
let flapTimer = null;
function pad(str, n) { const a = [...str]; while (a.length < n) a.push(' '); return a.join(''); }
function buildBoard() {
  const dep = $('#dep');
  dep.innerHTML = BOARD.map((r, i) => depRowHTML([r[0], r[1], pad(r[2], 6), pad(r[3], 3)], i === 3 ? 'me' : (i === 5 ? 'cx' : ''))).join('');
  const ttl = $('#ttlFlap');
  ttl.innerHTML = [...'8時50分発。'].map(ch => `<span class="fl">${ch}</span>`).join('');
  const cells = [...document.querySelectorAll('#dep .fl, #ttlFlap .fl')].map((el, i) => ({ el, final: el.textContent, until: now() + 300 + Math.random() * 1400 + (el.closest('#ttlFlap') ? 900 : 0) }));
  if (reduceMotion) return;
  cells.forEach(c => { if (c.final.trim()) c.el.textContent = pick([...FLAP_CHARS]); });
  clearInterval(flapTimer);
  flapTimer = setInterval(() => {
    const t = now(); let left = 0;
    for (const c of cells) {
      if (!c.final.trim()) continue;
      if (t < c.until) { c.el.textContent = pick([...FLAP_CHARS]); left++; }
      else if (c.el.textContent !== c.final) c.el.textContent = c.final;
    }
    if (!left) clearInterval(flapTimer);
  }, 55);
}
const tk = $('#tkino'), tkx = tk.getContext('2d');
function sizeTitleCanvas() {
  const dpr = window.devicePixelRatio || 1, w = tk.clientWidth || 320, h = tk.clientHeight || 74;
  tk.width = Math.round(w * dpr); tk.height = Math.round(h * dpr);
  if (tkx) tkx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawTitleKino(t) {
  if (!tkx) return;
  const w = tk.clientWidth || 320, h = tk.clientHeight || 74;
  tkx.clearRect(0, 0, w, h);
  tkx.fillStyle = '#30353B'; tkx.fillRect(0, h - 10, w, 10);
  tkx.fillStyle = '#3A4047'; for (let x = (t / 40) % 40 - 40; x < w; x += 40) tkx.fillRect(x, h - 10, 20, 2);
  const s = h - 6, range = w - s, period = range * 30;
  const k = (t % (period * 2)) / period;
  const goingRight = k < 1, pos = goingRight ? k : 2 - k;
  const x = pos * range;
  const pausePhase = (t / 3200) % 1;
  const stop = pausePhase > 0.82;
  drawBoy(tkx, x, h - s - 4, s, { face: goingRight ? 1 : -1, walk: stop ? 0 : (t / 420) % 1, pose: stop ? 'search' : '' });
  if (stop) {
    tkx.fillStyle = '#F2C230'; tkx.font = `700 ${s * .32}px "BIZ UDPGothic", sans-serif`; tkx.textAlign = 'center'; tkx.textBaseline = 'middle';
    tkx.fillText('？', x + s * .82, h - s - 2);
  }
  // そばに置いてあるスーツケース
  drawMob(tkx, { type: 'case' }, w - s * 0.9, h - s - 4, s * 0.8);
}
function toTitle() {
  stopAuto();
  MODE = 'title';
  Sound.bgm(false);
  $('#app').hidden = true; $('#scene').hidden = true; $('#title').hidden = false; modal.hidden = true;
  $('#tclock').textContent = fmt(START);
  buildBoard(); sizeTitleCanvas(); updateTitleBest();
}
$('#tStart').addEventListener('click', () => { Sound.init(); Sound.se('tap'); startScene(false); });
$('#tHow').addEventListener('click', () => { Sound.init(); Sound.se('tap'); showHow(); });
$('#tCenter').addEventListener('click', () => { Sound.init(); Sound.se('tap'); showCenter(); });
$('#tCloset').addEventListener('click', () => { Sound.init(); Sound.se('tap'); showCloset(); });

/* =========================================================
   登場シーン（チェックインカウンターで、パスポートがないことに気づく）
   ========================================================= */
const SCENE = [
  { pose: 'walk',   text: '午前7時20分。成田空港、4F 出発ロビー。' },
  { pose: 'walk',   text: 'きのぴーは、8時50分発の飛行機で台湾へ行く。' },
  { pose: 'stand',  who: '係員', text: 'おはようございます。パスポートを拝見します。' },
  { pose: 'stand',  who: 'きのぴー', text: 'はい。' },
  { pose: 'search', text: '（ごそごそ）' },
  { pose: 'search', items: true, text: '出てきたのは、搭乗券と、のど飴と、駐輪場のレシート。' },
  { pose: 'shock',  sfx: 'shock', text: '……パスポートが、ない。' },
  { pose: 'shock',  who: '係員', text: '8時50分の便ですね。……お待ちしております。' },
  { pose: 'think',  text: '電車を降りて、エレベーターに乗って、なぜか到着ロビーも通って……。' },
  { pose: 'think',  text: 'どこかで落としたらしい。' },
  { pose: 'go',     text: '赤い手帳（パスポート）を探して、ここ4Fの出国審査に戻ってこよう。' },
];
const scv = $('#scv'), sctx = scv.getContext('2d');
let SC = null;
function startScene(skipIntro) {
  newGame();
  if (skipIntro) { startPlay(); return; }
  MODE = 'scene';
  $('#title').hidden = true; $('#app').hidden = true; $('#scene').hidden = false;
  Sound.bgm(true);
  SC = { i: -1, shown: 0, full: '', timer: null, t0: now(), lineT: now() };
  sizeScene();
  nextLine();
}
function sizeScene() {
  const dpr = window.devicePixelRatio || 1, w = scv.clientWidth || 320, h = scv.clientHeight || 300;
  scv.width = Math.round(w * dpr); scv.height = Math.round(h * dpr);
  if (sctx) sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function nextLine() {
  if (!SC) return;
  if (SC.shown < SC.full.length) { SC.shown = SC.full.length; $('#dtext').textContent = SC.full; return; }
  SC.i++;
  if (SC.i >= SCENE.length) { startPlay(); return; }
  const l = SCENE[SC.i];
  $('#speaker').textContent = l.who || '';
  SC.full = l.text; SC.shown = 0; SC.lineT = now();
  if (l.sfx) Sound.se(l.sfx);
  clearInterval(SC.timer);
  $('#dtext').textContent = '';
  SC.timer = setInterval(() => {
    if (!SC) return;
    if (SC.shown >= SC.full.length) { clearInterval(SC.timer); return; }
    SC.shown++; $('#dtext').textContent = SC.full.slice(0, SC.shown);
    if (SC.shown % 2 === 0) Sound.se('blip');
  }, 38);
}
function drawScene(t) {
  if (!SC || !sctx || SC.i < 0) return;
  const w = scv.clientWidth, h = scv.clientHeight, g = sctx;
  const l = SCENE[Math.min(SC.i, SCENE.length - 1)];
  const lt = t - SC.lineT;
  // 背景：出発ロビー
  g.fillStyle = '#DCE0E4'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#C8CDD2'; for (let x = 0; x < w; x += 60) g.fillRect(x, 0, 2, h * .62);
  g.fillStyle = '#B9BEC4'; g.fillRect(0, h * .62, w, h * .38);
  g.fillStyle = '#AEB4BA'; for (let x = 0; x < w; x += 48) g.fillRect(x, h * .62, 1, h * .38);
  // 窓と飛行機
  g.fillStyle = '#A9C0D6'; g.fillRect(w * .05, h * .08, w * .32, h * .24);
  g.fillStyle = '#E9C9A0'; g.fillRect(w * .05, h * .26, w * .32, h * .06);
  g.fillStyle = '#F4F5F6'; const pxp = w * .05 + ((t / 60) % (w * .4)) - w * .04;
  g.save(); g.beginPath(); g.rect(w * .05, h * .08, w * .32, h * .24); g.clip();
  g.fillRect(pxp, h * .2, w * .07, h * .025); g.fillRect(pxp + w * .025, h * .175, w * .015, h * .03); g.restore();
  // 案内サイン
  const sw = Math.min(w * .52, 360), sx = w * .44;
  g.fillStyle = '#23272C'; rrect(g, sx, h * .06, sw, h * .14, 6); g.fill();
  g.fillStyle = '#F2C230'; g.font = `700 ${Math.max(11, h * .05)}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('チェックイン　KP 850　台北（桃園）　8:50', sx + 12, h * .13, sw - 24);
  // カウンターと係員
  const cxs = w * .58, cw = w * .38, s = Math.min(h * .42, w * .3);
  const staffX = cxs + cw * .45 - s / 2, staffY = h * .62 - s * .95;
  g.fillStyle = '#2B3A67'; rrect(g, staffX + s * .2, staffY + s * .45, s * .6, s * .5, s * .1); g.fill();
  g.fillStyle = '#F2C230'; g.beginPath(); g.moveTo(staffX + s * .38, staffY + s * .46); g.lineTo(staffX + s * .5, staffY + s * .58); g.lineTo(staffX + s * .62, staffY + s * .46); g.fill();
  g.fillStyle = '#F1D3B5'; circ(g, staffX + s * .5, staffY + s * .3, s * .17);
  g.fillStyle = '#4A3A33'; g.beginPath(); g.arc(staffX + s * .5, staffY + s * .28, s * .18, Math.PI, 0); g.fill();
  eyes(g, staffX + s * .5, staffY + s * .33, s, .06, .02);
  g.fillStyle = '#E9ECEF'; g.fillRect(cxs, h * .55, cw, h * .2);
  g.fillStyle = '#8A939C'; g.fillRect(cxs, h * .55, cw, h * .03);
  g.fillStyle = '#23272C'; g.fillRect(cxs + cw * .1, h * .6, cw * .25, h * .07);
  g.fillStyle = '#F2C230'; g.font = `700 ${Math.max(9, h * .035)}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'center';
  g.fillText('KP 850', cxs + cw * .225, h * .635);
  // きのぴー
  const ks = Math.min(h * .5, w * .34);
  let kx = w * .3 - ks / 2;
  if (l.pose === 'walk' && SC.i === 0) kx = -ks + clamp(lt / 1800, 0, 1) * (w * .3 + ks / 2);
  const walking = l.pose === 'walk' && SC.i === 0 && lt < 1800;
  const ky = h * .9 - ks;
  const shake = l.pose === 'search' && !reduceMotion ? Math.sin(t / 50) * ks * .02 : 0;
  drawBoy(g, kx + shake, ky, ks, { face: l.pose === 'think' ? -1 : 1, walk: walking ? (t / 420) % 1 : 0, pose: l.pose });
  // 汗・吹き出し・ポケットの中身
  if (l.pose === 'shock') {
    g.fillStyle = '#7FB6E3'; [[.82, .1], [.9, .2], [.15, .14]].forEach(([a, b]) => { g.beginPath(); g.ellipse(kx + ks * a, ky + ks * b, ks * .03, ks * .05, 0, 0, Math.PI * 2); g.fill(); });
    g.fillStyle = '#C9332B'; g.font = `700 ${ks * .3}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'center'; g.fillText('！', kx + ks * .95, ky - ks * .02);
  }
  if (l.pose === 'think') {
    g.fillStyle = '#FFFFFF'; circ(g, kx + ks * .85, ky + ks * .02, ks * .05); circ(g, kx + ks * .95, ky - ks * .1, ks * .07);
    rrect(g, kx + ks * .95, ky - ks * .45, ks * .7, ks * .3, ks * .1); g.fill();
    g.fillStyle = '#5E656D'; g.font = `700 ${ks * .14}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'center'; g.fillText('どこで…', kx + ks * 1.3, ky - ks * .3);
  }
  if (l.pose === 'search' && !l.items) {
    g.fillStyle = '#5E656D'; g.font = `700 ${ks * .18}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'center'; g.fillText('ごそごそ', kx + ks * .5, ky - ks * .05);
  }
  if (l.items) {
    const up = clamp(lt / 500, 0, 1) * ks * .1;
    drawItem(g, { key: 'ticket' }, kx + ks * .05, ky - up, ks * .6);
    g.fillStyle = '#F2C230'; circ(g, kx + ks * .5, ky - ks * .06 - up, ks * .06); g.fillStyle = '#E09A10'; g.fillRect(kx + ks * .41, ky - ks * .075 - up, ks * .04, ks * .03); g.fillRect(kx + ks * .55, ky - ks * .075 - up, ks * .04, ks * .03);
    g.fillStyle = '#FFFFFF'; g.save(); g.translate(kx + ks * .95, ky - up); g.rotate(.2); g.fillRect(-ks * .08, -ks * .12, ks * .16, ks * .24); g.fillStyle = '#9AA1A9'; for (let i = 0; i < 4; i++) g.fillRect(-ks * .05, -ks * .08 + i * ks * .045, ks * .1, ks * .015); g.restore();
  }
  if (l.pose === 'go') {
    g.fillStyle = '#B3261E'; g.font = `700 ${ks * .18}px "BIZ UDPGothic", sans-serif`; g.textAlign = 'center';
    drawItem(g, { key: 'note' }, kx + ks * 1.1, ky + ks * .1 + Math.sin(t / 300) * ks * .03, ks * .7);
    g.fillText('？', kx + ks * 1.1, ky - ks * .2);
  }
}
function startPlay() {
  if (SC) { clearInterval(SC.timer); SC = null; }
  MODE = 'play';
  $('#scene').hidden = true; $('#title').hidden = true; $('#app').hidden = false;
  Sound.bgm(true); Sound.setLevel(0);
  setup();
  Sound.se('chime');
  log('8時50分発 台北（桃園）行きは、定刻通りの出発を予定しております。', 'ann');
  log('パスポートがない。どこかで落としたらしい。', 'bad');
  updateHUD();
}
$('#dialog').addEventListener('click', () => nextLine());
$('#scv').addEventListener('click', () => nextLine());
$('#skip').addEventListener('click', () => { Sound.se('tap'); startPlay(); });

/* =========================================================
   入力
   ========================================================= */
const KEYMAP = {
  ArrowUp: [0,-1], ArrowDown: [0,1], ArrowLeft: [-1,0], ArrowRight: [1,0],
  w: [0,-1], s: [0,1], a: [-1,0], d: [1,0],
  q: [-1,-1], e: [1,-1], z: [-1,1], c: [1,1],
  '8': [0,-1], '2': [0,1], '4': [-1,0], '6': [1,0], '7': [-1,-1], '9': [1,-1], '1': [-1,1], '3': [1,1],
  Home: [-1,-1], PageUp: [1,-1], End: [-1,1], PageDown: [1,1],
};
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (MODE === 'scene') { if (k === 'Enter' || k === ' ') { e.preventDefault(); nextLine(); } else if (k === 'Escape') startPlay(); return; }
  if (MODE === 'title') { if (k === 'Enter') { e.preventDefault(); $('#tStart').click(); } return; }
  if (['how', 'elev', 'end', 'center', 'closet'].includes(MODE)) {
    if (k === 'Escape' && MODE !== 'end') { e.preventDefault(); closeSheet(); }
    return;
  }
  if (MODE === 'inv') {
    if (k === 'Escape' || k === 'i') { e.preventDefault(); closeSheet(); }
    else if (k === 'ArrowDown' || k === 's') { e.preventDefault(); G.sel = (G.sel + 1) % P.inv.length; renderInv(); }
    else if (k === 'ArrowUp' || k === 'w') { e.preventDefault(); G.sel = (G.sel - 1 + P.inv.length) % P.inv.length; renderInv(); }
    else if (k === 'Enter') { e.preventDefault(); useItem(G.sel); }
    else if (k === 'x' || k === 'Delete' || k === 'Backspace') { e.preventDefault(); dropItem(G.sel); }
    return;
  }
  if (MODE !== 'play') return;
  if (KEYMAP[k]) { e.preventDefault(); stopAuto(); act({ type: 'move', dx: KEYMAP[k][0], dy: KEYMAP[k][1] }); }
  else if (k === ' ' || k === '5' || k === 'Clear') { e.preventDefault(); stopAuto(); act({ type: 'wait' }); }
  else if (k === 'Enter') { e.preventDefault(); stopAuto(); act({ type: 'context' }); }
  else if (k === 'i') { e.preventDefault(); openInv(); }
  else if (k === 'm') { e.preventDefault(); toggleMini(); }
});
function toggleMini() { showMini = !showMini; mini.hidden = !showMini; Sound.se('tap'); }
document.querySelectorAll('[data-dir]').forEach(b => {
  let t1 = null, t2 = null;
  const go = () => { const [dx, dy] = b.dataset.dir.split(',').map(Number); if (!dx && !dy) act({ type: 'wait' }); else act({ type: 'move', dx, dy }); };
  const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
  b.addEventListener('pointerdown', e => { e.preventDefault(); stopAuto(); stop(); go(); t1 = setTimeout(() => { t2 = setInterval(go, 150); }, 340); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => b.addEventListener(ev, stop));
  b.addEventListener('contextmenu', e => e.preventDefault());
  b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go(); } });
});
$('#bAction').addEventListener('click', () => { stopAuto(); act({ type: 'context' }); });
$('#bInv').addEventListener('click', () => openInv());
$('#bMap').addEventListener('click', () => toggleMini());
$('#bSound').addEventListener('click', () => {
  Sound.init();
  const m = Sound.cycle();
  $('#bSound').textContent = ['音あり', 'BGMなし', '消音'][m];
});
// 地図をタップ／クリックで、その場所まで歩く
let downAt = null;
$('#stage').addEventListener('pointerdown', e => { downAt = { x: e.clientX, y: e.clientY }; });
$('#stage').addEventListener('pointerup', e => {
  if (MODE !== 'play' || !G || !downAt) return;
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12) return;
  const r = cv.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  if (px < 0 || py < 0 || px > r.width || py > r.height) return;
  startAuto(Math.floor(G.cam.x + px / TS + 0.0001), Math.floor(G.cam.y + py / TS + 0.0001));
});

/* ---------- ループ・リサイズ ---------- */
const titleEl = $('#title');
function frame() {
  requestAnimationFrame(frame);
  const t = now();
  if (!titleEl.hidden) drawTitleKino(t);
  else if (MODE === 'scene') drawScene(t);
  else if (G && !$('#app').hidden) draw();
}
addEventListener('resize', () => { setup(); sizeTitleCanvas(); sizeScene(); });
// 画面の部品の大きさが変わったときも、ゲーム画面を測り直す
if (window.ResizeObserver) new ResizeObserver(() => setup()).observe($('#stage'));
if (window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', readColors);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAuto(); });

toTitle();
readColors();
requestAnimationFrame(frame);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { readColors(); });
})();
