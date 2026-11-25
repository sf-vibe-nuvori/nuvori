/*
 * Nuvori 모바일 API 클라이언트 (RN 어댑터)
 * 원본: packages/api-client/api-client.js (window.NuvoriAPI, 상대경로 fetch)
 * 차이점:
 *   1. RN에는 window 전역 노출 대신 ES 모듈 export를 사용한다.
 *   2. RN에는 상대경로 "/.netlify/functions"를 쓸 수 없으므로 절대 URL 베이스를 사용한다.
 * 함수 시그니처와 요청/응답 필드는 원본·계약(contracts/*.schema.json)과 동일하게 유지한다.
 * 계약이 변경되면 packages/api-client/api-client.js가 먼저 갱신되고 이 파일이 그 뒤를 따른다.
 */

// 프로덕션 Netlify 배포 URL. 로컬 개발 시 에뮬레이터에서 localhost 함수를 쓰려면
// global.NUVORI_API_BASE = "http://localhost:9999/.netlify/functions" 로 덮어쓴다.
var DEFAULT_BASE = "https://nuvori.netlify.app/.netlify/functions";

function functionBase() {
  return (typeof global !== "undefined" && global.NUVORI_API_BASE) || DEFAULT_BASE;
}

function postJson(functionName, payload) {
  return fetch(functionBase() + "/" + functionName, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(function (res) {
    return res.json().then(function (body) {
      if (!res.ok) {
        throw new Error((body && (body.detail || body.error)) || ("HTTP " + res.status));
      }
      return body;
    });
  });
}

// 영수증 OCR — contracts/receipt-ocr.schema.json 준수
function parseReceipt(input) {
  return postJson("parse-receipt", {
    imageBase64: input.imageBase64,
    mimeType: input.mimeType || "image/jpeg",
    existingNames: input.existingNames || [],
    todayIso: input.todayIso || ""
  });
}

// AI 장보기/요리 어드바이저 — contracts/chat-advisor.schema.json 준수
function chatAdvisor(input) {
  return postJson("chat-advisor", {
    message: input.message,
    dayOffset: input.dayOffset || 0,
    inventorySummary: input.inventorySummary || [],
    receiptHistory: input.receiptHistory || [],
    makeableRecipes: input.makeableRecipes || [],
    nearMissRecipes: input.nearMissRecipes || []
  });
}

export { parseReceipt, chatAdvisor };
