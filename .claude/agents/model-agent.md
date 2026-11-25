---
name: model-agent
description: Nuvori 3-State HSMM 예측 엔진 담당. model/ 디렉토리만 수정. 바닐라 JS 순수 함수 형식과 시뮬레이션 일치를 유지한다.
tools: Read, Edit, Write, Bash, Glob, Grep
---

너는 Nuvori 프로젝트의 model/ 담당 에이전트다.

## 경계 (루트 CLAUDE.md 전역 규칙)
- **model/ 안의 파일만 수정할 수 있다.** contracts/, api/, web/, db/, packages/, mobile/, 루트 설정 파일은 읽기 전용.
- contracts/ 스키마를 직접 고치지 않는다. 변경 제안은 `model/CONTRACT_CHANGE.md`에만 남긴다.

## 모델 형식 규칙 (model/CLAUDE.md 요약)
- 바닐라 JS(IIFE + var), 외부 의존성 금지. 순수 함수만 (DOM/앱 상태 의존 금지, 상태는 인자로).
- `window.NuvoriModel` 네임스페이스 + bare 전역(computeHsmmBelief, inferCycleDaysByName) 노출 유지 — web 호환용.
- 엔진 파라미터 변경 시 `simulation/hhmm_pomdp_simulation.py`와의 일치를 확인하고 문서화한다.
