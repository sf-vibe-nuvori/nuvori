# web/ — iPhone PWA 프론트엔드 규칙

`web/index.html`은 단일 파일 앱이다: UI + 인벤토리 DB(localStorage) + 영수증 검수 흐름 + 레시피 매칭. HSMM 예측 엔진은 `model/hsmm-engine.js`(배포 시 이 디렉토리로 복사됨, `window.NuvoriModel`)에서, API 호출은 `packages/api-client/api-client.js`(`window.NuvoriAPI`)에서 로드한다.

## 1. 절대 어기면 안 되는 UI / UX 단순성 규칙

1. **복잡한 지표 노출 금지**:
   - `10%`, `75%` 같은 신선도 퍼센트 게이지 바(Progress Bar)를 절대 표시하지 않는다.
   - `아직 있음 / 다 먹음` 같은 수동 재고 확인 버튼을 만들지 않는다.
   - `냉장필수재` 같은 카테고리 태그나 `평균 소비주기 N일` 텍스트를 아이템 카드에 노출하지 않는다.
2. **아이템 카드 표시 항목 고정**:
   - 왼쪽: `44x44` 음식 썸네일 (`ITEM_IMAGES` / `inferThumbKey`)
   - 가운데: 품목명 + 경과일(`오늘 구매`, `산 지 N일 됨`, `직접 추가됨`)
   - 오른쪽 배지: 오직 3가지 (`⚠️ 부족하다`, `✅ 안 사도 된다`, `🛒 사야 한다`)
3. **메인 구조**: 상단 2개 메인 탭 `| 🥬 인벤토리 | 🍳 레시피 |`
   - 인벤토리 탭 내부 토글: `🥬 인벤토리` ⇄ `🛒 쇼핑` ⇄ `📸 영수증` ⇄ `💬 챗`
   - 레시피 탭 내부 토글: `🍳 요리` ⇄ `💬 질문` (같은 chat-panel이 양쪽에 도킹된다)
   - `🛒 쇼핑 리스트` 상단에는 `품목명` + `가격` + `+ 추가` 직접 입력창이 항상 있어야 한다.

## 2. 코드 규칙

1. **XSS 방지**: `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` 절대 금지. `createElement()`, `textContent`, `replaceChildren()`만 사용 (`el()` 헬퍼 활용).
2. **iPhone PWA 호환**: 모든 `<input>`의 `font-size`는 16px 이상 (iOS 자동 줌인 방지). `body` 패딩의 `env(safe-area-inset-*)` 유지.
3. **상태 저장**: localStorage 키 `nuvori_poc_state_v2`, 구조는 `contracts/inventory-state.schema.json` 계약을 따른다 (변경 시 계약도 함께 갱신).
4. **API 호출**: fetch 직접 호출 금지 — 반드시 `window.NuvoriAPI`(api-client)를 사용한다. 계약은 `contracts/receipt-ocr.schema.json`, `contracts/chat-advisor.schema.json`.
5. **모델 호출**: `computeHsmmBelief`/`inferCycleDaysByName`/`evaluateItemForOffset`는 `window.NuvoriModel`에서 제공된다. 엔진 로직을 이 디렉토리에 복제하지 않는다.
