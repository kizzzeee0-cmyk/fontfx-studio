# FontFX Studio v1.2.1 Web 배포 가이드

이 폴더는 **GitHub Pages**와 **Cloudflare Pages**에 그대로 업로드할 수 있도록 정리된 정적 웹사이트 프로젝트입니다.

앱 본체에는 서버가 필요하지 않습니다. HTML / CSS / JavaScript만 사용하며, `scripts/build.sh`가 실제 공개 파일만 `dist/` 폴더로 모읍니다.

---

# A. GitHub Pages로 배포하기 — 추천

## 1. GitHub에 새 저장소 만들기

예시 저장소 이름:

```text
fontfx-studio
```

Public / Private 어느 쪽이든 계정 플랜과 Pages 지원 범위에 맞춰 선택하면 됩니다.

## 2. 이 ZIP의 내용물을 저장소 최상단에 업로드

업로드 후 GitHub에서 최소한 아래 구조가 보여야 합니다.

```text
fontfx-studio/
├─ .github/
│  └─ workflows/
│     └─ deploy-pages.yml
├─ scripts/
│  └─ build.sh
├─ index.html
├─ app.js
├─ styles.css
├─ favicon.svg
├─ site.webmanifest
├─ 404.html
├─ .nojekyll
└─ ...
```

중요: ZIP 파일 자체를 올리는 것이 아니라 **압축을 푼 안의 파일들**을 저장소 루트에 올립니다.

## 3. GitHub Pages 설정

GitHub 저장소에서:

```text
Settings
→ Pages
→ Build and deployment
→ Source
→ GitHub Actions
```

으로 설정합니다.

## 4. 자동 배포 확인

저장소의:

```text
Actions
→ Deploy FontFX Studio to GitHub Pages
```

에서 초록색 체크가 뜨면 배포 완료입니다.

보통 주소는 다음 형태입니다.

```text
https://GITHUB아이디.github.io/저장소이름/
```

예:

```text
https://example.github.io/fontfx-studio/
```

이 프로젝트는 상대경로를 사용하므로 GitHub Pages의 `/저장소이름/` 하위 주소에서도 CSS와 JavaScript가 정상 로드되도록 구성되어 있습니다.

## 5. 이후 업데이트 방법

`index.html`, `app.js`, `styles.css` 등을 수정한 뒤 GitHub에 다시 업로드/커밋하면 `main` 또는 `master` 브랜치의 변경을 감지하여 자동 재배포됩니다.

---

# B. Cloudflare Pages로 배포하기

Cloudflare Pages에서는 GitHub 저장소를 연결하는 방식이 가장 편합니다.

## 1. 먼저 GitHub에 위 프로젝트를 업로드

GitHub Pages를 켤 필요는 없습니다. Cloudflare가 GitHub 저장소만 읽으면 됩니다.

## 2. Cloudflare Dashboard

```text
Workers & Pages
→ Create application
→ Pages
→ Import an existing Git repository
```

에서 FontFX Studio 저장소를 선택합니다.

## 3. Build 설정

다음처럼 입력합니다.

```text
Framework preset: None
Production branch: main
Build command: bash scripts/build.sh
Build output directory: dist
Root directory: 비워두기
```

그 다음 Deploy를 누릅니다.

## 4. 배포 주소

배포가 끝나면 보통 다음과 같은 주소를 받습니다.

```text
https://프로젝트이름.pages.dev
```

GitHub에 새 커밋을 올리면 Cloudflare Pages도 자동으로 다시 배포합니다.

---

# C. GitHub Pages와 Cloudflare Pages를 동시에 써도 되나요?

가능합니다.

같은 GitHub 저장소를 기준으로:

- GitHub Actions → GitHub Pages
- Cloudflare Git Integration → Cloudflare Pages

두 주소를 동시에 유지할 수 있습니다.

예:

```text
GitHub Pages
https://example.github.io/fontfx-studio/

Cloudflare Pages
https://fontfx-studio.pages.dev/
```

---

# D. 폰트 관련 중요사항

웹사이트로 배포하면 `file://` 로 직접 열 때보다 웹폰트 로딩 조건이 안정적입니다. 하지만 **외부 폰트 서버가 CORS 또는 접근을 차단하면** 직접 URL 폰트는 여전히 불러오지 못할 수 있습니다.

가장 안정적인 순서는:

1. Google Fonts / 정상적인 웹폰트 CSS
2. CORS가 허용된 WOFF2 URL
3. 사용자가 직접 TTF/OTF/WOFF 파일을 선택하는 로컬 폰트 기능

로컬 폰트 파일 선택 기능은 배포 후에도 사용 가능하며, 선택한 폰트 파일은 사용자의 브라우저 메모리에서 사용됩니다.

---

# E. 프로젝트 파일을 계속 가지고 있어야 하나요?

웹에 배포한 뒤 **사용할 때는 ZIP이나 프로젝트 폴더를 컴퓨터에 보관할 필요가 없습니다.**

브라우저에서 배포 URL만 열면 FontFX Studio를 사용할 수 있습니다.

다만 사이트를 수정하거나 새 버전으로 업데이트할 때는 GitHub 저장소의 소스 파일이 필요합니다. GitHub 자체가 원본 파일 보관소가 되므로 컴퓨터에서 별도로 계속 저장하지 않아도 됩니다.

---

# F. 다른 사람도 접속할 수 있나요?

공개 URL이라면 링크를 아는 사람이 접속할 수 있습니다.

FontFX Studio의 편집 데이터는 기본적으로 브라우저 안에서 처리됩니다. 사용자가 선택한 로컬 폰트 파일도 이 앱이 별도의 자체 서버로 업로드하지 않습니다.

---

# G. 배포 문제 빠른 확인

## GitHub Pages가 404인 경우

1. `Settings → Pages → Source = GitHub Actions` 확인
2. `Actions` 탭의 배포 작업이 성공했는지 확인
3. 저장소에 `.github/workflows/deploy-pages.yml`이 존재하는지 확인
4. 기본 브랜치가 `main` 또는 `master`인지 확인

## Cloudflare Pages가 404인 경우

아래 설정을 다시 확인합니다.

```text
Build command: bash scripts/build.sh
Build output directory: dist
```

그리고 배포 로그에서 `FontFX Studio static site prepared in ./dist` 문구가 출력되는지 확인합니다.

## v1.2.2로 업데이트할 때

기존 Cloudflare Pages 프로젝트를 새로 만들 필요가 없습니다. GitHub 저장소에서 v1.2.2의 파일로 교체하고 커밋하면 Cloudflare가 같은 `pages.dev` 주소에 자동 재배포합니다.

특히 다음 파일은 반드시 새 버전으로 교체하세요.

- `index.html`
- `app.js`
- `styles.css`
- `scripts/build.sh`

`index.html`에는 `app.js?v=1.2.2`, `styles.css?v=1.2.2`가 들어 있어 이전 브라우저 캐시 대신 새 코드를 요청합니다.


## v1.2.3 성능 최적화

- 그룹 합체 획/내부 그림자 편집의 렌더링 부담을 줄였습니다.
- 기존처럼 전체 캔버스를 매번 다시 계산하지 않고, 그룹의 실제 영역만 계산하도록 바꿨습니다.
- GitHub/Cloudflare Pages에서는 기존과 동일하게 파일만 교체하면 됩니다.


## 프리셋 저장 데이터

v1.2.4의 획/내부 그림자 프리셋은 브라우저의 사이트 저장공간(localStorage)에 보존됩니다. 따라서 같은 Cloudflare Pages 주소를 유지한 채 GitHub 파일만 업데이트하면 기존 프리셋은 계속 사용할 수 있습니다. Cloudflare 프로젝트를 새로 만들어 주소가 바뀌거나 브라우저 사이트 데이터를 삭제하면 로컬 저장 프리셋은 새로 시작됩니다. 프로젝트 `.fontfx.json`에도 프리셋이 포함되므로 중요한 프리셋은 프로젝트 파일로도 백업할 수 있습니다.


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


## v1.2.7 — 미리보기 확대/축소

그리기 및 세밀한 배치를 위해 편집 화면을 5%~400%로 확대/축소할 수 있습니다. 줌은 미리보기 전용이며 PNG 출력 픽셀 크기에는 영향을 주지 않습니다. `Ctrl + 마우스 휠`, 상단 줌 슬라이더, −/＋ 버튼, 100% 버튼, 화면 맞춤을 지원합니다.


## v1.2.8 드로잉 보정

- 그리기 모드에서 선을 그린 후 마우스를 떼지 않고 약 2초 정지하면, 현재 선이 한 번 더 부드럽게 보정됩니다.


## v1.2.9 드로잉 확장

- 글자/그룹 선택 후 그리면 해당 대상에 선이 붙어서 함께 이동합니다.
- 드로잉 브러시 종류에 펜 / 형광펜 / 에어브러시가 추가되었습니다.
- 선 보정 모드에 직선 / 곡선 / 원형 보정이 추가되었습니다.


## v1.3.0 그룹 획 + 배경 드로잉

- 글자/그룹 선택 후 뒤에 칠한 드로잉도 그룹 외곽선 계산에 포함됩니다.
- 따라서 그룹화 후 획을 추가하면, 글자뿐 아니라 뒤에 칠한 영역의 바깥쪽까지 함께 획이 생성됩니다.


## v1.4.0 색칠하기(클리핑)

- 선택한 글자/그룹 내부에만 칠해지는 색칠하기 툴이 추가되었습니다.
- 색칠 브러시에는 자유선/선형/곡선/원형 보정과 혼합모드가 제공됩니다.
- 지우개 모드로 색칠한 부분만 세밀하게 지울 수 있습니다.


## v1.4.1 업데이트

- 색칠 위치 오프셋 문제를 수정했습니다.
- 색칠 레이어 목록화와 선택 이동/삭제 기능이 추가되었습니다.
- 색칠 전용 프리셋 브러시 저장/적용/삭제 기능이 추가되었습니다.
- 클리핑 색칠에도 그라데이션 브러시를 사용할 수 있습니다.
