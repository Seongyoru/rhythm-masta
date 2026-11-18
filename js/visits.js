'use strict';
/* =========================================================
 * 방문자 수 (오늘 · 누적) : GoatCounter  https://www.goatcounter.com
 *
 * GC_CODE 에 GoatCounter 사이트 코드(https://<코드>.goatcounter.com 의 <코드>)를 넣으면 켜진다.
 * 비워 두면 방문을 세지도, 숫자를 보여주지도 않는다.
 * GoatCounter 사이트 설정에서 "Allow adding visitor counts on your website" 를 켜야 숫자를 읽을 수 있다.
 * 숫자는 GoatCounter 쪽에서 몇 시간 단위로 캐시되므로 바로바로 늘지 않는다.
 * ========================================================= */
(() => {
  const GC_CODE = 'sonyoru';
  if (!GC_CODE || location.protocol === 'file:') return;
  const base = `https://${GC_CODE}.goatcounter.com`;
  const PATH = '/'; // 주소 뒤에 ?... 가 붙어도 한 곳으로 센다

  // 방문 기록 (localhost 접속은 GoatCounter 가 알아서 빼고 센다)
  window.goatcounter = { path: PATH };
  const sc = document.createElement('script');
  sc.async = true;
  sc.src = 'https://gc.zgo.at/count.js';
  sc.dataset.goatcounter = `${base}/count`;
  document.head.appendChild(sc);

  // 숫자 읽기 : count 는 "1,234" 같은 문자열, 아직 기록이 없으면 404
  const read = (q) => fetch(`${base}/counter/${encodeURIComponent(PATH)}.json${q || ''}`)
    .then((r) => (r.ok ? r.json().then((j) => parseInt(String(j.count).replace(/\D/g, ''), 10) || 0)
      : r.status === 404 ? 0 : Promise.reject(new Error(String(r.status)))));
  // GoatCounter 는 같은 주소의 응답을 최대 4시간 캐시한다.
  // 결과에 영향 없는 날짜(사이트가 생기기 전 시작일 · 미래 종료일)를 10분마다 바꿔서 주소를 새로 만든다 → 10분 안팎으로 갱신
  const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const slot = Math.floor((now.getHours() * 60 + now.getMinutes()) / 10); // 0 ~ 143
  const plus = (days) => { const x = new Date(now); x.setDate(x.getDate() + days); return ymd(x); };
  const today = ymd(now), end = plus(1 + slot);
  const old = ymd(new Date(2020, 0, 1 + slot));

  Promise.all([read(`?start=${today}&end=${end}`), read(`?start=${old}&end=${end}`)]).then(([t, all]) => {
    document.querySelectorAll('[data-visits]').forEach((el) => {
      el.querySelector('[data-v=today]').textContent = t.toLocaleString();
      el.querySelector('[data-v=total]').textContent = Math.max(all, t).toLocaleString();
      el.hidden = false;
    });
  }).catch(() => { /* 못 읽으면 숨긴 채로 둔다 */ });
})();
