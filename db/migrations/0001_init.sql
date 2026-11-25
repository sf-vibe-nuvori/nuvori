-- ============================================================================
-- Nuvori 0001_init.sql — Supabase 전환용 초기 스키마 초안
-- ============================================================================
-- ⚠️ 문서용 초안입니다. 아직 어떤 환경에도 적용하지 않는다.
--    - 적용 시점: localStorage(nuvori_poc_state_v2) → Supabase 마이그레이션
--      승인 후, contracts/inventory-state.schema.json과 재대조하여 적용.
--    - 기준 계약: contracts/inventory-state.schema.json (2026-11-25 시점)
--    - 필드 매핑 세부 규칙은 db/mapping.md 참조.
--
-- 설계 노트
--    - 클라이언트가 생성하는 id("eggs", "rcpt_123" 등)는 사용자마다 충돌할 수
--      있으므로 모든 PK는 (user_id, id) 복합키다. id 단독으로는 유일하지 않다.
--    - boughtDay(상대일)는 컬럼으로 저장하지 않는다. DB는 절대일
--      (last_purchase_date / purchase_date)만 진실의 원천으로 삼고,
--      boughtDay는 클라이언트가 로드 시 계산한다 (변환 규칙: db/mapping.md).
--    - user_id는 클라이언트가 보내지 않고 서버가 auth.uid()로 주입한다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- items — 인벤토리 아이템 (계약: items[])
-- ----------------------------------------------------------------------------
create table public.items (
  user_id            uuid        not null references auth.users (id) on delete cascade,
  id                 text        not null,                -- 클라이언트 생성 id (사용자 범위 유일)
  thumb_key          text,                                -- ITEM_IMAGES 키
  name               text        not null,
  price              numeric(10,2) not null,
  last_store         text,
  last_purchase_date date,                                -- 절대 구매일 (진실의 원천)
  cycle_days         integer     not null check (cycle_days >= 1),
  manual_need_to_buy boolean     not null default false,
  is_manually_added  boolean     not null default false,
  checked_for_order  boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (user_id, id)
);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- 조회 패턴: 사용자별 아이템 전체 조회(PK prefix), 최근 구매순 정렬
create index items_user_last_purchase_idx
  on public.items (user_id, last_purchase_date desc);

-- ----------------------------------------------------------------------------
-- receipts — 영수증 헤더 (계약: receipts[])
-- ----------------------------------------------------------------------------
create table public.receipts (
  user_id        uuid        not null references auth.users (id) on delete cascade,
  id             text        not null,                     -- 클라이언트 생성 id ("rcpt_...")
  store_name     text        not null,
  purchase_date  date        not null,
  added_item_ids jsonb       not null default '[]'::jsonb, -- 인벤토리에 반영된 item id 목록
  prev_item_map  jsonb       not null default '{}'::jsonb, -- 되돌리기용 이전 상태 스냅샷 (db/mapping.md 참조)
  created_at     timestamptz not null default now(),
  primary key (user_id, id)
);

-- 조회 패턴: 사용자별 영수증 최신순 목록
create index receipts_user_date_idx
  on public.receipts (user_id, purchase_date desc, created_at desc);

-- ----------------------------------------------------------------------------
-- receipt_items — 영수증 품목 라인 (계약: receipts[].items[])
-- ----------------------------------------------------------------------------
-- 라인 순서 보존을 위해 line_index를 명시적으로 저장한다.
-- 계약상 id/name/price/cycleDays는 모두 선택 필드이므로 null을 허용한다
-- (필수화 제안: db/CONTRACT_CHANGE.md).
create table public.receipt_items (
  user_id    uuid          not null references auth.users (id) on delete cascade,
  receipt_id text          not null,
  line_index integer       not null,                      -- 0-based, 원본 배열 순서
  id         text,                                        -- 매칭된 인벤토리 item id (없을 수 있음)
  name       text,
  price      numeric(10,2),
  cycle_days integer,
  primary key (user_id, receipt_id, line_index),
  foreign key (user_id, receipt_id)
    references public.receipts (user_id, id) on delete cascade
);

-- receipt_id 단독 조회 대비 (RLS 필터는 user_id로 걸리므로 보조용)
create index receipt_items_receipt_idx
  on public.receipt_items (receipt_id);

-- ----------------------------------------------------------------------------
-- RLS (Row Level Security) 정책 — 초안
-- ----------------------------------------------------------------------------
-- 전제: Supabase Auth 채택. 모든 접근은 자기 소유 행(user_id = auth.uid())만.
-- anon 역할에 대한 정책을 만들지 않으므로 비로그인 접근은 전면 차단된다.
-- 서비스 역할(service_role)은 RLS를 우회하므로 백엔드 함수에서만 사용.

alter table public.items         enable row level security;
alter table public.receipts      enable row level security;
alter table public.receipt_items enable row level security;

-- items
create policy "items_select_own" on public.items
  for select using (user_id = auth.uid());

create policy "items_insert_own" on public.items
  for insert with check (user_id = auth.uid());

create policy "items_update_own" on public.items
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "items_delete_own" on public.items
  for delete using (user_id = auth.uid());

-- receipts
create policy "receipts_select_own" on public.receipts
  for select using (user_id = auth.uid());

create policy "receipts_insert_own" on public.receipts
  for insert with check (user_id = auth.uid());

create policy "receipts_update_own" on public.receipts
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "receipts_delete_own" on public.receipts
  for delete using (user_id = auth.uid());

-- receipt_items: 소유자는 receipts 경유로만 접근 (user_id 동일 조건)
create policy "receipt_items_select_own" on public.receipt_items
  for select using (user_id = auth.uid());

create policy "receipt_items_insert_own" on public.receipt_items
  for insert with check (user_id = auth.uid());

create policy "receipt_items_update_own" on public.receipt_items
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "receipt_items_delete_own" on public.receipt_items
  for delete using (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 미해결 사항 (적용 전 확정 필요)
-- ----------------------------------------------------------------------------
-- 1. added_item_ids(jsonb) → items.id 참조 무결성은 DB에서 강제하지 않는다
--    (배열 안 id가 삭제된 아이템을 가리킬 수 있음). 앱 레벨에서 무시 처리.
-- 2. prev_item_map 정규화 여부 — 초안에서는 jsonb 스냅샷 유지 (db/mapping.md).
-- 3. dayOffset/subMode/recipeMode 등 UI 상태는 서버에 저장하지 않는다.
--    (필요 시 user_settings 테이블 별도 추가)
