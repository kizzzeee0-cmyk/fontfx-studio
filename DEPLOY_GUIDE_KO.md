# FontFX Studio v1.2.0 Web 배포 가이드

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
