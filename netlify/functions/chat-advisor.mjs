export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server missing GEMINI_API_KEY environment variable" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { message = "", dayOffset = 0, inventorySummary = [], receiptHistory = [], makeableRecipes = [], nearMissRecipes = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    function safeStringify(value, fallback) {
      try {
        const text = JSON.stringify(value);
        return text === undefined ? fallback : text;
      } catch (_) {
        return fallback;
      }
    }

    // Cap payload: last 5 receipts, at most 15 items each (name + price only)
    const trimmedHistory = (Array.isArray(receiptHistory) ? receiptHistory : [])
      .slice(0, 5)
      .map(function (r) {
        const items = (Array.isArray(r && r.items) ? r.items : [])
          .slice(0, 15)
          .map(function (it) {
            return { name: String((it && it.name) || ""), price: Number((it && it.price) || 0) };
          });
        return {
          storeName: String((r && r.storeName) || ""),
          purchaseDate: String((r && r.purchaseDate) || ""),
          items: items
        };
      });

    const historyBlock =
      trimmedHistory.length > 0
        ? "사용자의 최근 영수증 구매 이력 (최신순):\n" +
          safeStringify(trimmedHistory, "[]") +
          "\n이 이력에서 같은 품목의 반복 구매 간격(예: 우유를 7일 간격으로 반복 구매)이 보이면 그 주기를 근거로 삼아, " +
          "이번에 다시 사야 할 품목과 아직 집에 남아 있을 품목을 더 정확히 판단하세요. 매장별로 자주 가는 곳이 있다면 언급해도 좋습니다.\n\n"
        : "";

    function sanitizeStringList(value, maxCount) {
      return (Array.isArray(value) ? value : [])
        .filter(function (x) { return typeof x === "string" && x.length > 0; })
        .slice(0, maxCount);
    }

    const trimmedMakeable = sanitizeStringList(makeableRecipes, 8);
    const trimmedNearMiss = sanitizeStringList(nearMissRecipes, 5);

    const recipeBlock =
      trimmedMakeable.length > 0 || trimmedNearMiss.length > 0
        ? "집에 있는 재료로 지금 만들 수 있는 요리: " +
          (trimmedMakeable.length > 0 ? trimmedMakeable.join(", ") : "없음") +
          "\n재료가 1~2개 부족한 요리: " +
          (trimmedNearMiss.length > 0 ? trimmedNearMiss.join(", ") : "없음") +
          "\n요리·레시피 관련 질문이면 이 목록의 요리를 우선 추천하고, 남은 재료를 활용해 음식 낭비를 줄이는 조언으로 연결하세요.\n\n"
        : "";

    const promptText =
      "당신은 Nuvori AI 스마트 장보기 어드바이저입니다.\n" +
      "현재 기준 시점: 장본 지 +" + Number(dayOffset || 0) + "일 경과\n" +
      "현재 가구 인벤토리 및 3-State HSMM 소진 예측 상태:\n" +
      safeStringify(inventorySummary, "[]") + "\n\n" +
      historyBlock +
      recipeBlock +
      "사용자 질문: \"" + message.slice(0, 300) + "\"\n\n" +
      "위 인벤토리 상태(사야 할 품목 isShort=true vs 아직 집에 있는 품목 isShort=false, 경과일 elapsed, 고갈확률 pDepleted)" +
      (trimmedHistory.length > 0 ? "와 구매 이력의 반복 구매 패턴" : "") +
      "을 바탕으로 " +
      "핵심 답변과 음식 낭비를 줄이는 실용적인 팁(예: 집에 남은 재료 소진법 또는 과잉구매 방지 조언)을 2~3문장의 자연스럽고 친절한 한국어로 답해주세요.";

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.5-flash-lite"];
    let lastStatus = 502;
    let lastErrorText = "";

    for (const modelName of models) {
      const geminiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/" +
        modelName +
        ":generateContent?key=" +
        encodeURIComponent(apiKey);

      const geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                reply: { type: "STRING" }
              },
              required: ["reply"]
            }
          }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        return new Response(rawText, {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        lastStatus = geminiRes.status;
        try {
          const errJson = await geminiRes.json();
          lastErrorText = errJson?.error?.message || ("HTTP " + geminiRes.status);
        } catch (_) {
          lastErrorText = "HTTP " + geminiRes.status;
        }
      }
    }

    return new Response(
      JSON.stringify({
        error: "Gemini upstream error",
        upstreamStatus: lastStatus,
        detail: lastErrorText
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" }
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
