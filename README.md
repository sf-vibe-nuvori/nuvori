# Nuvori — 스마트 장보기 (iPhone PWA + Netlify Serverless OCR)

영수증 사진을 찍으면 **언제(`purchaseDate`) · 어디서(`storeName`) · 어떤 품목을 얼마에(`items/price`)** 샀는지 Gemini 2.5 Flash로 추출하여 인벤토리 DB에 적재하고, 가구별 소비주기를 기반으로 **부족한 품목(`⚠️ 부족하다`)**과 **사야 할 품목(`🛒 사야 한다`) + 합계**를 자동 계산하는 웹앱입니다.

## 디렉토리 구조
- `index.html`: iPhone PWA 메타 태그(`apple-mobile-web-app-capable`), Safe Area 여백, Canvas 이미지 압축(1024px JPEG), Inventory DB(`localStorage`)가 포함된 단일 프론트엔드
- `manifest.json`: iOS/Android 홈 화면 추가용 Web App Manifest
- `netlify.toml`: 정적 파일 경로(`.`) 및 Serverless Functions 경로(`netlify/functions`) 설정
- `netlify/functions/parse-receipt.mjs`: 서버 환경변수 `GEMINI_API_KEY`를 사용해 영수증 이미지를 구조화된 JSON(`{ storeName, purchaseDate, items }`)으로 파싱하는 백엔드 함수

## GitHub + Netlify 배포 순서

### 1. GitHub 레포지토리 푸시
GitHub에서 새 빈 레포지토리(예: `nuvori`)를 만든 뒤 아래 명령어를 실행합니다:
```bash
cd ~/nuvori
git remote add origin https://github.com/<본인_깃허브_ID>/nuvori.git
git push -u origin main
```

### 2. Netlify 연동 및 API Key 설정
1. [Netlify 대시보드](https://app.netlify.com) 접속 → **Add new site** → **Import an existing project** → **GitHub**에서 `nuvori` 선택 후 **Deploy** 클릭 (설정은 `netlify.toml`이 자동 적용됨)
2. **Site configuration** → **Environment variables** → **Add a variable** 클릭:
   - **Key**: `GEMINI_API_KEY`
   - **Value**: 본인의 Gemini API Key 입력 후 저장
3. **Deploys** 탭에서 **Trigger deploy → Deploy site**를 한 번 눌러 환경변수를 반영합니다.

### 3. iPhone 홈 화면에 앱으로 설치
1. 배포된 `https://<사이트명>.netlify.app` 주소를 **iPhone Safari**로 엽니다.
2. 하단 **공유 버튼 `[↑]`** → **`홈 화면에 추가(Add to Home Screen)`**를 탭합니다.
3. 홈 화면에 생성된 **Nuvori** 아이콘을 눌러 전체화면 네이티브 앱 모드로 사용합니다.
