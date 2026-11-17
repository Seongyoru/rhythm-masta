'use strict';
/* =========================================================
 * AutoSync — 재생 중인 소리를 잠깐 들어보고 BPM · 첫 박 위치를 자동으로 찾는다.
 *
 * 유튜브 플레이어의 소리는 페이지에서 직접 읽을 수 없으므로,
 * 사용자가 허락하면 "이 탭의 오디오"를 공유받아(getDisplayMedia) 분석한다.
 * 노래 파일은 저장하지 않고, 분석이 끝나면 공유도 바로 끊는다.
 *
 * 1) capture  : 스트림 → 샘플. 각 블록이 도착한 performance.now() 도 기록
 * 2) 시간 맞춤 : 샘플 번호 → performance.now() → 영상 시간
 * 3) estimate : onset 들을 박자 격자에 맞춰 위상(첫 박) · 마디 시작 · BPM 결정
 * ========================================================= */
const AutoSync = (() => {
  /* 탭 오디오 공유 요청 (클릭 등 사용자 동작 안에서 불러야 함) */
  async function requestTabAudio() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('이 브라우저는 탭 소리 공유를 지원하지 않아요. 크롬이나 엣지를 써 주세요');
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser', frameRate: 1 },
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
        preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', systemAudio: 'exclude',
      });
    } catch (e) {
      throw new Error('탭 공유가 취소됐어요');
    }
    stream.getVideoTracks().forEach((t) => t.stop()); // 화면은 필요 없음
    if (!stream.getAudioTracks().length) {
      throw new Error('소리가 공유되지 않았어요. 공유 창에서 "탭 오디오도 공유"를 켜고 이 탭을 골라 주세요');
    }
    return stream;
  }

  /* 스트림 녹음 : timeFn(perf) 는 그 순간의 곡(영상) 시간, 재생 중이 아니면 null
   * 시작하자마자 '틱' 소리 3번을 직접 내보내고, 녹음에서 그 위치를 찾아
   * 녹음 경로의 지연을 정확히 잰다 (ready 는 틱이 끝난 뒤 resolve → 그때 영상 재생) */
  const CLICKS = 3, CLICK_GAP = 0.45, CLICK_LEAD = 0.5;

  // 오디오 스레드에서 샘플을 모아 보내는 워클릿 (메인 스레드가 바빠도 샘플이 빠지지 않음)
  // 블록마다 currentFrame 을 같이 보내서, 혹시 빠진 구간이 있어도 시간 위치는 정확히 유지
  const WORKLET = `
  class CapProc extends AudioWorkletProcessor {
    constructor(o) { super(); this.k = o.processorOptions.k; this.buf = new Float32Array(2048); this.n = 0; this.f0 = -1; this.acc = 0; this.cnt = 0; }
    process(inputs) {
      const inp = inputs[0];
      if (inp && inp.length) {
        const a = inp[0], b = inp[1] || a;
        for (let i = 0; i < a.length; i++) {
          if (this.cnt === 0 && this.n === 0 && this.f0 < 0) this.f0 = currentFrame + i;
          this.acc += (a[i] + b[i]) * 0.5; this.cnt++;
          if (this.cnt === this.k) {
            this.buf[this.n++] = this.acc / this.k; this.acc = 0; this.cnt = 0;
            if (this.n === this.buf.length) { this.port.postMessage({ f0: this.f0, d: this.buf }, [this.buf.buffer]); this.buf = new Float32Array(2048); this.n = 0; this.f0 = -1; }
          }
        }
      }
      return true;
    }
  }
  registerProcessor('rm-capture', CapProc);`;
  let workletP = null;
  function loadWorklet(ctx) {
    if (!workletP) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
      workletP = ctx.audioWorklet.addModule(url).catch((e) => { workletP = null; throw e; });
    }
    return workletP;
  }

  async function capture(stream, timeFn, opt) {
    const ctx = AudioEngine.context();
    await loadWorklet(ctx);
    const k = Math.max(1, Math.round(ctx.sampleRate / 24000)); // 24kHz 정도로 줄여서 저장
    const sr = ctx.sampleRate / k;
    const src = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'rm-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { k } });
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(node); node.connect(mute); mute.connect(ctx.destination);
    // 보정용 틱 (짧은 2kHz 톤 버스트)
    const csr = ctx.sampleRate;
    const clickBuf = ctx.createBuffer(1, Math.round(csr * 0.006), csr);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = 0.9 * Math.sin(2 * Math.PI * 2000 * i / csr) * Math.exp(-i / (csr * 0.002));
    const clickTimes = [];
    const cBase = ctx.currentTime + CLICK_LEAD;
    for (let i = 0; i < CLICKS; i++) {
      const s = ctx.createBufferSource();
      s.buffer = clickBuf;
      s.connect(opt.clickDest || ctx.destination);
      const at = cBase + i * CLICK_GAP;
      s.start(at);
      clickTimes.push(at);
    }
    const ready = new Promise((r) => setTimeout(r, (CLICK_LEAD + CLICKS * CLICK_GAP + 0.25) * 1000));
    const chunks = [], tpairs = [];
    let peak = 0, stopped = false, F0 = -1, lastEnd = 0;
    let resolveDone;
    const done = new Promise((r) => { resolveDone = r; });
    const t0 = performance.now();
    node.port.onmessage = (e) => {
      if (stopped) return;
      const now = performance.now();
      const { f0, d } = e.data;
      if (F0 < 0) F0 = f0;
      const idx = Math.round((f0 - F0) / k);
      chunks.push([idx, d]);
      lastEnd = Math.max(lastEnd, idx + d.length);
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
      const st = timeFn(now);
      if (st !== null && st !== undefined) tpairs.push([now, st]);
      const sec = (now - t0) / 1000;
      if (opt.onProgress) opt.onProgress(sec, peak);
      if (sec >= opt.maxSec || (opt.shouldStop && opt.shouldStop(sec))) finish();
    };
    function finish() {
      if (stopped) return;
      stopped = true;
      node.port.onmessage = null;
      try { src.disconnect(); node.disconnect(); mute.disconnect(); } catch (e) { /* ignore */ }
      resolveDone();
    }
    return {
      ready,
      stop: finish,
      done: done.then(() => {
        const total = lastEnd;
        if (total < sr * 8) throw new Error('너무 짧게 들었어요. 조금 더 길게 재생해 주세요');
        if (peak < 0.01) throw new Error('소리가 들리지 않았어요. 영상 소리가 켜져 있는지 (음악 볼륨) 확인해 주세요');
        if (tpairs.length < 20) throw new Error('영상 재생 시간을 읽지 못했어요');
        // 블록 위치 그대로 배치 (혹시 빠진 구간은 0으로 남음 → 시간은 어긋나지 않음)
        const buf = ctx.createBuffer(1, total, sr);
        const ch = buf.getChannelData(0);
        for (const [idx, d] of chunks) ch.set(d, idx);
        const base = F0 / csr; // 녹음 0번 샘플이 처리된 AudioContext 시각
        // 틱 위치 찾기 → 입력 경로 지연 D (틱이 예약된 시각보다 녹음에 얼마나 늦게 나타나는지)
        const Ds = [];
        for (const ct of clickTimes) {
          const a = Math.max(0, Math.floor((ct - base - 0.02) * sr)), b = Math.min(total, Math.ceil((ct - base + 0.45) * sr));
          let mx = 0;
          for (let i = a; i < b; i++) { const v = Math.abs(ch[i]); if (v > mx) mx = v; }
          if (mx < 0.03) continue;
          let n = -1;
          for (let i = a; i < b; i++) if (Math.abs(ch[i]) >= mx * 0.5) { n = i; break; }
          if (n >= 0) Ds.push(base + n / sr - ct);
        }
        Ds.sort((x, y) => x - y);
        const calibrated = Ds.length >= 2 && Ds[Ds.length - 1] - Ds[0] < 0.008;
        const D = calibrated ? Ds[Ds.length >> 1] : 0;
        const ts = ctx.getOutputTimestamp();
        const ctxToPerf = (ct) => ts.performanceTime + (ct - ts.contextTime) * 1000; // 그 소리가 실제로 나가는 시각
        // perf → 곡 시간 : 재생 중 기록을 직선으로 (기울기 1)
        const dd = tpairs.map(([p, st]) => st - p / 1000).sort((x, y) => x - y);
        const d0 = dd[dd.length >> 1];
        const toSong = (tBuf) => ctxToPerf(base + tBuf - D) / 1000 + d0;
        return { buffer: buf, toSong, calibrated, delayMs: Math.round(D * 1000) };
      }),
    };
  }

  /* onset(곡 시간) → BPM · 첫 박 */
  function estimate(onsets, bpmHint, lockBpm, analyzedBpm) {
    const strong = onsets.filter((o) => o.s >= 0.18 && o.t >= 0);
    if (strong.length < 24) throw new Error('박자를 찾을 만큼 소리가 충분하지 않았어요');
    const wOf = (o) => o.s * (o.band === 0 ? 1.35 : o.band === 1 ? 1.15 : 0.8);
    const SIG = 0.022;
    const score = (bpm, ph) => {
      const spb = 60 / bpm;
      let sc = 0;
      for (const o of strong) {
        const k = Math.round((o.t - ph) / spb), dd = o.t - (ph + k * spb);
        sc += wOf(o) * Math.exp(-0.5 * (dd / SIG) * (dd / SIG));
      }
      return sc;
    };
    const bestPhase = (bpm, step) => {
      const spb = 60 / bpm;
      let best = -1, bp = 0;
      for (let ph = 0; ph < spb; ph += step) { const v = score(bpm, ph); if (v > best) { best = v; bp = ph; } }
      return { ph: bp, sc: best };
    };

    // BPM 후보
    let cands = [];
    if (lockBpm && bpmHint > 0) cands = [bpmHint];
    else {
      const base = bpmHint > 0 ? bpmHint : analyzedBpm;
      if (!(base > 0)) throw new Error('BPM을 찾지 못했어요');
      for (const m of [1, 2, 0.5, 1.5, 2 / 3]) {
        const b = base * m;
        if (b >= 60 && b <= 220) for (let x = b * 0.95; x <= b * 1.05; x += 0.1) cands.push(+x.toFixed(2));
      }
    }
    let best = null;
    for (const b of cands) {
      const r = bestPhase(b, 0.004);
      // 느린 템포가 점수를 덜 받는 경향 보정 (박 개수 차이)
      const sc = r.sc * Math.pow(b / 120, 0.15);
      if (!best || sc > best.sc) best = { bpm: b, ph: r.ph, sc };
    }
    let bpm = best.bpm;
    if (!lockBpm && Math.abs(bpm - Math.round(bpm)) <= 0.25) bpm = Math.round(bpm); // 대부분의 곡은 정수 BPM
    const spb = 60 / bpm;
    let ph = bestPhase(bpm, 0.001).ph;

    // 박 위치마다 세기 기록 (저음 · 중음 따로) → 마디 첫 박 · 노래 시작 위치
    const lastT = strong[strong.length - 1].t;
    const nBeats = Math.floor((lastT - ph) / spb) + 1;
    const kick = new Float32Array(nBeats), snare = new Float32Array(nBeats), any = new Float32Array(nBeats);
    for (const o of strong) {
      const k = Math.round((o.t - ph) / spb);
      if (k < 0 || k >= nBeats) continue;
      if (Math.abs(o.t - (ph + k * spb)) > 0.04) continue;
      any[k] = Math.max(any[k], o.s);
      if (o.band === 0) kick[k] += o.s; else if (o.band === 1) snare[k] += o.s;
    }
    // 노래(박자)가 시작되는 첫 박 : 이후 8박 중 5박 이상에 박자에 맞는 소리가 있는 첫 지점
    // (조용한 인트로도 놓치지 않도록 약한 소리까지 본다. 말소리 같은 불규칙한 소리는 격자에 잘 안 맞아 걸러짐)
    const anyW = new Float32Array(nBeats);
    for (const o of onsets) {
      if (o.t < 0 || o.s < 0.08) continue;
      const k = Math.round((o.t - ph) / spb);
      if (k < 0 || k >= nBeats || Math.abs(o.t - (ph + k * spb)) > 0.035) continue;
      anyW[k] = Math.max(anyW[k], o.s);
    }
    let startK = -1;
    for (let k = 0; k + 8 <= nBeats; k++) {
      if (anyW[k] < 0.15) continue;
      let hit = 0;
      for (let j = k; j < k + 8; j++) if (anyW[j] >= 0.08) hit++;
      if (hit >= 5) { startK = k; break; }
    }
    if (startK < 0) throw new Error('노래가 시작되는 지점을 찾지 못했어요. 더 길게 들어봐 주세요');
    // 마디 첫 박 : 킥이 1·3박, 스네어가 2·4박에 오는 배치를 찾음
    let bestR = 0, bestRS = -Infinity;
    for (let r = 0; r < 4; r++) {
      let sc = 0;
      for (let k = startK; k < nBeats; k++) {
        const pos = ((k - r) % 4 + 4) % 4;
        if (pos === 0) sc += kick[k] * 1.3 - snare[k] * 0.6;
        else if (pos === 2) sc += kick[k] * 0.6 - snare[k] * 0.3;
        else sc += snare[k] * 0.9 - kick[k] * 0.3;
      }
      if (sc > bestRS) { bestRS = sc; bestR = r; }
    }
    let k0 = startK;
    while (((k0 - bestR) % 4 + 4) % 4 !== 0) k0++;
    // 시작 박이 마디 첫 박보다 1~3박 앞이면 (못갖춘마디) 그 앞 마디 첫 박을 쓰되 음수가 되지 않게
    if (k0 - startK >= 2 && k0 - 4 >= 0) k0 -= 4;
    const offset = ph + k0 * spb;

    // 신뢰도 : 강한 onset 중 박자 격자(8분음표) 위에 있는 비율
    const half = spb / 2;
    let on = 0, tot = 0;
    for (const o of strong) {
      if (o.t < offset - 0.05 || o.s < 0.35) continue;
      tot++;
      const k = Math.round((o.t - ph) / half);
      if (Math.abs(o.t - (ph + k * half)) <= 0.035) on++;
    }
    const conf = tot ? on / tot : 0;
    return { bpm, offset: Math.max(0, offset), conf, musicStart: ph + startK * spb };
  }

  return { requestTabAudio, capture, estimate };
})();
