/*
 * Nuvori 3-State Hierarchical HSMM 소진 예측 엔진
 * (model/ 디렉토리의 정규 구현 — web/index.html과 simulation/hhmm_pomdp_simulation.py가 함께 참조하는 형식 유지)
 *
 * 상태 정의:
 *   S2 (Surplus/여유) → S1 (Normal/보통) → S0 (Depleted/소진)
 * 경과일(elapsedDays)과 품목별 소비주기(cycleDays)로 벨리프를 전파하고
 * 소진 확률 pDepleted를 반환한다. 순수 함수만 포함 (DOM/상태 의존 없음).
 */
(function () {
  "use strict";

  function computeHsmmBelief(elapsedDays, cycleDays) {
    var bS2 = 1.0;
    var bS1 = 0.0;
    var bS0 = 0.0;

    var halfCycle = Math.max(1.0, cycleDays * 0.45);
    var remCycle = Math.max(1.0, cycleDays * 0.55);

    for (var d = 1; d <= elapsedDays; d++) {
      var h21 = Math.min(0.85, Math.max(0.05, (1.0 / halfCycle) * (1.0 + 0.35 * (d / halfCycle))));
      var h10 = Math.min(0.90, Math.max(0.04, (1.0 / remCycle) * Math.pow(Math.max(0.2, d / cycleDays), 1.6)));

      var nextS2 = bS2 * (1.0 - h21);
      var nextS1 = bS1 * (1.0 - h10) + bS2 * h21;
      var nextS0 = bS0 + bS1 * h10;

      var l2 = nextS2 * 0.98;
      var l1 = nextS1 * 0.98;
      var l0 = nextS0 * 0.72;
      var norm = l2 + l1 + l0;
      if (norm > 0) {
        bS2 = l2 / norm;
        bS1 = l1 / norm;
        bS0 = l0 / norm;
      }
    }
    return { pSurplus: bS2, pNormal: bS1, pDepleted: bS0 };
  }

  function inferCycleDaysByName(name) {
    var s = String(name || "").toLowerCase();
    if (s.indexOf("시금치") !== -1 || s.indexOf("상추") !== -1 || s.indexOf("연어") !== -1 || s.indexOf("생선") !== -1 || s.indexOf("딸기") !== -1 || s.indexOf("아보카도") !== -1) return 5;
    if (s.indexOf("우유") !== -1 || s.indexOf("두부") !== -1 || s.indexOf("삼겹살") !== -1 || s.indexOf("고기") !== -1 || s.indexOf("대파") !== -1 || s.indexOf("빵") !== -1) return 8;
    if (s.indexOf("계란") !== -1 || s.indexOf("달걀") !== -1 || s.indexOf("사과") !== -1 || s.indexOf("양파") !== -1 || s.indexOf("감자") !== -1) return 12;
    if (s.indexOf("라면") !== -1 || s.indexOf("파스타") !== -1 || s.indexOf("치즈") !== -1 || s.indexOf("커피") !== -1) return 21;
    if (s.indexOf("간장") !== -1 || s.indexOf("올리브") !== -1 || s.indexOf("식용유") !== -1 || s.indexOf("소금") !== -1) return 60;
    return 10;
  }

  // 순수 평가 함수: 앱 상태(state) 대신 dayOffset를 인자로 받는다.
  function evaluateItemForOffset(item, dayOffset) {
    var elapsed = Math.max(0, dayOffset - item.boughtDay);
    var belief = computeHsmmBelief(elapsed, Math.max(1, item.cycleDays));
    var isShort = Boolean(item.manualNeedToBuy) ||
      (belief.pDepleted >= 0.24) ||
      (elapsed >= Math.round(item.cycleDays * 0.75));
    return {
      elapsed: elapsed,
      belief: belief,
      isShort: isShort
    };
  }

  // web/index.html 인라인 스크립트와 packages/api-client가 함께 쓸 수 있도록 전역 노출
  // (기존 호출부의 직접 참조(computeHsmmBelief/inferCycleDaysByName) 호환용 bare 전역 + 네임스페이스)
  window.NuvoriModel = {
    computeHsmmBelief: computeHsmmBelief,
    inferCycleDaysByName: inferCycleDaysByName,
    evaluateItemForOffset: evaluateItemForOffset
  };
  window.computeHsmmBelief = computeHsmmBelief;
  window.inferCycleDaysByName = inferCycleDaysByName;
})();
