# Nuvori 모바일 (Expo / React Native)

현재는 **스캐폴드** 상태다. 실제 모바일 경험은 `web/` PWA(iPhone 홈 화면 설치)로 제공되며,
이 디렉토리는 네이티브 앱으로 확장할 때의 출발점이다.

## 현재 구현 범위

- 하단 2탭 셸: `🥬 인벤토리` | `🍳 레시피` (web PWA의 메인 구조 참고)
- 인벤토리 탭: 품목 리스트 (품목명 + 경과일 + 3종 배지 `⚠️ 부족하다` / `✅ 안 사도 된다` / `🛒 사야 한다`)
  - web의 내부 토글(인벤토리/쇼핑/영수증/챗)은 최소 구현에서 생략
- 레시피 탭: 재료 기반 요리 매칭 (`✅ 만들 수 있음` / `⚠️ 재료 N개 부족`)
- 데이터: `src/data.js`의 더미 상태 — `contracts/inventory-state.schema.json` 계약 준수 (필수 필드 전부 포함)
- API: `src/api.js` — `packages/api-client/api-client.js`의 RN 어댑터 (모듈 export, 절대 URL 베이스). 시그니처·필드는 계약과 동일

## 미구현 (TODO)

- HSMM 예측 엔진(`model/hsmm-engine.js`) 연동 — 배지 판정은 현재 단순 규칙(경과일 ≥ 소비주기 → 부족)
- 상태 영구 저장 (AsyncStorage, 키 구조는 inventory-state 계약)
- 영수증 OCR / 챗 어드바이저 화면 (`src/api.js`의 `parseReceipt` / `chatAdvisor` 사용)
- 쇼핑 리스트 직접 입력창

## 실행 방법

```bash
cd mobile
npm install        # expo ~51 / react 18.2.0 / react-native 0.74.5
npx expo start     # Expo Go 앱으로 QR 스캔, 또는 i / a 키로 시뮬레이터 실행
```

API 베이스 URL은 기본적으로 `https://nuvori.netlify.app/.netlify/functions`를 바라본다.
로컬 netlify dev 함수를 쓰려면 앱 진입점에서 `global.NUVORI_API_BASE`를 덮어쓴다.

## 검증

- `src/api.js`, `src/data.js`(ES 모듈)는 `node --input-type=module --check`로, `babel.config.js`(CJS)는 `node --check`로 문법 검사를 통과했다.
- `App.js`는 JSX를 포함하므로 `node --check` 검증 대상에서 제외했다 (Expo/Metro 번들러가 파싱).

## 규칙

- 이 디렉토리의 세부 규칙은 `mobile/CLAUDE.md`, 전역 규칙은 루트 `CLAUDE.md`를 따른다.
- UI 단순성 규칙(web/CLAUDE.md §1)을 동일하게 적용한다: 퍼센트 게이지바 금지, 배지 3종 고정, 카테고리 태그 금지.
