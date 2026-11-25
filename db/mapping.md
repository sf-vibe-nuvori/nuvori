# localStorage ↔ Supabase 매핑 문서

`nuvori_poc_state_v2`(localStorage)와 `db/migrations/0001_init.sql`(초안) 간 필드 매핑.
계약의 진실의 원천은 `contracts/inventory-state.schema.json`이다.

작성 기준: web/index.html의 `saveState()` / `loadInitialState()` / 영수증 커밋 로직 (2026-11-25 시점).

## 0. 전체 구조 대응

| localStorage (state)         | DB                              | 비고 |
|------------------------------|---------------------------------|------|
| `items[]`                    | `public.items`                  | 1행 = 1 아이템 |
| `receipts[]`                 | `public.receipts` + `public.receipt_items` | 헤더/라인 분리 |
| `subMode`, `recipeMode`, `dayOffset` | **마이그레이션 대상 아님** | 클라이언트 UI 세션 상태. 필요 시 향후 user_settings 테이블 |
| `activeTab`, `pendingReceipt` | 저장 안 됨 (saveState가 제외)  | 계약에도 없음 |

모든 테이블에 `user_id uuid` 컬럼이 추가된다. 클라이언트가 보내지 않고 **서버가 `auth.uid()`로 주입**한다.

## 1. items 매핑

| localStorage (camelCase) | DB 컬럼 (snake_case)     | 타입           | 비고 |
|--------------------------|--------------------------|----------------|------|
| `id`                     | `id`                     | text           | 클라이언트 생성. PK는 `(user_id, id)` 복합키 — 기본 프리셋 id("eggs" 등)가 사용자 간 충돌하므로 id 단독 유일이 아님 |
| `thumbKey`               | `thumb_key`              | text nullable  | ITEM_IMAGES 키 |
| `name`                   | `name`                   | text NOT NULL  | |
| `price`                   | `price`                  | numeric(10,2) NOT NULL | |
| `lastStore`              | `last_store`             | text nullable  | |
| `lastPurchaseDate`       | `last_purchase_date`     | date nullable  | **절대일 — DB 진실의 원천** |
| `cycleDays`              | `cycle_days`             | int NOT NULL, ≥1 | 3-State HSMM 소비주기 |
| `boughtDay`              | **컬럼 없음**            | —              | 파생값. 아래 §3 참조 |
| `manualNeedToBuy`        | `manual_need_to_buy`     | bool default false | |
| `isManuallyAdded`        | `is_manually_added`      | bool default false | |
| `checkedForOrder`        | `checked_for_order`      | bool default false | |
| —                        | `created_at` / `updated_at` | timestamptz  | DB 관리, `set_updated_at()` 트리거 |

## 2. receipts 매핑

| localStorage              | DB                              | 비고 |
|---------------------------|---------------------------------|------|
| `id`                      | `receipts.id`                   | "rcpt_..." 클라이언트 생성. PK `(user_id, id)` |
| `storeName`               | `receipts.store_name`           | NOT NULL |
| `purchaseDate`            | `receipts.purchase_date`        | date NOT NULL, 절대일 (이미 계약이 절대일 사용) |
| `addedItemIds[]`          | `receipts.added_item_ids` (jsonb) | 배열 그대로 jsonb 저장. items.id로의 참조 무결성은 DB가 강제하지 않음 (삭제된 아이템 id 허용) |
| `prevItemMap`             | `receipts.prev_item_map` (jsonb) | 아래 §4 참조 |
| `items[]` (영수증 품목)   | `receipt_items` 행들            | 아래 |
| —                         | `receipts.created_at`           | DB 관리 |

### receipt_items (영수증 품목 라인)

| localStorage (`receipts[].items[]`) | DB 컬럼            | 비고 |
|-------------------------------------|--------------------|------|
| 배열 순서                            | `line_index`       | 0-based. 원본 순서 보존용 |
| `id`                                | `id` (nullable)    | 계약상 선택 필드 |
| `name`                              | `name` (nullable)  | 계약상 선택 필드 |
| `price`                             | `price` (nullable) | 계약상 선택 필드 |
| `cycleDays`                         | `cycle_days` (nullable) | 계약상 선택 필드 |

## 3. boughtDay(상대일) ↔ purchaseDate(절대일) 변환 규칙

web 클라이언트의 기준 식 (web/index.html:944):

```
boughtDay = dayOffset - daysBetween(purchaseDate, today)
```

- `dayOffset`: 사용자가 스크럽하는 "현재 시점" 오프셋 (UI 상태, 서버 비저장)
- `today`: 실제 오늘 날짜
- 즉 `boughtDay`는 **dayOffset과 실제 today가 둘 다 개입하는 파생값**이어서,
  DB에 저장하면 두 축이 어느 시점 기준인지 모호해진다. 그래서 DB는 절대일만 저장한다.

### DB → 클라이언트 (로드 시)

```
lastPurchaseDate = row.last_purchase_date        (그대로)
boughtDay = dayOffset - daysBetween(lastPurchaseDate, today)   (클라이언트가 계산)
```

`dayOffset`은 세션 시작 시 0(또는 저장된 UI 값)에서 출발하므로,
DB 로드 직후의 `boughtDay`는 "오늘 기준 며칠 전에 샀나"가 된다.

### localStorage → DB (마이그레이션 임포트 시)

1. `lastPurchaseDate`가 있으면 그대로 `last_purchase_date`로.
2. 없으면(구형 데이터) 절대일을 역산:
   ```
   last_purchase_date = today - (dayOffset - boughtDay) 일
   ```
   (`boughtDay` 식을 today에 대해 풀면 `daysBetween(purchaseDate, today) = dayOffset - boughtDay`)
3. 영수증의 `purchaseDate`는 이미 절대일이므로 그대로 `purchase_date`로.
   역산이 필요한 경우는 없음.

## 4. prevItemMap 스냅샷 저장 방침

- `prevItemMap`은 영수증 확정 시 **인벤토리 아이템의 이전 상태 전체를 깊은 복사**해 둔
  것으로, 영수증 수정/삭제 시 되돌리기(undo)에만 쓰인다 (web/index.html:992-1006, 899).
- **방침: 정규화하지 않고 `receipts.prev_item_map` jsonb에 원본 그대로 저장한다.**
  - 계약(`contracts/inventory-state.schema.json`)이 `object` 타입으로 느슨하게 정의하고
    있어 정규화하면 계약 변경이 필요하다.
  - undo는 원본 스냅샷을 통째로 복원하는 방식이라 jsonb가 의미론적으로 정확하다.
  - 타입 테이블(items_prev)로 정규화하면 삭제된 아이템 id·스냅샷 시점 정합성 관리
    비용만 커진다.
- 임계점: prevItemMap에 저장된 item id는 **과거 시점의 items를 가리키는 유령 참조**가 될
  수 있다(undo 후 재확정 등). 조회 시 존재하지 않는 id는 앱이 무시하는 것을 전제로 한다.
  스냅샷 데이터 자체는 item 전체 복사본이므로 참조가 깨져도 복원은 가능하다.
- 스키마가 이 스냅샷 내부 구조를 강제하지 않는 것은 의도된 설계다 (계약 변경 제안 §2 참조).

## 5. 마이그레이션 임포트 절차 (개요)

1. 사용자 인증(Supabase Auth) 연동 후 `auth.uid()` 확보.
2. localStorage 전체를 클라이언트에서 읽어 서버 함수(또는 service_role 엔드포인트)로 전송.
3. §3 규칙으로 절대일 확정 → `items` upsert (on conflict `(user_id, id)`).
4. `receipts` + `receipt_items` 삽입 (라인 순서 = 원본 배열 순서).
5. 검증: item 수, 영수증 수, 라인 수 대조 후 localStorage는 삭제하지 않고 백업 키로 이동.
