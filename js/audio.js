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

  /* ---------------- 타격음 : 실제 악기 녹음 (sounds/ 폴더, CC0 퍼블릭 도메인) ----------------
   * 출처 : Sonic Pi 기본 샘플 (freesound.org 녹음, CC0 1.0)                                   */
  const SFX_KINDS = {
    snare: '스네어', kick: '킥 드럼', tom: '탐 드럼', hat: '하이햇',
    cowbell: '카우벨', tabla: '타블라 (게/나)', custom: '내 효과음 파일', off: '없음',
  };
  // 이름 → [파일, 재생 속도(음높이), 음량]
  const SAMPLES = {
    snare: ['drum_snare_hard', 1, 0.9], kick: ['drum_heavy_kick', 1, 1], tom: ['drum_tom_mid_hard', 1, 0.95],
    hat: ['drum_cymbal_closed', 1, 0.8], cowbell: ['drum_cowbell', 1, 0.7],
    tabla_in: ['tabla_ghe1', 1, 1], tabla_out: ['tabla_na', 1, 0.9],
  };
  // 안쪽 / 바깥쪽 레인에 다른 소리를 쓰는 종류
  const PAIRS = { tabla: ['tabla_in', 'tabla_out'] };
  let sfxKind = 'snare';
  const sampleBufs = {}, sampleLoading = {};
  function loadSample(name) {
    if (sampleBufs[name] || sampleLoading[name] || !SAMPLES[name]) return sampleLoading[name];
    init();
    sampleLoading[name] = fetch(`sounds/${SAMPLES[name][0]}.flac`)
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then((ab) => decode(ab))
      .then((buf) => {
        // 앞쪽 무음은 건너뛰고(누르자마자 소리), 음량은 최대값 기준으로 맞춤
        const d = buf.getChannelData(0);
        let pk = 0;
        for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
        let lead = 0;
        while (lead < d.length && Math.abs(d[lead]) < pk * 0.02) lead++;
        sampleBufs[name] = { buf, lead: Math.max(0, lead - 8) / buf.sampleRate, gain: pk > 0 ? 0.85 / pk : 1 };
      })
      .catch((e) => { console.warn('효과음을 불러오지 못했어요', name, e); delete sampleLoading[name]; });
    return sampleLoading[name];
  }
  function playSample(name, extraGain) {
    const smp = sampleBufs[name];
    if (!smp) { loadSample(name); return; }
    if (!ctx || ctx.state !== 'running') return;
    const [, rate, vol] = SAMPLES[name];
    const s = ctx.createBufferSource();
    s.buffer = smp.buf;
    s.playbackRate.value = rate;
    const gn = ctx.createGain();
    gn.gain.value = smp.gain * vol * (extraGain || 1);
    s.connect(gn); gn.connect(sfxGain);
    s.start(0, smp.lead);
  }
  function setSfxKind(k) {
    sfxKind = SFX_KINDS[k] ? k : 'snare';
    // 첫 타격 때 늦지 않게 미리 불러 둠
    const need = PAIRS[sfxKind] || (sfxKind === 'custom' || sfxKind === 'off' ? ['snare'] : [sfxKind]);
    need.forEach(loadSample);
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
  // 키를 누를 때 나는 소리 (누르는 순간 바로)
  // 타블라 · 내 효과음(2개)은 레인에 따라 안쪽 · 바깥쪽 소리가 다름
  let innerLanes = [1, 2];
  function setInnerLanes(arr) { innerLanes = arr; }
  function playHit(kind, lane) {
    const k = kind || sfxKind;
    if (k === 'off' || !ctx) return;
    const inner = lane === undefined || lane === null || innerLanes.includes(lane);
    if (k === 'chime') playBuf(hitBuf, 0.7);
    else if (PAIRS[k]) playSample(PAIRS[k][inner ? 0 : 1]);
    else if (k === 'custom') {
      const buf = !inner && customBuf.B ? customBuf.B : customBuf.A;
      if (buf) playBuf(buf, 1); else playSample('snare');
    } else playSample(k);
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
    songTime, songTimeAt, playHit, playChime, setMusicVolume, setSfxVolume, spectrum, setSfxKind, setInnerLanes, setCustomSfx, SFX_KINDS, loadSample, previewBuffer, stopPreview,
  };
})();
