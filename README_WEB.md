# FontFX Studio v1.2.0 Web

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

## v1.2.0 추가 기능

- 선형 / 원형 글자 그라데이션 채우기
- 다중 색상 스톱
- 각도 / 중심 X·Y / 범위 조절
- 입체 그라데이션 프리셋
- 이전 웹폰트 로딩 대기 로직 보강
