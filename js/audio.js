'use strict';
/* =========================================================
 * AudioEngine — 음악 재생 / 타이밍 / 효과음 / 스펙트럼
 * 게임 시간은 AudioContext.currentTime 기준으로 계산해서
 * 음악과 노트가 어긋나지 않도록 한다.
 * ========================================================= */
const AudioEngine = (() => {
  let ctx = null;
  let master = null, musicGain = null, sfxGain = null, analyser = null, freq = null;
  let source = null, startAt = 0, latency = 0;
  let lastCtx = -1, lastPerf = 0;
  let hitBuf = null;
  let chimeBufs = null;
  // 레인별 음높이 (펜타토닉 : G5 A5 C6 [C5] D6 E6 G6) — 어떤 조합으로 쳐도 어울리게
  const LANE_PITCH = [784, 880, 1047, 523.25, 1175, 1319, 1568];

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
    master = ctx.createGain();
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.72;
    musicGain.connect(analyser);
    analyser.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.connect(master);
    freq = new Uint8Array(analyser.frequencyBinCount);
    hitBuf = makeHitBuffer();
    chimeBufs = LANE_PITCH.map((f, i) => makeChime(f, i === 3));
    return ctx;
  }

  // 키를 누를 때의 부드러운 '톡' (외부 파일 없이 생성)
  function makeHitBuffer() {
    const sr = ctx.sampleRate, len = Math.floor(sr * 0.06);
    const b = ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const f = 900 - 500 * Math.min(1, t / 0.03);
      const tone = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 90);
      const click = (Math.random() * 2 - 1) * Math.exp(-t * 600) * 0.25;
      d[i] = (tone * 0.5 + click) * 0.6;
    }
    return b;
  }

  // 노트를 맞혔을 때의 반짝이는 차임 (스페이스는 '퐁' 하는 버블음 추가)
  function makeChime(freq, bubble) {
    const sr = ctx.sampleRate, len = Math.floor(sr * 0.45);
    const b = ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.min(1, t / 0.002) * Math.exp(-t * 9);
      let v = Math.sin(2 * Math.PI * freq * t) * 0.55
        + Math.sin(2 * Math.PI * freq * 2 * t) * 0.22 * Math.exp(-t * 14)
        + Math.sin(2 * Math.PI * freq * 3.01 * t) * 0.12 * Math.exp(-t * 22)
        + Math.sin(2 * Math.PI * freq * 4.2 * t) * 0.1 * Math.exp(-t * 40);
      v *= env;
      if (bubble) {
        const f = 260 + 520 * (1 - Math.exp(-t * 40));
        ph += 2 * Math.PI * f / sr;
        v += Math.sin(ph) * Math.exp(-t * 28) * 0.6;
      }
      d[i] = v * 0.42;
    }
    return b;
  }

  /* ---------------- 리듬게임 타격음 (외부 파일 없이 합성) ----------------
   * tick : 짧고 또렷한 '틱' (리듬게임 기본 히트음 느낌)
   * drum : 드럼 스틱/림샷 '탁'
   * clap : 핸드클랩
   * hat  : 닫힌 하이햇 '칫'
   * kick : 킥 + 하이햇 (댄스 리듬게임 느낌)
   * chime: 레인별 음높이 차임 (이전 파스텔 소리)                       */
  // 고를 수 있는 타격음 (원본 효과음 파일이 아니라, 그 느낌이 나게 직접 합성한 소리)
  const SFX_KINDS = {
    osu: 'osu! 느낌 (탁)', taiko: '태고 느낌 (동/캇)', rhythmhero: '리듬 히어로 느낌 (팍)',
    kick: '킥 펀치 (쿵)', snare: '스네어 (짝)', clap: '핸드클랩', rim: '림샷 (딱)', hat: '하이햇',
    custom: '내 효과음 파일', off: '없음',
  };
  let sfxKind = 'osu';
  const sfxBufs = {};
  function noiseGen(seed) {
    let a = seed >>> 0;
    return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 2147483648 - 1; };
  }
  // 간단한 2차 필터 (RBJ biquad)
  function biquad(type, f0, q, sr) {
    const w = 2 * Math.PI * f0 / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = (1 + cs) / 2; }
    else if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = (1 - cs) / 2; }
    else { b0 = al; b1 = 0; b2 = -al; } // bp
    a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  function synthSfx(kind) {
    const sr = ctx.sampleRate;
    const LEN = { tick: 0.07, hat: 0.09, osu: 0.11, rhythmhero: 0.13, don: 0.5, ka: 0.16, kick: 0.32, snare: 0.22, clap: 0.22, rim: 0.13 }[kind] || 0.1;
    const n = Math.floor(sr * LEN);
    const b = ctx.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    const nz = noiseGen(7 + kind.length * 31);
    const tw = 2 * Math.PI;
    if (kind === 'tick') {
      const hp = biquad('hp', 3000, 0.7, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = Math.sin(tw * 1250 * t) * Math.exp(-t * 75) * 0.38
          + Math.sin(tw * 2500 * t) * Math.exp(-t * 130) * 0.18
          + Math.sin(tw * 190 * t) * Math.exp(-t * 50) * 0.22
          + hp(nz()) * Math.exp(-t * 520) * 0.9;
      }
    } else if (kind === 'osu') {
      // 짧고 단단한 '탁' : 몸통(낮은 톤) + 스네어 같은 잡음 + 아주 짧은 클릭
      const bp = biquad('bp', 1900, 0.8, sr), hp = biquad('hp', 6000, 0.7, sr);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, x = nz();
        const f = 230 + 160 * Math.exp(-t * 60);
        ph += tw * f / sr;
        d[i] = Math.sin(ph) * Math.exp(-t * 38) * 0.55
          + bp(x) * Math.exp(-t * 55) * 1.5
          + hp(x) * Math.exp(-t * 700) * 0.5;
      }
    } else if (kind === 'rhythmhero') {
      // 짧고 경쾌한 '팍' : 손가락 스냅 같은 날카로운 잡음 + 가벼운 몸통
      const bp = biquad('bp', 2700, 1.6, sr), bp2 = biquad('bp', 1300, 1.2, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, x = nz();
        d[i] = bp(x) * Math.exp(-t * 110) * 2.6
          + bp2(x) * Math.exp(-t * 70) * 0.9
          + Math.sin(tw * 1650 * t) * Math.exp(-t * 80) * 0.25
          + Math.sin(tw * 310 * t) * Math.exp(-t * 55) * 0.35;
      }
    } else if (kind === 'don') {
      // 북 가운데 '동' : 큰 북 가죽은 여러 음(원형 막의 진동 모드)이 함께 울린다.
      // 북채가 닿는 순간의 '퉁' (부드러운 저음 잡음) + 살짝 높았다가 내려앉는 기본음 + 배음들
      const lp = biquad('lp', 700, 0.8, sr);
      const modes = [[1, 1.0, 6.5], [1.59, 0.42, 11], [2.14, 0.26, 16], [2.3, 0.18, 19], [2.65, 0.1, 24]];
      const ph = modes.map(() => 0);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f0 = 118 + 62 * Math.exp(-t * 32);
        let v = 0;
        modes.forEach(([r, a, dc], k) => { ph[k] += tw * f0 * r / sr; v += Math.sin(ph[k]) * a * Math.exp(-t * dc); });
        v += lp(nz()) * Math.exp(-t * 90) * 1.4;
        d[i] = Math.tanh(v * 1.6);
      }
    } else if (kind === 'ka') {
      // 북 테두리 '캇' : 단단한 나무를 때리는 소리. 높은 공명 2~3개가 아주 빨리 사라짐 + 날카로운 딱
      const bp = biquad('bp', 3200, 3, sr), hp = biquad('hp', 5000, 0.7, sr);
      const modes = [[1180, 0.7, 38], [2560, 0.45, 55], [3900, 0.25, 75]];
      for (let i = 0; i < n; i++) {
        const t = i / sr, x = nz();
        let v = 0;
        for (const [f, a, dc] of modes) v += Math.sin(tw * f * t) * a * Math.exp(-t * dc);
        v += bp(x) * Math.exp(-t * 160) * 2.2 + hp(x) * Math.exp(-t * 1200) * 0.8;
        d[i] = Math.tanh(v * 1.3);
      }
    } else if (kind === 'snare') {
      // 스네어 '짝' : 짧은 몸통 + 스네어 줄의 치익 잡음
      const bp = biquad('bp', 3800, 0.7, sr), hp = biquad('hp', 7000, 0.7, sr);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr, x = nz();
        const f = 185 + 70 * Math.exp(-t * 50);
        ph += tw * f / sr;
        d[i] = Math.tanh((Math.sin(ph) * Math.exp(-t * 28) * 0.8
          + bp(x) * Math.exp(-t * 20) * 1.6
          + hp(x) * Math.exp(-t * 300) * 0.9) * 1.4);
      }
    } else if (kind === 'rim') {
      const bp = biquad('bp', 2600, 1.1, sr), hp = biquad('hp', 5000, 0.7, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, x = nz();
        d[i] = Math.sin(tw * 520 * t) * Math.exp(-t * 42) * 0.5
          + Math.sin(tw * 1780 * t) * Math.exp(-t * 65) * 0.22
          + bp(x) * Math.exp(-t * 85) * 1.6
          + hp(x) * Math.exp(-t * 900) * 0.7;
      }
    } else if (kind === 'clap') {
      const bp = biquad('bp', 1150, 0.9, sr), bp2 = biquad('bp', 2400, 1.2, sr);
      const hits = [0, 0.0105, 0.021];
      for (let i = 0; i < n; i++) {
        const t = i / sr, x = nz();
        let env = 0;
        for (const h of hits) if (t >= h) env = Math.max(env, Math.exp(-(t - h) * 280));
        if (t >= 0.03) env = Math.max(env, Math.exp(-(t - 0.03) * 22) * 0.38);
        d[i] = (bp(x) * 2.2 + bp2(x) * 0.8) * env;
      }
    } else if (kind === 'hat') {
      const hp1 = biquad('hp', 7000, 0.7, sr), hp2 = biquad('hp', 7000, 0.7, sr), bp = biquad('bp', 10500, 1.5, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, x = nz();
        d[i] = (hp2(hp1(x)) * 0.9 + bp(x) * 1.2) * Math.exp(-t * 62);
      }
    } else if (kind === 'kick') {
      // 킥 펀치 '쿵' : 빠르게 떨어지는 저음 + 앞부분 '딱' 클릭, 살짝 찌그러뜨려 단단하게
      const hp = biquad('hp', 4000, 0.7, sr);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 46 + 150 * Math.exp(-t * 32);
        ph += tw * f / sr;
        d[i] = Math.tanh((Math.sin(ph) * Math.exp(-t * 11)
          + hp(nz()) * Math.exp(-t * 900) * 0.7
          + Math.sin(tw * 1800 * t) * Math.exp(-t * 300) * 0.3) * 1.8);
      }
    }
    // 끝부분 페이드 (뚝 끊기지 않게 조금 길게)
    const fade = Math.floor(sr * 0.02);
    for (let i = Math.max(0, n - fade); i < n; i++) d[i] *= (n - i) / fade;
    return addRoom(d, sr, ROOM[kind] || [0.18, 0.5]);
  }
  // 소리 종류별 잔향 [울림 양, 방 크기 0~1]
  const ROOM = {
    tick: [0.14, 0.4], osu: [0.18, 0.45], rhythmhero: [0.2, 0.5], don: [0.2, 0.6], ka: [0.2, 0.45],
    kick: [0.1, 0.5], snare: [0.28, 0.6], clap: [0.32, 0.6], rim: [0.22, 0.5], hat: [0.16, 0.4],
  };
  // 짧은 방 울림 + 스테레오 (Freeverb 방식 : 콤 필터 4개 + 올패스 2개, 좌우 지연을 살짝 다르게)
  function addRoom(dry, sr, [wet, size]) {
    const tail = Math.floor(sr * (0.35 + size * 0.75));
    const len = dry.length + tail;
    const out = ctx.createBuffer(2, len, sr);
    const fb = 0.7 + size * 0.14, damp = 0.32;
    for (let ch = 0; ch < 2; ch++) {
      const o = out.getChannelData(ch);
      const spread = ch ? 1.037 : 1;
      const combs = [0.0297, 0.0371, 0.0411, 0.0437].map((t) => ({ buf: new Float32Array(Math.floor(t * sr * spread)), i: 0, lp: 0 }));
      const aps = [0.005, 0.0017].map((t) => ({ buf: new Float32Array(Math.max(1, Math.floor(t * sr * spread))), i: 0 }));
      for (let n = 0; n < len; n++) {
        const x = n < dry.length ? dry[n] : 0;
        let y = 0;
        for (const c of combs) {
          const v = c.buf[c.i];
          c.lp = v * (1 - damp) + c.lp * damp;
          c.buf[c.i] = x + c.lp * fb;
          c.i = (c.i + 1) % c.buf.length;
          y += v;
        }
        y *= 0.25;
        for (const a of aps) {
          const v = a.buf[a.i];
          const z = -y * 0.5 + v;
          a.buf[a.i] = y + v * 0.5;
          a.i = (a.i + 1) % a.buf.length;
          y = z;
        }
        o[n] = x + y * wet * 2.2;
      }
    }
    // 정규화 + 마지막 페이드
    let pk = 0;
    for (let ch = 0; ch < 2; ch++) { const o = out.getChannelData(ch); for (let n = 0; n < len; n++) pk = Math.max(pk, Math.abs(o[n])); }
    const g = pk > 0 ? 0.85 / pk : 1, f2 = Math.floor(sr * 0.05);
    for (let ch = 0; ch < 2; ch++) { const o = out.getChannelData(ch); for (let n = 0; n < len; n++) o[n] *= g * (n > len - f2 ? (len - n) / f2 : 1); }
    return out;
  }
  function sfxBuf(kind) {
    if (!sfxBufs[kind]) sfxBufs[kind] = synthSfx(kind);
    return sfxBufs[kind];
  }
  function setSfxKind(k) {
    sfxKind = SFX_KINDS[k] ? k : 'osu';
    // 첫 타격 때 끊기지 않게 미리 만들어 둠
    const need = sfxKind === 'taiko' ? ['don', 'ka'] : sfxKind === 'custom' || sfxKind === 'off' ? ['osu'] : [sfxKind];
    setTimeout(() => { init(); need.forEach(sfxBuf); }, 0);
  }
  // 내 효과음 파일 : A = 기본(안쪽 레인), B = 바깥쪽 레인 (없으면 A 를 모든 레인에)
  const customBuf = { A: null, B: null };
  function setCustomSfx(slot, buffer) { customBuf[slot] = buffer || null; }

  async function resume() {
    init();
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* ignore */ } }
  }

  function decode(arrayBuffer) {
    init();
    return new Promise((res, rej) => {
      const p = ctx.decodeAudioData(arrayBuffer, res, rej);
      if (p && p.catch) p.catch(rej);
    });
  }

  function play(buffer, delay) {
    stop();
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(musicGain);
    startAt = ctx.currentTime + delay;
    source.start(startAt);
    latency = (typeof ctx.outputLatency === 'number' && ctx.outputLatency > 0)
      ? ctx.outputLatency : (ctx.baseLatency || 0);
    lastCtx = -1;
  }

  function stop() {
    if (!source) return;
    try { source.stop(); } catch (e) { /* ignore */ }
    try { source.disconnect(); } catch (e) { /* ignore */ }
    source = null;
  }

  function pause() { return ctx ? ctx.suspend() : Promise.resolve(); }
  function unpause() { return ctx ? ctx.resume() : Promise.resolve(); }
  function isRunning() { return !!ctx && ctx.state === 'running'; }

  // currentTime 은 덩어리 단위로 갱신되므로 performance.now() 로 보간한다
  function sync() {
    const t = ctx.currentTime, p = performance.now();
    if (t !== lastCtx) { lastCtx = t; lastPerf = p; }
    return p;
  }
  function audioTime() {
    const p = sync();
    if (ctx.state !== 'running') return lastCtx;
    return lastCtx + Math.min((p - lastPerf) / 1000, 0.05);
  }
  function audioTimeAt(perfMs) {
    sync();
    if (ctx.state !== 'running') return lastCtx;
    const dt = (perfMs - lastPerf) / 1000;
    return lastCtx + Math.max(-0.1, Math.min(dt, 0.05));
  }
  function songTime(offsetSec) {
    if (!ctx) return 0;
    return audioTime() - startAt - latency - offsetSec;
  }
  function songTimeAt(perfMs, offsetSec) {
    if (!ctx) return 0;
    return audioTimeAt(perfMs) - startAt - latency - offsetSec;
  }

  function playBuf(buf, gain) {
    if (!ctx || !buf || ctx.state !== 'running') return;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    if (gain !== undefined && gain !== 1) {
      const gn = ctx.createGain();
      gn.gain.value = gain;
      s.connect(gn); gn.connect(sfxGain);
    } else s.connect(sfxGain);
    s.start();
  }
  // 키를 누를 때 나는 소리 (리듬게임처럼 누르는 순간 바로)
  // 태고 느낌은 레인에 따라 '동'(안쪽) / '캇'(바깥쪽)
  let taikoDon = [1, 2];
  function setTaikoLanes(arr) { taikoDon = arr; }
  function playHit(kind, lane) {
    const k = kind || sfxKind;
    if (k === 'off' || !ctx) return;
    if (k === 'chime') playBuf(hitBuf, 0.7);
    else if (k === 'taiko') playBuf(sfxBuf(lane === undefined || taikoDon.includes(lane) ? 'don' : 'ka'), 1);
    else if (k === 'custom') {
      const inner = lane === undefined || taikoDon.includes(lane);
      const buf = !inner && customBuf.B ? customBuf.B : customBuf.A;
      if (buf) playBuf(buf, 1); else playBuf(sfxBuf('osu'), 1);
    }
    else playBuf(sfxBuf(k), 1);
  }
  // 노트를 맞혔을 때 추가로 나는 차임 (차임 모드일 때만)
  const CHIME_GAIN = { PERFECT: 1, GREAT: 0.75, GOOD: 0.5 };
  function playChime(lane, kind, force) {
    if (!chimeBufs || (sfxKind !== 'chime' && !force)) return;
    playBuf(chimeBufs[lane], CHIME_GAIN[kind] || 0);
  }

  // 곡 선택 미리듣기 (음악 파일 · 데모곡)
  let pv = null;
  function previewBuffer(buffer, startSec, vol, lenSec) {
    init();
    stopPreview(true);
    const g = ctx.createGain();
    g.connect(master);
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.connect(g);
    const t = ctx.currentTime + 0.05, len = lenSec || 15;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.9);
    g.gain.setValueAtTime(vol, t + len - 1.2);
    g.gain.linearRampToValueAtTime(0, t + len);
    s.start(t, Math.max(0, Math.min(startSec, buffer.duration - 1)));
    s.stop(t + len + 0.05);
    pv = { s, g };
  }
  function stopPreview(now) {
    if (!pv) return;
    const { s, g } = pv; pv = null;
    try {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + (now ? 0.02 : 0.25));
      s.stop(t + (now ? 0.03 : 0.3));
    } catch (e) { /* ignore */ }
  }

  function setMusicVolume(v) { init(); musicGain.gain.value = v; }
  function setSfxVolume(v) { init(); sfxGain.gain.value = v; }

  function spectrum() {
    if (!analyser || !source) return null;
    analyser.getByteFrequencyData(freq);
    return freq;
  }

  return {
    init, resume, decode, play, stop, pause, unpause, isRunning, context: () => init(),
    songTime, songTimeAt, playHit, playChime, setMusicVolume, setSfxVolume, spectrum, setSfxKind, setTaikoLanes, setCustomSfx, SFX_KINDS, sfxBuffer: (k) => { init(); return sfxBuf(k); }, previewBuffer, stopPreview,
  };
})();
