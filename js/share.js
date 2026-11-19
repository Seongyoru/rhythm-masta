'use strict';
/* =========================================================
 * 결과 공유 : 결과 카드 이미지를 그리고, 기기 공유(카톡 · 라인 · 인스타 등) / X / LINE / 저장 / 링크 복사
 * ========================================================= */
const ShareCard = (() => {
  const SITE_URL = 'https://seongyoru.github.io/rhythm-masta/';
  const W = 1200, H = 675, SCALE = 2;
  const FD = 'Fredoka, Jua, "Segoe UI", sans-serif';
  const FR = 'Jua, "Noto Sans KR", "Malgun Gothic", sans-serif';
  const FK = '"Noto Sans KR", "Malgun Gothic", sans-serif';
  const INK = '#3b3358', INK2 = '#6e6790', MUTED = '#9a93b8';
  const JCOL = { PERFECT: '#4fb8ff', GREAT: '#4cc85e', GOOD: '#ffae2e', MISS: '#a39bbf' };
  const RAINBOW = ['#ff86c2', '#ff8f7a', '#ffd23f', '#6fd34f', '#6cc4ff', '#b896ff'];
  const APPLE = new Path2D('M32 18c-6-5-20-5-24 8-4 14 6 32 16 32 4 0 5-2 8-2s4 2 8 2c10 0 20-18 16-32-4-13-18-13-24-8z');
  const STEM = new Path2D('M32 19c0-6 2-11 6-14');
  const LEAF = new Path2D('M36 12c4-7 13-8 17-5-3 6-11 9-17 5z');

  const $ = (s) => document.querySelector(s);
  let cur = null; // { r, blob, url, text }
  let isOpen = false;

  /* ---------- 그리기 도구 ---------- */
  const mix = (hex, t, to = '#ffffff') => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const a = p(hex), b = p(to);
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
  };
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const spaced = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };
  const rainbow = (ctx, x0, x1) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    RAINBOW.forEach((c, i) => g.addColorStop(i / (RAINBOW.length - 1), c));
    return g;
  };
  function apple(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(size / 64, size / 64);
    const g = ctx.createLinearGradient(13, 0, 51, 64);
    g.addColorStop(0, '#e4fb7a'); g.addColorStop(0.45, '#a6e23c'); g.addColorStop(1, '#5fb52a');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke(APPLE);
    ctx.fillStyle = g; ctx.fill(APPLE);
    ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.stroke(STEM);
    ctx.fillStyle = '#2f8f2c'; ctx.fill(LEAF);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(LEAF);
    ctx.translate(20, 30); ctx.rotate(25 * Math.PI / 180);
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function pill(ctx, x, y, text, fill, { size = 18, padX = 16, h = 36, align = 'left' } = {}) {
    ctx.font = `700 ${size}px ${FD}`; spaced(ctx, 2);
    const w = ctx.measureText(text).width + padX * 2;
    const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.08)'; rr(ctx, left, y + 3, w, h, h / 2); ctx.fill();
    ctx.fillStyle = typeof fill === 'function' ? fill(left, left + w) : fill;
    rr(ctx, left, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillText(text, left + w / 2, y + h / 2 + 1);
    ctx.restore();
    return w;
  }
  // 제목 : 한 줄에 안 들어가면 글자를 줄이고, 그래도 넘치면 두 줄 (넘치면 …)
  // 일본어(가나 · 한자)가 섞인 제목은 Jua 에 글자가 없어 섞여 보이므로 Noto Sans KR 굵은 글꼴로 통일
  const titleFont = (title, s) => (/[぀-ヿ㐀-鿿ｦ-ﾟ]/.test(title) ? `700 ${s}px ${FK}` : `${s}px ${FR}`);
  function fitTitle(ctx, title, maxW) {
    for (let s = 60; s >= 42; s -= 2) {
      ctx.font = titleFont(title, s);
      if (ctx.measureText(title).width <= maxW) return { size: s, lines: [title] };
    }
    const s = 40; ctx.font = titleFont(title, s);
    const chars = [...title];
    let a = '', i = 0;
    while (i < chars.length && ctx.measureText(a + chars[i]).width <= maxW) a += chars[i++];
    const cut = a.lastIndexOf(' ');
    if (cut > a.length * 0.5) { i -= a.length - cut - 1; a = a.slice(0, cut); }
    let b = chars.slice(i).join('').trim();
    if (ctx.measureText(b).width > maxW) {
      while (b && ctx.measureText(`${b}…`).width > maxW) b = b.slice(0, -1);
      b += '…';
    }
    return { size: s, lines: [a.trim(), b] };
  }

  /* ---------- 결과 카드 ---------- */
  async function draw(r) {
    const title = r.song.title;
    await Promise.race([
      Promise.all([
        document.fonts.load(`700 40px Fredoka`, 'RHYTHM MASTA 0123456789%'),
        document.fonts.load(`600 40px Fredoka`, 'SCORE'),
        document.fonts.load(`40px Jua`, title),
        document.fonts.load(`700 40px "Noto Sans KR"`, title),
        document.fonts.load(`500 40px "Noto Sans KR"`, T('비공식 팬메이드')),
      ]).catch(() => {}),
      new Promise((res) => setTimeout(res, 2500)),
    ]);

    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    const ctx = cv.getContext('2d');
    ctx.scale(SCALE, SCALE);

    // 배경 : 파스텔 그라데이션 + 둥실 떠 있는 색 방울
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#fff1f8'); bg.addColorStop(0.5, '#f1ecff'); bg.addColorStop(1, '#e7f9de');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    [[90, 60, 340, '#ff86c2', 0.28], [1130, 70, 300, '#b896ff', 0.3], [1120, 650, 380, '#6fd34f', 0.3], [260, 690, 300, '#ffd23f', 0.22]]
      .forEach(([x, y, rad, c, a]) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, c); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });
    ctx.globalAlpha = 1;
    // 흩어진 노트 조각
    [[22, 120, 0], [1168, 250, 1], [1150, 420, 2], [30, 330, 3], [60, 520, 4], [1172, 560, 5], [520, 18, 1], [760, 652, 3]]
      .forEach(([x, y, c], i) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate((i % 2 ? 1 : -1) * 0.35);
        ctx.globalAlpha = 0.45; ctx.fillStyle = RAINBOW[c];
        rr(ctx, -18, -7, 36, 14, 7); ctx.fill(); ctx.restore();
      });

    // 카드
    const cx = 40, cy = 36, cw = W - 80, ch = H - 84;
    ctx.fillStyle = '#ece4ff'; rr(ctx, cx, cy + 10, cw, ch, 44); ctx.fill();
    ctx.save();
    ctx.shadowColor = 'rgba(120, 90, 200, .22)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
    ctx.fillStyle = 'rgba(255,255,255,.94)'; rr(ctx, cx, cy, cw, ch, 44); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; rr(ctx, cx, cy, cw, ch, 44); ctx.stroke();
    // 위쪽 무지개 띠
    ctx.save(); rr(ctx, cx, cy, cw, ch, 44); ctx.clip();
    ctx.fillStyle = rainbow(ctx, cx, cx + cw); ctx.fillRect(cx, cy, cw, 7);
    ctx.restore();

    const L = 92, R = cx + cw - 52;
    ctx.textBaseline = 'alphabetic';

    // 머리 : 사과 + 로고 / 날짜
    apple(ctx, L - 4, 62, 46);
    ctx.fillStyle = INK; ctx.font = `700 28px ${FD}`; spaced(ctx, 3); ctx.textAlign = 'left';
    ctx.fillText('RHYTHM MASTA', L + 52, 98);

    // 난이도 + 제목
    const lv = r.song.charts && r.song.charts[r.diff] ? r.song.charts[r.diff].level : '';
    pill(ctx, L, 132, `${r.keys === '4k' ? '4K' : '7K'}  ${r.diff}${lv !== '' ? `  LV.${lv}` : ''}`, r.diffColor || '#3fa2ff', { size: 17, h: 34 });
    const ft = fitTitle(ctx, title, 590);
    ctx.fillStyle = INK; ctx.font = titleFont(title, ft.size); spaced(ctx, 0);
    if (ft.lines.length === 1) ctx.fillText(ft.lines[0], L, 232);
    else { ctx.fillText(ft.lines[0], L, 214); ctx.fillText(ft.lines[1], L, 260); }

    // 점수
    ctx.fillStyle = MUTED; ctx.font = `600 17px ${FD}`; spaced(ctx, 5);
    ctx.fillText('SCORE', L, 318);
    ctx.fillStyle = INK; ctx.font = `700 100px ${FD}`; spaced(ctx, 4);
    ctx.fillText(String(r.score).padStart(7, '0'), L - 4, 412);

    // 정확도 · 최대 콤보
    const stat = (x, label, val) => {
      ctx.fillStyle = MUTED; ctx.font = `600 15px ${FD}`; spaced(ctx, 4); ctx.fillText(label, x, 458);
      ctx.fillStyle = INK; ctx.font = `700 34px ${FD}`; spaced(ctx, 1); ctx.fillText(val, x, 498);
    };
    stat(L, 'ACCURACY', `${r.acc.toFixed(2)}%`);
    stat(L + 220, 'MAX COMBO', `${r.maxCombo} / ${r.total}`);

    // 랭크 : 원 + 큰 글자
    const rc = r.rankColor || '#b896ff', rx = 890, ry = 232, rad = 112;
    ctx.save();
    const halo = ctx.createRadialGradient(rx, ry, rad * 0.4, rx, ry, rad * 1.5);
    halo.addColorStop(0, mix(rc, 0.55)); halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.5; ctx.fillStyle = halo; ctx.fillRect(rx - rad * 1.6, ry - rad * 1.6, rad * 3.2, rad * 3.2);
    ctx.globalAlpha = 1;
    const disc = ctx.createLinearGradient(0, ry - rad, 0, ry + rad);
    disc.addColorStop(0, '#ffffff'); disc.addColorStop(1, mix(rc, 0.82));
    ctx.fillStyle = disc; ctx.beginPath(); ctx.arc(rx, ry, rad, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 6; ctx.strokeStyle = r.rank === 'SS' ? rainbow(ctx, rx - rad, rx + rad) : mix(rc, 0.35);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `700 ${r.rank.length > 1 ? 128 : 160}px ${FD}`; spaced(ctx, 0);
    ctx.fillStyle = mix(rc, 0.45);
    ctx.fillText(r.rank, rx, ry + 16);
    const tg = r.rank === 'SS' ? rainbow(ctx, rx - 90, rx + 90) : ctx.createLinearGradient(0, ry - 70, 0, ry + 70);
    if (r.rank !== 'SS') { tg.addColorStop(0, mix(rc, 0.4)); tg.addColorStop(1, rc); }
    ctx.fillStyle = tg; ctx.fillText(r.rank, rx, ry + 8);
    ctx.restore();
    ctx.fillStyle = MUTED; ctx.font = `600 15px ${FD}`; spaced(ctx, 6); ctx.textAlign = 'center';
    ctx.fillText('RANK', rx + 3, ry - rad - 14);

    // 배지
    const badges = [];
    if (r.ap) badges.push(['ALL PERFECT', (a, b) => rainbow(ctx, a, b)]);
    else if (r.fc) badges.push(['FULL COMBO', (a, b) => { const g = ctx.createLinearGradient(a, 0, b, 0); g.addColorStop(0, '#ffc23f'); g.addColorStop(1, '#ff9d3f'); return g; }]);
    if (r.newRecord) badges.push(['NEW RECORD', '#ff86c2']);
    if (badges.length) {
      ctx.font = `700 15px ${FD}`; spaced(ctx, 2);
      const ws = badges.map(([t]) => ctx.measureText(t).width + 28);
      let x = rx - (ws.reduce((a, b) => a + b, 0) + (badges.length - 1) * 10) / 2;
      badges.forEach(([t, f], i) => { pill(ctx, x, ry + rad + 18, t, f, { size: 15, padX: 14, h: 32 }); x += ws[i] + 10; });
    }

    // 판정
    const jx = 745, jw = R - jx, jy0 = badges.length ? 420 : 404;
    ['PERFECT', 'GREAT', 'GOOD', 'MISS'].forEach((k, i) => {
      const y = jy0 + i * 34;
      const n = r.counts[k] || 0;
      ctx.textAlign = 'left'; ctx.fillStyle = JCOL[k]; ctx.font = `700 15px ${FD}`; spaced(ctx, 2);
      ctx.fillText(k, jx, y + 5);
      const bx = jx + 104, bw = jw - 104 - 64;
      ctx.fillStyle = '#f1edfb'; rr(ctx, bx, y - 6, bw, 12, 6); ctx.fill();
      const fw = r.total ? Math.max(n ? 12 : 0, bw * n / r.total) : 0;
      if (fw) { ctx.fillStyle = JCOL[k]; rr(ctx, bx, y - 6, fw, 12, 6); ctx.fill(); }
      ctx.textAlign = 'right'; ctx.fillStyle = INK; ctx.font = `700 19px ${FD}`; spaced(ctx, 1);
      ctx.fillText(String(n), R, y + 7);
    });

    // 바닥 : 주소 · 비공식 안내
    ctx.strokeStyle = 'rgba(120, 100, 190, .14)'; ctx.lineWidth = 2; ctx.setLineDash([2, 8]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(L, 548); ctx.lineTo(R, 548); ctx.stroke(); ctx.setLineDash([]);
    ctx.textAlign = 'left'; ctx.fillStyle = INK2; ctx.font = `600 19px ${FD}`; spaced(ctx, 1);
    ctx.fillText('seongyoru.github.io/rhythm-masta', L, 590);
    const d = new Date();
    const url = ctx.measureText('seongyoru.github.io/rhythm-masta').width;
    ctx.fillStyle = MUTED; ctx.font = `600 16px ${FD}`; spaced(ctx, 2);
    ctx.fillText(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`, L + url + 22, 589);
    ctx.textAlign = 'right'; ctx.fillStyle = MUTED; ctx.font = `500 14px ${FK}`; spaced(ctx, 0);
    ctx.fillText(`${T('비공식 팬메이드')} · Mrs. GREEN APPLE`, R, 588);

    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }

  /* ---------- 공유 글 ---------- */
  function shareText(r) {
    const lv = r.song.charts && r.song.charts[r.diff] ? r.song.charts[r.diff].level : '';
    const badge = r.ap ? ' · ALL PERFECT' : r.fc ? ' · FULL COMBO' : '';
    return T('🍏 RHYTHM MASTA 에서 「{title}」 {diff} LV.{lv} 플레이!', { title: r.song.title, diff: `${r.keys === '4k' ? '4K' : '7K'} ${r.diff}`, lv })
      + `\nRANK ${r.rank} · SCORE ${String(r.score).padStart(7, '0')} · ${r.acc.toFixed(2)}%${badge}\n#RHYTHMMASTA`;
  }
  const fileOf = () => new File([cur.blob], `rhythm-masta-${Date.now()}.png`, { type: 'image/png' });
  const canShareFile = () => {
    try { return !!(cur && cur.blob && navigator.canShare && navigator.canShare({ files: [fileOf()] })); } catch (e) { return false; }
  };
  function tip(msg) {
    const el = $('#shareTip');
    el.textContent = msg;
  }

  /* ---------- 창 ---------- */
  async function open(r) {
    if (cur && cur.url) URL.revokeObjectURL(cur.url);
    cur = { r, blob: null, url: '', text: shareText(r) };
    isOpen = true;
    $('#shareModal').classList.add('show');
    $('#shareImg').hidden = true;
    $('#shareWait').hidden = false;
    $('#shareNative').hidden = true;
    tip(T('X · LINE 으로 보낼 때 이미지는 저장한 뒤 직접 첨부해 주세요'));
    const mine = cur;
    try {
      const blob = await draw(r);
      if (mine !== cur) return;
      cur.blob = blob;
      cur.url = URL.createObjectURL(blob);
      $('#shareImg').src = cur.url;
      $('#shareImg').hidden = false;
      $('#shareWait').hidden = true;
      if (canShareFile()) {
        $('#shareNative').hidden = false;
        tip(T('「공유하기」로 카카오톡 · LINE · 인스타 등에 이미지째 보낼 수 있어요'));
      }
    } catch (e) {
      $('#shareWait').textContent = T('이미지를 만들지 못했어요');
    }
  }
  function close() {
    isOpen = false;
    $('#shareModal').classList.remove('show');
  }
  async function native() {
    if (!canShareFile()) return;
    try {
      await navigator.share({ files: [fileOf()], text: `${cur.text}\n${SITE_URL}` });
    } catch (e) { /* 취소 */ }
  }
  function toX() {
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(cur.text)}&url=${encodeURIComponent(SITE_URL)}`, '_blank', 'noopener');
  }
  function toLine() {
    window.open(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(SITE_URL)}&text=${encodeURIComponent(cur.text)}`, '_blank', 'noopener');
  }
  function save() {
    if (!cur || !cur.url) return;
    const a = document.createElement('a');
    a.href = cur.url; a.download = `rhythm-masta-${(cur.r.song.title || 'result').replace(/[\\/:*?"<>|]/g, '')}.png`;
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function copy() {
    const s = `${cur.text}\n${SITE_URL}`;
    try { await navigator.clipboard.writeText(s); tip(T('공유 글과 링크를 복사했어요')); } catch (e) { tip(SITE_URL); }
  }

  const bind = () => {
    $('#shareNative').addEventListener('click', native);
    $('#shareX').addEventListener('click', toX);
    $('#shareLine').addEventListener('click', toLine);
    $('#shareSave').addEventListener('click', save);
    $('#shareCopy').addEventListener('click', copy);
    $('#shareClose').addEventListener('click', close);
    $('#shareModal').addEventListener('click', (e) => { if (e.target.id === 'shareModal') close(); });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();

  return { open, close, get isOpen() { return isOpen; }, draw };
})();
