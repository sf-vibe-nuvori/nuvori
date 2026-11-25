# packages/api-client/ — 공유 API 클라이언트 규칙

`api-client.js`는 `contracts/` 스키마를 구현으로 옮긴 유일한 fetch 래퍼다. web과 (향후) mobile이 같이 쓴다. `window.NuvoriAPI`로 노출된다.

## 규칙

1. **계약이 단일 기준**: 함수 시그니처·필드는 `contracts/receipt-ocr.schema.json`과 `contracts/chat-advisor.schema.json`을 따른다. 계약이 바뀌면 이 파일이 먼저 갱신되고, 이후 web/mobile 호출부가 따라온다.
2. **환경 독립**: 브라우저 전용(plain script tag 로드 가능, 의존성 없음)으로 유지한다. Node/번들러 가정 금지.
3. **에러 규격**: HTTP 오류 시 `Error`를 throw하되 메시지에 서버의 `detail`/`error` 필드를 우선 반영한다 (web의 기존 catch 처리 호환).
4. 이 디렉토리에서 web/, api/, model/ 파일을 수정하지 않는다 (루트 규칙).
