# 계약 변경 제안 (db-agent → 사용자 승인 대기)

`contracts/`는 읽기 전용이므로, 마이그레이션 초안(db/migrations/0001_init.sql,
db/mapping.md) 작성 중 발견한 계약 변경 필요 사항을 여기에 제안으로 남긴다.
**아직 어떤 계약 파일도 수정하지 않았다.** 승인 시 contracts/ + web/ + packages/를
함께 갱신해야 한다 (루트 CLAUDE.md §1.2).

작성일: 2026-11-25 · 작성자: db-agent · 상태: 승인 대기

---

## 제안 1 — `receipts[].items[]`에 `id`, `name` 필수화

**현황**: 계약상 영수증 품목의 `id`/`name`/`price`/`cycleDays`가 모두 선택 필드다.
DB의 `receipt_items`는 이를 그대로 반영해 전부 nullable이 됐다.

**문제**: 영수증 라인에 `name`이 없으면 사용자에게 표시할 내용이 없고, `id`가 없으면
인벤토리 매칭·undo 검증이 불가능하다. 실제 web 코드는 항상 name을 채워 넣으므로
계약이 실제 데이터보다 느슨하기만 하다.

**제안**: `id`는 계속 선택(미매칭 라인 존재), `name`과 `price`는 필수로 승격.
`cycleDays`는 선택 유지 (자동 추론Fallback 있음).

## 제안 2 — `prevItemMap` 내부 구조 계약화

**현황**: 계약이 `prevItemMap`을 `{ "type": "object" }`로만 정의. 내부는
`{ [itemId]: item전체복사본 }` 구조가 web 코드에 암묵적으로 존재한다.

**문제**: undo 로직의 진실의 원천이 계약 밖에 있다. DB jsonb로 옮겨도 내부 구조가
계약이 아니면 이기종 클라이언트(mobile 등)가 복원 로직을 재현할 수 없다.

**제안**: `additionalProperties: items의 items[] 아이템 스키마`로 명시. DB 스키마
(jsonb) 변경은 불필요하고 계약 문서만 명확해진다.

## 제안 3 — `items[].lastPurchaseDate` 필수화

**현황**: 선택 필드. `boughtDay`(dayOffset 기준 상대일)가 실질적 필수 필드다.

**문제**: DB는 절대일만 저장하는 설계(db/mapping.md §3)인데 `lastPurchaseDate`가
없으면 마이그레이션 시 `today - (dayOffset - boughtDay)` 역산에 의존해야 한다.
역산은 dayOffset이 0이 아닌 시점에 저장된 데이터에서 오차를 만들 수 있다.

**제안**: `lastPurchaseDate`를 필수 필드로 승격. web 코드는 이미 영수증 커밋·수동
추가 시 항상 채우고 있어 하위 호환 영향이 거의 없다. `boughtDay`는 "파생값
(재계산 대상)"으로 description을 갱신하는 것만으로 충분, 필수 해제는 제안하지 않음.

## 제안 4 — `items[].id`의 사용자 범위 유일성 명시

**현황**: id가 클라이언트 생성 문자열이고, 기본 프리셋이 "eggs", "milk" 같은
범용 키를 쓴다. 계약에 유일성 범위에 대한 설명이 없다.

**문제**: 서버 DB에서 id 단독 PK가 불가능하다 (사용자 간 충돌). 초안에서는
`(user_id, id)` 복합키로 해결했으나, 계약에 "id는 사용자(기기) 범위에서만 유일"함을
명시하면 향후 동기화 충돌 처리 설계의 전제가 된다.

**제안**: 스키마 description 갱신만으로 충분 (구조 변경 없음).

---

## 보류 (제안하지 않음)

- `dayOffset`/`subMode`/`recipeMode`의 서버 저장 — UI 세션 상태로 판단, user_settings
  테이블 필요성은 실사용 피드백 후 재검토.
- `addedItemIds`의 `text[]` 전환 — DB에서 jsonb 유지가 계약 패리티에 더 가깝다.
