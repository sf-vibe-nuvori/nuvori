# db/ — 데이터 계층 규칙

## 현재 상태

Nuvori는 서버 DB 없이 web 클라이언트의 **localStorage**(`nuvori_poc_state_v2`)를 쓴다. 스키마 계약은 `contracts/inventory-state.schema.json`을 따른다.

## 규칙

1. **스키마 변경 절차**: localStorage 구조가 바뀌면 (1) `contracts/inventory-state.schema.json` 갱신 → (2) web의 `loadInitialState()` 마이그레이션 처리 → (3) 기존 사용자 데이터가 깨지지 않는지 확인. 하위 호환 없는 변경은 사용자 승인 후에만.
2. **향후 DB 도입 시**: 이 디렉토리에 마이그레이션(supabase/migrations 등)과 RLS 정책을 추가한다. localStorage → DB 이전은 `contracts/inventory-state.schema.json`을 매핑 기준으로 삼는다.
3. 이 디렉토리에서 web/, model/, api/ 파일을 수정하지 않는다 (루트 규칙).
