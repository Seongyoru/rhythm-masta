'use strict';
/* =========================================================
 * RhythmGame — 판정 / 노트 진행 / 캔버스 렌더링 / 이펙트
 * 레인 0~6 : A S D [SPACE] L ; '
 * 테마 : POP FANTASY (파스텔 · 캔디 노트 · 청사과)
 * ========================================================= */
/* 키 모드 : 7키(6키+스페이스) / 4키 */
const KEY_MODES = {
  '7k': { n: 7, codes: ['KeyA', 'KeyS', 'KeyD', 'Space', 'KeyL', 'Semicolon', 'Quote'], labels: ['A', 'S', 'D', 'SPACE', 'L', ';', "'"], kr: ['ㅁ', 'ㄴ', 'ㅇ', '', 'ㅣ', '', ''], space: 3, colorIdx: [0, 1, 2, 3, 4, 5, 6] },
  '4k': { n: 4, codes: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'], labels: ['D', 'F', 'J', 'K'], kr: ['ㅇ', 'ㄹ', 'ㅓ', 'ㅏ'], space: -1, colorIdx: [0, 1, 5, 6] },
};
// 키 코드 → 화면 표시용 글자 / 한글 자판
const KEY_NAME = {
  Space: 'SPACE', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: String.fromCharCode(92), BracketLeft: '[', BracketRight: ']',
  Minus: '-', Equal: '=', Backquote: '`', ShiftLeft: 'L⇧', ShiftRight: 'R⇧', ControlLeft: 'LCtrl', ControlRight: 'RCtrl', AltLeft: 'LAlt', AltRight: 'RAlt',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', CapsLock: 'Caps', Backspace: 'BS', Lang1: '한/영', Lang2: '한자',
};
const KEY_KO = { KeyQ: 'ㅂ', KeyW: 'ㅈ', KeyE: 'ㄷ', KeyR: 'ㄱ', KeyT: 'ㅅ', KeyY: 'ㅛ', KeyU: 'ㅕ', KeyI: 'ㅑ', KeyO: 'ㅐ', KeyP: 'ㅔ', KeyA: 'ㅁ', KeyS: 'ㄴ', KeyD: 'ㅇ', KeyF: 'ㄹ', KeyG: 'ㅎ', KeyH: 'ㅗ', KeyJ: 'ㅓ', KeyK: 'ㅏ', KeyL: 'ㅣ', KeyZ: 'ㅋ', KeyX: 'ㅌ', KeyC: 'ㅊ', KeyV: 'ㅍ', KeyB: 'ㅠ', KeyN: 'ㅜ', KeyM: 'ㅡ' };
function keyLabel(code) {
  if (KEY_NAME[code]) return KEY_NAME[code];
  let m = code.match(/^Key([A-Z])$/); if (m) return m[1];
  m = code.match(/^Digit(\d)$/); if (m) return m[1];
  m = code.match(/^Numpad(.+)$/); if (m) return 'N' + m[1].replace('Add', '+').replace('Subtract', '-').replace('Multiply', '*').replace('Divide', '/').replace('Decimal', '.').replace('Enter', '↵');
  return code.length > 6 ? code.slice(0, 6) : code;
}
const KEY_CODES = KEY_MODES['7k'].codes.slice();
const KEY_LABELS = KEY_MODES['7k'].labels.slice();
const KEY_KR = KEY_MODES['7k'].kr.slice();
let SPACE_LANE = 3;
const LANE_COLORS = SKINS[DEFAULT_SKIN].lanes.slice();
const PALETTE = SKINS[DEFAULT_SKIN].palette.slice();
const JW = { PERFECT: 0.042, GREAT: 0.085, GOOD: 0.130, POOR: 0.170 };
const JUDGES = {
  PERFECT: { w: 1.0, color: '#4fb8ff', label: 'PERFECT' },
  GREAT:   { w: 0.7, color: '#4cc85e', label: 'GREAT' },
  GOOD:    { w: 0.4, color: '#ffae2e', label: 'GOOD' },
  MISS:    { w: 0.0, color: '#a39bbf', label: 'MISS' },
};
const LEAD_IN = 2.4;
const FONT_D = 'Fredoka, Jua, "Segoe UI", sans-serif';
const FONT_K = 'Jua, "Noto Sans KR", "Malgun Gothic", sans-serif';
let INK = SKINS[DEFAULT_SKIN].ink;
const RAINBOW = SKINS[DEFAULT_SKIN].accent.slice();
const setArr = (a, b) => { a.length = 0; a.push(...b); };

const SHAPES = {
  apple: 'M32 18c-6-5-20-5-24 8-4 14 6 32 16 32 4 0 5-2 8-2s4 2 8 2c10 0 20-18 16-32-4-13-18-13-24-8z',
  leaf: 'M36 12c4-7 13-8 17-5-3 6-11 9-17 5z',
  star: 'M32 4l7.6 18.4L58 24l-14 12.6L48 56 32 46 16 56l4-19.4L6 24l18.4-1.6z',
  spark: 'M32 2c3 18 12 27 30 30-18 3-27 12-30 30-3-18-12-27-30-30 18-3 27-12 30-30z',
  heart: 'M32 56S6 40 6 22C6 12 14 6 22 6c5 0 8 3 10 6 2-3 5-6 10-6 8 0 16 6 16 16 0 18-26 34-26 34z',
  note: 'M24 10l30-6v38a9 9 0 1 1-5-8V16l-20 4v28a9 9 0 1 1-5-8z',
};
const PATHS = {};
for (const k in SHAPES) PATHS[k] = new Path2D(SHAPES[k]);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const [r, g, b] = hexRgb(h); return `rgba(${r},${g},${b},${a})`; }
function shade(h, k) { // k>0 → 흰색 쪽, k<0 → 검정 쪽
  const [r, g, b] = hexRgb(h);
  const f = (c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function rr(g, x, y, w, h, r) {
  if (h < 0) { y += h; h = -h; }
  if (w < 0) { x += w; w = -w; }
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function rainbowGrad(g, x0, x1, y) {
  const gr = g.createLinearGradient(x0, y || 0, x1, y || 0);
  RAINBOW.forEach((c, i) => gr.addColorStop(i / (RAINBOW.length - 1), c));
  return gr;
}

/* 곡 시간 공급원 : 오디오 파일(Web Audio) / 유튜브 영상 */
const AudioClock = {
  start(song, lead) { AudioEngine.play(song.buffer, lead); },
  time(off) { return AudioEngine.songTime(off); },
  timeAt(p, off) { return AudioEngine.songTimeAt(p, off); },
  pause() { return AudioEngine.pause(); },
  resume() { return AudioEngine.unpause(); },
  stop() { AudioEngine.stop(); AudioEngine.unpause(); },
};
const YtClock = {
  start(song, lead) { YtEngine.begin(lead); },
  time(off) { return YtEngine.songTime() - off; },
  timeAt(p, off) { return YtEngine.songTimeAt(p) - off; },
  pause() { YtEngine.pause(); return Promise.resolve(); },
  resume() { YtEngine.resume(); return Promise.resolve(); },
  stop() { YtEngine.stop(); },
};

class RhythmGame {
  constructor(canvas, hooks) {
    this.cv = canvas;
    this.g = canvas.getContext('2d');
    this.hooks = hooks || {};
    this.state = 'idle';
    this.t = -LEAD_IN;
    this.pressed = new Array(7).fill(false);
    this.releaseT = new Array(7).fill(-1e9);
    this.autoRelease = new Array(7).fill(0);
    this.laneMissT = new Array(7).fill(-1e9);
    this.holdNow = new Array(7).fill(false);
    this.particles = [];
    this.fx = [];
    this.glowCache = {};
    this.shapeCache = {};
    this.bassS = 0;
    this.floaters = Array.from({ length: 34 }, () => ({
      x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7,
      kind: 'star', color: '#ffffff',
      rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.8, ph: Math.random() * 6.28,
    }));
    this.skinId = null;
    this.mode = KEY_MODES['7k']; this.modeId = '7k'; this.N = 7;
    this.setSkin(DEFAULT_SKIN, true);
    this.raf = 0;
    this._lastFrame = 0;
    this._loop = this._loop.bind(this);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  /* ---------------- 키 모드 ---------------- */
  setMode(id, customCodes) {
    const m = KEY_MODES[id] || KEY_MODES['7k'];
    this.modeId = KEY_MODES[id] ? id : '7k';
    this.mode = m;
    this.N = m.n;
    const codes = customCodes && customCodes.length === m.n ? customCodes : m.codes;
    setArr(KEY_CODES, codes);
    setArr(KEY_LABELS, codes.map(keyLabel));
    setArr(KEY_KR, codes.map((c) => KEY_KO[c] || ''));
    SPACE_LANE = m.space;
    AudioEngine.setInnerLanes(this.N === 4 ? [1, 2] : [2, 3, 4]);
    if (this.sk) setArr(LANE_COLORS, m.colorIdx.map((i) => this.sk.lanes[i]));
    if (this.W) this.resize();
  }
  // 화면 x 좌표 → 레인 (터치 입력용)
  laneAt(x) {
    for (let l = 0; l < this.N; l++) if (x >= this.laneX[l] && x < this.laneX[l] + this.laneW[l]) return l;
    if (x < this.fieldX && x > this.fieldX - this.lw) return 0;
    if (x >= this.fieldX + this.fieldW && x < this.fieldX + this.fieldW + this.lw) return this.N - 1;
    return -1;
  }

  /* ---------------- 스킨 ---------------- */
  setSkin(id, noBuild) {
    if (!SKINS[id]) id = DEFAULT_SKIN;
    if (id === this.skinId) return;
    this.skinId = id;
    const sk = this.sk = SKINS[id];
    setArr(LANE_COLORS, (this.mode || KEY_MODES['7k']).colorIdx.map((i) => sk.lanes[i]));
    setArr(PALETTE, sk.palette);
    setArr(RAINBOW, sk.accent);
    INK = sk.ink;
    const cols = sk.palette.filter((c) => c !== '#ffffff');
    for (const f of this.floaters) { f.kind = pick(sk.floaters); f.color = pick(cols); }
    if (!noBuild) this.buildSprites();
  }

  /* ---------------- 레이아웃 / 스프라이트 ---------------- */
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    this.cv.width = Math.round(W * dpr);
    this.cv.height = Math.round(H * dpr);
    this.dpr = dpr; this.W = W; this.H = H;
    let lw;
    if (this.N === 4) {
      lw = Math.round(clamp(Math.min(H * 0.115, (W - 12) / 4), 52, 128));
      this.laneW = [lw, lw, lw, lw];
    } else {
      lw = Math.round(clamp(Math.min(H * 0.08, W * 0.075, (W - 12) / 7.7), 34, 86));
      const sw = Math.round(lw * 1.7);
      this.laneW = [lw, lw, lw, sw, lw, lw, lw];
    }
    this.lw = lw;
    this.fieldW = this.laneW.reduce((a, b) => a + b, 0);
    this.fieldX = Math.round((W - this.fieldW) / 2);
    this.laneX = [];
    let x = this.fieldX;
    for (const w of this.laneW) { this.laneX.push(x); x += w; }
    this.laneC = this.laneX.map((lx, i) => lx + this.laneW[i] / 2);
    this.judgeY = Math.round(H * 0.82);
    this.noteH = Math.max(14, Math.round(lw * 0.34));
    this.buildSprites();
  }

  buildSprites() {
    const g = this.g;
    const mk = { neon: this.makeNeonNote, flat: this.makeFlatNote, bulb: this.makeBulbNote, stripe: this.makeStripeNote }[this.sk.note] || this.makeNote;
    this.deco = this.makeDeco();
    this.noteSpr = this.laneW.map((w, l) => mk.call(this, LANE_COLORS[l], w - 8, this.noteH, l === SPACE_LANE));
    // 롱노트 몸통 : 캔디 스트라이프 패턴
    this.holdPat = LANE_COLORS.map((col) => {
      const s = 24, c = document.createElement('canvas');
      c.width = c.height = s;
      const q = c.getContext('2d');
      q.fillStyle = rgba(col, 0.55);
      q.fillRect(0, 0, s, s);
      q.fillStyle = 'rgba(255,255,255,0.35)';
      q.beginPath();
      q.moveTo(0, s * 0.5); q.lineTo(s * 0.5, 0); q.lineTo(s, 0); q.lineTo(0, s); q.closePath(); q.fill();
      q.beginPath();
      q.moveTo(s * 0.5, s); q.lineTo(s, s * 0.5); q.lineTo(s, s); q.closePath(); q.fill();
      return g.createPattern(c, 'repeat');
    });
    this.bgGrad = g.createLinearGradient(0, 0, this.W * 0.3, this.H);
    const bg = this.sk.bg;
    bg.forEach((c, i) => this.bgGrad.addColorStop(i / (bg.length - 1), c));
    this.fieldGrad = g.createLinearGradient(0, 0, 0, this.H);
    this.fieldGrad.addColorStop(0, this.sk.field[0]);
    this.fieldGrad.addColorStop(1, this.sk.field[1]);
  }

  makeNote(color, w, h, isSpace) {
    const pad = 16, dpr = this.dpr;
    const c = document.createElement('canvas');
    c.width = Math.ceil((w + pad * 2) * dpr);
    c.height = Math.ceil((h + pad * 2) * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = h / 2;
    // 은은한 컬러 글로우
    g.shadowColor = rgba(color, 0.9);
    g.shadowBlur = 12;
    // 캔디 아랫면 (입체감)
    g.fillStyle = shade(color, -0.28);
    rr(g, pad, pad + 2, w, h, r);
    g.fill();
    g.shadowBlur = 0;
    // 본체
    const gr = g.createLinearGradient(0, pad, 0, pad + h);
    gr.addColorStop(0, shade(color, 0.55));
    gr.addColorStop(0.5, color);
    gr.addColorStop(1, shade(color, -0.08));
    g.fillStyle = gr;
    rr(g, pad, pad, w, h - 2, r);
    g.fill();
    // 흰 테두리
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2.2;
    rr(g, pad + 1, pad + 1, w - 2, h - 2, r);
    g.stroke();
    // 광택
    g.fillStyle = 'rgba(255,255,255,0.75)';
    rr(g, pad + r * 0.7, pad + h * 0.16, w - r * 1.4, Math.max(2.5, h * 0.2), 3);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(pad + r * 0.75, pad + h * 0.48, Math.max(1.6, h * 0.1), 0, Math.PI * 2);
    g.fill();
    if (isSpace) {
      // 가운데 청사과 아이콘
      const s = h * 0.95 / 64;
      g.save();
      g.translate(pad + w / 2 - 32 * s, pad + h / 2 - 32 * s - 1);
      g.scale(s, s);
      g.fillStyle = '#ffffff';
      g.fill(PATHS.apple);
      g.fillStyle = '#e9ffd9';
      g.fill(PATHS.leaf);
      g.restore();
      // 좌우 반짝이
      for (const k of [-1, 1]) {
        const ss = h * 0.45 / 64;
        g.save();
        g.translate(pad + w / 2 + k * w * 0.3 - 32 * ss, pad + h / 2 - 32 * ss);
        g.scale(ss, ss);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fill(PATHS.spark);
        g.restore();
      }
    } else {
      const ss = h * 0.42 / 64;
      g.save();
      g.translate(pad + w / 2 - 32 * ss, pad + h * 0.55 - 32 * ss);
      g.scale(ss, ss);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.fill(PATHS.spark);
      g.restore();
    }
    return { c, w: w + pad * 2, h: h + pad * 2, pad };
  }

  /* ---- 노트 스타일 : 엠블럼(이중 윤곽선) ---- */
  makeFlatNote(color, w, h, isSpace) {
    const pad = 16, dpr = this.dpr;
    const c = document.createElement('canvas');
    c.width = Math.ceil((w + pad * 2) * dpr);
    c.height = Math.ceil((h + pad * 2) * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = h / 2;
    g.shadowColor = rgba(color, 0.6); g.shadowBlur = 10;
    g.fillStyle = '#0f6a2a';
    rr(g, pad, pad, w, h, r); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = color; g.lineWidth = 3;
    rr(g, pad + 1.5, pad + 1.5, w - 3, h - 3, r - 1.5); g.stroke();
    g.lineWidth = 1.2;
    rr(g, pad + 5, pad + 5, w - 10, h - 10, Math.max(1, r - 5)); g.stroke();
    if (isSpace) {
      g.beginPath(); g.arc(pad + w / 2, pad + h / 2, h * 0.22, 0, Math.PI * 2);
      g.fillStyle = color; g.fill();
    }
    return { c, w: w + pad * 2, h: h + pad * 2, pad };
  }

  /* ---- 노트 스타일 : 극장 전구 ---- */
  makeBulbNote(color, w, h, isSpace) {
    const pad = 16, dpr = this.dpr;
    const c = document.createElement('canvas');
    c.width = Math.ceil((w + pad * 2) * dpr);
    c.height = Math.ceil((h + pad * 2) * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = Math.min(6, h / 2);
    g.shadowColor = color; g.shadowBlur = 14;
    const gr = g.createLinearGradient(0, pad, 0, pad + h);
    gr.addColorStop(0, shade(color, 0.35)); gr.addColorStop(1, shade(color, -0.35));
    g.fillStyle = gr;
    rr(g, pad, pad, w, h, r); g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(60,10,20,0.6)'; g.lineWidth = 1.5;
    rr(g, pad + 0.75, pad + 0.75, w - 1.5, h - 1.5, r); g.stroke();
    const n = Math.max(3, Math.floor(w / 11)), br = Math.max(1.6, h * 0.12);
    for (let i = 0; i < n; i++) {
      const x = pad + (i + 0.5) * (w / n), y = pad + h / 2;
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath(); g.arc(x, y, br * 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fffbe8';
      g.beginPath(); g.arc(x, y, br, 0, Math.PI * 2); g.fill();
    }
    if (isSpace) {
      g.strokeStyle = '#fffbe8'; g.lineWidth = 1.5;
      rr(g, pad + 3, pad + 3, w - 6, h - 6, Math.max(1, r - 2)); g.stroke();
    }
    return { c, w: w + pad * 2, h: h + pad * 2, pad };
  }

  /* ---- 노트 스타일 : 물감 줄무늬 ---- */
  makeStripeNote(color, w, h, isSpace) {
    const pad = 16, dpr = this.dpr;
    const c = document.createElement('canvas');
    c.width = Math.ceil((w + pad * 2) * dpr);
    c.height = Math.ceil((h + pad * 2) * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = h / 2;
    g.shadowColor = rgba(color, 0.7); g.shadowBlur = 10;
    g.fillStyle = color;
    rr(g, pad, pad, w, h, r); g.fill();
    g.shadowBlur = 0;
    g.save();
    rr(g, pad, pad, w, h, r); g.clip();
    const cols = isSpace ? RAINBOW : [shade(color, 0.45), color, shade(color, -0.15)];
    const sw = Math.max(5, h * 0.42);
    for (let i = -2, k = 0; i * sw < w + h; i++, k++) {
      g.fillStyle = cols[((k % cols.length) + cols.length) % cols.length];
      g.beginPath();
      const x = pad + i * sw;
      g.moveTo(x, pad + h); g.lineTo(x + h, pad); g.lineTo(x + h + sw, pad); g.lineTo(x + sw, pad + h);
      g.closePath(); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.45)';
    rr(g, pad + r * 0.7, pad + h * 0.14, w - r * 1.4, Math.max(2, h * 0.18), 3); g.fill();
    g.restore();
    g.strokeStyle = '#ffffff'; g.lineWidth = 2.2;
    rr(g, pad + 1, pad + 1, w - 2, h - 2, r); g.stroke();
    return { c, w: w + pad * 2, h: h + pad * 2, pad };
  }

  /* ---- 스킨별 배경 장식 (정적 레이어, 리사이즈 때 다시 그림) ---- */
  makeDeco() {
    const type = this.sk.deco;
    if (!type) return null;
    const W = this.W, H = this.H;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    let seed = 20240917;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pickR = (a) => a[Math.floor(rnd() * a.length)];

    if (type === 'savanna') {
      // 삼각 모자이크
      const s = Math.max(44, W / 26), h = s * 0.866, lim = H * 0.7;
      for (let row = 0; row * h < lim; row++) {
        for (let col = -1; col * s < W + s; col++) {
          for (const up of [0, 1]) {
            const x = col * s + (row % 2) * s / 2 + up * s / 2, y = row * h;
            g.beginPath();
            if (up) { g.moveTo(x, y + h); g.lineTo(x + s / 2, y); g.lineTo(x + s, y + h); }
            else { g.moveTo(x, y); g.lineTo(x + s, y); g.lineTo(x + s / 2, y + h); }
            g.closePath();
            g.fillStyle = `rgba(255,255,255,${(0.02 + rnd() * 0.08) * (1 - y / lim)})`;
            g.fill();
          }
        }
      }
      // 노을 해
      const cx = W * 0.5, cy = H * 0.6, R = Math.min(W, H) * 0.46;
      const sg = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      sg.addColorStop(0, 'rgba(255,220,130,0.85)'); sg.addColorStop(0.62, 'rgba(255,160,95,0.6)'); sg.addColorStop(1, 'rgba(255,120,110,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
      // 별자리 선
      const pts = Array.from({ length: 26 }, () => [rnd() * W, rnd() * H * 0.55]);
      g.strokeStyle = 'rgba(255,255,255,0.38)'; g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < pts.length; i++) if (rnd() < 0.75) { g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); }
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [x, y] of pts) { g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill(); }
      // 지평선
      const hg = g.createLinearGradient(0, H * 0.8, 0, H);
      hg.addColorStop(0, 'rgba(150,40,80,0)'); hg.addColorStop(1, 'rgba(150,40,80,0.35)');
      g.fillStyle = hg; g.fillRect(0, H * 0.8, W, H * 0.2);
    } else if (type === 'emblem') {
      const cx = W / 2, cy = H * 0.45;
      const rg = g.createRadialGradient(cx, cy * 0.6, 0, cx, cy, Math.max(W, H) * 0.7);
      rg.addColorStop(0, 'rgba(160,240,140,0.35)'); rg.addColorStop(1, 'rgba(0,40,10,0.35)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(243,240,184,0.10)';
      for (let r = 60, k = 0; r < Math.max(W, H); r += 46, k++) {
        g.lineWidth = k % 3 === 0 ? 4 : 1.2;
        g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      }
    } else if (type === 'marquee') {
      // 벽돌
      const bw = 64, bh = 26, top = H * 0.32;
      for (let y = top, row = 0; y < H; y += bh, row++) {
        for (let x = -bw + (row % 2) * bw / 2; x < W; x += bw) {
          g.fillStyle = `rgba(${150 + rnd() * 40},${40 + rnd() * 20},${40 + rnd() * 15},${0.18 + rnd() * 0.12})`;
          g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        }
      }
      // 차양 (빨강/크림 줄무늬 + 물결 끝단)
      const aw = 46, ah = H * 0.07;
      for (let x = 0, k = 0; x < W; x += aw, k++) {
        g.fillStyle = k % 2 ? 'rgba(255,233,200,0.75)' : 'rgba(200,30,50,0.85)';
        g.fillRect(x, 0, aw, ah);
        g.beginPath(); g.arc(x + aw / 2, ah, aw / 2, 0, Math.PI); g.fill();
      }
      // 아래쪽 무대 조명
      const sl = g.createLinearGradient(0, H * 0.75, 0, H);
      sl.addColorStop(0, 'rgba(255,210,87,0)'); sl.addColorStop(1, 'rgba(255,210,87,0.18)');
      g.fillStyle = sl; g.fillRect(0, H * 0.75, W, H * 0.25);
    } else if (type === 'orchard') {
      // 땅
      const gy = H * 0.7;
      const gg = g.createLinearGradient(0, gy, 0, H);
      gg.addColorStop(0, 'rgba(110,104,84,0.85)'); gg.addColorStop(1, 'rgba(70,66,52,0.95)');
      g.fillStyle = gg; g.fillRect(0, gy, W, H - gy);
      // 나무 두 줄 (먼 줄은 옅게)
      const rowDraw = (baseY, scale, alpha) => {
        for (let x = -40; x < W + 60; x += 120 * scale + rnd() * 40 * scale) {
          const tw = 10 * scale, th = 70 * scale;
          g.fillStyle = `rgba(60,48,36,${alpha})`;
          g.fillRect(x - tw / 2, baseY - th, tw, th);
          const cy = baseY - th - 30 * scale;
          for (let k = 0; k < 7; k++) {
            g.fillStyle = `rgba(${40 + rnd() * 20},${70 + rnd() * 25},${40 + rnd() * 15},${alpha})`;
            g.beginPath(); g.arc(x + (rnd() - 0.5) * 70 * scale, cy + (rnd() - 0.5) * 50 * scale, (26 + rnd() * 22) * scale, 0, Math.PI * 2); g.fill();
          }
          for (let k = 0; k < 14; k++) {
            g.fillStyle = `rgba(${200 + rnd() * 40},${40 + rnd() * 20},40,${alpha})`;
            g.beginPath(); g.arc(x + (rnd() - 0.5) * 90 * scale, cy + (rnd() - 0.5) * 70 * scale, 4 * scale, 0, Math.PI * 2); g.fill();
          }
        }
      };
      rowDraw(gy + 4, 0.7, 0.45);
      rowDraw(gy + 60, 1.05, 0.9);
    } else if (type === 'paint') {
      // 종이 결
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(0,0,0,${rnd() * 0.035})`;
        g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      const cols = this.sk.palette;
      // 붓 자국
      g.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = rgba(pickR(cols), 0.5);
        g.lineWidth = 8 + rnd() * 22;
        const x = rnd() * W, y = rnd() * H, a = rnd() * Math.PI;
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * 80, y + Math.sin(a) * 80 - 40, x + Math.cos(a) * 180, y + Math.sin(a) * 180); g.stroke();
      }
      // 스플래시
      for (let i = 0; i < 34; i++) {
        const col = pickR(cols), x = rnd() * W, y = rnd() * H, R = 14 + rnd() * 56;
        g.fillStyle = rgba(col, 0.55 + rnd() * 0.3);
        g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
        for (let k = 0; k < 9; k++) {
          const a = rnd() * Math.PI * 2, d = R * (1.1 + rnd() * 1.4);
          g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 2 + rnd() * R * 0.18, 0, Math.PI * 2); g.fill();
        }
      }
      // 아래 무지개 줄무늬 받침
      const sh = 10;
      RAINBOW.forEach((col, i) => { g.fillStyle = rgba(col, 0.85); g.fillRect(0, H - sh * (RAINBOW.length - i), W, sh); });
    } else if (type === 'bloom') {
      const cols = this.sk.palette.filter((x) => x !== '#ffffff');
      // 픽셀 모자이크 (모서리)
      const ps = 14;
      for (const [x0, y0, x1, y1] of [[W * 0.62, 0, W, H * 0.3], [0, H * 0.7, W * 0.38, H]]) {
        for (let x = x0; x < x1; x += ps) for (let y = y0; y < y1; y += ps) {
          if (rnd() < 0.55) continue;
          g.fillStyle = rgba(pickR(cols), 0.25 + rnd() * 0.35);
          g.fillRect(x, y, ps - 1, ps - 1);
        }
      }
      // 꽃 콜라주
      for (let i = 0; i < 80; i++) {
        const size = 30 + rnd() * 110;
        g.globalAlpha = 0.35 + rnd() * 0.45;
        g.save();
        g.translate(rnd() * W, rnd() * H); g.rotate(rnd() * Math.PI);
        g.drawImage(this.shape('flower', pickR(cols)), -size / 2, -size / 2, size, size);
        g.restore();
      }
      g.globalAlpha = 1;
    } else if (type === 'appleskin') {
      // 세로 결 무늬
      for (let x = 0; x < W; x += 2) {
        const l = rnd();
        g.fillStyle = l < 0.5 ? `rgba(40,80,10,${0.08 + rnd() * 0.12})` : `rgba(210,235,110,${0.06 + rnd() * 0.12})`;
        const y = rnd() * H * 0.3;
        g.fillRect(x, y, 1 + rnd() * 2, H * (0.4 + rnd() * 0.6));
      }
      // 작은 점 (껍질 숨구멍)
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(235,245,170,${0.15 + rnd() * 0.3})`;
        g.beginPath(); g.arc(rnd() * W, rnd() * H, 0.6 + rnd() * 1.4, 0, Math.PI * 2); g.fill();
      }
      // 광택
      const hx = W * 0.22, hy = H * 0.12, hr = Math.max(W, H) * 0.22;
      const hg = g.createRadialGradient(hx, hy, 0, hx, hy, hr);
      hg.addColorStop(0, 'rgba(255,255,240,0.75)'); hg.addColorStop(0.25, 'rgba(255,255,230,0.3)'); hg.addColorStop(1, 'rgba(255,255,230,0)');
      g.fillStyle = hg; g.fillRect(0, 0, W, H);
    }
    return c;
  }

  // 움직이는 장식 (극장 전구 깜빡임 등)
  drawDecoLive(g, now, p) {
    const type = this.sk.deco, W = this.W, H = this.H;
    if (type === 'marquee') {
      const step = 26, ph = Math.floor(now / 160);
      for (const y of [H * 0.07 + 20, H - 14]) {
        for (let x = 10, k = 0; x < W; x += step, k++) {
          const on = (k + ph) % 3 !== 0;
          g.globalAlpha = on ? 0.95 : 0.3;
          g.fillStyle = '#fff3c4';
          g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
          if (on) { g.globalAlpha = 0.35 + p * 0.4; g.drawImage(this.glow('#ffd257'), x - 12, y - 12, 24, 24); }
        }
      }
      g.globalAlpha = 1;
    } else if (type === 'savanna') {
      const cx = W * 0.5, cy = H * 0.6, R = Math.min(W, H) * (0.3 + p * 0.06);
      g.globalAlpha = 0.25 + p * 0.35;
      g.drawImage(this.glow('#ffe08a'), cx - R, cy - R, R * 2, R * 2);
      g.globalAlpha = 1;
    } else if (type === 'orchard') {
      // 무지갯빛 연기 (숲 사이로 흐르는 덩어리)
      const cols = RAINBOW;
      for (let i = 0; i < 9; i++) {
        const t = now / 1000 * 0.08 + i * 0.11;
        const x = ((t % 1.2) - 0.1) * W, y = H * 0.66 - Math.sin(t * 9 + i) * H * 0.05;
        const s = H * (0.22 + 0.08 * Math.sin(now / 900 + i)) * (1 + p * 0.3);
        g.globalAlpha = 0.28;
        g.drawImage(this.glow(cols[i % cols.length]), x - s / 2, y - s / 2, s, s);
      }
      g.globalAlpha = 1;
    } else if (type === 'appleskin' || type === 'emblem') {
      g.globalAlpha = 0.15 + p * 0.3;
      const s = Math.max(W, H) * 0.5;
      g.drawImage(this.glow('#fffbe0'), W * 0.22 - s / 2, H * 0.12 - s / 2, s, s);
      g.globalAlpha = 1;
    }
  }

  makeNeonNote(color, w, h, isSpace) {
    const pad = 16, dpr = this.dpr;
    const c = document.createElement('canvas');
    c.width = Math.ceil((w + pad * 2) * dpr);
    c.height = Math.ceil((h + pad * 2) * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = Math.min(7, h / 2);
    g.shadowColor = color;
    g.shadowBlur = 14;
    const gr = g.createLinearGradient(0, pad, 0, pad + h);
    gr.addColorStop(0, shade(color, 0.7));
    gr.addColorStop(0.45, color);
    gr.addColorStop(1, shade(color, -0.45));
    g.fillStyle = gr;
    rr(g, pad, pad, w, h, r);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.85)';
    rr(g, pad + 3, pad + 2, w - 6, Math.max(2, h * 0.16), 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(pad + w * 0.18, pad + h * 0.55, w * 0.64, 1.5);
    if (isSpace) {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      const cy = pad + h * 0.55;
      for (const s of [-1, 1]) {
        const cx = pad + w / 2 + s * w * 0.36;
        g.beginPath();
        g.moveTo(cx - 4 * s, cy - 4); g.lineTo(cx + 2 * s, cy); g.lineTo(cx - 4 * s, cy + 4);
        g.closePath(); g.fill();
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = 1;
    rr(g, pad + 0.5, pad + 0.5, w - 1, h - 1, r);
    g.stroke();
    return { c, w: w + pad * 2, h: h + pad * 2, pad };
  }

  glow(color) {
    if (this.glowCache[color]) return this.glowCache[color];
    const s = 128, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, rgba(color, 0.9));
    gr.addColorStop(0.25, rgba(color, 0.45));
    gr.addColorStop(0.6, rgba(color, 0.1));
    gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    this.glowCache[color] = c;
    return c;
  }

  // 별 · 하트 · 꽃 · 사과 등 장식 스프라이트 (64px 기준)
  shape(kind, color) {
    const key = kind + color;
    if (this.shapeCache[key]) return this.shapeCache[key];
    const s = 64, c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.lineJoin = 'round';
    if (kind === 'flower') {
      g.fillStyle = color;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        g.beginPath(); g.arc(32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14, 12, 0, Math.PI * 2); g.fill();
      }
      g.fillStyle = '#ffe066';
      g.beginPath(); g.arc(32, 32, 8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    } else if (kind === 'bubble') {
      g.fillStyle = rgba(color, 0.35);
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.ellipse(23, 22, 6, 4, -0.6, 0, Math.PI * 2); g.fill();
    } else if (kind === 'dot') {
      g.fillStyle = color;
      g.beginPath(); g.arc(32, 32, 24, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke();
    } else if (kind === 'confetti') {
      g.fillStyle = color;
      rr(g, 18, 8, 28, 48, 6); g.fill();
    } else {
      g.fillStyle = color;
      g.fill(PATHS[kind]);
      if (kind === 'apple') { g.fillStyle = '#3fae3a'; g.fill(PATHS.leaf); }
      if (kind === 'star' || kind === 'heart') { g.strokeStyle = '#fff'; g.lineWidth = 3.5; g.stroke(PATHS[kind]); }
    }
    this.shapeCache[key] = c;
    return c;
  }

  drawShape(g, kind, color, x, y, size, rot, alpha) {
    const d = this.dpr, cs = Math.cos(rot) * d, sn = Math.sin(rot) * d;
    g.setTransform(cs, sn, -sn, cs, x * d, y * d);
    g.globalAlpha = alpha;
    g.drawImage(this.shape(kind, color), -size / 2, -size / 2, size, size);
  }

  pps() { return this.settings.speed * this.H * 0.12; }

  /* ---------------- 게임 흐름 ---------------- */
  start(song, diff, settings, opts) {
    this.cancelEnding();
    this.song = song;
    this.diff = diff;
    this.settings = settings;
    this.clock = song.yt ? YtClock : AudioClock;
    // 녹화 모드 : 노트 없이 플레이어 입력을 그대로 기록
    this.rec = opts && opts.record ? [] : null;
    this.recOpen = new Array(7).fill(null);
    const chart = this.rec ? { notes: [], total: 0 } : song.charts[diff];
    this.notes = chart.notes.map((n) => ({
      t: n.t, lane: n.lane, end: n.end || 0,
      judged: false, holding: false, missed: false, tailDone: !n.end,
    }));
    this.laneNotes = Array.from({ length: this.N }, () => []);
    for (const n of this.notes) this.laneNotes[n.lane].push(n);
    this.laneIdx = new Array(this.N).fill(0);
    this._fsIdx = 0;
    this.total = chart.total;
    const lastEnd = this.notes.reduce((m, n) => Math.max(m, n.end || n.t), 0);
    const dur = song.buffer ? song.buffer.duration : song.duration;
    this.endTime = Math.max(dur - 0.2, lastEnd + 1.2);
    this.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
    this.combo = 0; this.maxCombo = 0; this.sumW = 0; this.judgedN = 0;
    this.fast = 0; this.slow = 0; this.errs = [];
    this.dispScore = 0;
    this.lastJudge = null;
    this.comboPopT = -1e9;
    this.milestone = null;
    this.missAt = -1e9;
    this.particles.length = 0;
    this.fx.length = 0;
    this.pressed.fill(false);
    this.autoRelease.fill(0);
    this.t = -LEAD_IN;
    this.clock.start(song, LEAD_IN);
    this.state = 'playing';
    if (!this.raf) { this._lastFrame = performance.now(); this.raf = requestAnimationFrame(this._loop); }
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    const now = performance.now();
    for (let l = 0; l < this.N; l++) {
      if (!this.pressed[l]) continue;
      if (this.rec) this.release(l, now, true);
      else { this.pressed[l] = false; this.releaseT[l] = now; }
    }
    this.clock.pause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.clock.resume().then(() => { if (this.state === 'paused') this.state = 'playing'; });
  }

  quit() {
    this.cancelEnding();
    if (this.clock) this.clock.stop();
    this.state = 'idle';
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.pressed.fill(false);
  }

  cancelEnding() {
    if (this._endTimer) { clearTimeout(this._endTimer); this._endTimer = 0; }
  }

  score() { return this.total ? Math.round(1e6 * this.sumW / this.total) : 0; }
  accuracy() { return this.judgedN ? (this.sumW / this.judgedN) * 100 : 100; }

  recPress(lane, t) {
    if (t < 0) return;
    const n = { t, lane };
    this.rec.push(n);
    this.recOpen[lane] = n;
    this.combo++;
    this.comboPopT = performance.now();
    this.spawnHit(lane, 'PERFECT');
  }
  recRelease(lane, t) {
    const n = this.recOpen[lane];
    this.recOpen[lane] = null;
    if (n && t - n.t >= 0.3) n.end = t;
  }
  // 녹화를 지금 끝내고 저장
  finishRecording() {
    if (!this.rec || (this.state !== 'playing' && this.state !== 'paused')) return;
    const now = performance.now();
    for (let l = 0; l < this.N; l++) if (this.pressed[l]) this.release(l, now, true);
    this.finish(true);
  }

  finish(immediate) {
    this.state = 'ending';
    this.endAt = performance.now();
    if (this.rec) {
      this.result = { record: true, notes: this.rec.slice(), song: this.song, diff: this.diff };
      this._endTimer = setTimeout(() => {
        this._endTimer = 0;
        if (this.hooks.onFinish) this.hooks.onFinish(this.result);
      }, immediate ? 50 : 1200);
      return;
    }
    this.confettiBurst();
    const acc = this.total ? (this.sumW / this.total) * 100 : 0;
    const rank = acc >= 98 ? 'SS' : acc >= 95 ? 'S' : acc >= 90 ? 'A' : acc >= 80 ? 'B' : acc >= 70 ? 'C' : 'D';
    const avgErr = this.errs.length ? this.errs.reduce((a, b) => a + b, 0) / this.errs.length : 0;
    this.result = {
      score: this.score(), acc, rank, counts: { ...this.counts }, maxCombo: this.maxCombo,
      fast: this.fast, slow: this.slow, avgErr: avgErr * 1000, total: this.total,
      fc: this.counts.MISS === 0, ap: this.counts.MISS === 0 && this.counts.GREAT === 0 && this.counts.GOOD === 0,
      auto: !!this.settings.auto, song: this.song, diff: this.diff,
    };
    this._endTimer = setTimeout(() => {
      this._endTimer = 0;
      if (this.hooks.onFinish) this.hooks.onFinish(this.result);
    }, 2000);
  }

  _loop(now) {
    this.raf = requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, Math.max(0, (now - this._lastFrame) / 1000));
    this._lastFrame = now;
    if (this.state === 'playing' || this.state === 'ending') {
      this.t = this.clock.time(this.settings.offset / 1000);
    }
    if (this.state === 'playing') this.update(this.t);
    this.render(dt);
  }

  /* ---------------- 판정 ---------------- */
  update(t) {
    if (this.settings.auto && !this.rec) this.autoPlay(t);
    for (let l = 0; l < this.N; l++) {
      const ln = this.laneNotes[l];
      for (let k = this.laneIdx[l]; k < ln.length; k++) {
        const n = ln[k];
        if (n.t - t > 0.5) break;
        if (!n.judged && t - n.t > JW.GOOD) {
          n.judged = true; n.missed = true;
          this.judge('MISS', null, l);
          if (n.end) { n.tailDone = true; this.judge('MISS', null, l, true); }
        }
        if (n.holding && t >= n.end) {
          n.holding = false; n.tailDone = true;
          this.judge('PERFECT', null, l, true);
          this.spawnHit(l, 'PERFECT');
          if (this.settings.auto) this.autoRelease[l] = t + 0.04;
        }
      }
      let i = this.laneIdx[l];
      while (i < ln.length && ln[i].judged && ln[i].tailDone) i++;
      this.laneIdx[l] = i;
    }
    if (t > this.endTime) this.finish();
  }

  autoPlay(t) {
    const now = performance.now();
    for (let l = 0; l < this.N; l++) {
      const ln = this.laneNotes[l];
      for (let k = this.laneIdx[l]; k < ln.length; k++) {
        const n = ln[k];
        if (n.t > t) break;
        if (n.judged) continue;
        n.judged = true;
        this.judge('PERFECT', 0, l);
        this.spawnHit(l, 'PERFECT');
        this.pressed[l] = true;
        if (n.end) { n.holding = true; this.autoRelease[l] = 0; } else this.autoRelease[l] = t + 0.07;
      }
      if (this.pressed[l] && this.autoRelease[l] && t >= this.autoRelease[l]) {
        this.pressed[l] = false; this.releaseT[l] = now; this.autoRelease[l] = 0;
      }
    }
  }

  press(lane, perfMs) {
    if (this.state !== 'playing' || this.pressed[lane]) return;
    this.pressed[lane] = true;
    AudioEngine.playHit(null, lane);
    if (this.settings.auto && !this.rec) return;
    const t = this.clock.timeAt(perfMs, this.settings.offset / 1000);
    if (this.rec) { this.recPress(lane, t); return; }
    const ln = this.laneNotes[lane];
    for (let k = this.laneIdx[lane]; k < ln.length; k++) {
      const n = ln[k];
      if (n.judged) continue;
      const d = t - n.t;
      if (d < -JW.POOR) break;      // 너무 이름 → 무시
      if (d > JW.GOOD) continue;    // 곧 자동 MISS 처리됨
      const ad = Math.abs(d);
      const kind = ad <= JW.PERFECT ? 'PERFECT' : ad <= JW.GREAT ? 'GREAT' : ad <= JW.GOOD ? 'GOOD' : 'MISS';
      n.judged = true;
      this.judge(kind, d, lane);
      if (kind === 'MISS') {
        n.missed = true;
        if (n.end) { n.tailDone = true; this.judge('MISS', null, lane, true); }
      } else {
        this.spawnHit(lane, kind);
        if (n.end) n.holding = true;
      }
      return;
    }
  }

  release(lane, perfMs, force) {
    if (!this.pressed[lane]) return;
    this.pressed[lane] = false;
    this.releaseT[lane] = performance.now();
    if (this.state !== 'playing' && !force) return;
    const t = this.clock.timeAt(perfMs, this.settings.offset / 1000);
    if (this.rec) { this.recRelease(lane, t); return; }
    if (this.settings.auto) return;
    const ln = this.laneNotes[lane];
    for (let k = this.laneIdx[lane]; k < ln.length; k++) {
      const n = ln[k];
      if (n.holding) {
        n.holding = false; n.tailDone = true;
        const early = n.end - t;
        const kind = early <= JW.PERFECT ? 'PERFECT' : early <= JW.GREAT ? 'GREAT' : early <= JW.GOOD ? 'GOOD' : 'MISS';
        this.judge(kind, null, lane, true);
        if (kind !== 'MISS') this.spawnHit(lane, kind);
        return;
      }
      if (n.t > t + 1) return;
    }
  }

  judge(kind, diff, lane, isTail) {
    const now = performance.now();
    this.counts[kind]++;
    this.judgedN++;
    this.sumW += JUDGES[kind].w;
    if (kind === 'MISS') {
      this.combo = 0;
      this.missAt = now;
      this.laneMissT[lane] = now;
    } else {
      this.combo++;
      this.comboPopT = now;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      if (this.combo % 100 === 0) this.milestone = { n: this.combo, at: now };
    }
    if (diff !== null && !isTail) {
      this.errs.push(diff);
      if (kind !== 'PERFECT' && kind !== 'MISS') { if (diff < 0) this.fast++; else this.slow++; }
    }
    this.lastJudge = { kind, at: now, diff: isTail ? null : diff };
  }

  /* ---------------- 이펙트 ---------------- */
  spawnHit(lane, kind) {
    const now = performance.now();
    AudioEngine.playChime(lane, kind);
    const x = this.laneC[lane], y = this.judgeY, w = this.laneW[lane];
    const col = kind === 'PERFECT' ? LANE_COLORS[lane] : JUDGES[kind].color;
    this.fx.push({ type: 'bloom', x, y, w, color: col, born: now, dur: 420, big: kind === 'PERFECT', rot: Math.random() * 6.28 });
    this.fx.push({ type: 'pillar', x, y, w, color: col, born: now, dur: 280 });
    const n = kind === 'PERFECT' ? 12 : kind === 'GREAT' ? 8 : 4;
    this.spawnParticles(x, y, col, n, lane === SPACE_LANE ? 1.25 : 1, w, kind === 'PERFECT');
  }

  spawnParticles(x, y, color, n, power, spread, rich) {
    const kinds = rich ? ['star', 'heart', 'spark', 'dot', 'flower'] : ['spark', 'dot'];
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 700) this.particles.shift();
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const sp = (140 + Math.random() * 380) * power;
      this.particles.push({
        x: x + (Math.random() - 0.5) * spread * 0.5, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 1000,
        life: 0, max: 0.35 + Math.random() * 0.4, size: 9 + Math.random() * 12,
        color: Math.random() < 0.55 ? color : pick(PALETTE),
        kind: pick(kinds), rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 14,
      });
    }
  }

  confettiBurst() {
    const W = this.W;
    for (let i = 0; i < 160; i++) {
      this.particles.push({
        x: Math.random() * W, y: -20 - Math.random() * this.H * 0.4,
        vx: (Math.random() - 0.5) * 120, vy: 80 + Math.random() * 160, grav: 140,
        life: 0, max: 2.2 + Math.random() * 1.6, size: 10 + Math.random() * 12,
        color: pick(PALETTE.slice(0, 6)), kind: Math.random() < 0.7 ? 'confetti' : pick(['star', 'heart', 'flower']),
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 10, flutter: Math.random() * 6.28,
      });
    }
  }

  /* ---------------- 렌더링 ---------------- */
  render(dt) {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const now = performance.now();
    const t = this.t;
    const spec = this.song && this.song.yt ? this.fakeSpectrum(t) : AudioEngine.spectrum();
    let bass = 0;
    if (spec) { for (let i = 1; i < 7; i++) bass += spec[i]; bass /= 6 * 255; }
    bass = Math.pow(bass, 2.2);
    this.bassS = bass > this.bassS ? bass : this.bassS + (bass - this.bassS) * Math.min(1, dt * 5);

    this.drawBackground(g, dt, spec, now);
    if (!this.song) return;
    this.drawField(g, t, now);
    this.drawNotes(g, t, now);
    this.drawReceptors(g, now);
    this.drawFx(g, dt, now);
    this.drawHud(g, t, now, dt);
  }

  fakeSpectrum(t) {
    if (!this._fspec) this._fspec = new Uint8Array(512);
    const sp = this._fspec, grid = this.song.grid;
    if (t < 0 || this.state !== 'playing' || !this.notes) { sp.fill(0); return sp; }
    let env;
    if (grid) {
      const spb = 60 / grid.bpm, ph = (((t - grid.offset) / spb) % 1 + 1) % 1;
      const beatN = Math.floor((t - grid.offset) / spb);
      env = Math.exp(-ph * 5) * (beatN % 2 === 0 ? 1 : 0.8);
    } else {
      // 박자 격자가 없는 곡 : 가장 최근 노트 기준으로 맥박
      let i = this._fsIdx || 0;
      while (i + 1 < this.notes.length && this.notes[i + 1].t <= t) i++;
      if (i > 0 && this.notes[i].t > t) i = 0;
      this._fsIdx = i;
      const last = this.notes[i] && this.notes[i].t <= t ? this.notes[i].t : -9;
      env = Math.exp(-(t - last) * 6);
    }
    for (let i = 0; i < 220; i++) {
      const wob = 0.5 + 0.5 * Math.sin(i * 0.37 + t * 2.3) * Math.sin(i * 0.11 - t * 1.3);
      const v = i < 8 ? env : env * 0.55 + wob * 0.35;
      sp[i] = Math.max(0, Math.min(255, v * 235));
    }
    return sp;
  }

  drawBackground(g, dt, spec, now) {
    const W = this.W, H = this.H, p = this.bassS;
    if (this.song && this.song.yt && this.state !== 'idle') {
      // 뒤에 깔린 흐린 유튜브 영상이 보이도록 반투명하게만 물들인다
      g.clearRect(0, 0, W, H);
      g.globalAlpha = this.sk.ink === '#ffffff' ? 0.35 : 0.28;
      g.fillStyle = this.bgGrad;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    } else {
      g.fillStyle = this.bgGrad;
      g.fillRect(0, 0, W, H);
    }
    // 스킨 장식 레이어
    if (this.deco) {
      g.globalAlpha = this.song && this.song.yt && this.state !== 'idle' ? 0.35 : 1;
      g.drawImage(this.deco, 0, 0, this.W, this.H);
      g.globalAlpha = 1;
      this.drawDecoLive(g, now, p);
    }
    // 둥실 떠다니는 파스텔 블롭
    g.globalCompositeOperation = 'source-over';
    const sk = this.sk, pos = [[0.18, 0.2], [0.82, 0.25], [0.25, 0.85], [0.8, 0.82]];
    if (!(this.song && this.song.yt)) sk.blobs.forEach((c, i) => {
      const [bx, by] = pos[i % 4];
      const ox = Math.sin(now / 3000 + i * 1.7) * W * 0.04, oy = Math.cos(now / 3700 + i) * H * 0.04;
      const s = Math.max(W, H) * (0.55 + p * 0.25);
      g.globalAlpha = sk.blobAlpha || 0.75;
      g.drawImage(this.glow(c), bx * W + ox - s / 2, by * H + oy - s / 2, s, s);
    });
    g.globalAlpha = 1;
    // 무지개 아치
    if (sk.arc) {
      const cx = W / 2, cy = H * 1.05, R = Math.max(W, H) * (0.62 + p * 0.03);
      g.lineWidth = Math.max(10, H * 0.018);
      RAINBOW.forEach((c, i) => {
        g.strokeStyle = rgba(c, sk.arc + p * 0.12);
        g.beginPath();
        g.arc(cx, cy, R - i * g.lineWidth, Math.PI, Math.PI * 2);
        g.stroke();
      });
    }
    if (sk.fx === 'glow') g.globalCompositeOperation = 'lighter';
    // 스펙트럼 : 둥근 파스텔 막대
    if (spec && this.fieldX > 90) {
      const n = 18, maxW = this.fieldX - 40, bw = maxW / n;
      for (let i = 0; i < n; i++) {
        const bin = Math.floor(Math.pow(i / n, 1.7) * 200) + 2;
        const v = spec[bin] / 255;
        const h = v * v * H * 0.42;
        if (h < bw) continue;
        const col = RAINBOW[i % RAINBOW.length];
        g.fillStyle = rgba(col, sk.fx === 'glow' ? 0.08 + v * 0.22 : 0.28 + v * 0.3);
        const xl = this.fieldX - 26 - (i + 1) * bw;
        const xr = this.fieldX + this.fieldW + 26 + i * bw;
        rr(g, xl + 2, H - h - 6, bw - 4, h, (bw - 4) / 2); g.fill();
        rr(g, xr + 2, H - h - 6, bw - 4, h, (bw - 4) / 2); g.fill();
      }
    }
    // 떠오르는 장식들
    const speedK = this.state === 'playing' ? 1 + p * 2.5 : 0.5;
    for (const f of this.floaters) {
      f.y -= dt * (0.015 + f.z * 0.035) * speedK;
      f.rot += f.vr * dt;
      if (f.y < -0.08) { f.y = 1.08; f.x = Math.random(); }
      const x = f.x * W + Math.sin(now / 1400 + f.ph) * 18;
      const y = f.y * H;
      if (x > this.fieldX - 20 && x < this.fieldX + this.fieldW + 20) continue;
      const size = (18 + f.z * 26) * (1 + p * 0.25);
      this.drawShape(g, f.kind, f.color, x, y, size, f.rot, (0.35 + f.z * 0.4) * sk.floaterAlpha);
    }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  drawField(g, t, now) {
    const fx = this.fieldX, fw = this.fieldW, H = this.H, jy = this.judgeY;
    // 필드 그림자 + 본체
    const sk = this.sk;
    g.fillStyle = sk.fieldShadow;
    g.fillRect(fx - 10, 0, fw + 20, H);
    g.fillStyle = this.fieldGrad;
    g.fillRect(fx, 0, fw, H);
    for (let l = 0; l < this.N; l++) {
      g.fillStyle = rgba(LANE_COLORS[l], l === SPACE_LANE ? 0.08 : 0.04);
      g.fillRect(this.laneX[l], 0, this.laneW[l], jy);
    }
    // 점선 레인 구분선
    g.fillStyle = sk.dash;
    const dashOff = (now / 30) % 14;
    for (let l = 1; l < this.N; l++) {
      const x = this.laneX[l] - 1;
      for (let y = -14 + dashOff; y < jy; y += 14) g.fillRect(x, y, 2, 6);
    }

    // 마디선 (BPM 을 아는 곡만)
    if (this.song.grid) {
      const spb = 60 / this.song.grid.bpm, off = this.song.grid.offset, pps = this.pps();
      const k0 = Math.ceil((t - off - 0.05) / spb), k1 = Math.floor((t - off + jy / pps) / spb);
      for (let k = Math.max(0, k0); k <= k1; k++) {
        const y = jy - (off + k * spb - t) * pps;
        const bar = k % 4 === 0;
        g.fillStyle = bar ? sk.beat[0] : sk.beat[1];
        g.fillRect(fx, y, fw, bar ? 2 : 1);
      }
    }

    // 키 빔
    for (let l = 0; l < this.N; l++) {
      const a = this.pressed[l] ? 1 : Math.max(0, 1 - (now - this.releaseT[l]) / 180);
      if (a > 0) {
        const h = H * 0.55;
        const gr = g.createLinearGradient(0, jy, 0, jy - h);
        gr.addColorStop(0, rgba(LANE_COLORS[l], 0.5 * a));
        gr.addColorStop(0.5, rgba(LANE_COLORS[l], 0.14 * a));
        gr.addColorStop(1, rgba(LANE_COLORS[l], 0));
        g.fillStyle = gr;
        g.fillRect(this.laneX[l], jy - h, this.laneW[l], h);
      }
      const ma = 1 - (now - this.laneMissT[l]) / 300;
      if (ma > 0) {
        const gr = g.createLinearGradient(0, jy, 0, jy - H * 0.3);
        gr.addColorStop(0, `rgba(${sk.miss},${0.4 * ma})`);
        gr.addColorStop(1, `rgba(${sk.miss},0)`);
        g.fillStyle = gr;
        g.fillRect(this.laneX[l], jy - H * 0.3, this.laneW[l], H * 0.3);
      }
    }

    // 테두리 : 흰 라인 + 파스텔 글로우
    const eg = 0.35 + this.bassS * 0.65;
    if (sk.edgeLine) {
      g.fillStyle = sk.edgeLine;
      g.fillRect(fx - 3, 0, 3, H);
      g.fillRect(fx + fw, 0, 3, H);
    } else {
      g.fillStyle = rgba(sk.edge[0], 0.85); g.fillRect(fx - 2, 0, 2, H);
      g.fillStyle = rgba(sk.edge[1], 0.85); g.fillRect(fx + fw, 0, 2, H);
    }
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = eg;
    g.drawImage(this.glow(sk.edge[0]), fx - 18, -60, 34, H + 120);
    g.drawImage(this.glow(sk.edge[1]), fx + fw - 16, -60, 34, H + 120);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  drawNotes(g, t, now) {
    const pps = this.pps(), jy = this.judgeY, nh = this.noteH;
    const tMax = t + (jy + nh) / pps;
    const fadeH = this.H * 0.16;
    this.holdNow.fill(false);
    for (let l = 0; l < this.N; l++) {
      const ln = this.laneNotes[l], spr = this.noteSpr[l];
      const x = this.laneX[l] + 4, col = LANE_COLORS[l];
      for (let k = this.laneIdx[l]; k < ln.length; k++) {
        const n = ln[k];
        if (n.t > tMax) break;
        if (n.end) {
          if (n.tailDone && !n.holding) continue;
          const yHead = n.holding ? jy : jy - (n.t - t) * pps;
          const yTail = jy - (n.end - t) * pps;
          if (n.holding) this.holdNow[l] = true;
          if (yTail < yHead) {
            const bw = (this.laneW[l] - 8) * 0.6, bx = this.laneC[l] - bw / 2;
            const top = Math.max(yTail, -20);
            g.globalAlpha = n.holding ? 0.9 + 0.1 * Math.sin(now / 35) : 0.7;
            g.save();
            g.translate(0, (now / 12) % 24 * (n.holding ? 1 : 0));
            g.fillStyle = this.holdPat[l];
            rr(g, bx, top - (n.holding ? (now / 12) % 24 : 0), bw, yHead - top, bw / 2);
            g.fill();
            g.restore();
            g.strokeStyle = n.holding ? '#ffffff' : 'rgba(255,255,255,0.55)';
            g.lineWidth = 2;
            rr(g, bx, top, bw, yHead - top, bw / 2);
            g.stroke();
            g.globalAlpha = 1;
            if (yTail > -nh) {
              // 끝 캡 : 작은 하트 모양 리본
              g.fillStyle = col;
              rr(g, bx - 4, yTail - 5, bw + 8, 10, 5);
              g.fill();
              g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
            }
          }
          if (!n.judged || n.holding) {
            g.globalAlpha = n.holding ? 1 : clamp(yHead / fadeH, 0, 1);
            g.drawImage(spr.c, x - spr.pad, yHead - nh / 2 - spr.pad, spr.w, spr.h);
            g.globalAlpha = 1;
          }
          continue;
        }
        if (n.judged) continue;
        const y = jy - (n.t - t) * pps;
        g.globalAlpha = clamp(y / fadeH, 0, 1);
        g.drawImage(spr.c, x - spr.pad, y - nh / 2 - spr.pad, spr.w, spr.h);
      }
    }
    g.globalAlpha = 1;
  }

  drawReceptors(g, now) {
    const fx = this.fieldX, fw = this.fieldW, jy = this.judgeY, H = this.H;
    // 키 영역 : 크림색 받침
    const sk = this.sk;
    g.fillStyle = sk.keyBase;
    g.fillRect(fx - 3, jy + 4, fw + 6, H - jy - 4);
    g.fillStyle = rgba(RAINBOW[RAINBOW.length - 1], 0.18);
    g.fillRect(fx - 3, jy + 4, fw + 6, 4);

    const capY = jy + 18, capH = Math.min(H - jy - 30, this.lw * 0.95);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let l = 0; l < this.N; l++) {
      const x = this.laneX[l] + 5, w = this.laneW[l] - 10, col = LANE_COLORS[l];
      const p = this.pressed[l];
      const off = p ? 4 : 0;
      // 아래 두께
      g.fillStyle = shade(col, sk.ink === '#ffffff' ? -0.5 : -0.12);
      rr(g, x, capY + 5, w, capH, 12); g.fill();
      // 윗면 (반투명 면이어도 아래 두께가 비치지 않게 바탕을 먼저 깐다)
      rr(g, x, capY + off, w, capH, 12);
      if (!p) { g.fillStyle = sk.keyBase; g.fill(); }
      g.fillStyle = p ? col : sk.capFace;
      g.fill();
      g.strokeStyle = col;
      g.lineWidth = 2.5;
      g.stroke();
      if (!p) {
        g.fillStyle = rgba(col, 0.18);
        rr(g, x + 4, capY + capH * 0.62, w - 8, capH * 0.28, 8); g.fill();
      }
      g.fillStyle = p ? '#ffffff' : sk.capText;
      if (this.hideLabels) {
        // 터치 모드 : 글자 대신 작은 점 하나
        g.globalAlpha = p ? 0.95 : 0.45;
        g.fillStyle = p ? '#ffffff' : col;
        g.beginPath(); g.arc(x + w / 2, capY + off + capH * 0.45, Math.max(3, this.lw * 0.06), 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      } else if (l === SPACE_LANE) {
        const s = capH * 0.36 / 64;
        g.save();
        g.translate(x + w / 2 - 32 * s - this.lw * 0.42, capY + off + capH * 0.45 - 32 * s);
        g.scale(s, s);
        g.fillStyle = p ? '#ffffff' : col;
        g.fill(PATHS.apple);
        g.restore();
        g.fillStyle = p ? '#ffffff' : sk.capText;
        g.font = `600 ${Math.round(this.lw * 0.22)}px ${FONT_D}`;
        g.fillText(KEY_LABELS[l], x + w / 2 + this.lw * 0.12, capY + off + capH * 0.47);
      } else {
        g.font = `600 ${Math.round(this.lw * (this.N === 4 ? 0.26 : 0.32))}px ${FONT_D}`;
        g.fillText(KEY_LABELS[l], x + w / 2, capY + off + capH * 0.42);
      }
      if (KEY_KR[l] && !this.hideLabels) {
        g.font = `400 ${Math.round(this.lw * 0.17)}px ${FONT_K}`;
        g.fillStyle = p ? 'rgba(255,255,255,0.9)' : sk.capSub;
        g.fillText(KEY_KR[l], x + w / 2, capY + off + capH * 0.77);
      }
    }

    // 판정선 : 무지개 + 흰 코어
    g.fillStyle = rainbowGrad(g, fx, fx + fw);
    rr(g, fx - 3, jy - 4, fw + 6, 8, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(fx, jy - 1, fw, 2);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.25 + this.bassS * 0.4;
    g.drawImage(this.glow(sk.judgeGlow), fx - 30, jy - 26, fw + 60, 52);
    for (let l = 0; l < this.N; l++) {
      const a = this.pressed[l] ? 1 : Math.max(0, 1 - (now - this.releaseT[l]) / 160);
      const hold = this.holdNow[l];
      if (a <= 0 && !hold) continue;
      const w = this.laneW[l] * (hold ? 1.9 + 0.2 * Math.sin(now / 40) : 1.5);
      g.globalAlpha = hold ? 0.9 : 0.6 * a;
      g.drawImage(this.glow(LANE_COLORS[l]), this.laneC[l] - w / 2, jy - w * 0.4, w, w * 0.8);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  drawFx(g, dt, now) {
    // 롱노트 유지 중 반짝이
    for (let l = 0; l < this.N; l++) {
      if (this.holdNow[l] && Math.random() < dt * 30) {
        this.spawnParticles(this.laneC[l], this.judgeY, LANE_COLORS[l], 1, 0.5, this.laneW[l], false);
      }
    }
    this.fx = this.fx.filter((f) => now - f.born < f.dur);
    for (const f of this.fx) {
      const p = (now - f.born) / f.dur, a = 1 - p;
      if (f.type === 'bloom' && this.sk.fx === 'glow') {
        g.globalCompositeOperation = 'lighter';
        const r = f.w * 0.28 + easeOut(p) * f.w * (f.big ? 0.95 : 0.7);
        g.strokeStyle = rgba(f.color, 0.9 * a);
        g.lineWidth = 1 + 4 * a;
        g.beginPath();
        g.arc(f.x, f.y, r, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = a;
        const s = f.w * 2.4 * (1 - p * 0.4);
        g.drawImage(this.glow(f.color), f.x - s / 2, f.y - s / 2, s, s);
        g.drawImage(this.glow('#ffffff'), f.x - s / 4, f.y - s / 4, s / 2, s / 2);
        g.globalAlpha = 1;
        g.globalCompositeOperation = 'source-over';
      } else if (f.type === 'bloom') {
        // 은은한 빛
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = a * 0.9;
        const s = f.w * 2.2 * (1 - p * 0.3);
        g.drawImage(this.glow(f.color), f.x - s / 2, f.y - s / 2, s, s);
        g.drawImage(this.glow('#ffffff'), f.x - s / 5, f.y - s / 5, s / 2.5, s / 2.5);
        g.globalCompositeOperation = 'source-over';
        // 꽃잎 버스트
        const R = f.w * (0.2 + easeOut(p) * (f.big ? 0.75 : 0.55));
        const pr = f.w * 0.16 * (1 - p * 0.6);
        g.globalAlpha = a;
        g.fillStyle = f.color;
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const ang = f.rot + p * 1.2 + i * (Math.PI / 3);
          g.beginPath();
          g.arc(f.x + Math.cos(ang) * R, f.y + Math.sin(ang) * R * 0.75, pr, 0, Math.PI * 2);
          g.fill(); g.stroke();
        }
        // 흰 링
        g.strokeStyle = `rgba(255,255,255,${0.9 * a})`;
        g.lineWidth = 1 + 3 * a;
        g.beginPath();
        g.ellipse(f.x, f.y, R * 1.05, R * 0.8, 0, 0, Math.PI * 2);
        g.stroke();
        g.globalAlpha = 1;
      } else if (f.type === 'pillar') {
        const w = f.w * (1 - p * 0.5) * 0.85, h = this.H * 0.3 * (0.5 + 0.5 * a);
        const gr = g.createLinearGradient(0, f.y, 0, f.y - h);
        gr.addColorStop(0, rgba(f.color, 0.55 * a));
        gr.addColorStop(1, rgba(f.color, 0));
        g.fillStyle = gr;
        rr(g, f.x - w / 2, f.y - h, w, h, w / 2);
        g.fill();
      }
    }
    const ps = this.particles;
    const glowFx = this.sk.fx === 'glow';
    if (glowFx) g.globalCompositeOperation = 'lighter';
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.life += dt;
      if (q.life >= q.max || q.y > this.H + 40) { ps.splice(i, 1); continue; }
      q.vy += q.grav * dt;
      q.vx *= q.flutter !== undefined ? 1 : 0.97;
      if (q.flutter !== undefined) { q.flutter += dt * 4; q.x += Math.sin(q.flutter) * 40 * dt; }
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.vr * dt;
      const k = 1 - q.life / q.max;
      const fade = q.flutter !== undefined ? Math.min(1, k * 3) : k;
      const s = q.size * (q.flutter !== undefined ? 1 : 0.5 + 0.5 * k);
      if (glowFx && q.flutter === undefined) {
        g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        g.globalAlpha = fade;
        g.drawImage(this.glow(q.color), q.x - s * 0.7, q.y - s * 0.7, s * 1.4, s * 1.4);
      } else this.drawShape(g, q.kind, q.color, q.x, q.y, s, q.rot, fade);
    }
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  outlinedText(g, text, x, y, fill, stroke, lw) {
    g.lineJoin = 'round';
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.strokeText(text, x, y);
    g.fillStyle = fill;
    g.fillText(text, x, y);
  }

  drawHud(g, t, now, dt) {
    const cx = this.fieldX + this.fieldW / 2, lw = this.lw, H = this.H, W = this.W;
    const hasLS = 'letterSpacing' in g;
    const ls = (v) => { if (hasLS) g.letterSpacing = v; };

    // 진행 바 (무지개)
    const prog = clamp(t / this.endTime, 0, 1);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(this.fieldX, 0, this.fieldW, 6);
    g.fillStyle = rainbowGrad(g, this.fieldX, this.fieldX + this.fieldW);
    g.fillRect(this.fieldX, 0, this.fieldW * prog, 6);
    if (prog > 0) {
      const s = 18 / 64, px = this.fieldX + this.fieldW * prog;
      g.save();
      g.translate(px - 32 * s, 3 - 32 * s);
      g.scale(s, s);
      g.fillStyle = '#6fd34f'; g.fill(PATHS.apple);
      g.fillStyle = '#3fae3a'; g.fill(PATHS.leaf);
      g.restore();
    }

    g.textAlign = 'center';
    g.textBaseline = 'middle';

    // 콤보
    if (this.combo >= 3) {
      const pop = Math.max(0, 1 - (now - this.comboPopT) / 160);
      const s = 1 + pop * 0.22;
      g.save();
      g.translate(cx, H * 0.3);
      g.scale(s, s);
      const gold = this.combo >= 100;
      g.font = `600 ${Math.round(lw * 0.24)}px ${FONT_D}`;
      ls('6px');
      g.fillStyle = gold ? '#ffcf4a' : this.sk.comboLabel;
      g.fillText(this.rec ? 'NOTES' : 'COMBO', 0, -lw * 0.78);
      ls('0px');
      g.font = `700 ${Math.round(lw * 1.15)}px ${FONT_D}`;
      const fill = gold ? rainbowGrad(g, -lw, lw) : this.sk.comboFill;
      this.outlinedText(g, String(this.combo), 0, 0, fill, gold ? '#ffffff' : this.sk.comboStroke, gold ? 7 : 5);
      g.restore();
    }

    // 판정 텍스트 (스티커 느낌)
    if (this.lastJudge) {
      const age = (now - this.lastJudge.at) / 1000;
      if (age < 0.6) {
        const kind = this.lastJudge.kind, j = JUDGES[kind];
        const pop = Math.max(0, 1 - age / 0.1);
        const a = age < 0.4 ? 1 : 1 - (age - 0.4) / 0.2;
        g.save();
        g.globalAlpha = a;
        g.translate(cx, this.judgeY - H * 0.21 - (1 - pop) * 4);
        g.rotate(kind === 'MISS' ? -0.06 : 0);
        g.scale(1 + pop * 0.35, 1 + pop * 0.35);
        g.font = `700 ${Math.round(lw * 0.56)}px ${FONT_D}`;
        ls('2px');
        const fill = kind === 'PERFECT' ? rainbowGrad(g, -lw * 1.6, lw * 1.6) : j.color;
        this.outlinedText(g, j.label, 0, 0, fill, '#ffffff', 7);
        ls('0px');
        const d = this.lastJudge.diff;
        if (d !== null && kind !== 'PERFECT' && kind !== 'MISS') {
          g.font = `600 ${Math.round(lw * 0.21)}px ${FONT_D}`;
          this.outlinedText(g, `${d < 0 ? 'FAST' : 'SLOW'} ${d < 0 ? '' : '+'}${Math.round(d * 1000)}ms`, 0, lw * 0.48,
            d < 0 ? '#3fa2ff' : '#ff8f5c', '#ffffff', 4);
        }
        g.restore();
      }
    }

    // 100콤보 마일스톤
    if (this.milestone) {
      const age = (now - this.milestone.at) / 1000;
      if (age < 1) {
        const p = age;
        g.save();
        g.globalAlpha = 1 - p;
        g.translate(cx, H * 0.43);
        g.scale(1 + easeOut(p) * 0.5, 1 + easeOut(p) * 0.5);
        g.font = `700 ${Math.round(lw * 0.46)}px ${FONT_D}`;
        this.outlinedText(g, `${this.milestone.n} COMBO!`, 0, 0, rainbowGrad(g, -lw * 2, lw * 2), '#ffffff', 7);
        g.restore();
        if (age < dt * 1.5) this.spawnParticles(cx, H * 0.43, '#ffffff', 18, 0.9, this.fieldW * 0.6, true);
      }
    }

    // READY / GO
    if (t < 0.5 && this.state !== 'ending') {
      const ready = t < -0.7;
      const txt = ready ? 'READY?' : 'GO!';
      const a = ready ? 1 : clamp(1 - (t + 0.7) / 1.2, 0, 1);
      const bob = ready ? Math.sin(now / 160) * 6 : 0;
      g.save();
      g.globalAlpha = a;
      g.translate(cx, H * 0.42 + bob);
      if (!ready) g.scale(1 + (t + 0.7) * 0.4, 1 + (t + 0.7) * 0.4);
      g.font = `700 ${Math.round(lw * 0.8)}px ${FONT_D}`;
      ls('6px');
      this.outlinedText(g, txt, 0, 0, ready ? '#ffffff' : rainbowGrad(g, -lw * 1.2, lw * 1.2), ready ? LANE_COLORS[1] : '#ffffff', 8);
      g.restore();
      ls('0px');
    }

    // MISS 비네트 (부드러운 라벤더)
    const ma = 1 - (now - this.missAt) / 350;
    if (ma > 0) {
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, `rgba(${this.sk.miss},0)`);
      vg.addColorStop(1, `rgba(${this.sk.miss},${0.28 * ma})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, W, H);
    }

    if (!this.rec) this.drawSideHud(g, dt);
    if (this.rec) {
      g.textAlign = 'center';
      g.font = `700 ${Math.round(lw * 0.3)}px ${FONT_D}`;
      g.globalAlpha = 0.65 + 0.35 * Math.sin(now / 180);
      this.outlinedText(g, `● REC  ${this.diff}`, cx, 40, '#ff4d6d', '#ffffff', 5);
      g.globalAlpha = 1;
      g.font = `400 ${Math.round(lw * 0.2)}px ${FONT_K}`;
      this.outlinedText(g, '박자에 맞춰 키를 쳐서 채보를 만들어요 · 길게 누르면 롱노트 · Esc → 저장/취소', cx, 40 + lw * 0.42, '#ffffff', 'rgba(59,51,88,0.7)', 4);
    }
    if (this.song.yt && YtEngine.waiting() && this.state === 'playing') {
      g.textAlign = 'center';
      g.font = `600 ${Math.round(lw * 0.26)}px ${FONT_K}`;
      g.globalAlpha = 0.7 + 0.3 * Math.sin(now / 150);
      this.outlinedText(g, '영상 불러오는 중...', cx, H * 0.5, '#ffffff', 'rgba(59,51,88,0.7)', 5);
      g.globalAlpha = 1;
    }

    if (this.settings.auto && !this.rec) {
      g.font = `600 ${Math.round(lw * 0.2)}px ${FONT_D}`;
      g.textAlign = 'center';
      g.globalAlpha = 0.7 + 0.3 * Math.sin(now / 200);
      this.outlinedText(g, 'AUTO PLAY', cx, 28, '#ffd23f', 'rgba(59,51,88,0.6)', 4);
      g.globalAlpha = 1;
    }

    // 종료 배너 : 무지개 리본
    if (this.state === 'ending' && this.result && !this.rec) {
      const age = (now - this.endAt) / 1000;
      const p = clamp(age / 0.4, 0, 1);
      const r = this.result;
      const txt = r.ap ? 'ALL PERFECT' : r.fc ? 'FULL COMBO' : 'CLEAR!';
      g.save();
      g.globalAlpha = p;
      const bh = H * 0.15, by = H * 0.44 - bh / 2;
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.fillRect(0, by, W * easeOut(p), bh);
      g.fillStyle = rainbowGrad(g, 0, W);
      g.fillRect(0, by - 5, W * easeOut(p), 5);
      g.fillRect(W * (1 - easeOut(p)), by + bh, W, 5);
      g.translate(W / 2, H * 0.44);
      const s = 1.5 - 0.5 * easeOut(clamp(age / 0.5, 0, 1)) + Math.sin(age * 6) * 0.015;
      g.scale(s, s);
      g.font = `700 ${Math.round(Math.min(W / 11, lw * 1.1))}px ${FONT_D}`;
      ls('6px');
      const fill = r.ap ? rainbowGrad(g, -W * 0.25, W * 0.25) : r.fc ? '#ffae2e' : '#ff86c2';
      this.outlinedText(g, txt, 0, 0, fill, '#ffffff', 10);
      g.restore();
      ls('0px');
    }
  }

  card(g, x, y, w, h) {
    g.save();
    const sk = this.sk;
    g.shadowColor = sk.cardShadow;
    g.shadowBlur = 24;
    g.shadowOffsetY = 8;
    g.fillStyle = sk.card;
    rr(g, x, y, w, h, 22); g.fill();
    g.restore();
    g.strokeStyle = sk.cardEdge;
    g.lineWidth = 2;
    rr(g, x, y, w, h, 22); g.stroke();
  }

  drawSideHud(g, dt) {
    const H = this.H;
    const score = this.score();
    this.dispScore += (score - this.dispScore) * Math.min(1, dt * 14);
    const rx = this.fieldX + this.fieldW + 40;
    const avail = this.W - rx - 24;
    g.textBaseline = 'alphabetic';
    if (avail > 160) {
      const cw = Math.min(avail, 280);
      const big = Math.round(clamp(cw / 7, 22, 38));
      const ix = rx + 20;
      this.card(g, rx, 30, cw, big + 190);
      g.textAlign = 'left';
      g.font = `600 12px ${FONT_D}`;
      g.fillStyle = this.sk.muted;
      g.fillText('SCORE', ix, 60);
      g.font = `700 ${big}px ${FONT_D}`;
      g.fillStyle = INK;
      g.fillText(String(Math.round(this.dispScore)).padStart(7, '0'), ix, 60 + big + 4);
      g.fillStyle = rainbowGrad(g, ix, ix + cw - 40);
      rr(g, ix, 60 + big + 14, cw - 40, 4, 2); g.fill();
      const y2 = 60 + big + 50;
      g.font = `600 12px ${FONT_D}`;
      g.fillStyle = this.sk.muted;
      g.fillText('ACCURACY', ix, y2);
      g.fillText('MAX COMBO', ix, y2 + 58);
      g.font = `700 ${Math.round(big * 0.66)}px ${FONT_D}`;
      const stat = this.sk.stat || [LANE_COLORS[0], LANE_COLORS[1]];
      g.fillStyle = stat[0];
      g.fillText(this.accuracy().toFixed(2) + '%', ix, y2 + 28);
      g.fillStyle = stat[1];
      g.fillText(String(this.maxCombo), ix, y2 + 86);
      this.card(g, rx, H - 64, Math.min(cw, 200), 40);
      g.font = `600 13px ${FONT_D}`;
      g.fillStyle = INK;
      g.fillText(`SPEED x${this.settings.speed.toFixed(1)}  ↑↓`, rx + 18, H - 39);
    } else {
      g.textAlign = 'right';
      g.font = `700 18px ${FONT_D}`;
      this.outlinedText(g, String(Math.round(this.dispScore)).padStart(7, '0'), this.fieldX + this.fieldW - 10, 32, INK, '#ffffff', 4);
    }

    const lx = this.fieldX - 40;
    if (lx > 180) {
      const s = this.song;
      const cw = Math.min(lx - 24, 300), cx0 = lx - cw, ix = lx - 20;
      this.card(g, cx0, 30, cw, s.bpm ? 130 : 108);
      g.textAlign = 'right';
      const dcol = { EASY: '#4cc85e', NORMAL: '#3fa2ff', HARD: '#ff5b9a' }[this.diff];
      g.font = `700 12px ${FONT_D}`;
      const tag = `${this.diff}  LV.${s.charts[this.diff].level}`;
      const tw = g.measureText(tag).width + 20;
      g.fillStyle = dcol;
      rr(g, ix - tw, 44, tw, 22, 11); g.fill();
      g.fillStyle = '#ffffff';
      g.fillText(tag, ix - 10, 60);
      g.font = `400 ${Math.round(clamp(lx / 13, 17, 25))}px ${FONT_K}`;
      g.fillStyle = INK;
      g.fillText(this.fit(g, s.title, cw - 40), ix, 96);
      g.font = `500 13px ${FONT_D}`;
      g.fillStyle = this.sk.ink2;
      g.fillText(this.fit(g, s.artist, cw - 40), ix, 118);
      if (s.bpm) {
        g.font = `600 12px ${FONT_D}`;
        g.fillStyle = this.sk.muted;
        g.fillText(`♪ ${Math.round(s.bpm)} BPM`, ix, 142);
      }
      const jh = 150;
      this.card(g, cx0, H - jh - 40, cw, jh);
      let y = H - jh - 8;
      for (const k of ['PERFECT', 'GREAT', 'GOOD', 'MISS']) {
        g.textAlign = 'left';
        g.font = `600 13px ${FONT_D}`;
        g.fillStyle = JUDGES[k].color;
        g.fillText(k, cx0 + 20, y);
        g.textAlign = 'right';
        g.font = `700 17px ${FONT_D}`;
        g.fillStyle = INK;
        g.fillText(String(this.counts[k]), ix, y);
        y += 26;
      }
      g.font = `500 11px ${FONT_D}`;
      g.fillStyle = this.sk.muted;
      g.fillText(`FAST ${this.fast}  ·  SLOW ${this.slow}`, ix, y + 2);
    }
  }

  fit(g, text, maxW) {
    if (g.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && g.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
}
