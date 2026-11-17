'use strict';
/* =========================================================
 * YtEngine — 유튜브 공식 플레이어(IFrame API) 재생 + 게임용 시계
 *
 * 유튜브 플레이어가 알려주는 재생 시간(getCurrentTime)은 띄엄띄엄 갱신되므로
 * performance.now() 로 사이를 메우고, 새 값이 들어올 때마다 조금씩 보정한다.
 *
 * mode
 *   idle      : 아무것도 안 함
 *   lead      : 곡 시작 전 카운트다운 (영상은 정지 상태, 시간은 performance.now 로 진행)
 *   starting  : playVideo() 를 불렀고 실제 재생이 시작되길 기다리는 중 (시간 정지)
 *   playing   : 재생 중 (영상 시간 기준)
 *   paused    : 일시정지
 * ========================================================= */
const YtEngine = (() => {
  let player = null, apiP = null, playerP = null;
  let curId = null, lastErr = null;
  let mode = 'idle';
  let start = 0;                  // 곡 0초에 해당하는 영상 위치(초)
  let leadPerf = 0, leadDur = 0;  // lead 모드 기준점
  let holdT = 0, waitSince = 0, startRep = 0, pausedFrom = '';
  let base = 0, basePerf = 0, lastRep = -1;
  let volume = 0.8;

  const ERR = {
    2: '영상 주소가 올바르지 않아요',
    5: '이 브라우저에서 영상을 재생할 수 없어요',
    100: '영상을 찾을 수 없어요 (삭제되었거나 비공개)',
    101: '이 영상은 외부 재생이 막혀 있어요 (채널 설정). 다른 영상을 골라주세요',
    150: '이 영상은 외부 재생이 막혀 있어요 (채널 설정). 다른 영상을 골라주세요',
    153: '유튜브가 재생을 거부했어요. start.bat 로 실행했는지 확인해 주세요',
  };
  const errMsg = (c) => (ERR[c] ? T(ERR[c]) : T('영상 재생 오류 (코드 {c})', { c }));

  /* 유튜브 주소 → 영상 ID */
  function parseId(input) {
    const s = String(input || '').trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    let m = s.match(/(?:v=|\/embed\/|\/shorts\/|youtu\.be\/|\/live\/|\/v\/)([\w-]{11})/);
    return m ? m[1] : null;
  }

  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiP) return apiP;
    apiP = new Promise((res, rej) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(); };
      const sc = document.createElement('script');
      sc.src = 'https://www.youtube.com/iframe_api';
      sc.onerror = () => { apiP = null; rej(new Error(T('유튜브에 연결할 수 없어요. 인터넷 연결을 확인해 주세요'))); };
      document.head.appendChild(sc);
      setTimeout(() => rej(new Error(T('유튜브 플레이어를 불러오지 못했어요 (시간 초과)'))), 20000);
    });
    return apiP;
  }

  function ensurePlayer(id) {
    if (playerP) return playerP;
    playerP = loadApi().then(() => new Promise((res, rej) => {
      const host = document.getElementById('ytHost');
      host.innerHTML = '';
      const el = document.createElement('div');
      host.appendChild(el);
      const timer = setTimeout(() => rej(new Error(T('유튜브 플레이어를 준비하지 못했어요'))), 20000);
      player = new YT.Player(el, {
        width: '100%', height: '100%', videoId: id,
        playerVars: {
          autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1,
          iv_load_policy: 3, modestbranding: 1, origin: location.origin,
        },
        events: {
          onReady: () => { clearTimeout(timer); curId = id; res(player); },
          onError: (e) => { lastErr = e.data; },
        },
      });
    }));
    playerP.catch(() => { playerP = null; player = null; });
    return playerP;
  }

  const now = () => performance.now();
  const state = () => (player && player.getPlayerState ? player.getPlayerState() : -1);
  const cur = () => (player && player.getCurrentTime ? player.getCurrentTime() || 0 : 0);

  /* 영상을 실제로 재생 가능한 상태로 만든다 (광고 · 버퍼링 통과 후 시작 위치에 정지) */
  async function prepare(id, startSec, onStatus) {
    snipToken++; clearTimeout(snipStop); clearInterval(snipFade);
    mode = 'idle';
    start = startSec || 0;
    lastErr = null;
    const p = await ensurePlayer(id);
    p.mute();
    if (curId !== id) { curId = id; p.loadVideoById({ videoId: id, startSeconds: start }); }
    else { p.seekTo(start, true); p.playVideo(); }
    p.playVideo();
    const t0 = now();
    await new Promise((res, rej) => {
      const tick = () => {
        if (lastErr !== null) return rej(new Error(errMsg(lastErr)));
        const st = state(), ct = cur();
        if (st === 1 && ct > start + 0.12) return res();
        if (now() - t0 > 45000) return rej(new Error(T('영상을 불러오지 못했어요 (시간 초과)')));
        if (onStatus) onStatus(st === 3 ? T('영상 버퍼링 중...') : T('영상 준비 중... (광고가 나오면 끝날 때까지 기다려 주세요)'), Math.min(0.95, (now() - t0) / 8000));
        if (st === 5 || st === -1 || st === 2) p.playVideo();
        setTimeout(tick, 120);
      };
      tick();
    });
    p.pauseVideo();
    p.seekTo(start, true);
    const data = p.getVideoData ? p.getVideoData() : {};
    return { duration: p.getDuration() || 0, title: data.title || '', author: data.author || '' };
  }

  /* ---------------- 게임용 시계 ---------------- */
  function begin(leadSec) {
    mode = 'lead';
    leadPerf = now();
    leadDur = leadSec;
  }

  function goStart(t) {
    player.unMute();
    player.setVolume(Math.round(volume * 100));
    player.playVideo();
    mode = 'starting';
    holdT = t;
    waitSince = now();
    startRep = cur();
  }

  // 재생 중 추정 시간 (보정 포함). perf 시점의 곡 시간(초)
  function raw(perf) {
    if (mode === 'lead') {
      const t = (perf - leadPerf) / 1000 - leadDur;
      if (t < -0.04) return t;
      goStart(Math.min(t, 0));
      return holdT;
    }
    if (mode === 'starting') {
      const ct = cur();
      if (state() === 1 && Math.abs(ct - startRep) > 0.001) {
        mode = 'playing';
        base = ct - start; basePerf = perf; lastRep = ct;
        return base;
      }
      // 소리 재생이 막혀 멈춰 있으면 다시 시도
      if (perf - waitSince > 2500 && state() !== 1 && state() !== 3) { player.playVideo(); waitSince = perf; }
      return holdT;
    }
    if (mode === 'playing') {
      const ct = cur();
      let est = base + (perf - basePerf) / 1000;
      if (ct !== lastRep) {
        lastRep = ct;
        const err = (ct - start) - est;
        if (Math.abs(err) > 0.25) { base = ct - start; basePerf = perf; }
        else base += err * 0.12;
        est = base + (perf - basePerf) / 1000;
      }
      const st = state();
      if (st === 3 || st === 2) { // 버퍼링 · 외부 요인으로 멈춤 → 시간 정지 후 재개 대기
        mode = 'starting'; holdT = est; waitSince = perf; startRep = ct;
        if (st === 2) player.playVideo();
      }
      return est;
    }
    if (mode === 'paused') return holdT;
    return 0;
  }

  function songTime() { return raw(now()); }
  function songTimeAt(perfMs) {
    if (mode === 'lead') return (perfMs - leadPerf) / 1000 - leadDur;
    if (mode === 'playing') return base + (perfMs - basePerf) / 1000;
    return holdT;
  }

  function pause() {
    if (mode === 'idle' || mode === 'paused') return;
    holdT = raw(now());
    pausedFrom = mode === 'lead' ? 'lead' : 'play';
    mode = 'paused';
    if (player) player.pauseVideo();
  }
  function resume() {
    if (mode !== 'paused') return;
    if (pausedFrom === 'lead' && holdT < -0.04) {
      mode = 'lead';
      leadPerf = now() - (holdT + leadDur) * 1000;
    } else goStart(holdT);
  }
  function stop() {
    mode = 'idle';
    if (player && player.pauseVideo) { try { player.pauseVideo(); } catch (e) { /* ignore */ } }
  }
  const waiting = () => mode === 'starting' && now() - waitSince > 400;

  /* ---------------- 미리보기 (곡 추가 창) ---------------- */
  function previewPlay() {
    if (!player) return;
    start = 0;
    goStart(cur());
  }
  function previewPause() {
    if (!player) return;
    holdT = raw(now()); mode = 'paused'; pausedFrom = 'play';
    player.pauseVideo();
  }
  function previewSeek(sec) {
    if (!player) return;
    const t = Math.max(0, Math.min(sec, (player.getDuration() || 1e9) - 0.5));
    const wasPlaying = mode === 'playing' || mode === 'starting';
    player.seekTo(t, true);
    holdT = t;
    if (wasPlaying) { mode = 'starting'; waitSince = now(); startRep = cur(); }
    else { mode = 'paused'; }
  }
  const isPlaying = () => mode === 'playing' || mode === 'starting';

  /* ---------------- 곡 선택 미리듣기 (후렴 15초, 서서히 커졌다 작아짐) ---------------- */
  let snipToken = 0, snipFade = 0, snipStop = 0;
  function fadeTo(target, ms, then) {
    clearInterval(snipFade);
    if (!player || !player.getVolume) return;
    const from = player.getVolume(), t0 = performance.now();
    snipFade = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / ms);
      try { player.setVolume(Math.round(from + (target - from) * p)); } catch (e) { /* ignore */ }
      if (p >= 1) { clearInterval(snipFade); if (then) then(); }
    }, 40);
  }
  async function snippet(id, startSec, vol, lenSec) {
    const my = ++snipToken;
    clearTimeout(snipStop);
    let p;
    try { p = await ensurePlayer(id); } catch (e) { return; }
    if (my !== snipToken) return;
    mode = 'idle';
    lastErr = null;
    p.setVolume(0);
    p.unMute();
    if (curId !== id) { curId = id; p.loadVideoById({ videoId: id, startSeconds: startSec }); }
    else { p.seekTo(startSec, true); p.playVideo(); }
    fadeTo(Math.round(vol * 100), 900);
    snipStop = setTimeout(() => { if (my === snipToken) fadeTo(0, 1200, () => { if (my === snipToken && mode === 'idle') p.pauseVideo(); }); }, (lenSec || 15) * 1000);
  }
  function stopSnippet() {
    snipToken++;
    clearTimeout(snipStop);
    if (!player || !player.pauseVideo || mode !== 'idle') return;
    fadeTo(0, 250, () => { if (mode === 'idle') { try { player.pauseVideo(); } catch (e) { /* ignore */ } } });
  }

  function setVolume(v) { volume = v; if (player && player.setVolume && mode !== 'idle') player.setVolume(Math.round(v * 100)); }

  return {
    parseId, prepare, begin, songTime, songTimeAt, pause, resume, stop, waiting,
    previewPlay, previewPause, previewSeek, isPlaying, setVolume, snippet, stopSnippet,
    get mode() { return mode; },
  };
})();

/* 탭 템포 : 박자에 맞춰 누른 시각들 → BPM 과 첫 박 위치 (최소제곱 직선) */
function fitTaps(taps) {
  if (taps.length < 4) return null;
  const d = [];
  for (let i = 1; i < taps.length; i++) d.push(taps[i] - taps[i - 1]);
  const med = d.slice().sort((a, b) => a - b)[d.length >> 1];
  if (!(med > 0.2 && med < 1.6)) return null;
  const idx = taps.map((t) => Math.round((t - taps[0]) / med));
  const n = taps.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += idx[i]; sy += taps[i]; sxx += idx[i] * idx[i]; sxy += idx[i] * taps[i]; }
  const den = n * sxx - sx * sx;
  if (!den) return null;
  const b = (n * sxy - sx * sy) / den;
  const a = (sy - b * sx) / n;
  let bpm = 60 / b;
  // 소수점 둘째 자리 근처 정수 BPM 이면 정수로 맞춤
  if (Math.abs(bpm - Math.round(bpm)) < 0.15) bpm = Math.round(bpm);
  let rms = 0;
  for (let i = 0; i < n; i++) rms += Math.pow(taps[i] - (a + b * idx[i]), 2);
  rms = Math.sqrt(rms / n);
  return { bpm, offset: Math.max(0, a), rms };
}
