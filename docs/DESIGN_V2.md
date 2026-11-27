https://www.figma.com/design/CFjoOFt2SaAbYsjG1i6RNg/Meal-Prep-App-%E2%80%94-Wireframes?node-id=0-1&t=XzvFxELFndtFwCbA-1# Nuvori v2 레이아웃 적용 가이드 (web/)

Figma: https://www.figma.com/design/CFjoOFt2SaAbYsjG1i6RNg → 페이지 **"v2 · Home Router"**
- 🖥 Web · 1440: `W1 · Home (router)`, `W2 · Inventory`, `W3 · Recipes`
- 📱 Mobile · 390: `M1 · Home (router)`, `M2 · Inventory`, `M3 · Recipes`

> 원칙: **기존 기능·데이터·모델은 하나도 지우지 않는다.** 레이아웃과 스타일만 바꾸고, 새 화면은 기존 함수/상태를 그대로 호출한다.
> `contracts/`, `model/`, `api/`, `packages/`는 건드리지 않는다 (루트 CLAUDE.md 경계 규칙).

---

## 0. 먼저 팀 결정이 필요한 것 (⚠️ 현재 규칙과 충돌)

| # | Figma v2 | 현재 `web/CLAUDE.md` | 제안 |
|---|---|---|---|
| A | Inventory에 **소비 속도 표** (남은 양 막대, `~6 / week`, 소진 예상일, 근거 영수증 수) | §1.1 퍼센트 게이지바 금지, `평균 소비주기 N일` 카드 노출 금지 | **아이템 카드 규칙은 그대로 유지**하고, 별도 섹션 "📈 소비 패턴"에서만 허용하도록 규칙에 예외 추가. 막대는 %가 아니라 HSMM 3단계(여유/보통/소진)로 표시 |
| B | Home = Inventory / Recipes 2분할 라우터 | §1.3 메인 구조: 상단 2개 메인 탭 | 메인 탭 2개는 유지, 그 앞에 `home` 뷰 추가 (탭 = 라우터 이동 수단으로 계속 사용) |
| C | 크림 화이트/베이지 톤 (오버뷰 문서 기준) | 브랜드 레드 그라데이션 히어로 | `:root` CSS 변수 값만 교체 (구조 변경 없음) |
| D | 화면 문구 영어 | 화면 문구 한국어 | 팀 결정. 결정 전까지는 **한국어 유지** |

A가 승인되면 `web/CLAUDE.md` §1.1에 아래 한 줄을 추가한다:

```
- 예외: 인벤토리 탭의 "📈 소비 패턴" 섹션에서는 품목별 구매 주기(cycleDays), 소진 예상일, HSMM 3단계 상태 막대, 근거 영수증 수를 표시할 수 있다. 아이템 카드(3종 배지)는 변경하지 않는다.
```

---

## 1. Figma 요소 → 기존 코드 매핑

### W1/M1 · Home (router) — **새 뷰**
| Figma 요소 | 데이터 출처 (기존) |
|---|---|
| Inventory 카드 → 클릭 시 인벤토리 | `state.activeTab = "inventory"` (기존 `tab-inventory-btn` 핸들러와 동일 동작) |
| `$42.80 saved this week` | `renderMainView()`의 `savedMoney` 계산 (✅ 안 사도 된다 품목 가격 합) → 함수로 분리해 재사용 |
| `34 items · 3 use soon · 2 running low` | `state.items.length`, `evaluateItem(item).isShort` 개수, `🛒 사야 한다` 개수 |
| USE SOON 미리보기 3개 | `isShort === true` 품목을 경과일 순 정렬, 기존 아이템 카드(3종 배지) 그대로 재사용 |
| Recipes 카드 → 클릭 시 레시피 | `state.activeTab = "recipe"` |
| `5 recipes you can cook now` | `getRecipeMatches()` 중 `missing.length === 0` 개수 |
| TONIGHT'S PICKS | `getRecipeMatches()` 상위 3~4개, 기존 `createRecipeCard()` 재사용 |

구현: `state.activeTab`에 `"home"` 값 추가 (기본값을 `"home"`으로). `renderAll()`의 `if (state.activeTab !== "recipe") state.activeTab = "inventory";` 라인이 `home`을 덮어쓰지 않도록 수정. `#view-home` 컨테이너 추가. 로고(🥦 Nuvori) 클릭 → `home`.
※ `activeTab`은 `contracts/inventory-state.schema.json`에 없음 → localStorage에 저장 중이라면 계약 변경 필요 여부를 db/ 담당과 확인.

### W2/M2 · Inventory
| Figma 요소 | 데이터 출처 |
|---|---|
| 상단 Savings band — 총액 | 위 `savedMoney` 함수 |
| Savings breakdown 3칸 | 현재 데이터로 가능한 건 **"Skipped duplicate buys" 1칸뿐**. "Used before expiring", "Cooked instead of delivery"는 조리 기록 데이터가 없어서 **지금은 숨김** (데이터 생기면 추가) |
| 필터 칩 (All / Use soon / Running low …) | 기존 서브 토글 `🥬 인벤토리 · 🛒 쇼핑 · 📸 영수증 · 💬 챗`은 **그대로 유지**, 그 아래에 필터 칩 추가 |
| 📈 소비 패턴 표 (A 승인 시) | 품목명: `item.name` / 상태 막대: `evaluateItem(item).belief` (pSurplus/pNormal/pDepleted 중 최댓값 → 3단계) / Usage speed: `item.cycleDays` → "약 N일마다" / Runs out: `max(0, cycleDays - elapsed)`일 / Based on: `state.receipts` 중 `addedItemIds`에 포함된 영수증 수 |
| 오른쪽 패널(웹): Running low + 영수증 업로드 | Running low = `isShort` 품목 / 업로드 = 기존 `subview-receipt`의 업로드 박스 재사용 (`file-upload`, `compressImageToBase64`, `requestReceiptOcr`, 검수 에디터 그대로) |

### W3/M3 · Recipes
| Figma 요소 | 데이터 출처 |
|---|---|
| 레시피 카드 그리드 (웹 4열) / 리스트 (모바일) | `getRecipeMatches()` + `createRecipeCard()` — 카드 스타일만 변경 |
| `All set` / `Need N` 배지 | `missing.length` |
| "곧 만료되는 재료 사용" 필터 | `inStock` 품목 중 `isShort`인 것 포함 여부 |
| `🍳 요리 ⇄ 💬 질문` 토글 | **그대로 유지** |

### 내비게이션
- 웹(≥1024px): 상단 바 = 로고(→home) + `[🥬 인벤토리 | 🍳 레시피]` 세그먼트. 기존 `.main-tabs` 버튼을 이 바 안으로 옮김 (id 유지 → 이벤트 핸들러 수정 불필요)
- 모바일(<1024px): 상단 `← 홈` + 같은 세그먼트. 하단 탭바 없음
- `.container { max-width: 720px }` → 웹 브레이크포인트에서 `max-width: 1440px` + 2열 레이아웃 (`@media (min-width: 1024px)`)

---

## 2. 디자인 토큰 (C 승인 시 `:root` 값만 교체)

| 토큰 | 현재 | v2 |
|---|---|---|
| `--brand` / `--brand-gradient` | 레드 | `#FBF7F0` (크림 화이트 배경, 그라데이션 제거) |
| `--on-brand` | `#fff` | `#3B2F25` (짙은 브라운) |
| `--background` | `#fff` | `#FBF7F0` |
| `--card` | `#fff` | `#FFFDF9` |
| `--secondary` | `#f1f5f9` | `#F3EADC` (밝은 베이지: 제안 카드, 세그먼트) |
| `--secondary-soft` | `#f8fafc` | `#E9DCC6` (썸네일) |
| `--border` | `#e2e8f0` | `#E6DACA` |
| `--primary` | `#1f2937` | `#A9804F` (따뜻한 진한 베이지: 주 버튼/선택) |
| `--foreground` | `#0f172a` | `#3B2F25` |
| `--muted-foreground` | `#64748b` | `#8C7B6B` |
| `--success-text` | `#047857` | `#4F7A4A` (절감액) |
| `--radius-lg` | 22px | 24px |

3종 배지 색(`--pill-*`)은 유지. 다크 모드 값은 별도 결정.

---

## 3. 작업 순서 (PR 단위, 각 단계마다 `npx netlify dev`로 확인)

1. **토큰 교체** — `:root` 값만. 기능 변경 0
2. **Home 라우터** — `activeTab: "home"` + `#view-home` + 로고 클릭
3. **내비게이션 재배치** — 상단 바 + 1024px 반응형
4. **Inventory 상단** — Savings band (savedMoney 함수 분리) + 필터 칩 + 웹 우측 패널
5. **📈 소비 패턴 섹션** — A 승인 후에만
6. **Recipes 카드 그리드** — 웹 4열 / 모바일 리스트

## 4. Claude Code 시작 프롬프트 (복붙용)

```
web/DESIGN_V2.md와 web/CLAUDE.md, 루트 CLAUDE.md를 먼저 읽어.
Figma 파일 CFjoOFt2SaAbYsjG1i6RNg의 "v2 · Home Router" 페이지가 목표 레이아웃이야.
규칙: 기존 함수·상태·이벤트 핸들러·DOM id는 삭제하거나 이름 바꾸지 말고, 레이아웃과 CSS만 바꿔.
web/ 밖의 파일은 수정하지 마. innerHTML 금지(el() 헬퍼 사용).
DESIGN_V2.md §3의 1단계만 진행하고 멈춰. 변경 요약과 내가 확인할 화면을 알려줘.
```
Figma MCP 호출은 월 한도가 있으니 화면당 `get_design_context` 1회만 쓰고, 나머지는 이 문서를 기준으로 진행할 것.
