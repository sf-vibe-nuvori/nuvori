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
    const { imageBase64, existingNames = [], todayIso = "" } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Missing imageBase64" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const promptText =
      "이 마트 영수증 사진에서 다음 정보를 정확히 추출해 주세요:\n" +
      "1. storeName: 영수증에 찍힌 상점/마트 이름 (예: Trader Joe's, H-Mart, Costco, Whole Foods 등, 식별 불가 시 '마트')\n" +
      "2. purchaseDate: 영수증에 찍힌 구매일자 YYYY-MM-DD 형식 (식별 불가 시 오늘 날짜 '" + (todayIso || "2026-11-11") + "')\n" +
      "3. items: 구매한 식료품/생필품 목록. 영수증 약어는 이해하기 쉬운 한국어 품목명으로 정규화하고, 기존 인벤토리 품목(" +
      existingNames.join(", ") +
      ")과 동일한 식품이면 기존 이름을 그대로 사용하세요. 각 품목의 단가/금액(price, 달러 숫자 기준, 원화 영수증이면 1350으로 나눈 달러 환산값), 수량(quantity, 기본 1), 일반적인 가정 소비주기 일수(cycleDays: 잎채소/생선 4~5일, 우유/두부/계란 7~10일, 라면/파스타 21일, 양념/오일 60일)를 함께 포함하세요.";

    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey);

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              storeName: { type: "STRING" },
              purchaseDate: { type: "STRING" },
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    price: { type: "NUMBER" },
                    quantity: { type: "INTEGER" },
                    cycleDays: { type: "INTEGER" }
                  },
                  required: ["name", "price", "cycleDays"]
                }
              }
            },
            required: ["storeName", "purchaseDate", "items"]
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
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

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
