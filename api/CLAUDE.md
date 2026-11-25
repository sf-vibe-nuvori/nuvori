# api/ — Netlify 서버리스 함수 규칙

## 파일

- `parse-receipt.mjs`: 영수증 사진 → Gemini 2.5 Flash OCR → 구조화 JSON (`contracts/receipt-ocr.schema.json` 계약).
- `chat-advisor.mjs`: 인벤토리/구매 이력/레시피 상태 → Gemini 조언 (`contracts/chat-advisor.schema.json` 계약).

## 규칙

1. **API 키**: 오직 `process.env.GEMINI_API_KEY`에서만 읽는다. 요청 바디의 키 수용(clientApiKey 등)은 절대 금지 — CLAUDE.md 전역 보안 규칙 4.1.
2. **모델 폴백 유지**: `["gemini-2.5-flash", "gemini-2.0-flash", "gemini-3.5-flash-lite"]` 폴백 루프를 유지한다. Gemini 모델이 deprecated되면 이 리스트를 갱신한다 — **이런 수정은 `fix-api` 브랜치에서 수행**한다.
3. **계약 준수**: 요청/응답 구조를 바꿀 때는 먼저 `contracts/` 스키마를 갱신하고(사용자 승인 필요), `packages/api-client`와 web/mobile 호출부를 함께 맞춘다.
4. **입력 방어**: 요청 바디 검증(method, 필수 필드, 타입), 프롬프트 주입 방지를 위해 사용자 문자열은 길이 제한 후 삽입한다.
5. 이 디렉토리에서 web/, model/, packages/ 파일을 수정하지 않는다 (루트 규칙). 단 `model/hsmm-engine.js`는 읽어 참조할 수 있다.
