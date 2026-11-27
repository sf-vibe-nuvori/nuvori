# web/ — iPhone PWA 프론트엔드 규칙

`web/index.html`은 단일 파일 앱이다: UI + 인벤토리 DB(localStorage) + 영수증 흐름 + 레시피 매칭. HSMM 예측 엔진은 `model/hsmm-engine.js`(배포 시 이 디렉토리로 복사됨, `window.NuvoriModel`)에서, API 호출은 `packages/api-client/api-client.js`(`window.NuvoriAPI`)에서 로드한다.

## 0. 디자인 기준 (Single Source of Truth)

- **Figma "Nuvori — Home JL Edit"** (`fileKey: IW54na46Fhr2M5RpXLK8xq`, Page 1)이 모든 UI의 기준이다. 이전 Figma "v2 · Home Router" 레이아웃은 폐기한다.
- **모바일(390×844) 프레임을 먼저 구현한다.** 프레임 이름 규칙: `{세트} · {플로우} · {화면} · {Lock|Home}`.
  - **Set 1** (`1 · …`, Clear glass, Aurora 배경) = **다크 테마**
  - **Set 2** (`2 · …`, Ivory gloss, Pearl white 배경) = **라이트 테마**
  - `Set 1 · Flow map` 프레임(`2056:5561`)이 화면 간 이동의 기준이다.
  - `· Web ·` 프레임(1440×900)은 모바일 완료 후 데스크톱 레이아웃으로 구현한다.
- Figma는 영어로 되어 있지만 **앱 UI 문구는 전부 한국어**로 옮긴다 (§3).

## 1. PWA로 옮기는 방법

Figma는 iOS 잠금화면/홈화면 위에 누보리가 떠 있는 형태로 그려져 있다. PWA는 OS 화면을 그릴 수 없으므로 다음처럼 옮긴다.

| Figma | PWA 구현 |
|---|---|
| 홈화면 배경(`Wallpaper / Aurora`, `Wallpaper / Pearl white`) + 앱 아이콘 그리드 | 앱 배경 = 월페이퍼 그라디언트만. **가짜 iOS 아이콘·Dock·상태바·Dynamic Island는 그리지 않는다.** |
| `· Home` 프레임의 Sheet(하단에서 올라오는 유리 패널) | 앱 내 **바텀 시트**. 시트 바깥은 dim 처리, 탭하면 닫힘 |
| Dock의 마스코트 / 마스코트 탭 | 앱 메인 화면 하단의 **마스코트 버튼** → 대화(Talk) 시트 |
| `· Lock` 프레임 (잠금화면 위젯·알림) | 이번 단계에서 구현하지 않음. 추후 Web Push 알림으로 대응 |
| `Web · Home`의 중앙 영역 (마스코트 + "오늘 뭐 해 먹을까?" + 입력창 + 빠른 칩 + 카드 3개) | 모바일 **메인(홈) 화면**의 구성 기준 |
| "Hey Nuvori" 음성 호출 | 마이크 버튼을 누를 때만 음성 입력 (Web Speech API, 지원 안 되면 텍스트 입력). 상시 호출어 감지는 하지 않는다 |

### 화면 목록 (모바일, 구현 우선순위 순)
1. **메인 화면**: 마스코트, 오늘 저녁 한 줄 요약, 대화 입력창 + 마이크, 빠른 칩(`요리 시작`, `오늘 외식해`, `계란 다 떨어졌어`, `장보기 주문`), 카드 3개(`오늘 저녁` / `빨리 써야 해요` / `장보기`)
2. **대화 시트**: Talk · Listening, N4 Talk · Answer (사용자 말풍선 → 누보리 답변 카드)
3. **식단 시트** (S3 Meal plan) ⇄ **팬트리 시트** (S3 Pantry → Fridge/Freezer/Pantry 상세): 하단 페이저 점 2개로 좌우 이동
4. **장보기 시트** (S2 Shopping): 매장별 탭, `살 것` / `같이 사면 좋은 것` / 건너뛸 항목 제안, 예상 금액, 영수증 추가(선택)
5. **레시피 시트** (N5 Recipe) → **요리 모드** 전체 화면 (S4: 단계 + 타이머, "다음") → 완료 (S4 Cooking done: 팬트리 반영)
6. **변경 확인 시트** (S1 Plan change, N2 Correction): 바뀐 항목을 취소선(이전) → 새 값으로 보여주고 `좋아요` 버튼 1개
7. **절약 시트** (Savings): 이번 주 절약액 + 항목별 내역
8. **주문 시트** (S5 Auto order, N8 Auto-order rules)
9. **첫 실행 설정** (N1 Setup 1–4: 연결 → 평소 지출 → 요리 시간 → 취향)
10. N6 Timer done, N7 Saved recipe(레시피 링크 가져오기)

## 2. UI / UX 원칙 (Figma Flow map 기준)

1. **누보리가 하고, 알려준다.** 재고·식단·장보기 목록은 누보리가 영수증과 요리 기록으로 스스로 갱신한다. 사용자에게 입력·체크를 요구하지 않는다.
2. **확인은 한 번.** 누보리가 바꾼 내용은 한 시트에 모아 보여주고, 주 버튼(흰색/진한 알약 버튼)은 **1개**만 둔다 (`좋아요`, `요리 시작`, `주문 · ₩30,930` 등).
3. **말로 고친다.** 모든 시트 하단에 음성/텍스트 안내 줄(`🎤 "좋아요"라고 하거나, 바꿀 걸 말해 주세요`)을 둔다. 재고 수정은 대화("계란 다 떨어졌어")로 한다.
   - **품목마다 붙는 수동 재고 체크 버튼(`아직 있음 / 다 먹음` 등)은 만들지 않는다.** 예외: 누보리가 한 품목에 대해 묻는 질문에 대한 1개의 빠른 답 칩(예: Fridge 상세의 `다 먹었어`).
4. **절약액 알약(Savings pill)** 은 모든 시트 헤더 오른쪽에 표시하고, 탭하면 절약 시트를 연다. 초과 지출 시 `Savings pill / Over` (빨간 코인, `−14`) 변형을 쓴다.
5. **닫기**: 아래로 스와이프, 시트 바깥 탭, "닫아" — 세 가지 모두 지원한다. 시트 상단에 grabber(36×5)를 둔다.
6. **숫자 표시**
   - 남은 양 막대는 **팬트리 상세(Fridge/Freezer/Pantry)** 와 **주문 합계(한도 대비)** 에서만 쓴다. 남은 양 텍스트는 대략적으로만 쓴다 (`약 ½봉`, `~30% 남음`, `6개 남음`). 정밀 퍼센트(`73.4%`)나 신뢰도 수치는 표시하지 않는다.
   - 남은 기간은 오른쪽 일수 알약(`2일`, `3일` …)으로 표시한다. 가까운 것(≤4일)은 흰색 강조, 나머지는 반투명.
   - HSMM 내부 상태명·확률·cycleDays 원값은 화면에 노출하지 않는다. 근거는 한 줄로만 (`영수증 6장과 요리 기록으로 추정했어요.`).
7. **카테고리**: 팬트리는 `전체 / 냉장 / 냉동 / 실온` 4개 탭만 쓴다.
8. **이모지 아이콘을 쓰지 않는다.** 아이콘은 Figma의 라인 아이콘(SVG, 1.5px stroke)을 `web/assets/icons/`로 받아 쓴다.

## 3. 한국어 현지화

1. 모든 UI 문구는 **부드러운 해요체**로 통일한다 (반말·합니다체 섞지 않기). 누보리의 말투는 친근하고 짧게 (`알겠어요 — 계란이 다 떨어졌네요`).
2. 통화는 **원(₩)**, 천 단위 콤마 (`₩30,930`). 절약 알약은 `₩` 코인 + 숫자.
3. 매장·서비스 예시는 한국 기준으로 바꾼다 (Trader Joe's → 이마트, Costco → 코스트코, Instacart → 쿠팡/컬리).
4. 요일은 `월 화 수 목 금 토 일`, 날짜는 `11월 23–29일`.
5. 음식 예시도 한국 식단 기준 (시금치 계란 덮밥, 된장찌개, 김치볶음밥 등 — Figma에 이미 있는 메뉴는 그대로 번역).

## 4. 디자인 토큰 (테마는 기기 설정에 따라 자동 전환)

`@media (prefers-color-scheme: dark)`로 전환한다. 수동 테마 토글은 두지 않는다. 모든 색은 `:root`의 CSS 변수로만 쓰고, 컴포넌트 CSS에 hex를 직접 쓰지 않는다.

| 토큰 | 라이트 (Set 2 · Ivory gloss) | 다크 (Set 1 · Clear glass) |
|---|---|---|
| 앱 배경 | Pearl white 월페이퍼 (아이보리 그라디언트) | Aurora 월페이퍼 (보라·남색 그라디언트 + 별) |
| 시트 배경 | `linear-gradient(180deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 30%), linear-gradient(180deg, rgba(248,239,221,.66), rgba(241,228,203,.62))` | `rgba(255,255,255,.2)` + `backdrop-filter: blur()` |
| 시트 테두리 | `1.5px solid #fff` | `1px solid rgba(255,255,255,.9)` |
| 시트 그림자 | `0 16px 40px rgba(77,54,26,.26)` + inset `0 4px 15px 5px rgba(255,255,255,.8)` | `0 8px 24px rgba(31,5,51,.18)` |
| 카드/칩 배경 | `rgba(255,255,255,.55)` | `rgba(255,255,255,.12)`–`.16` |
| 텍스트 기본 | `#3d301b` | `#fff` (+ `text-shadow: 0 1px 3px rgba(13,5,31,.45)`) |
| 텍스트 보조 | `rgba(61,48,27,.9)` | `rgba(255,255,255,.85)`–`.92` |
| 선택된 탭/칩 | 배경 `#e8d7b4`, 테두리 `#d6c196`, 글자 `#4a3a20` | 배경 `#fff`, 글자 `#291f3d` |
| 주 버튼 | 진한 갈색 알약 (Flow map `#8a6338` 계열) | 흰색 알약, 글자 `#291f3d` |
| 강조 점선 박스 | `1px dashed rgba(185,162,131,.35)` | `1px dashed rgba(255,255,255,.35)` |
| 절약 코인 | `#1cb073` (초과 시 빨강) | 동일 |
| grabber | `rgba(180,146,90,.4)` | `rgba(255,255,255,.55)` |

- **모서리**: 시트 36px, 카드 20px, 아이콘 타일 14px, 알약 999px.
- **간격**: 시트 패딩 20/18/16, 요소 간격 12px, 칩 간격 6px.
- **글꼴**: Pretendard (한글) — Figma의 Inter와 굵기 대응: 제목 24px Bold, 카드 제목 18px Bold, 본문 13–14px Medium/SemiBold, 칩 12px SemiBold.
- **마스코트**: 다크 = `Mascot` (유리 질감), 라이트 = `Mascot · Set 2` (아이보리). Figma에서 PNG로 받아 `web/assets/`에 둔다. 임시 Figma 에셋 URL을 코드에 남기지 않는다.

## 5. 코드 규칙

1. **XSS 방지**: `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` 절대 금지. `createElement()`, `textContent`, `replaceChildren()`만 사용 (`el()` 헬퍼 활용).
2. **iPhone PWA 호환**: 모든 `<input>`의 `font-size`는 16px 이상 (iOS 자동 줌인 방지). `env(safe-area-inset-*)` 유지. 시트는 하단 safe area 위에 붙인다.
3. **상태 저장**: localStorage 키 `nuvori_poc_state_v2`, 구조는 `contracts/inventory-state.schema.json` 계약을 따른다. 식단·절약액·주문 규칙처럼 계약에 없는 상태가 필요하면 **먼저 사용자에게 보고하고 승인 후** 계약과 함께 갱신한다 (루트 CLAUDE.md §1.2).
4. **API 호출**: fetch 직접 호출 금지 — 반드시 `window.NuvoriAPI`(api-client)를 사용한다. 계약은 `contracts/receipt-ocr.schema.json`, `contracts/chat-advisor.schema.json`.
5. **모델 호출**: `computeHsmmBelief`/`inferCycleDaysByName`/`evaluateItemForOffset`는 `window.NuvoriModel`에서 제공된다. 엔진 로직을 이 디렉토리에 복제하지 않는다.
6. **아직 백엔드가 없는 기능**(자동 주문, 매장 연결, 이메일 영수증)은 UI만 만들고 동작은 "준비 중" 상태로 둔다. 실제 결제·주문 호출을 임의로 만들지 않는다.
