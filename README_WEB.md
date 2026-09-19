# FontFX Studio v1.2.1 Web

GitHub Pages / Cloudflare Pages용 배포 패키지입니다.

가장 먼저 `DEPLOY_GUIDE_KO.md`를 읽어주세요.

## 배포 핵심

### GitHub Pages

이 프로젝트를 GitHub 저장소 루트에 올리고:

`Settings → Pages → Source → GitHub Actions`

으로 설정하면 `.github/workflows/deploy-pages.yml`이 자동 배포합니다.

### Cloudflare Pages

GitHub 저장소를 Cloudflare Pages에 연결하고:

```text
Framework: None
Build command: bash scripts/build.sh
Build output directory: dist
```

로 설정합니다.

## 빌드 구조

`scripts/build.sh` 실행 시 공개에 필요한 파일만 `dist/`로 복사합니다.

## v1.2.1 추가 기능

- 선형 / 원형 글자 그라데이션 채우기
- 다중 색상 스톱
- 각도 / 중심 X·Y / 범위 조절
- 입체 그라데이션 프리셋
- 이전 웹폰트 로딩 대기 로직 보강


## v1.2.3 성능 최적화

- 그룹 합체 획/내부 그림자 편집의 렌더링 부담을 줄였습니다.
- 기존처럼 전체 캔버스를 매번 다시 계산하지 않고, 그룹의 실제 영역만 계산하도록 바꿨습니다.
- GitHub/Cloudflare Pages에서는 기존과 동일하게 파일만 교체하면 됩니다.


## v1.2.4
- 획 전체 스택 프리셋 저장/적용/삭제
- 내부 그림자 전체 스택 프리셋 저장/적용/삭제
- 브라우저 자동 보존 + 프로젝트 JSON 백업
- v1.2.3 그룹 효과 최적화 유지


## v1.2.5 업데이트

- 그룹 획/다중 획 편집 성능을 추가 최적화했습니다.
- 가로 중앙 / 세로 중앙 / 정중앙 정렬 기능이 추가되었습니다.
- 브러시 색상/굵기 조절이 가능한 그리기 툴이 추가되었습니다.


## v1.2.6 폰트 자동 저장

- 한 번 불러온 웹 CSS / URL / 로컬 폰트는 브라우저에 자동 저장됩니다.
- 같은 Cloudflare Pages 또는 GitHub Pages 주소로 다시 접속하면 자동 복원됩니다.
- 로컬 폰트는 IndexedDB에 저장되므로 다시 파일을 선택할 필요가 없습니다.
- 폰트 삭제 버튼을 누르면 저장본도 같이 삭제됩니다.
- 브라우저 사이트 데이터 삭제 또는 도메인 변경 시 저장본은 유지되지 않을 수 있습니다.
