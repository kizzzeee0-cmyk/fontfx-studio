#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
mkdir -p dist

# 반드시 필요한 파일
for file in index.html app.js styles.css; do
  if [ ! -f "$file" ]; then
    echo "ERROR: required file '$file' was not found in the repository root."
    exit 1
  fi
  cp "$file" dist/
done

# 없어도 배포를 중단하지 않는 파일
for file in favicon.svg site.webmanifest 404.html _headers; do
  if [ -f "$file" ]; then
    cp "$file" dist/
  fi
done

# 저장소에 .nojekyll이 없어도 직접 생성
: > dist/.nojekyll

echo "FontFX Studio static site prepared successfully in ./dist"
