'use strict';
/* =========================================================
 * main — 메뉴 / 곡 관리 / 입력 / 결과 화면
 * ========================================================= */
(() => {
  const $ = (s) => document.querySelector(s);
  const DIFFS = ['EASY', 'NORMAL', 'HARD'];
  const DIFF_COL = { EASY: '#4cc85e', NORMAL: '#3fa2ff', HARD: '#ff5b9a' };
  const RANK_COL = { SS: '#ff6fb0', S: '#ffae2e', A: '#ff6fb0', B: '#9a76ff', C: '#3fa2ff', D: '#a39bbf' };

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const IS_MOBILE = (() => {
    try {
      return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
        || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 820);
    } catch (e) { return false; }
  })();
  if (IS_MOBILE) document.body.classList.add('mobile');
  const settings = Object.assign({ keyMode: IS_MOBILE ? '4k' : '7k', preview: true, speed: 5.5, offset: 0, music: 0.8, sfx: 0.6, auto: false, skin: DEFAULT_SKIN, hitSound: 'snare' }, store.get('rm_settings', {}));
  const bests = store.get('rm_best', {});
  const ytList = store.get('rm_yt', []);          // 유튜브 곡 목록 (영상 ID · BPM · 첫 박 ...)
  const customCharts = store.get('rm_charts', {}); // 녹화로 만든 채보 : "곡ID|난이도" → chart
  let lastStartOpts = {};
  const ytRemoved = store.get('rm_yt_removed', []); // 사용자가 지운 샘플 곡
  // 샘플 : Mrs. GREEN APPLE 공식 MV 20곡 (js/songdata.js 의 실측 BPM · 첫 박 · 소리 위치로 채보 설계)
  const SAMPLE_SONGS = (typeof SONG_DATA !== 'undefined' ? SONG_DATA : []).map((d) => ({ ...d, artist: 'Mrs. GREEN APPLE', designed: true }));
  // 예전에 탭으로 맞춰 저장해 둔 샘플 곡 설정은 실측 데이터로 대체
  for (let i = ytList.length - 1; i >= 0; i--) if (SAMPLE_SONGS.some((d) => d.videoId === ytList[i].videoId)) ytList.splice(i, 1);
  store.set('rm_yt', ytList);
  let modalOpen = false;
  const songs = [];
  let sel = 0;
  let diff = store.get('rm_diff', 'NORMAL');
  if (!DIFFS.includes(diff)) diff = 'NORMAL';
  let screen = 'menu';

  const game = new RhythmGame($('#game'), { onFinish: showResult });
  if (!KEY_MODES[settings.keyMode]) settings.keyMode = '7k';
  if (IS_MOBILE) settings.keyMode = '4k'; // 모바일(터치)은 4키 고정
  if (!settings.keys || typeof settings.keys !== 'object') settings.keys = {};
  game.setMode(settings.keyMode, settings.keys[settings.keyMode]);
  game.hideLabels = IS_MOBILE; // 모바일(터치)에서는 건반에 키 글자 숨김
  const LANE_OF = {};
  function rebuildLaneMap() {
    for (const k of Object.keys(LANE_OF)) delete LANE_OF[k];
    KEY_CODES.forEach((c, i) => { LANE_OF[c] = i; });
  }
  rebuildLaneMap();
  // 녹화 채보 · 최고 기록은 키 모드별로 따로
  const ckey = (id, d, mode) => `${id}|${d}${(mode || settings.keyMode) === '4k' ? '|4k' : ''}`;

  /* ---------------- 유틸 ---------------- */
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const fmtTime = (sec) => { sec = Math.max(0, Math.round(sec || 0)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const saveSettings = () => store.set('rm_settings', settings);
  let toastTimer = 0;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
  }
  function setLoading(text, p) {
    $('#loading').classList.add('show');
    if (text) $('#loadingText').textContent = text;
    $('#loadingBar').style.width = `${Math.round((p || 0) * 100)}%`;
  }
  const hideLoading = () => $('#loading').classList.remove('show');

  function setScreen(name) {
    screen = name;
    if (name !== 'menu') stopPreview();
    document.body.classList.toggle('in-game', name === 'game' || name === 'pause' || name === 'result');
    $('#menu').classList.toggle('active', name === 'menu');
    $('#pause').classList.toggle('show', name === 'pause');
    $('#result').classList.toggle('show', name === 'result');
  }

  /* ---------------- 곡 목록 / 상세 ---------------- */
  function renderSongList() {
    const ul = $('#songList');
    ul.innerHTML = songs.map((s, i) => `
      <li class="song-item ${i === sel ? 'sel' : ''}" data-i="${i}" style="--h:${s.hue}">
        <div class="thumb">${esc(s.title.slice(0, 1).toUpperCase())}</div>
        <div class="info"><b>${s.yt ? '<i class="yt-ico yt-tag"></i>' : ''}${esc(s.title)}</b><span>${esc(s.artist)}</span></div>
        <div class="meta">${s.loading ? '<i class="mini-spin"></i>' : s.needsSync ? `${s.bpm ? Math.round(s.bpm) + ' BPM' : ''}<br><span class="need">첫 박 설정</span>` : `${s.bpm ? Math.round(s.bpm) + ' BPM' : ''}<br>${fmtTime(s.duration)}`}</div>
      </li>`).join('');
    const cur = ul.querySelector('.sel');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
  }

  function updateDetail() {
    const s = songs[sel];
    if (!s) return;
    const jk = $('#jacket');
    jk.style.setProperty('--h', s.hue);
    jk.style.backgroundImage = s.yt ? `url("https://i.ytimg.com/vi/${s.yt.videoId}/mqdefault.jpg")` : '';
    jk.classList.toggle('thumb', !!s.yt);
    $('#jacketTxt').textContent = s.yt ? '' : s.title.slice(0, 1).toUpperCase();
    $('#songTag').textContent = s.demo ? 'DEMO' : s.yt ? 'YOUTUBE' : 'LOCAL FILE';
    $('#songTitle').textContent = s.title;
    $('#songMeta').textContent = [s.artist, s.bpm ? `${Math.round(s.bpm)} BPM` : '', s.duration ? fmtTime(s.duration) : ''].filter(Boolean).join('  ·  ');
    document.querySelectorAll('.diff').forEach((b) => {
      const d = b.dataset.d, c = s.charts && s.charts[d];
      b.classList.toggle('active', d === diff);
      b.querySelector('b').textContent = c ? `Lv.${c.level}` : '-';
      const mine = s.custom && s.custom[d] ? ' · <span class="mine">내 채보</span>' : '';
      b.querySelector('small').innerHTML = c ? `${c.count} notes · 롱노트 ${c.holds}${mine}` : (s.loading ? '생성 중...' : '-');
    });
    $('#recDiff').textContent = diff;
    const needSetup = s.needsSync && !(s.charts && s.charts[diff]);
    $('#startBtn').innerHTML = needSetup ? '첫 박 맞추기 <small>ENTER</small>' : 'GAME START <small>ENTER</small>';
    $('#songTag').textContent = s.designed ? 'MGA · 실측 채보' : s.sample ? 'SAMPLE · YOUTUBE' : $('#songTag').textContent;
    if (s.needsSync) $('#songMeta').textContent = [s.artist, s.bpm ? `${Math.round(s.bpm)} BPM` : '', '첫 박 위치를 한 번 맞추면 채보가 만들어져요'].filter(Boolean).join('  ·  ');
    $('#recBtn').disabled = !!s.loading || !s.charts;
    $('#editYtBtn').textContent = s.needsSync ? '첫 박 맞추기' : '곡 설정';
    $('#resetChartBtn').hidden = !(s.custom && s.custom[diff]);
    $('#editYtBtn').hidden = !s.yt || !!s.designed;
    $('#delSongBtn').hidden = !s.yt;
    const b = bests[ckey(s.id, diff)];
    $('#bestInfo').textContent = b ? `BEST  ${String(b.score).padStart(7, '0')}  ·  ${b.rank}  ·  ${b.acc.toFixed(2)}%${b.fc ? '  ·  FC' : ''}` : 'BEST  -';
    $('#startBtn').disabled = !!s.loading;
  }

  /* ---------------- 곡 선택 미리듣기 ---------------- */
  let previewTimer = 0, previewOn = null, userActed = false;
  const markActed = () => { userActed = true; };
  window.addEventListener('pointerdown', markActed, true);
  window.addEventListener('keydown', markActed, true);
  function highlightOf(s) {
    if (s.hl !== undefined) return s.hl;
    let t = (s.duration || 60) * 0.33;
    const D = s.designData;
    if (D) {
      // 가장 음량이 큰 8마디 (= 대개 후렴) 시작점
      const g16 = 60 / D.bpm / 4, win = 128;
      const lo = Math.max(0, Math.floor((D.start - D.e0) / g16)), hi = Math.min(D.e.length - win, Math.floor((D.end - D.e0) / g16) - win);
      let best = -1, bi = lo, sum = 0;
      for (let i = lo; i < lo + win && i < D.e.length; i++) sum += D.e.charCodeAt(i) - 48;
      for (let i = lo; i <= hi; i++) {
        if (i > lo) sum += (D.e.charCodeAt(i + win - 1) - 48) - (D.e.charCodeAt(i - 1) - 48);
        if ((i - lo) % 16 === 0 && sum > best) { best = sum; bi = i; }
      }
      t = Math.max(0, D.e0 + bi * g16 - 0.3);
    } else if (s.demo) t = 20 * 4 * 60 / 140;
    s.hl = t;
    return t;
  }
  function stopPreview() {
    clearTimeout(previewTimer);
    if (previewOn === 'yt') YtEngine.stopSnippet();
    else if (previewOn === 'buf') AudioEngine.stopPreview();
    previewOn = null;
    const jk = $('#jacket'); if (jk) jk.classList.remove('playing');
  }
  function schedulePreview() {
    stopPreview();
    if (settings.preview === false) return;
    previewTimer = setTimeout(startPreview, 450);
  }
  async function startPreview() {
    if (screen !== 'menu' || modalOpen || !userActed || settings.preview === false) return;
    const s = songs[sel];
    if (!s || s.loading || settings.music <= 0) return;
    await AudioEngine.resume();
    if (s !== songs[sel] || screen !== 'menu') return;
    if (s.yt) {
      if (location.protocol === 'file:') return;
      YtEngine.snippet(s.yt.videoId, highlightOf(s), settings.music * 0.9, 15);
      previewOn = 'yt';
    } else if (s.buffer) {
      AudioEngine.previewBuffer(s.buffer, highlightOf(s), settings.music * 0.9, 15);
      previewOn = 'buf';
    } else return;
    $('#jacket').classList.add('playing');
  }

  function selectSong(i) {
    if (!songs.length) return;
    sel = (i + songs.length) % songs.length;
    renderSongList();
    updateDetail();
    schedulePreview();
  }
  function setDiff(d) {
    diff = d;
    store.set('rm_diff', d);
    updateDetail();
  }

  /* ---------------- 설정 ---------------- */
  function bindSettings() {
    const bind = (id, key, fmt, parse) => {
      const el = $(id), val = $(id.replace('set', 'val'));
      el.value = settings[key];
      const show = () => { if (val) val.textContent = fmt(settings[key]); };
      show();
      el.addEventListener('input', () => {
        settings[key] = parse(el.value);
        show();
        saveSettings();
        if (key === 'music') { AudioEngine.setMusicVolume(settings.music); YtEngine.setVolume(settings.music); }
        if (key === 'sfx') { AudioEngine.setSfxVolume(settings.sfx); AudioEngine.resume().then(() => AudioEngine.playHit()); }
      });
    };
    bind('#setSpeed', 'speed', (v) => `x${v.toFixed(1)}`, parseFloat);
    bind('#setOffset', 'offset', (v) => `${v > 0 ? '+' : ''}${v}ms`, (v) => parseInt(v, 10));
    bind('#setMusic', 'music', (v) => `${Math.round(v * 100)}%`, parseFloat);
    bind('#setSfx', 'sfx', (v) => `${Math.round(v * 100)}%`, parseFloat);
    renderSkins();
    renderKeyguide();
    renderModeBtns();
    document.querySelectorAll('#keyMode [data-mode]').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      if (b.dataset.mode === settings.keyMode) return;
      applyMode(b.dataset.mode);
      saveSettings();
      toast(settings.keyMode === '4k' ? '4키 모드 : D F J K' : '7키 모드 : A S D 스페이스 L ; \'');
    }));
    const pvt = $('#setPreview');
    pvt.checked = settings.preview !== false;
    pvt.addEventListener('change', () => { settings.preview = pvt.checked; saveSettings(); if (!pvt.checked) stopPreview(); else schedulePreview(); });
    // 타격음 종류
    const hs = $('#setHitSound');
    hs.innerHTML = Object.entries(AudioEngine.SFX_KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    if (!AudioEngine.SFX_KINDS[settings.hitSound]) settings.hitSound = 'snare';
    hs.value = settings.hitSound;
    AudioEngine.setSfxKind(settings.hitSound);
    $('#customSfxRow').hidden = settings.hitSound !== 'custom';
    hs.addEventListener('change', () => {
      $('#customSfxRow').hidden = hs.value !== 'custom';
      settings.hitSound = hs.value;
      AudioEngine.setSfxKind(hs.value);
      saveSettings();
      AudioEngine.resume().then(() => { if (hs.value === 'tabla') { AudioEngine.playHit(null, 1); setTimeout(() => AudioEngine.playHit(null, 0), 280); } else AudioEngine.playHit(); });
    });
    const auto = $('#setAuto');
    auto.checked = !!settings.auto;
    auto.addEventListener('change', () => { settings.auto = auto.checked; saveSettings(); });
  }
  /* ---------------- 키 모드 ---------------- */
  const GUIDE = {
    '7k': [['A', 'ㅁ', 'sk'], ['S', 'ㄴ', 'pk'], ['D', 'ㅇ', 'lm'], ['SPACE', '', 'ap space'], ['L', 'ㅣ', 'lm'], [';', '', 'pk'], ["'", '', 'sk']],
    '4k': [['D', 'ㅇ', 'sk'], ['F', 'ㄹ', 'pk'], ['J', 'ㅓ', 'pk'], ['K', 'ㅏ', 'sk']],
  };
  let guideKeys = [];
  function renderKeyguide() {
    const box = document.querySelector('.keys');
    box.innerHTML = GUIDE[settings.keyMode].map(([, , c], i) => {
      const b = esc(KEY_LABELS[i] || ''), k = KEY_KR[i] || '';
      return c.includes('space')
        ? `<div class="kc ${c}"><svg><use href="#i-apple"/></svg><b>${b}</b></div>`
        : `<div class="kc ${c}"><b>${b}</b>${k ? `<i>${k}</i>` : ''}</div>`;
    }).join('');
    box.classList.toggle('k4', settings.keyMode === '4k');
    guideKeys = box.querySelectorAll('.kc');
  }
  function renderModeBtns() {
    document.querySelectorAll('#keyMode [data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === settings.keyMode));
  }
  function applyMode(m) {
    settings.keyMode = KEY_MODES[m] ? m : '7k';
    game.setMode(settings.keyMode, settings.keys[settings.keyMode]);
    rebuildLaneMap();
    renderKeyguide();
    renderModeBtns();
    for (const s of songs) applyCustom(s);
    if (songs.length) updateDetail();
  }

  /* ---------------- 내 효과음 파일 (IndexedDB, 이 기기에만 저장) ---------------- */
  const sfxDB = (() => {
    let dbp = null;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      const rq = indexedDB.open('rm_sfx', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('files');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    }));
    const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction('files', mode); const r = fn(t.objectStore('files')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); };
    return {
      get: (k) => tx('readonly', (st) => st.get(k)),
      put: (k, v) => tx('readwrite', (st) => st.put(v, k)),
      del: (k) => tx('readwrite', (st) => st.delete(k)),
    };
  })();
  async function loadCustomSfx() {
    for (const slot of ['A', 'B']) {
      try {
        const rec = await sfxDB.get(slot);
        $(`#csfx${slot}`).textContent = rec ? rec.name : '없음';
        if (rec) AudioEngine.setCustomSfx(slot, await AudioEngine.decode(rec.data.slice(0)));
        else AudioEngine.setCustomSfx(slot, null);
      } catch (e) { console.warn(e); }
    }
  }
  let csfxSlot = 'A';
  document.querySelectorAll('#customSfxRow [data-slot]').forEach((b) => b.addEventListener('click', () => { csfxSlot = b.dataset.slot; $('#csfxInput').click(); }));
  $('#csfxInput').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast('효과음 파일은 5MB 이하로 골라 주세요'); return; }
    try {
      const data = await f.arrayBuffer();
      const buf = await AudioEngine.decode(data.slice(0));
      if (buf.duration > 3) toast('3초보다 긴 소리예요. 짧은 효과음이 더 잘 맞아요');
      await sfxDB.put(csfxSlot, { name: f.name, data });
      AudioEngine.setCustomSfx(csfxSlot, buf);
      $(`#csfx${csfxSlot}`).textContent = f.name;
      await AudioEngine.resume();
      AudioEngine.playHit('custom', csfxSlot === 'A' ? 1 : 0);
      toast(`${csfxSlot === 'A' ? '기본' : '바깥쪽'} 효과음을 바꿨어요`);
    } catch (err) {
      console.error(err);
      toast('이 파일은 소리로 읽을 수 없어요');
    }
  });
  $('#csfxClear').addEventListener('click', async () => {
    await sfxDB.del('A'); await sfxDB.del('B');
    await loadCustomSfx();
    toast('내 효과음을 지웠어요');
  });
  loadCustomSfx();

  /* ---------------- 저작권 및 이용 안내 ---------------- */
  let noticeOpen = false;
  const openNotice = () => { noticeOpen = true; $('#noticeModal').classList.add('show'); };
  const closeNotice = () => { noticeOpen = false; $('#noticeModal').classList.remove('show'); };
  document.querySelectorAll('[data-notice]').forEach((b) => b.addEventListener('click', openNotice));
  $('#noticeClose').addEventListener('click', closeNotice);
  $('#noticeModal').addEventListener('click', (e) => { if (e.target.id === 'noticeModal') closeNotice(); });

  /* ---------------- 키 설정 (PC) ---------------- */
  let keyBindOpen = false, bindLane = -1;
  function renderKeyBind() {
    const box = $('#keyBindLanes');
    const cls = GUIDE[settings.keyMode];
    box.className = `kb-lanes ${settings.keyMode === '4k' ? 'k4' : ''}`;
    box.innerHTML = KEY_CODES.map((code, i) => `<button type="button" class="kb-lane kc ${cls[i][2]} ${i === bindLane ? 'wait' : ''}" data-lane="${i}">
        <small>${i === SPACE_LANE ? '가운데' : `${i + 1}번`}</small><b>${i === bindLane ? '?' : esc(KEY_LABELS[i])}</b>${KEY_KR[i] && i !== bindLane ? `<i>${KEY_KR[i]}</i>` : ''}</button>`).join('');
    box.querySelectorAll('.kb-lane').forEach((b) => b.addEventListener('click', () => { bindLane = +b.dataset.lane; renderKeyBind(); $('#keyBindMsg').textContent = `${+b.dataset.lane + 1}번 레인에 쓸 키를 누르세요 (Esc 취소)`; }));
    $('#keyBindTitle').textContent = `키 설정 · ${settings.keyMode === '4k' ? '4키' : '7키'}`;
  }
  function openKeyBind() {
    keyBindOpen = true; bindLane = -1;
    $('#keyBindMsg').textContent = '바꾸고 싶은 레인을 누른 다음, 원하는 키를 누르세요';
    renderKeyBind();
    $('#keyModal').classList.add('show');
  }
  function closeKeyBind() {
    keyBindOpen = false; bindLane = -1;
    $('#keyModal').classList.remove('show');
  }
  function setLaneKey(lane, code) {
    const codes = KEY_CODES.slice();
    const other = codes.indexOf(code);
    if (other >= 0 && other !== lane) codes[other] = codes[lane]; // 이미 쓰는 키면 서로 바꾸기
    codes[lane] = code;
    settings.keys[settings.keyMode] = codes;
    saveSettings();
    applyMode(settings.keyMode);
  }
  function keyBindKey(e) {
    e.preventDefault();
    if (bindLane < 0) { if (e.code === 'Escape') closeKeyBind(); return; }
    if (e.code === 'Escape') { bindLane = -1; $('#keyBindMsg').textContent = '취소했어요'; renderKeyBind(); return; }
    if (['Enter', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu', ''].includes(e.code) || /^F\d+$/.test(e.code)) {
      $('#keyBindMsg').textContent = '그 키는 쓸 수 없어요. 다른 키를 눌러 주세요'; return;
    }
    const lane = bindLane;
    bindLane = -1;
    setLaneKey(lane, e.code);
    $('#keyBindMsg').textContent = `${lane + 1}번 레인 → ${KEY_LABELS[lane]}`;
    renderKeyBind();
  }
  $('#keyBindBtn').addEventListener('click', openKeyBind);
  $('#keyBindClose').addEventListener('click', closeKeyBind);
  $('#keyBindReset').addEventListener('click', () => {
    delete settings.keys[settings.keyMode];
    saveSettings(); applyMode(settings.keyMode);
    bindLane = -1; renderKeyBind();
    $('#keyBindMsg').textContent = '기본 키로 되돌렸어요';
  });
  $('#keyModal').addEventListener('click', (e) => { if (e.target.id === 'keyModal') closeKeyBind(); });

  /* ---------------- 스킨 ---------------- */
  function applySkin(id) {
    if (!SKINS[id]) id = DEFAULT_SKIN;
    settings.skin = id;
    document.body.dataset.skin = id;
    document.body.classList.toggle('dk', !!SKINS[id].dark);
    game.setSkin(id);
  }
  function renderSkins() {
    const box = $('#skinPicker');
    const btn = (id) => {
      const sk = SKINS[id];
      return `<button type="button" class="skin-opt ${id === settings.skin ? 'on' : ''}" data-skin="${id}" title="${esc(sk.desc)}">
        <span class="sw">${sk.swatch.map((c) => `<i style="background:${c}"></i>`).join('')}</span>
        <b>${esc(sk.name)}</b></button>`;
    };
    const basic = SKIN_IDS.filter((id) => SKINS[id].group !== 'album');
    const album = SKIN_IDS.filter((id) => SKINS[id].group === 'album');
    box.innerHTML = basic.map(btn).join('')
      + `<div class="skin-sep">앨범 오마쥬 <small>${esc(SKINS[settings.skin].group === 'album' ? SKINS[settings.skin].desc : '앨범 커버의 색감과 분위기를 빌려온 스킨')}</small></div>`
      + album.map(btn).join('');
    box.querySelectorAll('.skin-opt').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      applySkin(b.dataset.skin);
      saveSettings();
      renderSkins();
      toast(`스킨 : ${SKINS[settings.skin].name}`);
    }));
  }
  applySkin(settings.skin);

  function syncSettingsUI() {
    $('#setSpeed').value = settings.speed; $('#valSpeed').textContent = `x${settings.speed.toFixed(1)}`;
    $('#setOffset').value = settings.offset; $('#valOffset').textContent = `${settings.offset > 0 ? '+' : ''}${settings.offset}ms`;
  }

  /* ---------------- 녹화 채보 ---------------- */
  // 자동 채보 위에 녹화한 채보(있으면)를 덮어씌운다
  function autoFor(song) {
    if (settings.keyMode !== '4k') return song.auto7;
    if (!song.auto4) song.auto4 = song.designData ? ChartGen.designAll(song.designData, song.seed, 4) : ChartGen.allTo4k(song.auto7);
    return song.auto4;
  }
  function applyCustom(song) {
    if (!song.charts && !song.auto7) return;
    if (!song.auto7) song.auto7 = song.charts;
    song.autoCharts = autoFor(song);
    song.charts = { ...song.autoCharts };
    song.custom = {};
    for (const d of DIFFS) {
      const c = customCharts[ckey(song.id, d)];
      if (c) { song.charts[d] = c; song.custom[d] = true; }
    }
  }
  function saveRecording(r) {
    const song = r.song, d = r.diff;
    const grid = song.grid;
    const q = grid ? 60 / grid.bpm / 4 : 0; // 16분음표 격자로 정리
    const snap = (t) => (q ? grid.offset + Math.round((t - grid.offset) / q) * q : t);
    const seen = new Set();
    const notes = [];
    for (const n of r.notes) {
      const t = Math.max(0, snap(n.t));
      const key = `${n.lane}|${Math.round(t * 1000)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const o = { t: +t.toFixed(4), lane: n.lane };
      if (n.end) {
        const e = snap(n.end);
        if (e - t >= Math.max(0.25, q * 2)) o.end = +e.toFixed(4);
      }
      notes.push(o);
    }
    // 같은 레인에서 롱노트와 겹치는 노트 제거
    notes.sort((a, b) => a.t - b.t);
    const busy = new Array(7).fill(-1);
    const clean = notes.filter((n) => { if (n.t <= busy[n.lane]) return false; busy[n.lane] = n.end ? n.end + 0.05 : n.t + 0.03; return true; });
    if (clean.length < 5) { toast('노트가 너무 적어서 저장하지 않았어요'); return; }
    const dur = song.buffer ? song.buffer.duration : song.duration;
    customCharts[ckey(song.id, d)] = ChartGen.finalize(clean, dur, d);
    store.set('rm_charts', customCharts);
    applyCustom(song);
    toast(`${d} 채보를 녹화한 내용으로 저장했어요 (노트 ${clean.length}개)`);
  }

  /* ---------------- 유튜브 곡 ---------------- */
  function makeYtSong(d, sample) {
    const id = `yt:${d.videoId}`;
    const seed = hashStr(id);
    if (d.designed) {
      // 실측 데이터로 설계한 채보
      const song = {
        id, yt: { videoId: d.videoId }, title: d.title, artist: d.artist, hue: seed % 360, bpm: d.bpm,
        grid: d.grid ? { bpm: d.bpm, offset: d.offset } : null, duration: d.dur, sample: true, designed: true, needsSync: false,
        designData: d, seed,
      };
      song.charts = ChartGen.designAll(d, seed);
      applyCustom(song);
      return song;
    }
    const synced = typeof d.offset === 'number' && d.duration > 0 && d.bpm > 0;
    const song = {
      id, yt: { videoId: d.videoId }, title: d.title || '제목 없음', artist: d.artist || 'YouTube',
      hue: seed % 360, bpm: d.bpm, grid: synced ? { bpm: d.bpm, offset: d.offset } : null, duration: d.duration || 0,
      sample: !!sample, needsSync: !synced,
    };
    song.charts = synced ? ChartGen.buildAll(ChartGen.fromGrid(d.bpm, d.offset, d.duration, seed), d.duration, seed) : {};
    applyCustom(song);
    return song;
  }
  function loadYtSongs() {
    for (const d of SAMPLE_SONGS) {
      if (ytRemoved.includes(d.videoId)) continue;
      try { songs.push(makeYtSong(d, true)); } catch (e) { console.error(e); }
    }
    for (const d of ytList) { try { songs.push(makeYtSong(d)); } catch (e) { console.error(e); } }
  }

  /* ---------------- 곡 추가 ---------------- */
  async function loadDemo() {
    const s = { id: 'demo:neon-pulse', demo: true, title: 'Neon Pulse', artist: 'RHYTHM MASTA · 내장 데모', hue: 265, bpm: DemoSong.BPM, loading: true };
    songs.push(s);
    selectSong(0);
    try {
      const d = await DemoSong.render();
      s.buffer = d.buffer;
      s.duration = d.buffer.duration;
      s.grid = { bpm: d.bpm, offset: 0 };
      s.charts = ChartGen.buildAll(ChartGen.fromDemo(d.events), s.duration, 7);
      applyCustom(s);
      s.loading = false;
    } catch (e) {
      console.error(e);
      s.loading = false;
      s.artist = '데모 생성 실패';
    }
    renderSongList();
    updateDetail();
  }

  const AUDIO_RE = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|webm)$/i;
  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => /^audio\//.test(f.type) || AUDIO_RE.test(f.name));
    if (!files.length) { toast('음악 파일만 추가할 수 있어요'); return; }
    for (const f of files) {
      const id = `file:${f.name}:${f.size}`;
      const exist = songs.findIndex((s) => s.id === id);
      if (exist >= 0) { selectSong(exist); continue; }
      try {
        setLoading(`"${f.name}" 불러오는 중...`, 0.02);
        const ab = await f.arrayBuffer();
        const buffer = await AudioEngine.decode(ab);
        setLoading(`"${f.name}" 비트 분석 중...`, 0.1);
        const an = await ChartGen.analyze(buffer, (p) => setLoading(null, 0.1 + p * 0.85));
        let name = f.name.replace(/\.[^.]+$/, '');
        let artist = '로컬 파일';
        const m = name.match(/^(.+?)\s+-\s+(.+)$/);
        if (m) { artist = m[1]; name = m[2]; }
        const seed = hashStr(id);
        const song = {
          id, title: name, artist, hue: seed % 360, buffer, duration: buffer.duration,
          bpm: an.bpm, grid: null, charts: ChartGen.buildAll(an.onsets, buffer.duration, seed),
        };
        applyCustom(song);
        songs.push(song);
        sel = songs.length - 1;
        toast(`"${name}" 추가 완료!`);
      } catch (e) {
        console.error(e);
        toast(`"${f.name}"을(를) 읽을 수 없어요`);
      }
    }
    hideLoading();
    renderSongList();
    updateDetail();
  }

  /* ---------------- 게임 흐름 ---------------- */
  let starting = false;
  async function startGame(opts) {
    opts = opts && opts.record ? { record: true } : {};
    const s = songs[sel];
    if (!s || s.loading || !s.charts || starting) return;
    if (!opts.record && !s.charts[diff]) {
      if (s.yt) openYtModal(s); else toast('이 난이도는 채보가 없어요');
      return;
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    lastStartOpts = opts;
    stopPreview();
    await AudioEngine.resume();
    AudioEngine.setMusicVolume(settings.music);
    AudioEngine.setSfxVolume(settings.sfx);
    if (s.yt) {
      if (location.protocol === 'file:') { toast('유튜브 곡은 start.bat 으로 실행해야 재생돼요'); return; }
      starting = true;
      try {
        setLoading('영상 준비 중...', 0.05);
        const info = await YtEngine.prepare(s.yt.videoId, 0, (m, pr) => setLoading(m, pr));
        if (info.duration && Math.abs(info.duration - s.duration) > 1) s.duration = info.duration;
        YtEngine.setVolume(settings.music);
      } catch (e) {
        console.error(e);
        toast(e.message || '영상을 불러오지 못했어요');
        starting = false;
        hideLoading();
        return;
      }
      starting = false;
      hideLoading();
    }
    document.body.classList.toggle('yt-bg', !!s.yt);
    try {
      await Promise.race([
        Promise.all(['700 40px Fredoka', '600 20px Fredoka', '400 20px Jua', '500 20px "Noto Sans KR"'].map((f) => document.fonts.load(f))),
        new Promise((r) => setTimeout(r, 1200)),
      ]);
    } catch (e) { /* 폰트 없이 진행 */ }
    setScreen('game');
    game.resize();
    game.start(s, diff, settings, opts);
    if (opts.record) toast(`● ${diff} 채보 녹화 시작! 박자에 맞춰 쳐 보세요`);
  }
  function pauseGame() {
    if (screen !== 'game' || game.state !== 'playing') return;
    game.pause();
    $('#pause [data-act=recsave]').hidden = !game.rec;
    setScreen('pause');
  }
  function saveRecNow() {
    if (screen !== 'pause' || !game.rec) return;
    setScreen('game');
    game.finishRecording();
  }
  function resumeGame() {
    if (screen !== 'pause') return;
    setScreen('game');
    game.resume();
  }
  function retry() {
    game.quit();
    startGame(lastStartOpts);
  }
  function toMenu() {
    game.quit();
    document.body.classList.remove('yt-bg');
    setScreen('menu');
    renderSongList();
    updateDetail();
  }

  function showResult(r) {
    if (screen !== 'game') return;
    if (r.record) { saveRecording(r); toMenu(); return; }
    $('#resDiff').textContent = `${r.diff}  ·  LV.${r.song.charts[r.diff].level}`;
    $('#resDiff').style.color = DIFF_COL[r.diff];
    $('#resTitle').textContent = r.song.title;
    const rk = $('#resRank');
    rk.textContent = r.rank;
    rk.style.setProperty('--rc', RANK_COL[r.rank]);
    rk.style.animation = 'none'; void rk.offsetWidth; rk.style.animation = '';
    rk.classList.toggle('rb', r.rank === 'SS');
    const conf = $('#resConfetti');
    const cols = ['#ff86c2', '#ff8f7a', '#ffd23f', '#6fd34f', '#6cc4ff', '#b896ff'];
    conf.innerHTML = Array.from({ length: r.rank === 'D' ? 0 : 46 }, () => {
      const a = Math.random() * Math.PI * 2, d = 160 + Math.random() * 260;
      return `<i style="--c:${cols[(Math.random() * cols.length) | 0]};--tx:${Math.round(Math.cos(a) * d)}px;--ty:${Math.round(Math.sin(a) * d - 60)}px;--r:${Math.round(Math.random() * 720 - 360)}deg;--dl:${(Math.random() * 0.25).toFixed(2)}s;${Math.random() < 0.4 ? 'border-radius:50%;width:11px;height:11px;' : ''}"></i>`;
    }).join('');
    $('#resAcc').textContent = `${r.acc.toFixed(2)}%`;
    $('#resCombo').textContent = `${r.maxCombo} / ${r.total}`;

    const key = ckey(r.song.id, r.diff);
    const prev = bests[key];
    const newRecord = !r.auto && (!prev || r.score > prev.score);
    if (newRecord) {
      bests[key] = { score: r.score, rank: r.rank, acc: r.acc, fc: r.fc };
      store.set('rm_best', bests);
    }
    const badges = [];
    if (r.auto) badges.push('<span class="badge auto">AUTO</span>');
    if (r.ap) badges.push('<span class="badge ap">ALL PERFECT</span>');
    else if (r.fc) badges.push('<span class="badge fc">FULL COMBO</span>');
    if (newRecord) badges.push('<span class="badge nr">NEW RECORD</span>');
    $('#resBadges').innerHTML = badges.join('');

    $('#resJudges').innerHTML = ['PERFECT', 'GREAT', 'GOOD', 'MISS'].map((k) => `
      <div class="jrow"><span style="color:${JUDGES[k].color}">${k}</span>
      <div class="bar"><i style="background:${JUDGES[k].color}" data-w="${r.total ? (r.counts[k] / r.total) * 100 : 0}"></i></div>
      <b>${r.counts[k]}</b></div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('#resJudges .bar i').forEach((i) => { i.style.width = `${i.dataset.w}%`; });
    }));
    const avg = Math.round(r.avgErr);
    $('#resFs').textContent = `FAST ${r.fast}  ·  SLOW ${r.slow}  ·  평균 판정 오차 ${avg > 0 ? '+' : ''}${avg}ms`;

    const off = $('#resOffset');
    off.innerHTML = '';
    if (!r.auto && Math.abs(avg) >= 12 && r.counts.PERFECT + r.counts.GREAT + r.counts.GOOD >= 20) {
      const rec = Math.max(-200, Math.min(200, Math.round((settings.offset + avg) / 5) * 5));
      off.innerHTML = `입력이 평균 ${Math.abs(avg)}ms ${avg > 0 ? '늦어요' : '빨라요'} → 추천 오프셋 <b>${rec > 0 ? '+' : ''}${rec}ms</b>
        <button class="btn" id="applyOffset">적용</button>`;
      $('#applyOffset').onclick = () => {
        settings.offset = rec; saveSettings(); syncSettingsUI();
        off.textContent = `오프셋을 ${rec > 0 ? '+' : ''}${rec}ms 로 적용했어요`;
      };
    }

    // 스코어 카운트업
    const el = $('#resScore');
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 900);
      el.textContent = String(Math.round(r.score * (1 - Math.pow(1 - p, 3)))).padStart(7, '0');
      if (p < 1 && screen === 'result') requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setScreen('result');
  }

  /* ---------------- 입력 ---------------- */
  const evTime = (e) => (Math.abs(e.timeStamp - performance.now()) < 1000 ? e.timeStamp : performance.now());

  window.addEventListener('keydown', (e) => {
    if (noticeOpen) { if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); closeNotice(); } return; }
    if (keyBindOpen) { keyBindKey(e); return; }
    if (modalOpen) { ytModalKey(e); return; }
    const lane = LANE_OF[e.code];
    if (screen === 'game') {
      if (lane !== undefined) {
        e.preventDefault();
        if (!e.repeat) game.press(lane, evTime(e));
        return;
      }
      if (e.code === 'Escape') { e.preventDefault(); pauseGame(); return; }
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        settings.speed = Math.max(1, Math.min(12, settings.speed + (e.code === 'ArrowUp' ? 0.5 : -0.5)));
        saveSettings(); syncSettingsUI();
        toast(`스크롤 속도 x${settings.speed.toFixed(1)}`);
      }
      return;
    }
    if (screen === 'pause') {
      if (lane !== undefined) e.preventDefault();
      if (e.code === 'Escape' || e.code === 'Enter') { e.preventDefault(); resumeGame(); }
      else if (e.code === 'KeyR') retry();
      else if (e.code === 'KeyQ') toMenu();
      else if (e.code === 'KeyS') saveRecNow();
      return;
    }
    if (screen === 'result') {
      if (lane !== undefined) e.preventDefault();
      if (e.code === 'KeyR' || e.code === 'Enter') { e.preventDefault(); retry(); }
      else if (e.code === 'Escape') toMenu();
      return;
    }
    if (screen === 'menu') {
      if (lane !== undefined && guideKeys[lane]) guideKeys[lane].classList.add('lit');
      if (e.code === 'Space') e.preventDefault();
      const onInput = document.activeElement && document.activeElement.tagName === 'INPUT';
      if (onInput && (e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown')) return;
      if (e.code === 'ArrowUp') { e.preventDefault(); selectSong(sel - 1); }
      else if (e.code === 'ArrowDown') { e.preventDefault(); selectSong(sel + 1); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); setDiff(DIFFS[Math.max(0, DIFFS.indexOf(diff) - 1)]); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); setDiff(DIFFS[Math.min(2, DIFFS.indexOf(diff) + 1)]); }
      else if (e.code === 'Enter') { e.preventDefault(); startGame(); }
    }
  });
  // 터치 / 마우스로 레인 누르기 (모바일)
  const pointerLane = new Map();
  const cv = $('#game');
  cv.addEventListener('pointerdown', (e) => {
    if (screen !== 'game') return;
    e.preventDefault();
    const lane = game.laneAt(e.clientX);
    if (lane < 0) return;
    pointerLane.set(e.pointerId, lane);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    game.press(lane, evTime(e));
  });
  const pointerUp = (e) => {
    const lane = pointerLane.get(e.pointerId);
    if (lane === undefined) return;
    pointerLane.delete(e.pointerId);
    if (![...pointerLane.values()].includes(lane)) game.release(lane, evTime(e));
  };
  cv.addEventListener('pointerup', pointerUp);
  cv.addEventListener('pointercancel', pointerUp);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  $('#pauseBtn').addEventListener('click', (e) => { e.preventDefault(); pauseGame(); });

  window.addEventListener('keyup', (e) => {
    if (modalOpen || keyBindOpen) return;
    const lane = LANE_OF[e.code];
    if (lane === undefined) return;
    e.preventDefault();
    if (guideKeys[lane]) guideKeys[lane].classList.remove('lit');
    game.release(lane, evTime(e));
  });
  window.addEventListener('blur', () => {
    for (let l = 0; l < 7; l++) game.release(l, performance.now());
    guideKeys.forEach((k) => k.classList.remove('lit'));
    pauseGame();
  });

  /* ---------------- UI 바인딩 ---------------- */
  $('#songList').addEventListener('click', (e) => {
    const li = e.target.closest('.song-item');
    if (li) { const i = +li.dataset.i; if (i === sel && !previewOn) { userActed = true; schedulePreview(); } else selectSong(i); }
  });
  $('#songList').addEventListener('dblclick', (e) => { if (e.target.closest('.song-item')) startGame(); });
  document.querySelectorAll('.diff').forEach((b) => b.addEventListener('click', () => setDiff(b.dataset.d)));
  $('#startBtn').addEventListener('click', startGame);
  $('#addSongBtn').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'resume') resumeGame();
    else if (a === 'retry') retry();
    else if (a === 'menu') toMenu();
    else if (a === 'recsave') saveRecNow();
  }));
  $('#recBtn').addEventListener('click', () => startGame({ record: true }));
  $('#resetChartBtn').addEventListener('click', () => {
    const s = songs[sel];
    if (!s || !confirm(`${diff} 녹화 채보를 지우고 자동 채보로 되돌릴까요?`)) return;
    delete customCharts[ckey(s.id, diff)];
    store.set('rm_charts', customCharts);
    applyCustom(s);
    updateDetail();
    toast('자동 채보로 되돌렸어요');
  });
  $('#addYtBtn').addEventListener('click', () => openYtModal(null));
  $('#editYtBtn').addEventListener('click', () => { const s = songs[sel]; if (s && s.yt) openYtModal(s); });
  $('#delSongBtn').addEventListener('click', () => {
    const s = songs[sel];
    if (!s || !s.yt || !confirm(`"${s.title}" 을(를) 목록에서 삭제할까요?\n녹화한 채보와 기록도 함께 지워져요.`)) return;
    const i = ytList.findIndex((d) => `yt:${d.videoId}` === s.id);
    if (i >= 0) ytList.splice(i, 1);
    store.set('rm_yt', ytList);
    const vid = s.yt.videoId;
    if (SAMPLE_SONGS.some((d) => d.videoId === vid) && !ytRemoved.includes(vid)) { ytRemoved.push(vid); store.set('rm_yt_removed', ytRemoved); }
    for (const d of DIFFS) for (const m of ['7k', '4k']) { delete customCharts[ckey(s.id, d, m)]; delete bests[ckey(s.id, d, m)]; }
    store.set('rm_charts', customCharts);
    store.set('rm_best', bests);
    songs.splice(sel, 1);
    sel = Math.max(0, Math.min(sel, songs.length - 1));
    renderSongList();
    updateDetail();
    toast('삭제했어요');
  });

  // 드래그 앤 드롭
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => { e.preventDefault(); if (screen === 'menu') { dragDepth++; $('#dropZone').classList.add('show'); } });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropZone').classList.remove('show'); });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    $('#dropZone').classList.remove('show');
    if (screen === 'menu' && e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  /* ---------------- 유튜브 곡 추가 / 설정 창 ---------------- */
  const ym = {
    vid: null, duration: 0, taps: [], lastTapPerf: 0, metro: false, lastBeat: null, raf: 0, edit: null,
  };
  const ymMsg = (t, err) => { const el = $('#ytMsg'); el.textContent = t || ''; el.classList.toggle('err', !!err); };
  function cleanTitle(title, author) {
    let t = title || '';
    const m = t.match(/[「『](.+?)[」』]/);
    if (m) return m[1].trim();
    if (author) t = t.split(author).join(' ');
    t = t.replace(/[(\[【][^)\]】]*(official|mv|m\/v|music video|lyric|audio|video)[^)\]】]*[)\]】]/ig, ' ')
      .replace(/\b(official\s*(music\s*)?video|music video|official audio|lyric video|m\/v|mv)\b/ig, ' ')
      .replace(/^[\s\-–—|:]+|[\s\-–—|:]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    return t || title;
  }
  function openYtModal(editSong) {
    stopPreview();
    ym.edit = editSong;
    ym.vid = null; ym.taps = []; ym.metro = false;
    $('#ytModalTitle').textContent = editSong ? (editSong.needsSync ? `첫 박 맞추기 · ${editSong.title}` : '유튜브 곡 설정') : '유튜브 곡 추가';
    $('#ytUrl').value = editSong ? `https://www.youtube.com/watch?v=${editSong.yt.videoId}` : '';
    $('#ytTitle').value = editSong ? editSong.title : '';
    $('#ytArtist').value = editSong ? editSong.artist : '';
    $('#ytBpm').value = editSong ? (editSong.grid ? editSong.grid.bpm : editSong.bpm || '') : '';
    $('#ytOffset').value = editSong && editSong.grid ? editSong.grid.offset : '';
    $('#ytBpmLock').checked = !!(editSong && (editSong.grid || editSong.bpm));
    $('#ytBody').hidden = true;
    $('#ytSaveBtn').disabled = true;
    $('#ytSaveBtn').textContent = editSong && !editSong.needsSync ? '저장하고 채보 다시 만들기' : '저장하고 채보 만들기';
    $('#ytTapRes').textContent = '탭 0회';
    $('#ytMetro').innerHTML = '메트로놈 <b>OFF</b>';
    ymMsg(location.protocol === 'file:' ? '지금은 파일로 직접 열려 있어서 유튜브가 재생되지 않아요. 폴더의 start.bat 으로 실행해 주세요.' : '', location.protocol === 'file:');
    $('#ytModal').classList.add('show');
    modalOpen = true;
    AudioEngine.resume();
    if (editSong) ytLoad();
    else setTimeout(() => $('#ytUrl').focus(), 50);
  }
  function closeYtModal() {
    modalOpen = false;
    YtEngine.stop();
    cancelAnimationFrame(ym.raf); ym.raf = 0;
    document.body.classList.remove('yt-preview');
    $('#ytWrap').removeAttribute('style');
    $('#ytModal').classList.remove('show');
  }
  function placePreview() {
    const r = $('#ytPreview').getBoundingClientRect();
    Object.assign($('#ytWrap').style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, right: 'auto', bottom: 'auto' });
  }
  async function ytLoad() {
    const id = YtEngine.parseId($('#ytUrl').value);
    if (!id) { ymMsg('유튜브 영상 주소를 확인해 주세요 (예: https://www.youtube.com/watch?v=...)', true); return; }
    if (location.protocol === 'file:') { ymMsg('유튜브는 start.bat 으로 실행했을 때만 재생돼요.', true); return; }
    $('#ytLoadBtn').disabled = true;
    ymMsg('영상 불러오는 중...');
    try {
      const info = await YtEngine.prepare(id, 0, (m) => ymMsg(m));
      if (!modalOpen) return;
      ym.vid = id;
      ym.duration = info.duration;
      if (!$('#ytTitle').value || (!ym.edit)) $('#ytTitle').value = cleanTitle(info.title, info.author);
      if (!$('#ytArtist').value || (!ym.edit)) $('#ytArtist').value = info.author || '';
      $('#ytBody').hidden = false;
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      document.body.classList.add('yt-preview');
      placePreview();
      $('#ytSaveBtn').disabled = false;
      ymMsg(`불러왔어요 · 길이 ${fmtTime(info.duration)}. ▶ 재생 후 탭으로 BPM과 첫 박을 맞추고, 메트로놈으로 확인해 보세요.`);
      ymLoop();
    } catch (e) {
      console.error(e);
      ymMsg(e.message || '영상을 불러오지 못했어요', true);
    } finally {
      $('#ytLoadBtn').disabled = false;
    }
  }
  function ymLoop() {
    cancelAnimationFrame(ym.raf);
    const step = () => {
      if (!modalOpen) return;
      ym.raf = requestAnimationFrame(step);
      placePreview();
      const t = Math.max(0, YtEngine.songTime());
      const playing = YtEngine.isPlaying();
      $('#ytTime').textContent = `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
      const pb = $('#ytModal [data-yt=toggle]');
      const lbl = playing ? '⏸ 정지' : '▶ 재생';
      if (pb.textContent !== lbl) pb.textContent = lbl;
      // 메트로놈
      const bpm = parseFloat($('#ytBpm').value), off = parseFloat($('#ytOffset').value);
      if (ym.metro && playing && YtEngine.mode === 'playing' && bpm >= 40 && off >= 0 && t >= off) {
        const spb = 60 / bpm, k = Math.floor((t - off) / spb + 0.02);
        if (ym.lastBeat !== k) {
          if (ym.lastBeat !== null && k === ym.lastBeat + 1) {
            if (k % 4 === 0) AudioEngine.playChime(3, 'PERFECT', true); else AudioEngine.playHit('hat');
          }
          ym.lastBeat = k;
        }
      } else ym.lastBeat = null;
    };
    ym.raf = requestAnimationFrame(step);
  }
  function ymTap(perf) {
    const btn = $('#ytTap');
    btn.classList.add('hit'); setTimeout(() => btn.classList.remove('hit'), 80);
    if (!YtEngine.isPlaying() || YtEngine.mode !== 'playing') { ymMsg('먼저 ▶ 재생을 눌러 주세요'); return; }
    if (perf - ym.lastTapPerf > 2200) ym.taps = [];
    ym.lastTapPerf = perf;
    ym.taps.push(YtEngine.songTimeAt(perf));
    const lockBpm = parseFloat($('#ytBpm').value);
    if ($('#ytBpmLock').checked && lockBpm >= 40) {
      // BPM 은 그대로 두고 첫 박 위치만 계산
      const spb = 60 / lockBpm, t0 = ym.taps[0];
      const offs = ym.taps.map((t) => t - Math.round((t - t0) / spb) * spb);
      const mean = offs.reduce((a, b) => a + b, 0) / offs.length;
      const rms = Math.sqrt(offs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / offs.length);
      if (ym.taps.length >= 4) $('#ytOffset').value = +Math.max(0, mean).toFixed(3);
      $('#ytTapRes').textContent = ym.taps.length >= 4
        ? `탭 ${ym.taps.length}회 · 첫 박 ${Math.max(0, mean).toFixed(2)}초 · 흔들림 ±${Math.round(rms * 1000)}ms`
        : `탭 ${ym.taps.length}회 (4번 이상 눌러주세요)`;
      return;
    }
    const f = fitTaps(ym.taps);
    if (f) {
      $('#ytBpm').value = +f.bpm.toFixed(2);
      $('#ytOffset').value = +f.offset.toFixed(3);
      $('#ytTapRes').textContent = `탭 ${ym.taps.length}회 · BPM ${+f.bpm.toFixed(2)} · 흔들림 ±${Math.round(f.rms * 1000)}ms`;
    } else $('#ytTapRes').textContent = `탭 ${ym.taps.length}회`;
  }
  function ytModalKey(e) {
    const inInput = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (e.code === 'Escape') { e.preventDefault(); closeYtModal(); return; }
    if (inInput) {
      if (e.code === 'Enter' && document.activeElement.id === 'ytUrl') { e.preventDefault(); ytLoad(); }
      return;
    }
    if (e.code === 'KeyT' && !e.repeat) { e.preventDefault(); ymTap(evTime(e)); }
    else if (e.code === 'Space') { e.preventDefault(); $('#ytModal [data-yt=toggle]').click(); }
  }
  function ytSave() {
    const bpm = parseFloat($('#ytBpm').value), offset = parseFloat($('#ytOffset').value);
    if (!ym.vid) { ymMsg('먼저 영상을 불러와 주세요', true); return; }
    if (!(bpm >= 40 && bpm <= 300)) { ymMsg('BPM을 40~300 사이로 입력해 주세요. 모르면 탭으로 맞출 수 있어요', true); return; }
    if (!(offset >= 0 && offset < ym.duration)) { ymMsg('첫 박 위치(초)를 입력해 주세요', true); return; }
    const d = {
      videoId: ym.vid, title: $('#ytTitle').value.trim() || '제목 없음', artist: $('#ytArtist').value.trim() || 'YouTube',
      bpm, offset, duration: ym.duration,
    };
    const old = ym.edit;
    if (old && old.sample) old.sample = false;
    const i = ytList.findIndex((x) => x.videoId === d.videoId || (old && `yt:${x.videoId}` === old.id));
    if (i >= 0) ytList[i] = d; else ytList.push(d);
    store.set('rm_yt', ytList);
    const song = makeYtSong(d);
    let si = songs.findIndex((x) => x.id === song.id || (old && x.id === old.id));
    if (si >= 0) songs[si] = song; else { songs.push(song); si = songs.length - 1; }
    sel = si;
    closeYtModal();
    renderSongList();
    updateDetail();
    toast(`"${d.title}" ${old ? '설정을 저장했어요' : '추가 완료! 채보를 자동으로 만들었어요'}`);
  }
  /* ---- 자동 맞추기 : 탭 소리를 잠깐 들어보고 BPM · 첫 박 계산 ---- */
  async function ytAutoSync() {
    if (ym.auto) { ym.autoStop = true; return; } // 듣는 중이면 '그만 듣고 분석'
    if (!ym.vid) { ymMsg('먼저 영상을 불러와 주세요', true); return; }
    let stream = null;
    const btn = $('#ytAuto'), lbl = $('#ytAutoLbl');
    const stopStream = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
    try {
      stream = await AutoSync.requestTabAudio();
      await AudioEngine.resume();
      ym.auto = true; ym.autoStop = false;
      const metroWas = ym.metro; ym.metro = false; // 메트로놈 소리가 섞이지 않게
      btn.classList.add('busy'); lbl.textContent = '보정 중...';
      YtEngine.previewPause();
      YtEngine.previewSeek(0);
      const cap = await AutoSync.capture(stream, (perf) => (YtEngine.mode === 'playing' ? YtEngine.songTimeAt(perf) : null), {
        maxSec: 70,
        onProgress: (sec) => {
          if (sec < 2) return;
          lbl.textContent = sec >= 20 ? '그만 듣고 분석' : `듣는 중 ${Math.floor(sec)}초`;
          ymMsg(`영상 소리를 듣는 중이에요... ${Math.floor(sec)}초 / 최대 70초 (20초가 지나면 버튼을 눌러 바로 분석할 수 있어요)`);
        },
        shouldStop: (sec) => ym.autoStop && sec >= 12,
      });
      ymMsg('보정 중이에요. 짧은 "틱" 소리가 3번 나요...');
      await cap.ready;
      YtEngine.setVolume(Math.max(0.6, settings.music));
      YtEngine.previewPlay();
      const res = await cap.done;
      stopStream();
      YtEngine.previewPause();
      lbl.textContent = '분석 중...';
      ymMsg('박자를 분석하는 중이에요...');
      const an = await ChartGen.analyze(res.buffer);
      const ons = an.onsets.map((o) => ({ ...o, t: res.toSong(o.t) }));
      const lock = $('#ytBpmLock').checked && parseFloat($('#ytBpm').value) >= 40;
      const est = AutoSync.estimate(ons, parseFloat($('#ytBpm').value) || 0, lock, an.bpm);
      $('#ytBpm').value = +est.bpm.toFixed(2);
      $('#ytOffset').value = +est.offset.toFixed(3);
      const pct = Math.round(est.conf * 100);
      const good = est.conf >= 0.55;
      ymMsg(`찾았어요! BPM ${+est.bpm.toFixed(2)} · 첫 박 ${est.offset.toFixed(2)}초 · 박자 일치도 ${pct}%${res.calibrated ? '' : ' (보정 틱을 못 찾아서 정확도가 조금 낮을 수 있어요)'}. ` +
        (good ? '메트로놈과 같이 재생해 줄게요. 맞으면 저장하세요.' : '일치도가 낮아요. 메트로놈으로 들어보고 어긋나면 탭으로 다시 맞춰 주세요.'), !good);
      // 확인용 : 첫 박 조금 앞에서 메트로놈과 함께 재생
      ym.metro = true;
      $('#ytMetro').innerHTML = '메트로놈 <b>ON</b>';
      YtEngine.previewSeek(Math.max(0, est.offset - 1.5));
      YtEngine.previewPlay();
      void metroWas;
    } catch (e) {
      console.error(e);
      ymMsg(e.message || '자동 맞추기에 실패했어요', true);
      YtEngine.previewPause();
    } finally {
      stopStream();
      ym.auto = false; ym.autoStop = false;
      btn.classList.remove('busy'); lbl.textContent = '자동 맞추기';
    }
  }
  $('#ytAuto').addEventListener('click', ytAutoSync);
  $('#ytLoadBtn').addEventListener('click', ytLoad);
  $('#ytSaveBtn').addEventListener('click', ytSave);
  $('#ytCancelBtn').addEventListener('click', closeYtModal);
  $('#ytTap').addEventListener('pointerdown', (e) => { e.preventDefault(); ymTap(evTime(e)); });
  $('#ytTapReset').addEventListener('click', () => { ym.taps = []; $('#ytTapRes').textContent = '탭 0회'; });
  $('#ytMark').addEventListener('click', () => { $('#ytOffset').value = +Math.max(0, YtEngine.songTime()).toFixed(3); });
  $('#ytMetro').addEventListener('click', () => {
    ym.metro = !ym.metro;
    $('#ytMetro').innerHTML = `메트로놈 <b>${ym.metro ? 'ON' : 'OFF'}</b>`;
    AudioEngine.resume();
  });
  document.querySelectorAll('#ytModal [data-shift]').forEach((b) => b.addEventListener('click', () => {
    const bpm = parseFloat($('#ytBpm').value), off = parseFloat($('#ytOffset').value) || 0;
    if (!(bpm >= 40)) { ymMsg('BPM을 먼저 정해 주세요', true); return; }
    $('#ytOffset').value = +Math.max(0, off + (+b.dataset.shift) * 60 / bpm).toFixed(3);
  }));
  document.querySelectorAll('#ytModal [data-yt]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.yt, t = Math.max(0, YtEngine.songTime());
    AudioEngine.resume();
    if (a === 'toggle') { if (YtEngine.isPlaying()) YtEngine.previewPause(); else { YtEngine.setVolume(settings.music); YtEngine.previewPlay(); } }
    else if (a === 'restart') YtEngine.previewSeek(0);
    else if (a === 'back') YtEngine.previewSeek(t - 5);
    else if (a === 'fwd') YtEngine.previewSeek(t + 5);
  }));
  $('#ytModal').addEventListener('click', (e) => { if (e.target.id === 'ytModal') closeYtModal(); });

  bindSettings();
  setScreen('menu');
  loadDemo();
  loadYtSongs();
  renderSongList();

  // 디버그/테스트용
  window.RM = { game, songs, settings, startGame, addFiles, openYtModal, saveRecording, SAMPLE_SONGS };
})();
