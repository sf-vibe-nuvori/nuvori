# Nuvori — 전체 규칙 (`CLAUDE.md` / `AGENTS.md`)

이 문서는 **Cursor, Claude Code, Windsurf, GitHub Copilot, Gemini CLI, Antigravity** 등 모든 AI 코딩 에이전트가 `nuvori` 레포지토리에서 작업할 때 반드시 준수해야 하는 **전역 경계 규칙**이다. 각 디렉토리의 세부 규칙은 그 디렉토리 안의 `CLAUDE.md`를 따른다.

---

## 1. 병렬 에이전트 경계 규칙 (가장 중요)

1. **자기 디렉토리 밖 수정 금지**: 각 에이전트는 자신에게 할당된 디렉토리 안의 파일만 수정한다. 다른 디렉토리의 파일은 **읽기만** 허용된다.
2. **`contracts/`는 읽기 전용**: 계약 스키마는 model ↔ api ↔ web/mobile의 공통 명세다. 변경이 필요하면 먼저 사용자에게 보고하고 승인을 받은 후, 관련 디렉토리 전부를 함께 갱신한다.
3. **공유 모듈의 원본 위치**: `model/hsmm-engine.js`와 `packages/api-client/api-client.js`가 원본이다. 배포 시 netlify.toml의 command가 이들을 `web/`으로 복사하며, 복사본(`web/hsmm-engine.js`, `web/api-client.js`)은 커밋하지 않는다 (.gitignore).

## 2. 프로젝트 구조

```
nuvori/
├── CLAUDE.md                  # 이 문서 (전역 경계 규칙)
├── contracts/                 # [읽기 전용] API·상태 계약 스키마
│   ├── receipt-ocr.schema.json     # parse-receipt 요청/응답 계약
│   ├── chat-advisor.schema.json    # chat-advisor 요청/응답 계약
│   └── inventory-state.schema.json # localStorage 인벤토리/영수증 상태 계약
├── model/     CLAUDE.md       # 3-State HSMM 소진 예측 엔진 (JS) + 몬테카를로 시뮬레이션 (Python)
├── api/       CLAUDE.md       # Netlify 서버리스 함수 (Gemini OCR / 어드바이저)
├── web/       CLAUDE.md       # iPhone PWA 프론트엔드 (index.html 단일 앱)
├── db/        CLAUDE.md       # 현재: localStorage 스키마 문서 / 향후: DB 마이그레이션
├── packages/api-client/       # contracts 기반 공유 fetch 클라이언트 (web, mobile 공용)
├── mobile/    CLAUDE.md       # 향후 Expo/React Native 자리 (현재는 스캐폴드)
├── netlify.toml               # publish=web, functions=api, 공유 모듈 복사 커맨드
└── manifest.json은 web/ 내부에 있음
```

## 3. 배포 워크플로우

별도 빌드 과정 없이 커밋·푸시하면 Netlify가 자동 배포한다 (`https://nuvori.netlify.app`):

```bash
git add -A
git commit -m "ui/feat: <변경 내용 요약>"
git push origin main
```

기능 개발은 브랜치에서 진행하고 PR으로 머지한다. **API 호환성 수정(모델명 deprecated 등)은 `fix-api` 브랜치에서** 처리한다.

## 4. 전역 보안 규칙 (모든 디렉토리 공통)

1. **API Key 하드코딩 절대 금지**: `GEMINI_API_KEY`는 오직 `api/*.mjs`의 `process.env.GEMINI_API_KEY`에서만 읽는다. 클라이언트 코드(web/, packages/, mobile/)에 키나 키 입력창을 노출하지 않는다.
2. **XSS 방지**: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` 금지. `document.createElement()`, `textContent`, `replaceChildren()`만 사용.
3. UI/UX 단순성 규칙(3종 배지, 게이지바 금지 등)의 전문은 `web/CLAUDE.md`를 따른다.
