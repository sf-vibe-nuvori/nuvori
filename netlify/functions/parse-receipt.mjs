export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const {
      imageBase64,
      mimeType = "image/jpeg",
      existingNames = [],
      todayIso = "",
      clientApiKey = ""
    } = await req.json();

    const envKey = (process.env.GEMINI_API_KEY || "").trim().replace(/^["']|["']$/g, "");
    const userKey = (clientApiKey || "").trim().replace(/^["']|["']$/g, "");
    const candidateKeys = [userKey, envKey].filter(Boolean);

    if (candidateKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: "Server missing GEMINI_API_KEY environment variable" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Missing imageBase64" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const promptText =
      "당신은 고정밀 마트 영수증 OCR 파서입니다. 이미지를 분석하여 다음 JSON 형식으로만 응답하세요:\n" +
      "1. isValidGroceryReceipt: 영수증이 아닌 일반 사진(풍경, 인물, 사물 등)이거나 식료품이 전혀 없는 무관한 영수증(주유소, 주차권, 의류, 전자제품, 약국 등)이면 false로 설정하고 items는 빈 배열([])로 반환하세요.\n" +
      "2. reason: isValidGroceryReceipt가 false일 때 사용자에게 보여줄 짧은 한국어 사유. 정상 식료품 영수증이면 빈 문자열('')로 두세요.\n" +
      "3. storeName: 영수증에 실제로 인쇄된 상점/마트 이름 (예: Trader Joe's, H-Mart, Costco, Whole Foods, 이마트 등)\n" +
      "4. purchaseDate: 영수증에 인쇄된 구매일자 YYYY-MM-DD 형식 (식별 불가 시 '" + (todayIso || "2026-11-12") + "')\n" +
      "5. items: 영수증에 **실제로 적혀 있는 식료품/식재료/음료 행만** 빠짐없이 정확히 추출하세요.\n" +
      "   - 주의 1 (환각 금지): 영수증에 적혀 있지 않은 품목을 절대 추측해서 넣지 마세요. 기존 품목 목록(" + existingNames.join(", ") + ")과 실제로 같은 식품일 때만 이름을 맞추고, 다른 식품이면 영수증에 적힌 실제 품목명을 한국어로 읽기 쉽게 적어주세요.\n" +
      "   - 주의 2 (수량/중량 행 병합): '2 @ $1.99' 또는 '1.45 lb @ $2.99/lb' 같은 단가 보조 행은 별도 품목으로 분리하지 말고 해당 품목의 최종 결제 금액(price) 하나로 합치세요.\n" +
      "   - 주의 3 (비식품 제외): 쇼핑백/봉투값(BAG FEE), 공병보증금(CRV/DEPOSIT), 세금(TAX), 소계(SUBTOTAL), 합계(TOTAL), 할인(DISCOUNT/SAVINGS), 카드결제 내역은 절대 포함하지 마세요.\n" +
      "   - price: 해당 품목의 최종 금액(숫자, 원화 영수증이면 1350으로 나눈 달러 환산 소수점 둘째자리 값).\n" +
      "   - quantity: 구매 수량(정수, 기본 1).\n" +
      "   - cycleDays: 일반 가정 소비주기 일수(잎채소/생선/베리류 4~5일, 우유/두부/계란/육류 7~10일, 라면/파스타/냉동식품 21일, 양념/오일/쌀 60일).";

    const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite"];
    let lastStatus = 502;
    let lastErrorText = "";

    for (const activeKey of candidateKeys) {
      for (const modelName of models) {
        const geminiUrl =
          "https://generativelanguage.googleapis.com/v1beta/models/" +
          modelName +
          ":generateContent?key=" +
          encodeURIComponent(activeKey);

        const geminiRes = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: promptText },
                  { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
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
          // If the key itself is invalid (400 API key not valid), break inner model loop and try next key if any
          if (lastErrorText.indexOf("API key not valid") !== -1) {
            break;
          }
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
