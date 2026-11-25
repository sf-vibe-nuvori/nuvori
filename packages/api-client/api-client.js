/*
 * Nuvori 공유 API 클라이언트 (web / mobile 공용)
 * contracts/ 스키마를 구현으로 옮긴 유일한 fetch 래퍼.
 * contracts/*.schema.json이 변경되면 이 파일과 호출부를 함께 갱신해야 한다.
 */
(function () {
  "use strict";

  var FUNCTION_BASE = "/.netlify/functions";

  function postJson(functionName, payload) {
    return fetch(FUNCTION_BASE + "/" + functionName, {
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

  window.NuvoriAPI = {
    parseReceipt: parseReceipt,
    chatAdvisor: chatAdvisor
  };
})();
