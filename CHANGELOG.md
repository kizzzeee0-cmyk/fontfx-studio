# Changelog

## v1.2.2

### Webfont loader overhaul
- Google Fonts의 전체 `<link>` 복사 코드를 붙여넣어도 실제 stylesheet 링크를 자동 선택합니다.
- `@import url(...)`, CSS URL, `@font-face { ... }` 원문 CSS를 모두 지원합니다.
- Google Fonts URL의 `family=` 값에서 font-family 이름 자동 감지를 시도합니다.
- CORS 허용 CSS는 `fetch`로 직접 읽고, CSS 내부 상대 `url(...)` 경로를 절대 경로로 보정한 뒤 `<style>`로 삽입합니다.
- CSS fetch가 CORS로 차단되면 `<link rel="stylesheet">` 방식으로 자동 재시도합니다.
- 폰트 로드 상태를 성공 / 경고 / 오류로 상세 표시합니다.
- stylesheet는 연결됐지만 FontFaceSet 확인이 늦는 경우 더 이상 곧바로 실패 처리하지 않고 목록에 등록해 미리보기로 확인할 수 있게 했습니다.
- 웹 CSS의 family 이름 입력을 선택 사항으로 변경했습니다.
- 프로젝트에 직접 붙여넣은 `@font-face` CSS도 다시 불러올 수 있게 저장/복원 구조를 보강했습니다.
- HTML의 app.js / styles.css 버전 쿼리를 1.2.2로 변경해 Cloudflare/브라우저의 이전 JS 캐시가 남는 문제를 방지했습니다.

## v1.2.1
- Cloudflare build script에서 `.nojekyll` 누락 시 실패하던 문제 수정

## v1.2.0
- 글자 채우기 선형/원형 그라데이션 및 다중 색상 스톱 추가
