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
      "이 이미지를 분석하여 식료품(그로서리) 영수증인지 먼저 판별하고, 식료품 항목만 추출해 주세요:\n" +
      "1. isValidGroceryReceipt: 영수증이 아닌 일반 사진(풍경, 인물, 사물 등)이거나, 식료품이 전혀 없는 무관한 영수증(주유소, 주차권, 의류매장, 전자제품, 병원/약국 등)이면 반드시 false로 설정하고 items는 빈 배열([])로 반환하세요.\n" +
      "2. reason: isValidGroceryReceipt가 false일 때 사용자에게 보여줄 짧은 한국어 사유 (예: '영수증 사진이 아닙니다', '식료품 내역이 없는 주유소 영수증입니다'). 정상 식료품 영수증이면 빈 문자열('')로 두세요.\n" +
      "3. storeName: 영수증에 찍힌 상점/마트 이름 (예: Trader Joe's, H-Mart, Costco, Whole Foods 등)\n" +
      "4. purchaseDate: 영수증에 찍힌 구매일자 YYYY-MM-DD 형식 (식별 불가 시 오늘 날짜 '" + (todayIso || "2026-11-11") + "')\n" +
      "5. items: 마트 영수증 안에서도 **실제 먹는 식료품/식재료/음료만** 추출하세요. 쇼핑백/종량제봉투(BAG FEE), 공병보증금(CRV/DEPOSIT), 세금(TAX), 팁(TIP), 할인/쿠폰(DISCOUNT), 기프트카드, 비식품 공산품(옷, 가전, 세제, 건전지 등)은 절대 포함하지 마세요. 영수증 약어는 이해하기 쉬운 한국어 품목명으로 정규화하고, 기존 인벤토리 품목(" +
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
              isValidGroceryReceipt: { type: "BOOLEAN" },
              reason: { type: "STRING" },
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
            required: ["isValidGroceryReceipt", "reason", "storeName", "purchaseDate", "items"]
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
