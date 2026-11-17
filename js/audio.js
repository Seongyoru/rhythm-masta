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
    osu: 'osu! 느낌 (탁)', rhythm: '리듬 세상 느낌 (뽁)', taiko: '태고 느낌 (동/캇)', hat: '하이햇', off: '없음',
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
    const LEN = { tick: 0.07, hat: 0.09, osu: 0.11, rhythm: 0.16, don: 0.38, ka: 0.12 }[kind] || 0.1;
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
    } else if (kind === 'rhythm') {
      // 귀여운 우드블록 '뽁' + 살짝 반짝이는 배음
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 1150 + 260 * Math.exp(-t * 90);
        ph += tw * f / sr;
        d[i] = Math.sin(ph) * Math.exp(-t * 32) * 0.8
          + Math.sin(ph * 2.76) * Math.exp(-t * 70) * 0.28
          + Math.sin(tw * 3520 * t) * Math.exp(-t * 45) * 0.12
          + nz() * Math.exp(-t * 1200) * 0.35;
      }
    } else if (kind === 'don') {
      // 북 가운데 '동' : 낮게 떨어지는 톤 + 북 가죽 울림
      const lp = biquad('lp', 900, 0.7, sr);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 92 + 70 * Math.exp(-t * 28);
        ph += tw * f / sr;
        d[i] = Math.sin(ph) * Math.exp(-t * 8.5) * 1.0
          + Math.sin(ph * 2.02) * Math.exp(-t * 16) * 0.25
          + lp(nz()) * Math.exp(-t * 45) * 0.9;
      }
    } else if (kind === 'ka') {
      // 북 테두리 '캇' : 나무를 때리는 짧고 높은 소리
      const bp = biquad('bp', 2600, 2.5, sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        d[i] = bp(nz()) * Math.exp(-t * 75) * 2.4
          + Math.sin(tw * 1750 * t) * Math.exp(-t * 60) * 0.35
          + Math.sin(tw * 2930 * t) * Math.exp(-t * 80) * 0.2;
      }
    } else if (kind === 'drum') {
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
      const hp1 = biquad('hp', 7000, 0.7, sr), hp2 = biquad('hp', 7000, 0.7, sr);
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const f = 48 + 120 * Math.exp(-t * 35);
        ph += tw * f / sr;
        d[i] = Math.sin(ph) * Math.exp(-t * 14) * 0.95
          + Math.sin(tw * 2100 * t) * Math.exp(-t * 400) * 0.25
          + hp2(hp1(nz())) * Math.exp(-t * 70) * 0.45;
      }
    }
    // 정규화 + 끝부분 페이드
    let pk = 0;
    for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i]));
    const g = pk > 0 ? 0.85 / pk : 1, fade = Math.floor(sr * 0.005);
    for (let i = 0; i < n; i++) d[i] *= g * (i > n - fade ? (n - i) / fade : 1);
    return b;
  }
  function sfxBuf(kind) {
    if (!sfxBufs[kind]) sfxBufs[kind] = synthSfx(kind);
    return sfxBufs[kind];
  }
  function setSfxKind(k) { sfxKind = SFX_KINDS[k] ? k : 'osu'; }

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
    songTime, songTimeAt, playHit, playChime, setMusicVolume, setSfxVolume, spectrum, setSfxKind, setTaikoLanes, SFX_KINDS, previewBuffer, stopPreview,
  };
})();
