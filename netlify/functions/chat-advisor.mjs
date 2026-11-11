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
    const { message = "", dayOffset = 0, inventorySummary = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Missing message" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const promptText =
      "당신은 Nuvori AI 스마트 장보기 어드바이저입니다.\n" +
      "현재 기준 시점: 장본 지 +" + Number(dayOffset || 0) + "일 경과\n" +
      "현재 가구 인벤토리 및 3-State HSMM 소진 예측 상태:\n" +
      JSON.stringify(inventorySummary) + "\n\n" +
      "사용자 질문: \"" + message.slice(0, 300) + "\"\n\n" +
      "위 인벤토리 상태(사야 할 품목 isShort=true vs 아직 집에 있는 품목 isShort=false, 경과일 elapsed, 고갈확률 pDepleted)를 바탕으로 " +
      "핵심 답변과 음식 낭비를 줄이는 실용적인 팁(예: 집에 남은 재료 소진법 또는 과잉구매 방지 조언)을 2~3문장의 자연스럽고 친절한 한국어로 답해주세요.";

    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
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

    if (!geminiRes.ok) {
      return new Response(JSON.stringify({ error: "Gemini upstream error" }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    return new Response(rawText, {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
