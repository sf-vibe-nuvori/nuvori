# mobile/ — 모바일 앱 규칙 (스캐폴드)

현재 Nuvori의 모바일 경험은 web/의 PWA(iPhone 홈 화면 설치)로 제공된다. 이 디렉토리는 **향후 네이티브 앱(Expo / React Native)이 필요해질 때**의 자리다.

## 향후 도입 시 규칙

1. **계약 준수**: API 호출은 `packages/api-client`를, 데이터 구조는 `contracts/`를 따른다. 자체 fetch/스키마 복제 금지.
2. **UI 규칙**: web/CLAUDE.md의 디자인 기준(Figma "Nuvori — Home JL Edit")과 UI/UX 원칙을 동일하게 적용한다. 네이티브 앱에서는 Figma의 `· Lock` 프레임(잠금화면 위젯·알림)도 구현 대상이다.
3. **보안**: API 키·비밀값을 앱 번들에 포함하지 않는다 (루트 CLAUDE.md 전역 보안 규칙).
4. 이 디렉토리에서 web/, api/, model/, packages/ 파일을 수정하지 않는다 (루트 규칙).
