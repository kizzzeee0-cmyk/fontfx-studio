#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
mkdir -p dist

cp index.html dist/
cp app.js dist/
cp styles.css dist/
cp favicon.svg dist/
cp site.webmanifest dist/
cp 404.html dist/
cp .nojekyll dist/

# Cloudflare Pages reads _headers from the output directory.
if [ -f _headers ]; then
  cp _headers dist/
fi

echo "FontFX Studio static site prepared in ./dist"
