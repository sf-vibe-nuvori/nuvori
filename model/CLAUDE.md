# model/ — 3-State HSMM 소진 예측 엔진 규칙

## 파일

- `hsmm-engine.js`: 순수 함수 엔진 (`computeHsmmBelief`, `inferCycleDaysByName`, `evaluateItemForOffset`). web/index.html이 `window.NuvoriModel`로 로드한다.
- `simulation/hhmm_pomdp_simulation.py`: 300가구 × 365일 몬테카를로 검증 (Empirical Bayes + Newsvendor 비대칭 손실 + POMDP EVSI + 게임이론적 레시피 라우팅).

## 규칙

1. **현재 모델 형식 유지**: 바닐라 JS(IIFE + `var`), Python 표준 라이브러리만 사용. 외부 의존성(FastAPI, ML 프레임워크 등) 도입은 사용자 승인 후에만.
2. **순수 함수 원칙**: `hsmm-engine.js`의 함수는 DOM·앱 상태(state)·localStorage에 의존하지 않는다. 상태가 필요한 판단은 `dayOffset`을 인자로 받는다 (`evaluateItemForOffset`).
3. **시뮬레이션과의 일치**: `hsmm-engine.js`의 전이/방출 확률 파라미터를 바꾸면 `simulation/`의 대응 파라미터도 함께 갱신하고 몬테카를로 검증을 다시 돌려 상대 오차가 악화하지 않았는지 확인한다.
4. **전역 노출 호환**: `window.NuvoriModel` 네임스페이스와 bare 전역(`window.computeHsmmBelief`, `window.inferCycleDaysByName`) 노출을 유지한다 — web의 기존 호출부 호환용.
5. 이 디렉토리에서 web/, api/, packages/, db/ 파일을 수정하지 않는다 (루트 규칙).
