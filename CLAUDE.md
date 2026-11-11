# Nuvori — AI Coding Agent Guidelines (`AGENTS.md` / `CLAUDE.md`)

이 문서는 **Cursor, Claude Code, Windsurf, GitHub Copilot, Gemini CLI, Antigravity** 등 모든 AI 코딩 에이전트가 `yshin/nuvori` 레포지토리에서 Vibe Coding을 수행할 때 반드시 준수해야 하는 규칙입니다.

---

## 1. 프로젝트 개요 및 파일 위치

- **`index.html`**: iPhone PWA 전체화면 웹앱 프론트엔드 + 인벤토리 DB(`localStorage`) + 실시간 3-State HSMM 소진 예측 엔진 (`computeHsmmBelief` / `evaluateItem` / `ingestReceiptToDB`)
- **`netlify/functions/parse-receipt.mjs`**: 영수증 사진을 Gemini 2.5 Flash API(`process.env.GEMINI_API_KEY`)로 분석하여 `{ storeName, purchaseDate, items: [{ name, price, quantity, cycleDays }] }` 구조화 JSON으로 반환하는 서버리스 함수
- **`simulation/hhmm_pomdp_simulation.py`**: 300가구 × 365일 몬테카를로 시뮬레이터 (3-State Hierarchical HSMM + Empirical Bayes + Newsvendor 비대칭 손실 + POMDP EVSI + Game-Theoretic 레시피 라우팅 검증용 Python 스크립트)
- **`netlify.toml` / `manifest.json`**: Netlify 배포 설정 및 iOS/Android 홈 화면 웹앱 매니페스트

---

## 2. 절대 어기면 안 되는 UI / UX 단순성 규칙

1. **복잡한 지표 노출 금지**:
   - 화면에 `10%`, `75%` 같은 신선도 퍼센트 게이지 바(Progress Bar)를 절대 표시하지 마세요.
   - `아직 있음 / 다 먹음` 같은 수동 재고 확인 버튼을 만들지 마세요.
   - `냉장필수재` 같은 카테고리 태그나 `평균 소비주기 N일` 텍스트를 아이템 카드에 노출하지 마세요.
2. **아이템 카드 표시 항목 고정**:
   - 왼쪽: `44x44` 음식 썸네일 이미지 (`ITEM_IMAGES` / `inferThumbKey`)
   - 가운데: 품목명(`item.name`) + 경과일(`오늘 구매`, `산 지 N일 됨`, 또는 `직접 추가됨`)만 깔끔하게 표시
   - 오른쪽 배지: 오직 3가지 아이콘 배지만 사용 (`⚠️ 부족하다`, `✅ 안 사도 된다`, `🛒 사야 한다`)
3. **2개 메인 탭 + 내부 토글 구조 유지**:
   - 상단 메인 탭: `| 🥬 인벤토리 ⇄ 🛒 쇼핑 리스트 | 📸 사진 올리기 |`
   - 첫 번째 탭 내부 토글: `🥬 인벤토리` ⇄ `🛒 쇼핑 리스트`
   - `🛒 쇼핑 리스트` 상단에는 사용자가 새 아이템을 직접 입력(`품목명` + `가격` + `+ 추가`)할 수 있는 입력창이 항상 있어야 합니다.

---

## 3. 보안 및 코드 작성 규칙

1. **API Key 하드코딩 절대 금지**:
   - `GEMINI_API_KEY` 등 모든 비밀 키는 오직 `netlify/functions/parse-receipt.mjs`의 `process.env.GEMINI_API_KEY`에서만 읽어야 합니다. 클라이언트 `index.html`에 키나 입력창을 노출하지 마세요.
2. **XSS 방지 (안전한 DOM 조작)**:
   - `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`를 절대 사용하지 마세요.
   - 반드시 `document.createElement()`, `textContent`, `replaceChildren()`만 사용하세요.
3. **iPhone PWA 호환성 유지**:
   - 모든 `<input>`의 `font-size`는 최소 `16px` 이상을 유지하여 iOS Safari에서 입력창 터치 시 화면이 강제 줌인되는 현상을 방지하세요.
   - `body` 패딩의 `env(safe-area-inset-top)` 및 `env(safe-area-inset-bottom)` 여백을 유지하세요.

---

## 4. Vibe Coding 후 자동 배포 워크플로우

사용자가 기능이나 UI 수정을 요청하면:
1. `index.html` (또는 관련 파일)을 수정합니다.
2. 별도 빌드 과정이 없으므로 즉시 아래 명령어로 커밋 및 푸시하여 `https://nuvori.netlify.app` 에 자동 배포합니다:
   ```bash
   git add -A
   git commit -m "ui/feat: <변경 내용 요약>"
   git push origin main
   ```
