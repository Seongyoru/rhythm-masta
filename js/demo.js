'use strict';
/* =========================================================
 * DemoSong — 음악 파일 없이 테스트할 수 있는 내장 데모곡
 * 140BPM 일렉트로닉 트랙을 샘플 단위로 직접 합성하고,
 * 어떤 악기가 언제 연주됐는지(events)를 함께 돌려준다.
 * ========================================================= */
const DemoSong = (() => {
  const BPM = 140;
  const SR = 44100;
  const CHORDS = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]]; // Am F C G
  const ROOTS = [45, 41, 48, 43];
  // [16분음표 위치, MIDI, 길이(16분음표 수)]
  const LEAD = [
    [[0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 74, 3], [10, 76, 2], [12, 79, 4]],
    [[0, 77, 3], [3, 76, 3], [6, 72, 2], [8, 69, 4], [12, 72, 4]],
    [[0, 76, 2], [2, 79, 2], [4, 84, 4], [8, 83, 2], [10, 79, 2], [12, 76, 4]],
    [[0, 74, 3], [3, 71, 3], [6, 74, 2], [8, 79, 6], [14, 77, 2]],
  ];
  const ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const TAU = Math.PI * 2;

  function section(b) {
    if (b < 4) return 'intro';
    if (b < 12) return 'verse';
    if (b < 20) return 'build';
    if (b < 28) return 'drop';
    if (b < 32) return 'break';
    if (b < 40) return 'drop2';
    return 'outro';
  }

  // TPT 상태변수 필터 (lp / bp / hp)
  function makeSVF() { return { a: 0, b: 0, g: 0, k: 1, a1: 0, a2: 0, a3: 0 }; }
  function svfSet(f, fc, q) {
    const g = Math.tan(Math.PI * Math.min(fc, SR * 0.45) / SR), k = 1 / q;
    f.a1 = 1 / (1 + g * (g + k)); f.a2 = g * f.a1; f.a3 = g * f.a2; f.k = k;
  }
  function svf(f, x, mode) {
    const v3 = x - f.b;
    const v1 = f.a1 * f.a + f.a2 * v3;
    const v2 = f.b + f.a2 * f.a + f.a3 * v3;
    f.a = 2 * v1 - f.a; f.b = 2 * v2 - f.b;
    return mode === 0 ? v2 : mode === 1 ? v1 : x - f.k * v1 - v2;
  }

  async function render() {
    const beat = 60 / BPM, step = beat / 4, barLen = beat * 4, BARS = 42;
    const total = BARS * barLen + 3;
    const LEN = Math.ceil(total * SR);
    const L = new Float32Array(LEN), R = new Float32Array(LEN);
    const SEND = new Float32Array(LEN);          // 딜레이 센드
    const DUCK = new Float32Array(LEN).fill(1);  // 사이드체인
    const PADL = new Float32Array(LEN), PADR = new Float32Array(LEN);
    const NOISE = new Float32Array(SR);
    for (let i = 0; i < SR; i++) NOISE[i] = Math.random() * 2 - 1;
    const events = [];

    // gen(n, t) → 샘플 값. pan: -1~1, send: 딜레이 양
    function voice(t0, dur, pan, send, gen, toPad) {
      const s0 = Math.floor(t0 * SR), n = Math.min(Math.floor(dur * SR), LEN - s0);
      const gl = Math.cos((pan + 1) * Math.PI / 4) * 1.414, gr = Math.sin((pan + 1) * Math.PI / 4) * 1.414;
      const OL = toPad ? PADL : L, OR = toPad ? PADR : R;
      for (let i = 0; i < n; i++) {
        const x = gen(i, i / SR);
        OL[s0 + i] += x * gl;
        OR[s0 + i] += x * gr;
        if (send) SEND[s0 + i] += x * send;
      }
    }
    const expEnv = (t, dur, from = 1, to = 0.001) => from * Math.pow(to / from, Math.min(1, t / dur));

    // ---- 악기 ----
    function kick(t0, v = 1) {
      let ph = 0, prev = 0, ni = (Math.random() * SR) | 0;
      voice(t0, 0.42, 0, 0, (i, t) => {
        const f = 155 * Math.pow(44 / 155, Math.min(1, t / 0.11));
        ph += TAU * f / SR;
        const a = (t < 0.003 ? t / 0.003 : 1) * expEnv(t, 0.4);
        const nz = NOISE[(ni + i) % SR];
        const click = (nz - prev) * 0.5 * Math.exp(-t / 0.004); prev = nz;
        return (Math.sin(ph) * a + click * 0.3) * v;
      });
      const s0 = Math.floor(t0 * SR), dn = Math.floor(beat * 0.85 * SR);
      for (let i = 0; i < dn && s0 + i < LEN; i++) {
        const g = 0.28 + 0.72 * (i / dn);
        if (g < DUCK[s0 + i]) DUCK[s0 + i] = g;
      }
    }
    function snare(t0, v = 1) {
      const f = makeSVF(); svfSet(f, 1900, 0.8);
      let ph = 0, ni = (Math.random() * SR) | 0;
      voice(t0, 0.22, 0, 0.25, (i, t) => {
        const nz = svf(f, NOISE[(ni + i) % SR], 1) * 0.75 * expEnv(t, 0.2);
        ph += TAU * (210 * Math.pow(150 / 210, Math.min(1, t / 0.08))) / SR;
        const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
        return (nz * 1.6 + tri * 0.5 * expEnv(t, 0.1)) * v;
      });
    }
    function hat(t0, v, open) {
      const f = makeSVF(); svfSet(f, 7500, 0.7);
      const len = open ? 0.18 : 0.045, ni = (Math.random() * SR) | 0;
      voice(t0, len, 0.25, 0, (i, t) => svf(f, NOISE[(ni + i) % SR], 2) * 0.3 * v * expEnv(t, len));
    }
    function crash(t0) {
      const f = makeSVF(); svfSet(f, 4500, 0.7);
      const ni = (Math.random() * SR) | 0;
      voice(t0, 1.8, -0.15, 0.3, (i, t) => svf(f, NOISE[(ni + i) % SR], 2) * 0.3 * expEnv(t, 1.8));
    }
    function bass(t0, m, len) {
      const f = makeSVF(), fr = mtof(m);
      let p1 = 0, p2 = 0;
      voice(t0, len + 0.05, 0, 0, (i, t) => {
        if ((i & 15) === 0) svfSet(f, 1500 * Math.pow(220 / 1500, Math.min(1, t / len)), 5);
        p1 = (p1 + fr / SR) % 1; p2 = (p2 + fr / 2 / SR) % 1;
        const x = (2 * p1 - 1) + (p2 < 0.5 ? 0.45 : -0.45);
        const a = t < 0.006 ? t / 0.006 : t < len ? 1 : expEnv(t - len, 0.05, 1, 0.0001);
        return svf(f, x, 0) * 0.42 * a;
      });
    }
    function pad(t0, notes, len) {
      const f = makeSVF(); svfSet(f, 1300, 0.7);
      const oscs = [];
      for (const m of notes) for (const det of [-9, 9]) oscs.push({ p: Math.random(), inc: mtof(m) * Math.pow(2, det / 1200) / SR });
      voice(t0, len + 0.4, 0, 0.6, (i, t) => {
        let x = 0;
        for (const o of oscs) { o.p += o.inc; if (o.p >= 1) o.p -= 1; x += 2 * o.p - 1; }
        const a = t < 0.3 ? t / 0.3 : t < len ? 1 : Math.max(0, 1 - (t - len) / 0.35);
        return svf(f, x, 0) * 0.05 * a;
      }, true);
    }
    function arp(t0, m, v, right) {
      const f = makeSVF(), fr = mtof(m);
      let p = 0;
      voice(t0, 0.2, right ? 0.35 : -0.35, 0.35, (i, t) => {
        if ((i & 15) === 0) svfSet(f, 5200 * Math.pow(800 / 5200, Math.min(1, t / 0.13)), 3);
        p = (p + fr / SR) % 1;
        const a = (t < 0.003 ? t / 0.003 : 1) * expEnv(t, 0.18, 1, 0.0001);
        return svf(f, p < 0.5 ? 1 : -1, 0) * 0.1 * v * a;
      });
    }
    function lead(t0, m, len) {
      const f = makeSVF(); svfSet(f, 4200, 2);
      const fr = mtof(m);
      const i1 = fr * Math.pow(2, -11 / 1200) / SR, i2 = fr * Math.pow(2, 11 / 1200) / SR;
      let p1 = 0, p2 = 0.5;
      voice(t0, len + 0.13, 0, 0.45, (i, t) => {
        p1 += i1; if (p1 >= 1) p1 -= 1;
        p2 += i2; if (p2 >= 1) p2 -= 1;
        const a = t < 0.012 ? t / 0.012 : t < len ? 1 - 0.18 * Math.min(1, t / len) : expEnv(t - len, 0.12, 0.82, 0.0001);
        return svf(f, (2 * p1 - 1) + (2 * p2 - 1), 0) * 0.11 * a;
      });
    }
    function riser(t0, len) {
      const f = makeSVF(), ni = (Math.random() * SR) | 0;
      voice(t0, len, 0, 0.2, (i, t) => {
        if ((i & 31) === 0) svfSet(f, 300 * Math.pow(7500 / 300, Math.min(1, t / len)), 3);
        return svf(f, NOISE[(ni + i) % SR], 1) * 0.5 * (t / len);
      });
    }

    // ---- 편곡 ----
    for (let b = 0; b < BARS; b++) {
      const t0 = b * barLen, ci = b % 4, S = section(b), ch = CHORDS[ci];
      const isDrop = S === 'drop' || S === 'drop2';

      if (S !== 'outro' || b === 40) {
        const len = barLen * (b === 40 ? 2 : 1);
        pad(t0, b === 40 ? [57, 60, 64, 69] : ch, len);
        events.push({ t: t0, type: 'pad', dur: len * 0.95 });
      }
      if (b === 4 || b === 12 || b === 20 || b === 32 || b === 40) { crash(t0); events.push({ t: t0, type: 'crash' }); }
      if (b === 19 || b === 31) riser(t0, barLen);

      for (let s = 0; s < 16; s++) {
        const t = t0 + s * step;
        let k = false;
        if (S === 'verse' || S === 'build' || isDrop) k = s % 4 === 0;
        if (isDrop && s === 14 && b % 2 === 1) k = true;
        if (b === 40 && s === 0) k = true;
        if (k) { kick(t); events.push({ t, type: 'kick' }); }

        let sn = 0;
        if ((S === 'verse' || S === 'build' || isDrop) && (s === 4 || s === 12)) sn = 1;
        if (b === 18 && s % 2 === 0) sn = Math.max(sn, 0.5 + s / 40);
        if ((b === 19 || b === 31) && s < 15) sn = Math.max(sn, 0.45 + s / 30);
        if (sn) { sn = Math.min(1, sn); snare(t, sn); events.push({ t, type: 'snare', v: sn }); }

        let h = 0;
        if (S === 'intro') h = s % 4 === 2 ? 0.5 : 0;
        if (S === 'verse') h = s % 2 === 0 ? (s % 4 === 2 ? 0.65 : 0.3) : 0;
        if (S === 'build' || isDrop) h = s % 4 === 2 ? 0.75 : 0.3;
        if (h) { hat(t, h, isDrop && s % 4 === 2); events.push({ t, type: 'hat', v: h }); }

        if (S === 'verse' && s % 2 === 0) { bass(t, ROOTS[ci] + (s % 8 === 6 ? 12 : 0), step * 1.6); events.push({ t, type: 'bass' }); }
        if (S === 'build' && s % 2 === 0) { bass(t, ROOTS[ci], step * 1.6); events.push({ t, type: 'bass' }); }
        if (isDrop && s % 4 !== 0) { bass(t, ROOTS[ci] + (s % 4 === 2 ? 12 : 0), step * 0.85); events.push({ t, type: 'bass' }); }

        if (S === 'build' || isDrop || S === 'break') {
          const tones = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2] + 12];
          const vel = S === 'break' ? 0.65 : S === 'build' ? 0.35 + 0.55 * ((b - 12) / 8) : 0.7;
          arp(t, tones[ARP[s]] + 12, vel, s % 2 === 1);
          events.push({ t, type: 'arp', v: s % 2 === 0 ? 1 : 0.6 });
        }
        if (isDrop) {
          for (const n of LEAD[ci]) {
            if (n[0] !== s) continue;
            lead(t, n[1] + (S === 'drop2' && b >= 36 ? 12 : 0), n[2] * step);
            events.push({ t, type: 'lead', dur: n[2] * step });
          }
        }
      }
      if (b % 6 === 5) await new Promise((r) => setTimeout(r, 0)); // UI 숨 돌리기
    }

    // ---- 패드(사이드체인) 합치기 ----
    for (let i = 0; i < LEN; i++) { L[i] += PADL[i] * DUCK[i]; R[i] += PADR[i] * DUCK[i]; }

    // ---- 딜레이 (점8분, 핑퐁) ----
    const D = Math.round(beat * 0.75 * SR), D2 = D + Math.round(0.013 * SR);
    const line = new Float32Array(LEN);
    let lp = 0;
    const lpk = 1 - Math.exp(-TAU * 2800 / SR);
    for (let i = 0; i < LEN; i++) {
      const fbIn = i >= D ? line[i - D] : 0;
      lp += (fbIn - lp) * lpk;
      line[i] = SEND[i] + lp * 0.38;
      L[i] += lp * 0.26;
    }
    // 오른쪽은 살짝 늦은 탭으로 스테레오감
    for (let i = LEN - 1; i >= D2; i--) R[i] += line[i - D2] * 0.22;

    // ---- 마스터: 소프트 클립 + 노멀라이즈 ----
    let peak = 0;
    for (let i = 0; i < LEN; i++) {
      L[i] = Math.tanh(L[i] * 1.2); R[i] = Math.tanh(R[i] * 1.2);
      const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
      if (a > peak) peak = a;
    }
    const norm = peak > 0 ? 0.92 / peak : 1;
    for (let i = 0; i < LEN; i++) { L[i] *= norm; R[i] *= norm; }

    let buffer;
    try { buffer = new AudioBuffer({ length: LEN, numberOfChannels: 2, sampleRate: SR }); }
    catch (e) { buffer = AudioEngine.init().createBuffer(2, LEN, SR); }
    buffer.copyToChannel(L, 0);
    buffer.copyToChannel(R, 1);
    return { buffer, events, bpm: BPM, title: 'Neon Pulse', artist: 'RHYTHM MASTA · 내장 데모' };
  }

  return { render, BPM };
})();
