/*
 * Nuvori HSMM 엔진 테스트 스위트
 * 실행: node model/tests/run-tests.js
 *
 * 엔진이 IIFE 안에서 window 전역을 쓰므로 로드 전에 Node 전역을 window로 shim한다.
 * 순수 함수(computeHsmmBelief / inferCycleDaysByName / evaluateItemForOffset / updateCycleDays)의
 * 경계값·정규화·단조성을 검증한다. DOM·localStorage 의존 없음.
 */
"use strict";

// --- window shim (엔진 로드 전에 제공) ---
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}
require("../hsmm-engine.js");

var NuvoriModel = globalThis.NuvoriModel;
var computeHsmmBelief = NuvoriModel.computeHsmmBelief;
var inferCycleDaysByName = NuvoriModel.inferCycleDaysByName;
var evaluateItemForOffset = NuvoriModel.evaluateItemForOffset;
var updateCycleDays = NuvoriModel.updateCycleDays;

// --- 초소형 테스트 러너 (외부 의존 없음) ---
var passed = 0;
var failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error("  FAIL: " + msg);
  }
}

function approxEq(a, b, eps) {
  return Math.abs(a - b) <= (eps || 1e-9);
}

function describe(name, fn) {
  var beforePassed = passed;
  var beforeFailed = failed;
  console.log(name);
  fn();
  var ok = failed === beforeFailed;
  console.log("  -> " + (ok ? "OK" : "FAIL") + " (" + (passed - beforePassed) + " assertions)\n");
}

function isValidBelief(b) {
  return b && typeof b.pSurplus === "number" && typeof b.pNormal === "number" &&
    typeof b.pDepleted === "number" &&
    b.pSurplus >= 0 && b.pNormal >= 0 && b.pDepleted >= 0 &&
    b.pSurplus <= 1 && b.pNormal <= 1 && b.pDepleted <= 1 &&
    Number.isFinite(b.pSurplus + b.pNormal + b.pDepleted);
}

var EPS = 1e-9;

// 검증에 쓰는 주기 그리드 (경계값 1과 90, inferCycleDaysByName 티어 전부 포함)
var CYCLES = [1, 2, 5, 8, 10, 12, 21, 60, 90];

// ============================================================
describe("computeHsmmBelief — 경계값", function () {
  // 경과 0일: 루프 미실행 → 초기 신념 그대로 (S2=1)
  var b0 = computeHsmmBelief(0, 10);
  assert(approxEq(b0.pSurplus, 1.0, EPS), "elapsed=0 이면 pSurplus=1 (got " + b0.pSurplus + ")");
  assert(approxEq(b0.pNormal, 0.0, EPS), "elapsed=0 이면 pNormal=0");
  assert(approxEq(b0.pDepleted, 0.0, EPS), "elapsed=0 이면 pDepleted=0");

  // 음수 경과도 신념은 유효 (내부 루프는 실행 안 됨)
  var bNeg = computeHsmmBelief(-5, 10);
  assert(isValidBelief(bNeg) && approxEq(bNeg.pSurplus, 1.0, EPS), "elapsed<0 도 초기 신념 반환");

  // 주기 1일: halfCycle/remCycle 하한(1)에 걸려도 NaN/무한루프 없이 유효 신념
  for (var e = 0; e <= 30; e++) {
    var b1 = computeHsmmBelief(e, 1);
    assert(isValidBelief(b1), "cycle=1, elapsed=" + e + " 신념이 [0,1] 유한값");
    assert(approxEq(b1.pSurplus + b1.pNormal + b1.pDepleted, 1.0, EPS),
      "cycle=1, elapsed=" + e + " 벨리프 합=1");
  }
  // d=1 에는 아직 S1 질량이 없어 h10이 작동하지 않는다(bS1=0) — 소진 질량은 d=2부터 생성
  var bOne = computeHsmmBelief(2, 1);
  assert(bOne.pDepleted > 0, "cycle=1, elapsed=2 이면 pDepleted>0 (got " + bOne.pDepleted + ")");

  // 매우 긴 경과: pDepleted 가 지배적으로 커진다
  var bLong5 = computeHsmmBelief(500, 5);
  assert(bLong5.pDepleted > 0.9, "cycle=5, elapsed=500 → pDepleted>0.9 (got " + bLong5.pDepleted + ")");
  var bLong10 = computeHsmmBelief(300, 10);
  assert(bLong10.pDepleted > 0.9, "cycle=10, elapsed=300 → pDepleted>0.9 (got " + bLong10.pDepleted + ")");
  // 긴 주기에서도 3배 경과면 소진 신념이 우세
  var bLong60 = computeHsmmBelief(180, 60);
  assert(bLong60.pDepleted >= 0.5, "cycle=60, elapsed=180 → pDepleted>=0.5 (got " + bLong60.pDepleted + ")");

  // 매우 큰 주기 + 매우 긴 경과 조합도 유한·정규화
  var bBig = computeHsmmBelief(10000, 90);
  assert(isValidBelief(bBig) && approxEq(bBig.pSurplus + bBig.pNormal + bBig.pDepleted, 1.0, EPS),
    "cycle=90, elapsed=10000 신념 유효");

  // 주기 0/음수: evaluateItemForOffset 에는 Math.max(1,·) 가드가 있지만
  // computeHsmmBelief 를 직접 호출해도 halfCycle/remCycle 하한(1) 덕에 NaN 없이 동작
  var bZeroCycle = computeHsmmBelief(10, 0);
  assert(isValidBelief(bZeroCycle), "cycle=0 이어도 신념은 유한 (하한 가드)");
});

// ============================================================
describe("computeHsmmBelief — 벨리프 정규화 (합=1)", function () {
  CYCLES.forEach(function (c) {
    for (var e = 0; e <= Math.max(90, 3 * c); e++) {
      var b = computeHsmmBelief(e, c);
      assert(approxEq(b.pSurplus + b.pNormal + b.pDepleted, 1.0, EPS),
        "cycle=" + c + ", elapsed=" + e + " 벨리프 합=1 (got " +
        (b.pSurplus + b.pNormal + b.pDepleted) + ")");
    }
  });
});

// ============================================================
describe("computeHsmmBelief — 단조성 (경과↑ → pDepleted 감소 안 함)", function () {
  // 엔진 특성(변경 금지): 일 단위 엄격 단조성은 0..3×주기 구간에서 보장된다.
  // 그보다 먼 꼬리(경과 ≳ 3.4×주기, 주기 45+일)에서는 매일 재정규화의 고정점 때문에
  // 계단형 미세 감소(<~0.03)가 존재한다 — 자세한 기록은 model/PARAMETERS.md 참조.
  // 여기서는 (1) 0..3×주기 엄격 단조, (2) 꼬리의 대소 관계(3c ≤ 4c ≤ 6c)를 검증한다.
  CYCLES.concat([3, 7, 15, 30, 45]).forEach(function (c) {
    var prev = -1;
    for (var e = 0; e <= Math.max(90, 3 * c); e++) {
      var p = computeHsmmBelief(e, c).pDepleted;
      assert(p >= prev - EPS,
        "cycle=" + c + " elapsed=" + e + " pDepleted 단조 (prev=" + prev + ", cur=" + p + ")");
      prev = p;
    }
  });

  // 꼬리 대소 관계: 대략적 단조 (국소 계단은 허용, 3배수 지점끼리는 비감소)
  [45, 60, 90].forEach(function (c) {
    var p3 = computeHsmmBelief(3 * c, c).pDepleted;
    var p4 = computeHsmmBelief(4 * c, c).pDepleted;
    var p6 = computeHsmmBelief(6 * c, c).pDepleted;
    assert(p4 >= p3 - EPS, "cycle=" + c + " pDepleted(4c) >= pDepleted(3c)");
    assert(p6 >= p4 - EPS, "cycle=" + c + " pDepleted(6c) >= pDepleted(4c)");
  });
});

// ============================================================
describe("inferCycleDaysByName — 카테고리 매핑", function () {
  var cases = [
    ["시금치", 5], ["상추", 5], ["연어", 5], ["생선", 5], ["딸기", 5], ["아보카도", 5],
    ["우유", 8], ["두부", 8], ["삼겹살", 8], ["고기", 8], ["대파", 8], ["빵", 8],
    ["계란", 12], ["달걀", 12], ["사과", 12], ["양파", 12], ["감자", 12],
    ["라면", 21], ["파스타", 21], ["치즈", 21], ["커피", 21],
    ["간장", 60], ["올리브", 60], ["식용유", 60], ["소금", 60],
  ];
  cases.forEach(function (c) {
    assert(inferCycleDaysByName(c[0]) === c[1],
      "'" + c[0] + "' → " + c[1] + " (got " + inferCycleDaysByName(c[0]) + ")");
  });

  // toLowerCase 적용 확인 (한국어 키워드는 대소문자 영향이 없으므로 동일 결과)
  assert(inferCycleDaysByName("우유") === inferCycleDaysByName("우유".toUpperCase()), "toLowerCase 정상 동작");
  // 영문 전용 이름은 한국어 키워드에 매칭되지 않음 → 기본값 (기록된 동작)
  assert(inferCycleDaysByName("MILK") === 10, "영문 전용 이름('MILK') → 기본값 10 (한국어 키워드 매칭 없음)");

  // 부분 문자열 포함 (영수증 OCR 품목명)
  assert(inferCycleDaysByName("맛있는 우유 1L") === 8, "'우유' 포함 품목명 → 8");
  assert(inferCycleDaysByName("동원 참치") === 10, "미등록 품목 → 기본값 10");

  // 빈 입력/Null 안전
  assert(inferCycleDaysByName("") === 10, "빈 문자열 → 기본값 10");
  assert(inferCycleDaysByName(null) === 10, "null → 기본값 10");
  assert(inferCycleDaysByName(undefined) === 10, "undefined → 기본값 10");

  // 티어 우선순위: 짧은 주기 티어의 if가 먼저 매칭 ('생선'∈5일 티어가 '고기'∈8일 티어보다 우선)
  assert(inferCycleDaysByName("생선 고기") === 5, "티어 우선순위: 신선식(5)이 고기(8)보다 우선");

  // 반환값은 항상 양의 정수
  var samples = ["시금치", "우유", "계란", "라면", "간장", "알수없음", ""];
  samples.forEach(function (s) {
    var v = inferCycleDaysByName(s);
    assert(typeof v === "number" && v > 0 && Number.isInteger(v), "'" + s + "' → 양의 정수");
  });
});

// ============================================================
describe("evaluateItemForOffset — 경계값·isShort 판정", function () {
  function mkItem(boughtDay, cycleDays, manualNeedToBuy) {
    return { boughtDay: boughtDay, cycleDays: cycleDays, manualNeedToBuy: !!manualNeedToBuy };
  }

  // dayOffset === boughtDay → elapsed 0, isShort false (기본)
  var r0 = evaluateItemForOffset(mkItem(5, 10), 5);
  assert(r0.elapsed === 0, "구매 당일 elapsed=0");
  assert(approxEq(r0.belief.pSurplus, 1.0, EPS), "구매 당일 pSurplus=1");
  assert(r0.isShort === false, "구매 당일 isShort=false");

  // dayOffset < boughtDay → elapsed 0으로 클램프
  var rNeg = evaluateItemForOffset(mkItem(10, 10), 5);
  assert(rNeg.elapsed === 0, "dayOffset<boughtDay → elapsed 클램프 0");

  // manualNeedToBuy 우선: 경과 0이어도 isShort
  var rManual = evaluateItemForOffset(mkItem(5, 10, true), 5);
  assert(rManual.isShort === true, "manualNeedToBuy=true → isShort");

  // isShort = manualNeedToBuy || (pDepleted>=0.24) || (elapsed>=round(0.75*cycleDays))
  // 기록된 엔진 특성: 주기 1~90 전 범위에서 0.75×주기 경과 규칙이 pDepleted 0.24 도달보다
  // 항상 먼저(또는 동시에) 발화한다 (PARAMETERS.md 참조). 따라서 !isShort 구간은
  // 두 규칙 모두 미충족인 구간과 일치한다.
  // (1) 두 규칙 모두 미충족 구간: isShort=false
  var eRule = Math.round(0.75 * 10); // = 8
  for (var e = 0; e < eRule; e++) {
    var r = evaluateItemForOffset(mkItem(0, 10), e);
    assert(r.belief.pDepleted < 0.24, "전제: cycle=10, elapsed=" + e + " pDepleted<0.24");
    assert(r.isShort === false, "elapsed<8 & pDepleted<0.24 → !isShort (elapsed=" + e + ")");
  }
  // (2) 경과 규칙 경계: e=7 false → e=8 true
  assert(evaluateItemForOffset(mkItem(0, 10), 7).isShort === false, "cycle=10, elapsed=7 → !isShort");
  assert(evaluateItemForOffset(mkItem(0, 10), 8).isShort === true, "cycle=10, elapsed=8 (=round(0.75c)) → isShort");
  // (3) pDepleted>=0.24 → isShort (경과 규칙과 동시에 만족하는 구간에서 확인)
  var r10 = evaluateItemForOffset(mkItem(0, 10), 10);
  assert(r10.belief.pDepleted >= 0.24 && r10.isShort === true,
    "cycle=10, elapsed=10 → pDepleted>=0.24 & isShort (pDepleted=" + r10.belief.pDepleted.toFixed(3) + ")");

  // 경과 규칙: elapsed >= round(0.75*cycleDays) 이면 pDepleted가 낮아도 isShort
  // (cycle=60에서 pDepleted가 0.24에 못 미치는 구간이 존재 → 이 규칙이 담당)
  var rBelow = evaluateItemForOffset(mkItem(0, 60), 44);
  assert(rBelow.belief.pDepleted < 0.24, "cycle=60, elapsed=44 아직 pDepleted<0.24 (전제 확인)");
  var r60 = evaluateItemForOffset(mkItem(0, 60), 45); // round(0.75*60)=45
  assert(r60.elapsed === 45, "elapsed=45 (round(0.75*cycle))");
  assert(r60.isShort === true, "elapsed>=round(0.75*cycle) → isShort (pDepleted=" +
    r60.belief.pDepleted.toFixed(3) + ")");

  // cycleDays=1 경계
  var r1 = evaluateItemForOffset(mkItem(0, 1), 1);
  assert(r1.elapsed === 1 && r1.isShort === true, "cycle=1, 1일 경과 → isShort");

  // 매우 긴 경과 → pDepleted 지배, isShort
  var rLong = evaluateItemForOffset(mkItem(0, 10), 400);
  assert(rLong.belief.pDepleted > 0.9 && rLong.isShort === true, "400일 경과 → 소진 isShort");

  // 결과 구조: 항상 elapsed/belief/isShort 키
  var keys = Object.keys(r0).sort().join(",");
  assert(keys === "belief,elapsed,isShort", "반환 키 = elapsed/belief/isShort (got " + keys + ")");
});

// ============================================================
describe("updateCycleDays — Empirical Bayes 블렌드", function () {
  // 기본 블렌드: 0.7*prev + 0.3*interval
  assert(updateCycleDays(10, 20) === 13, "0.7*10+0.3*20 = 13 (got " + updateCycleDays(10, 20) + ")");
  assert(approxEq(updateCycleDays(30, 30), 30, EPS), "prev==interval → 값 유지");
  assert(approxEq(updateCycleDays(10, 2), 7.6, EPS), "하한 경계 간격 2 → 블렌드 0.7*10+0.3*2=7.6");
  assert(approxEq(updateCycleDays(10, 90), 34, EPS), "상한 경계 간격 90 → 블렌드 0.7*10+0.3*90=34");

  // 결과는 prev와 interval 사이 (유효 구간 안에서만)
  assert(updateCycleDays(10, 20) > 10 && updateCycleDays(10, 20) < 20, "블렌드 결과는 두 값 사이");
  assert(updateCycleDays(20, 10) > 10 && updateCycleDays(20, 10) < 20, "prev>interval 도 두 값 사이");

  // 유효 구간 가드: 간격 2~90 밖 → prev 그대로
  assert(updateCycleDays(10, 1) === 10, "간격 1일 → prev 그대로");
  assert(updateCycleDays(10, 0) === 10, "간격 0일 → prev 그대로");
  assert(updateCycleDays(10, -7) === 10, "음수 간격 → prev 그대로");
  assert(updateCycleDays(10, 91) === 10, "간격 91일 → prev 그대로");
  assert(updateCycleDays(10, 365) === 10, "간격 365일 → prev 그대로");
  assert(updateCycleDays(10, NaN) === 10, "NaN 간격 → prev 그대로");

  // prev 클램프: 최소 2 (블렌드에도, 가드 반환에도 적용)
  assert(approxEq(updateCycleDays(0, 10), 4.4, EPS), "prev=0 → 클램프 2 후 블렌드 0.7*2+0.3*10=4.4");
  assert(approxEq(updateCycleDays(-5, 30), 10.4, EPS), "prev=-5 → 클램프 2 후 블렌드 0.7*2+0.3*30=10.4");
  assert(updateCycleDays(1, 100) === 2, "prev=1 & 무효 간격(100) → 클램프 2 반환");
  assert(updateCycleDays(0, NaN) === 2, "prev=0 & NaN 간격 → 클램프 2 반환");
  assert(updateCycleDays(2, 50) === 2 || updateCycleDays(2, 50) > 2, "prev=2 (경계) 정상 동작");

  // 순수성: 동일 입력 → 동일 출력
  assert(updateCycleDays(10, 20) === updateCycleDays(10, 20), "순수 함수 (동일 입력 동일 출력)");

  // 반복 갱신의 방향성: 관측 interval 쪽으로 수렴
  var cyc = 60;
  for (var i = 0; i < 5; i++) cyc = updateCycleDays(cyc, 10);
  assert(cyc < 60, "10일 간격 관측 반복 → 주기 감소 방향 (got " + cyc + ")");

  var cyc2 = 5;
  for (var j = 0; j < 5; j++) cyc2 = updateCycleDays(cyc2, 40);
  assert(cyc2 > 5, "40일 간격 관측 반복 → 주기 증가 방향 (got " + cyc2 + ")");
});

// ============================================================
describe("전역 노출 호환", function () {
  assert(typeof globalThis.NuvoriModel === "object", "window.NuvoriModel 네임스페이스 노출");
  assert(typeof globalThis.computeHsmmBelief === "function", "bare 전역 computeHsmmBelief 노출");
  assert(typeof globalThis.inferCycleDaysByName === "function", "bare 전역 inferCycleDaysByName 노출");
  assert(typeof globalThis.updateCycleDays === "function", "bare 전역 updateCycleDays 노출");
  assert(globalThis.NuvoriModel.updateCycleDays === updateCycleDays, "네임스페이스와 동일 참조");
});

// ============================================================
console.log("========================================");
console.log("총 " + (passed + failed) + " assertions — 통과 " + passed + ", 실패 " + failed);
if (failed > 0) {
  console.log("RESULT: FAIL");
  process.exit(1);
} else {
  console.log("RESULT: PASS");
}
