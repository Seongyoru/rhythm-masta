'use strict';
/* =========================================================
 * ChartGen — 채보(노트 배치) 생성기
 *  1) analyze(): 음악 파일을 분석해 박자/타격 지점(onset)을 찾는다
 *  2) fromDemo(): 데모곡의 악기 이벤트를 onset 으로 변환한다
 *  3) build(): onset 목록 → 난이도별 7레인 채보
 * 레인: 0 1 2 | 3(SPACE) | 4 5 6
 * ========================================================= */
const ChartGen = (() => {
  const SIDE = [0, 1, 2, 4, 5, 6];
  const DIFF = {
    EASY:   { nps: 1.4, minGap: 0.30,  streamGap: 0,    spaceGap: 1.6,  jackW: 0.6,  holdGap: 0.8,  holdProb: 0.55, chordProb: 0,    spaceChord: 0 },
    NORMAL: { nps: 2.6, minGap: 0.17,  streamGap: 0.22, spaceGap: 0.85, jackW: 0.25, holdGap: 0.7,  holdProb: 0.55, chordProb: 0.06, spaceChord: 0.08 },
    HARD:   { nps: 3.9, minGap: 0.12,  streamGap: 0.18, spaceGap: 0.6,  jackW: 0.15, holdGap: 0.62, holdProb: 0.5,  chordProb: 0.15, spaceChord: 0.2 },
    HELL:   { nps: 5.0, minGap: 0.095, streamGap: 0.15, spaceGap: 0.42, jackW: 0.1,  holdGap: 0.55, holdProb: 0.45, chordProb: 0.22, spaceChord: 0.3 },
  };
  // 분석 프레임 시간 보정값 (내장 데모곡으로 측정해 맞춤)
  const TIME_CAL = 0;

  function rng32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  function lowerBound(arr, v) {
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
    return lo;
  }

  /* ---------------- 채보 생성 ---------------- */
  function build(onsets, duration, name, seed) {
    const P = DIFF[name];
    const rnd = rng32(seed);
    const maxCount = Math.max(8, Math.round(duration * P.nps));

    // 1) 조용한 구간도 비지 않도록 일정 구간마다 가장 강한 onset 을 먼저 고르고
    // 2) 나머지는 강한 onset 부터 최소 간격을 지키며 채운다
    const times = [], chosen = [], taken = new Set();
    const tryAdd = (o) => {
      if (chosen.length >= maxCount || o.t < 0.05 || taken.has(o)) return;
      const i = lowerBound(times, o.t);
      if (i > 0 && o.t - times[i - 1] < P.minGap) return;
      if (i < times.length && times[i] - o.t < P.minGap) return;
      times.splice(i, 0, o.t);
      chosen.push(o);
      taken.add(o);
    };
    const cover = 2.4 / P.nps;
    const winBest = new Map();
    for (const o of onsets) {
      if (o.s < 0.12) continue;
      const w = Math.floor(o.t / cover);
      const b = winBest.get(w);
      if (!b || o.s > b.s) winBest.set(w, o);
    }
    for (const o of winBest.values()) tryAdd(o);
    const byS = onsets.slice().sort((a, b) => b.s - a.s || a.t - b.t);
    for (const o of byS) { if (chosen.length >= maxCount) break; tryAdd(o); }
    chosen.sort((a, b) => a.t - b.t);

    const notes = [];
    const busy = new Array(7).fill(-1e9);
    const free = (l, t) => busy[l] <= t;
    let last = -1, lastT = -1e9, dir = 1, lastSpace = -1e9;

    for (let k = 0; k < chosen.length; k++) {
      const o = chosen[k], t = o.t;
      const gapPrev = t - lastT;
      const gapNext = k + 1 < chosen.length ? chosen[k + 1].t - t : 9;
      let lane = -1;

      if (o.band === 0 && o.s >= 0.6 && t - lastSpace >= P.spaceGap && free(3, t)) {
        lane = 3; // 강한 저음(킥) → 스페이스
      } else if (P.streamGap && gapPrev <= P.streamGap && last >= 0 && last !== 3) {
        // 빠른 연타 구간은 계단 / 지그재그 패턴
        if (rnd() < 0.18) dir = -dir;
        let si = SIDE.indexOf(last) + dir;
        if (si < 0 || si > 5) { dir = -dir; si = SIDE.indexOf(last) + dir; }
        if (free(SIDE[si], t)) lane = SIDE[si];
      }
      if (lane < 0) {
        let hand;
        if (last >= 0 && last !== 3 && gapPrev < 0.3) hand = last < 3 ? 1 : 0; // 손 번갈아
        else hand = o.band === 1 ? 0 : o.band === 2 ? 1 : (rnd() < 0.5 ? 0 : 1);
        const w = []; let tot = 0;
        for (const l of SIDE) {
          let x = free(l, t) ? 1 : 0;
          if (l === last) x *= P.jackW;
          if ((l < 3) === (hand === 0)) x *= 2.2;
          w.push(x); tot += x;
        }
        if (tot <= 0) continue;
        let r = rnd() * tot;
        for (let i = 0; i < 6; i++) { if (w[i] <= 0) continue; lane = SIDE[i]; r -= w[i]; if (r <= 0) break; }
        dir = rnd() < 0.5 ? 1 : -1;
      }

      // 롱노트
      let end = 0;
      const holdLen = o.dur
        ? Math.min(o.dur - 0.02, 2.4)
        : (gapNext >= P.holdGap ? Math.min(gapNext * 0.62, 2.4) : 0);
      const hp = P.holdProb * (o.dur ? 1.7 : 1) * (lane === 3 ? 0.5 : 1);
      if (holdLen >= 0.26 && rnd() < hp) end = t + holdLen;
      notes.push(end ? { t, lane, end } : { t, lane });
      busy[lane] = end ? end + 0.12 : t + 0.01;

      // 동시치기
      if (lane !== 3 && o.s >= 0.78 && rnd() < P.chordProb) {
        const m = 6 - lane;
        if (free(m, t)) { notes.push({ t, lane: m }); busy[m] = t + 0.01; }
      } else if (lane === 3 && rnd() < P.spaceChord) {
        const c = SIDE[Math.floor(rnd() * 6)];
        if (free(c, t)) { notes.push({ t, lane: c }); busy[c] = t + 0.01; }
      }
      if (lane === 3) lastSpace = t;
      last = lane; lastT = t;
    }

    return finalize(notes, duration, name);
  }

  /* ================= 샘플 곡 전용 '설계형' 채보 =================
   * 실제 음원 분석 데이터(SONG_DATA)를 바탕으로, 사람이 짠 것처럼 치는 재미가 있게 배치한다.
   *  - 마디마다 곡의 세기(벌스/후렴)에 맞춰 노트 수 조절
   *  - 정박 > 8분 > 16분 순으로 우선, 강한 소리 우선
   *  - 킥 → 스페이스, 스네어 → 1·5번 레인, 하이햇 → 2·4번 레인, 그 외 → 0·6번 레인 (양손 교대)
   *  - 빠른 연타 → 계단 / 트릴 / 롤 패턴
   *  - 강한 정박 → 대칭 동시치기,  소리가 길게 이어지는 곳 → 롱노트
   *  - 보컬 데이터(D.v)가 있으면 노래 부르는 마디는 보컬 리듬을 따라간다
   *    (음이 올라가면 오른쪽, 내려가면 왼쪽 레인 · 길게 끄는 음은 롱노트 · 킥은 스페이스로 박자 받침)
   *    보컬이 없는 전주 · 간주는 원래대로 드럼 · 반주 리듬                     */
  const DESIGN = {
    // rank : 0 EASY · 1 NORMAL · 2 HARD(노말과 헬 사이) · 3 HELL(예전 HARD)
    EASY:   { rank: 0, nps: [1.3, 1.8, 2.3], minGap: 0.30, allow: 1, space: 'down', spaceGap: 4.0, chord: 9,    holdGap: 1.2,  holdProb: 0.65, run: 0,  vAllow: 2, vHold: 0.95, vDrum: 0,    vCover: 0.5 },
    NORMAL: { rank: 1, nps: [2.15, 2.9, 3.75], minGap: 0.155, allow: 2, space: 'beat', spaceGap: 2.0, chord: 0.88, holdGap: 1.0,  holdProb: 0.62, run: 4,  vAllow: 3, vHold: 0.68,  vDrum: 0,    vCover: 0.75 },
    HARD:   { rank: 2, nps: [3.75, 5.15, 6.7], minGap: 0.10, allow: 3, space: 'beat', spaceGap: 1.0, chord: 0.8,  holdGap: 0.9,  holdProb: 0.62, run: 8,  vAllow: 3, vHold: 0.8,  vDrum: 0.3,  vCover: 0.95 },
    HELL:   { rank: 3, nps: [4.2, 5.8, 7.6], minGap: 0.07, allow: 4, space: 'beat', spaceGap: 1.0, chord: 0.74, holdGap: 0.72, holdProb: 0.8,  run: 16, vAllow: 3, vHold: 0.75,  vDrum: 0.55, vCover: 1 },
  };
  const VOC_W = 1.4; // 보컬 마디에서 보컬 소리의 우선도
  function design(D, name, seed, keys) {
    const K4 = keys === 4, SP = K4 ? -1 : 3;
    const P = DESIGN[name];
    const rnd = rng32(seed);
    const spb = 60 / D.bpm, g16 = spb / 4, barDur = spb * 4;
    const E = (t) => { const i = Math.floor((t - D.e0) / g16); return i >= 0 && i < D.e.length ? D.e.charCodeAt(i) - 48 : 0; };
    const ons = [];
    const ST = D.stride || 3;
    for (let i = 0; i < D.on.length; i += ST) ons.push({ t: D.on[i] / 1000, s: D.on[i + 1] / 99, b: D.on[i + 2], p: ST > 3 ? D.on[i + 3] : -1 });
    // 박 안의 위치 : 0 마디첫박, 1 정박, 2 8분, 3 16분, 4 격자 밖
    const posOf = (t) => {
      const x = (t - D.offset) / g16, k = Math.round(x);
      if (Math.abs(x - k) * g16 > 0.012) return 4;
      const m = ((k % 16) + 16) % 16;
      return m === 0 ? 0 : m % 4 === 0 ? 1 : m % 2 === 0 ? 2 : 3;
    };
    // 마디별 세기 → 3단계
    const barIdx = (t) => Math.floor((t - D.offset) / barDur);
    const firstBar = barIdx(D.start), lastBar = barIdx(D.end);
    const barE = [];
    for (let b = firstBar; b <= lastBar; b++) {
      let s = 0, n = 0;
      for (let k = 0; k < 16; k++) { s += E(D.offset + b * barDur + k * g16); n++; }
      barE.push(s / n);
    }
    const sortedE = barE.slice().sort((a, b) => a - b);
    const q40 = sortedE[Math.floor(sortedE.length * 0.4)] || 0, q68 = sortedE[Math.floor(sortedE.length * 0.68)] || 0;
    const tierOf = (b) => { const v = barE[b - firstBar] || 0; return v >= q68 ? 2 : v >= q40 ? 1 : 0; };

    // 보컬 (stride 5 : 시간ms · 세기 · 길이ms · 음높이(MIDI) · 박 위치)
    const vocs = [];
    if (D.v) for (let i = 0; i < D.v.length; i += 5) vocs.push({ t: D.v[i] / 1000, s: D.v[i + 1] / 99, dur: D.v[i + 2] / 1000, m: D.v[i + 3], p: D.v[i + 4], b: 1, voc: true });
    const vocBar = new Set();
    {
      const cnt = new Map();
      for (const o of vocs) if (o.s >= 0.3 && o.m > 0) { const b = barIdx(o.t); cnt.set(b, (cnt.get(b) || 0) + 1); }
      for (const [b, c] of cnt) if (c >= 3) vocBar.add(b);
    }
    const mids = vocs.filter((o) => o.m > 0).map((o) => o.m).sort((a, b) => a - b);
    const pLo = mids.length ? mids[Math.floor(mids.length * 0.1)] : 60, pHi = mids.length ? Math.max(pLo + 5, mids[Math.floor(mids.length * 0.9)]) : 72;

    // 1) 마디마다 노트 고르기
    const POS_W = [1.6, 1.3, 1.0, 0.75, 0.45];
    const BAND_W = [1.15, 1.1, 0.9];
    const chosen = [];
    const times = [];
    const okGap = (t) => { const i = lowerBound(times, t); return !(i > 0 && t - times[i - 1] < P.minGap) && !(i < times.length && times[i] - t < P.minGap); };
    const byBar = new Map();
    for (const o of vocs) {
      if (o.t < D.start || o.t > D.end || o.p > P.vAllow || !vocBar.has(barIdx(o.t))) continue;
      o.pos = o.p;
      o.sc = o.s * POS_W[o.pos] * VOC_W;
      const b = barIdx(o.t);
      if (!byBar.has(b)) byBar.set(b, []);
      byBar.get(b).push(o);
    }
    for (const o of ons) {
      if (o.t < D.start || o.t > D.end) continue;
      // 보컬 마디 : 킥만 남기고 (어려움은 다른 드럼도 약하게) 보컬을 따라간다
      const inVoc = vocBar.has(barIdx(o.t));
      if (inVoc && o.b !== 0 && !P.vDrum) continue;
      o.pos = o.p >= 0 ? o.p : posOf(o.t);
      if (o.pos > P.allow) {
        // 쉬운 난이도는 아주 강한 8분만 예외 허용
        if (!(P.rank < 3 && o.pos === P.allow + 1 && o.s >= 0.82 && tierOf(barIdx(o.t)) === 2)) continue;
      }
      o.sc = o.s * POS_W[o.pos] * BAND_W[o.b] * (inVoc && o.b !== 0 ? P.vDrum : 1);
      const b = barIdx(o.t);
      if (!byBar.has(b)) byBar.set(b, []);
      byBar.get(b).push(o);
    }
    for (const [b, list] of byBar) {
      const tier = tierOf(b);
      let budget = Math.max(1, Math.round(P.nps[tier] * barDur * (K4 ? 0.9 : 1) * (0.9 + rnd() * 0.2)));
      // 노래하는 마디 : 보컬 음절을 (난이도만큼) 거의 다 넣는다
      if (vocBar.has(b)) budget = Math.max(budget, Math.round(list.filter((o) => o.voc).length * P.vCover));
      list.sort((x, y) => y.sc - x.sc);
      let n = 0;
      for (const o of list) {
        if (n >= budget) break;
        if (o.s < 0.1 || !okGap(o.t)) continue;
        const i = lowerBound(times, o.t);
        times.splice(i, 0, o.t);
        chosen.push(o);
        n++;
      }
    }
    chosen.sort((a, b) => a.t - b.t);

    // 2) 레인 배치
    const LEFT = K4 ? [0, 1] : [0, 1, 2], RIGHT = K4 ? [2, 3] : [4, 5, 6];
    const handOf = (l) => (K4 ? (l < 2 ? 0 : 1) : (l < 3 ? 0 : 1));
    const notes = [];
    const busy = new Array(7).fill(-1e9);
    const lastUse = new Array(7).fill(-1e9);
    const free = (l, t) => busy[l] < t - 0.001;
    let lastT = -1e9, lastLane = -1, lastHand = rnd() < 0.5 ? 0 : 1, lastSpace = -1e9;
    let run = null; // { kind, seq, i }
    let holdUntil = -1, holdHand = -1; // 한 손 롱노트 중이면 다른 손으로만
    const PATTERNS = K4 ? {
      stairs: [0, 1, 2, 3, 2, 1], stairsR: [3, 2, 1, 0, 1, 2],
      trillIn: [1, 2], trillMid: [0, 2], trillOut: [0, 3],
      rollL: [0, 1, 3, 2], rollR: [3, 2, 0, 1],
      zig: [0, 2, 1, 3],
    } : {
      stairs: [0, 1, 2, 4, 5, 6, 5, 4, 2, 1],
      stairsR: [6, 5, 4, 2, 1, 0, 1, 2, 4, 5],
      trillIn: [2, 4], trillMid: [1, 5], trillOut: [0, 6],
      rollL: [0, 1, 2, 1], rollR: [6, 5, 4, 5],
      zig: [0, 4, 1, 5, 2, 6],
    };
    const runKinds = P.rank >= 2 ? ['stairs', 'stairsR', 'trillIn', 'trillMid', 'zig', 'rollL', 'rollR', 'trillOut'] : ['trillIn', 'trillMid', 'stairs', 'stairsR'];
    const preferLane = (o, hand) => {
      const side = hand === 0 ? LEFT : RIGHT;
      // 소리 종류 → 레인 (스네어 가운데, 하이햇 안쪽, 그 외 바깥)
      let base;
      if (K4) base = o.b === 1 ? (hand === 0 ? 1 : 2) : (hand === 0 ? 0 : 3);
      else base = o.b === 1 ? side[1] : o.b === 2 ? (hand === 0 ? 2 : 4) : (hand === 0 ? 0 : 6);
      if (rnd() < 0.25) base = side[Math.floor(rnd() * side.length)];
      return base;
    };
    const VL = K4 ? [0, 1, 2, 3] : [0, 1, 2, 4, 5, 6];
    let lastVoc = null, vCenter = 0; // 앞 보컬 음 { t, m, i } · 프레이즈 음높이 중심
    let sameHand = 0; // 같은 손으로 빠르게 이어 친 횟수
    for (let k = 0; k < chosen.length; k++) {
      const o = chosen[k], t = o.t;
      const dt = t - lastT;
      const nextT = k + 1 < chosen.length ? chosen[k + 1].t : t + 10;
      let lane = -1;
      if (o.voc && o.m > 0) {
        // 보컬 : 음높이 → 레인 (높을수록 오른쪽), 앞 음과의 오르내림을 살린다
        // 프레이즈 중심(최근 음들의 평균)보다 높으면 오른쪽, 낮으면 왼쪽
        const near = !!lastVoc && t - lastVoc.t < 1.6;
        vCenter = near ? vCenter * 0.8 + o.m * 0.2 : o.m;
        const span = K4 ? 6 : 8;
        let i = Math.round((VL.length - 1) / 2 + ((o.m - vCenter) / span) * (VL.length - 1));
        i = Math.max(0, Math.min(VL.length - 1, i));
        if (near) {
          const dm = o.m - lastVoc.m, li = lastVoc.i;
          if (dm > 0 && i <= li) i = li + 1;
          else if (dm < 0 && i >= li) i = li - 1;
          else if (dm === 0) i = t - lastVoc.t < spb * 1.05 ? li + (li < (VL.length - 1) / 2 ? 1 : -1) : li;
          // 끝 레인에서 더 올라가거나 내려가면 반대쪽에서 다시 시작 (옥타브 넘김 느낌)
          if (i >= VL.length) { i = Math.max(0, li - 2); vCenter = o.m + span * 0.35; }
          if (i < 0) { i = Math.min(VL.length - 1, li + 2); vCenter = o.m - span * 0.35; }
        }
        // 치기 편하게 (노트 수는 그대로) : 빠른 음절이 한 손에 3개 넘게 몰리면 반대 손으로,
        // 한 손 안에서 빠르게 양 끝을 오가면 가운데 손가락 쪽으로
        const fast = dt < spb * 0.55;
        if (fast && sameHand >= 2 && handOf(VL[i]) === lastHand) i = VL.length - 1 - i;
        else if (fast && lastLane >= 0 && lastLane !== SP && handOf(VL[i]) === handOf(lastLane) && Math.abs(VL[i] - lastLane) >= 2) {
          i = VL.indexOf(lastLane) + (VL[i] > lastLane ? 1 : -1);
        }
        const order = VL.map((_, j) => j).sort((a, b) => Math.abs(a - i) - Math.abs(b - i));
        for (const j of order) {
          const l = VL[j];
          if (!free(l, t)) continue;
          if (t < holdUntil && handOf(l) === holdHand) continue;
          if (l === lastLane && dt < spb * 0.55) continue;
          lane = l; i = j; break;
        }
        if (lane >= 0) lastVoc = { t, m: o.m, i };
        run = null;
      }
      // 스페이스 (킥)
      const spaceOk = P.space === 'down' ? o.pos === 0 && tierOf(barIdx(t)) >= 1 : o.pos <= 1;
      const vocKick = !o.voc && vocBar.has(barIdx(t));
      if (lane >= 0 || o.voc) { /* 보컬 레인 이미 정함 */ } else if (!K4 && o.b === 0 && o.s >= 0.55 && spaceOk && t - lastSpace >= P.spaceGap * spb - 0.01 && free(3, t)) {
        lane = 3; run = null;
      } else if (P.run && dt <= g16 * 2.2 + 0.005 && t >= holdUntil) {
        // 연타 패턴
        if (!run || run.left <= 0) {
          const kind = runKinds[Math.floor(rnd() * runKinds.length)];
          run = { seq: PATTERNS[kind], i: Math.max(0, PATTERNS[kind].indexOf(lastLane) + 1), left: P.run };
        }
        for (let tries = 0; tries < run.seq.length && lane < 0; tries++) {
          const l = run.seq[run.i % run.seq.length]; run.i++;
          if (l !== lastLane && free(l, t)) lane = l;
        }
        run.left--;
      } else run = null;
      // 보컬 마디의 드럼 : 스페이스(킥)나 마디 첫박 강세만 남긴다 (어려움은 그대로)
      if (lane < 0 && vocKick && !P.vDrum && !(o.pos === 0 && o.s >= 0.6)) continue;
      if (lane < 0) {
        // 양손 교대 (가끔은 같은 손 연속)
        let hand = rnd() < 0.72 ? 1 - lastHand : lastHand;
        if (lastLane === SP) hand = rnd() < 0.5 ? 0 : 1;
        if (t < holdUntil) hand = 1 - holdHand;
        let l = preferLane(o, hand);
        const side = hand === 0 ? LEFT : RIGHT;
        // 같은 레인 연타 피하기 (8분 이내)
        if ((l === lastLane && dt < spb * 0.55) || !free(l, t)) {
          const alt = side.filter((x) => x !== lastLane && free(x, t));
          const other = t < holdUntil ? [] : (hand === 0 ? RIGHT : LEFT).filter((x) => free(x, t));
          l = alt.length ? alt[Math.floor(rnd() * alt.length)] : other.length ? other[Math.floor(rnd() * other.length)] : -1;
        }
        lane = l;
      }
      if (lane < 0) continue;

      // 롱노트 : 다음 노트까지 충분히 비어 있고, 그 사이 소리가 이어질 때
      let end = 0;
      const gap = nextT - t;
      if (o.voc) {
        // 길게 끄는 노래 음 → 롱노트
        const len = Math.floor(Math.min(o.dur, gap - g16 * 1.2, spb * 4) / g16) * g16;
        if (len >= Math.max(spb * 0.6, 0.32) && rnd() < P.vHold) end = t + len;
      } else if (lane !== SP || P.rank < 3) {
        if (gap >= P.holdGap * spb) {
          let sus = 0, cnt = 0;
          const e0 = Math.max(1, E(t));
          for (let x = t + g16; x < nextT - g16 * 0.5; x += g16) { sus += E(x) >= e0 * 0.6 ? 1 : 0; cnt++; }
          if (cnt && sus / cnt >= 0.75 && rnd() < P.holdProb) {
            const len = Math.min(spb * 4, Math.floor((gap - g16 * 1.5) / g16) * g16);
            if (len >= spb * 0.75) end = t + len;
          }
        }
      }
      // 한 손 롱노트 + 다른 손 연타 (후렴 마디 첫박의 긴 소리)
      if (!end && !o.voc && name !== 'EASY' && lane !== SP && o.pos === 0 && o.s >= 0.6 && tierOf(barIdx(t)) >= 1 && t >= holdUntil
        && rnd() < [0, 0.3, 0.45, 0.62][P.rank]) {
        const len = spb * (P.rank >= 2 && rnd() < 0.5 ? 3 : 2);
        let sus = 0, cnt = 0;
        const e0 = Math.max(1, E(t));
        for (let x = t + g16; x < t + len; x += g16) { sus += E(x) >= e0 * 0.55 ? 1 : 0; cnt++; }
        const soon = chosen.slice(k + 1).filter((c) => c.t < t + len).length;
        if (cnt && sus / cnt >= 0.7 && (P.rank >= 2 || soon <= 4)) {
          end = t + len;
          holdUntil = end + 0.02; holdHand = handOf(lane);
        }
      }
      notes.push(end ? { t, lane, end } : { t, lane });
      busy[lane] = end ? end + 0.06 : t + 0.01;
      lastUse[lane] = t;

      // 동시치기 : 강한 정박
      if (!o.voc && o.s >= P.chord && o.pos <= 1 && tierOf(barIdx(t)) >= (P.rank >= 2 ? 1 : 2)) {
        let m = K4 ? 3 - lane : lane === 3 ? (o.pos === 0 ? (rnd() < 0.5 ? 0 : 6) : -1) : 6 - lane;
        if (m >= 0 && free(m, t) && m !== lane) { notes.push({ t, lane: m }); busy[m] = t + 0.01; }
        // HELL 후렴 마디 첫박 : 3키 화음 (스페이스 + 양쪽)
        if (!K4 && P.rank === 3 && o.pos === 0 && o.s >= 0.9 && tierOf(barIdx(t)) === 2 && lane !== 3 && free(3, t) && t - lastSpace >= spb) {
          notes.push({ t, lane: 3 }); busy[3] = t + 0.01; lastSpace = t;
        }
      }
      if (lane === SP) { lastSpace = t; sameHand = 0; } else {
        const h = handOf(lane);
        sameHand = h === lastHand && dt < spb * 0.55 ? sameHand + 1 : 0;
        lastHand = h;
      }
      lastLane = lane; lastT = t;
    }
    return finalize(notes, D.end - D.start, name);
  }
  function designAll(D, seed, keys) {
    return { EASY: design(D, 'EASY', seed + 1, keys), NORMAL: design(D, 'NORMAL', seed + 2, keys), HARD: design(D, 'HARD', seed + 4, keys), HELL: design(D, 'HELL', seed + 3, keys) };
  }

  /* 7키 채보 → 4키 (설계 데이터가 없는 곡용) : 왼손 0·1·2 → 0·1, 오른손 4·5·6 → 2·3, 스페이스 → 가운데 번갈아 */
  function to4k(chart, name) {
    const MAP = [0, 1, 1, -1, 2, 2, 3];
    const busy = [-1, -1, -1, -1];
    const out = [];
    let flip = 0;
    for (const n of chart.notes.slice().sort((a, b) => a.t - b.t)) {
      let l = n.lane === 3 ? (flip++ % 2 ? 2 : 1) : MAP[n.lane];
      const tryL = [l, l ^ 1, 3 - l, (3 - l) ^ 1];
      l = tryL.find((x) => busy[x] < n.t - 0.001);
      if (l === undefined) continue;
      if (out.length && out[out.length - 1].t === n.t && out.filter((o) => o.t === n.t).length >= 2) continue;
      out.push(n.end ? { t: n.t, lane: l, end: n.end } : { t: n.t, lane: l });
      busy[l] = n.end ? n.end + 0.06 : n.t + 0.01;
    }
    const dur = out.length ? out[out.length - 1].t - out[0].t + 10 : 30;
    return finalize(out, Math.max(30, dur), name);
  }
  function allTo4k(charts) {
    const r = {};
    for (const d of Object.keys(charts)) r[d] = to4k(charts[d], d);
    return r;
  }

  // 노트 목록 → 채보 객체 (레벨 · 개수 계산)
  function finalize(notes, duration, name) {
    notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
    const holds = notes.filter((n) => n.end).length;
    const nps = notes.length / Math.max(30, duration);
    const level = Math.max(1, Math.min(15, Math.round(nps * 2.3 + (name === 'HELL' ? 1 : name === 'HARD' ? 0.5 : 0))));
    return { notes, level, count: notes.length, holds, total: notes.length + holds };
  }

  /* ---------------- BPM 격자 → onset (유튜브 곡용) ----------------
   * 소리를 분석할 수 없으므로 박자 위치에 '음악적인' 강세를 매겨 가짜 onset 을 만든다.
   * 마디(16분음표 16칸)마다 몇 가지 그루브 패턴 중 하나를 골라 단조로움을 줄인다. */
  const GROOVES = [
    // 0: 기본 8비트 (킥 1·3, 스네어 2·4)
    [[0, .95, 0], [2, .5, 2], [4, .92, 1], [6, .5, 2], [8, .85, 0], [10, .5, 2], [12, .92, 1], [14, .5, 2]],
    // 1: 당김음
    [[0, .95, 0], [3, .7, 2], [4, .9, 1], [6, .62, 0], [10, .72, 2], [12, .92, 1], [14, .45, 2]],
    // 2: 4비트 킥 (댄스)
    [[0, .95, 0], [2, .45, 2], [4, .93, 0], [6, .45, 2], [8, .93, 0], [10, .45, 2], [12, .95, 1], [14, .45, 2]],
    // 3: 하프타임
    [[0, .95, 0], [6, .55, 2], [8, .9, 1], [11, .5, 2], [14, .55, 2]],
  ];
  function fromGrid(bpm, offset, duration, seed) {
    const rnd = rng32(seed);
    const spb = 60 / bpm, s16 = spb / 4, bar = spb * 4;
    const out = [];
    const nBars = Math.ceil((duration - offset) / bar);
    let groove = 0;
    for (let b = 0; b < nBars; b++) {
      if (b % 4 === 0) groove = Math.floor(rnd() * GROOVES.length);
      const fill = b % 8 === 7;           // 8마디마다 필인 (16분 연타)
      const phraseStart = b % 8 === 0;
      const pat = new Map(GROOVES[groove].map(([pos, s, band]) => [pos, [s, band]]));
      for (let pos = 0; pos < 16; pos++) {
        const t = offset + b * bar + pos * s16;
        if (t < 0.05 || t > duration - 0.6) continue;
        let s, band, dur = 0;
        if (pat.has(pos)) [s, band] = pat.get(pos);
        else if (pos % 2 === 0) { s = 0.3; band = 2; }
        else { s = fill && pos >= 8 ? 0.55 : 0.16; band = 2; }
        if (fill && pos >= 8) s = Math.max(s, 0.58);
        s = Math.max(0, Math.min(1, s + (rnd() - 0.5) * 0.12));
        if (pos === 0 && (phraseStart || rnd() < 0.18)) { dur = spb * (rnd() < 0.5 ? 2 : 1.5); band = 1; s = Math.max(s, 0.9); }
        out.push({ t, s, band, dur });
      }
    }
    return out;
  }

  function buildAll(onsets, duration, seed) {
    return {
      EASY: build(onsets, duration, 'EASY', seed + 1),
      NORMAL: build(onsets, duration, 'NORMAL', seed + 2),
      HARD: build(onsets, duration, 'HARD', seed + 4),
      HELL: build(onsets, duration, 'HELL', seed + 3),
    };
  }

  /* ---------------- 데모곡 이벤트 → onset ---------------- */
  const DEMO_MAP = {
    kick: [0, 0.95], snare: [1, 0.97], hat: [2, 0.18], bass: [0, 0.3],
    arp: [2, 0.45], lead: [2, 0.86], pad: [1, 0.62], crash: [2, 0.7],
  };
  function fromDemo(events) {
    const ev = events.map((e) => {
      const [band, s0] = DEMO_MAP[e.type];
      const s = e.v ? s0 * (0.6 + 0.4 * e.v) : s0;
      return { t: e.t, band, s, dur: e.dur || 0 };
    }).sort((a, b) => a.t - b.t);
    const out = [];
    for (const e of ev) {
      const p = out[out.length - 1];
      if (p && e.t - p.t < 0.006) {
        const hi = Math.max(p.s, e.s);
        if (e.s > p.s) { p.band = e.band; p.dur = e.dur; }
        p.s = Math.min(1, hi + 0.04);
      } else out.push({ ...e });
    }
    return out;
  }

  /* ---------------- 음악 파일 분석 ---------------- */
  function twiddles(N) {
    const c = new Float32Array(N / 2), s = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) { c[i] = Math.cos(-2 * Math.PI * i / N); s[i] = Math.sin(-2 * Math.PI * i / N); }
    return { c, s };
  }
  function fft(re, im, tw) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, stepT = n / len;
      for (let i = 0; i < n; i += len) {
        for (let k = 0; k < half; k++) {
          const wr = tw.c[k * stepT], wi = tw.s[k * stepT];
          const a = i + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
  }
  const mean = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; };

  async function analyze(buffer, onProgress, opts) {
    const SENS = opts && opts.sensitive;
    const sr = buffer.sampleRate;
    const d = Math.max(1, Math.round(sr / 22050));
    const fs = sr / d;
    const c0 = buffer.getChannelData(0);
    const c1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : c0;
    const n = Math.floor(c0.length / d);
    const x = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0; const b = i * d;
      for (let k = 0; k < d; k++) s += c0[b + k] + c1[b + k];
      x[i] = s / (2 * d);
    }

    const N = 1024, HOP = 256, half = N / 2;
    const frames = n >= N ? Math.floor((n - N) / HOP) + 1 : 0;
    if (frames < 50) throw new Error(T('곡이 너무 짧아요'));
    const win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    const re = new Float32Array(N), im = new Float32Array(N), prev = new Float32Array(half);
    const tw = twiddles(N);
    const binHz = fs / N;
    const lowEnd = Math.max(2, Math.round(160 / binHz)), midEnd = Math.round(2500 / binHz);
    const FL = new Float32Array(frames), FM = new Float32Array(frames), FH = new Float32Array(frames);

    for (let f = 0; f < frames; f++) {
      const o = f * HOP;
      for (let i = 0; i < N; i++) { re[i] = x[o + i] * win[i]; im[i] = 0; }
      fft(re, im, tw);
      let l = 0, m = 0, h = 0;
      for (let k = 1; k < half; k++) {
        const mag = Math.log(1 + 30 * Math.sqrt(re[k] * re[k] + im[k] * im[k]));
        const dd = mag - prev[k]; prev[k] = mag;
        if (dd > 0) { if (k < lowEnd) l += dd; else if (k < midEnd) m += dd; else h += dd; }
      }
      FL[f] = l; FM[f] = m; FH[f] = h;
      if (f % 3000 === 2999) {
        if (onProgress) onProgress(f / frames);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const mL = mean(FL) + 1e-9, mM = mean(FM) + 1e-9, mH = mean(FH) + 1e-9;
    const nov = new Float32Array(frames);
    for (let f = 0; f < frames; f++) nov[f] = FL[f] / mL + FM[f] / mM + FH[f] / mH * 0.7;
    const sm = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      sm[f] = (nov[Math.max(0, f - 1)] + 2 * nov[f] + nov[Math.min(frames - 1, f + 1)]) / 4;
    }
    const ps = new Float64Array(frames + 1);
    for (let f = 0; f < frames; f++) ps[f + 1] = ps[f] + sm[f];
    const gMean = ps[frames] / frames;

    // 피크 검출
    const A = 20, peaks = [];
    for (let f = 3; f < frames - 3; f++) {
      const v = sm[f];
      if (v < sm[f - 1] || v < sm[f + 1] || v < sm[f - 2] || v < sm[f + 2] || v < sm[f - 3] || v < sm[f + 3]) continue;
      const a = Math.max(0, f - A), b = Math.min(frames, f + A + 1);
      const lm = (ps[b] - ps[a]) / (b - a);
      if (v < (SENS ? lm * 1.1 + gMean * 0.04 : lm * 1.3 + gMean * 0.1)) continue;
      const lp = peaks[peaks.length - 1];
      if (lp && f - lp.f < (SENS ? 3 : 4)) { if (v > lp.v) { lp.f = f; lp.v = v; } continue; }
      peaks.push({ f, v });
    }
    if (!peaks.length) throw new Error(T('타격 지점을 찾지 못했어요'));

    // 세기 정규화 (전역 + 구간별)
    const sorted = peaks.map((p) => p.v).sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
    const fr = fs / HOP;
    const win2 = Math.round(fr * 2);
    let j0 = 0;
    // 대역 분류: 각 대역 flux 를 피크들 사이의 백분위로 바꿔 비교 (음량 차이에 둔감)
    const bandVals = peaks.map((p) => {
      const f = p.f;
      const q = (arr) => arr[Math.max(0, f - 1)] + arr[f] + arr[Math.min(frames - 1, f + 1)];
      return [q(FL), q(FM), q(FH)];
    });
    const pct = [0, 1, 2].map((bi) => {
      const idx = bandVals.map((v, i) => i).sort((a, b) => bandVals[a][bi] - bandVals[b][bi]);
      const r = new Float32Array(peaks.length);
      idx.forEach((pi, rank) => { r[pi] = rank / Math.max(1, peaks.length - 1); });
      return r;
    });
    const onsets = [];
    for (let i = 0; i < peaks.length; i++) {
      const p = peaks[i];
      while (peaks[j0].f < p.f - win2) j0++;
      let lmax = 0;
      for (let j = j0; j < peaks.length && peaks[j].f <= p.f + win2; j++) lmax = Math.max(lmax, peaks[j].v);
      const s = Math.min(1, 0.6 * Math.min(1, p.v / p95) + 0.4 * (p.v / (lmax || 1)));
      const f = p.f;
      const pl = pct[0][i], pm = pct[1][i], ph = pct[2][i];
      const band = pl >= 0.72 ? 0 : pm >= ph ? 1 : 2;
      onsets.push({ t: (f * HOP + N / 2) / fs + TIME_CAL, s, band, dur: 0 });
    }

    // BPM 추정 (자기상관)
    let bpm = 0;
    {
      const z = new Float32Array(frames);
      for (let f = 0; f < frames; f++) z[f] = sm[f] - gMean;
      const minLag = Math.floor(fr * 60 / 190), maxLag = Math.ceil(fr * 60 / 70);
      const lim = Math.min(frames, Math.round(fr * 120));
      const r = new Float64Array(maxLag + 2);
      let bestLag = 0, best = -Infinity;
      for (let lag = minLag; lag <= maxLag + 1; lag++) {
        let s = 0;
        for (let i = 0; i + lag < lim; i++) s += z[i] * z[i + lag];
        r[lag] = s;
      }
      for (let lag = minLag + 1; lag <= maxLag; lag++) {
        const b = 60 * fr / lag;
        const w = Math.exp(-0.5 * Math.pow(Math.log2(b / 125) / 0.8, 2));
        if (r[lag] * w > best) { best = r[lag] * w; bestLag = lag; }
      }
      if (bestLag) {
        const y0 = r[bestLag - 1], y1 = r[bestLag], y2 = r[bestLag + 1];
        const den = y0 - 2 * y1 + y2;
        const off = den !== 0 ? 0.5 * (y0 - y2) / den : 0;
        bpm = Math.round(60 * fr / (bestLag + Math.max(-0.5, Math.min(0.5, off))));
      }
    }
    if (onProgress) onProgress(1);
    return { onsets, bpm };
  }

  return { analyze, build, buildAll, fromDemo, fromGrid, finalize, design, designAll, to4k, allTo4k, DIFF };
})();
