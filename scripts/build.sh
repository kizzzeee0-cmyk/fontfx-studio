#!/usr/bin/env bash
set -euo pipefail

rm -rf dist
mkdir -p dist

# Core files required for the app.
for file in index.html app.js styles.css; do
  if [ ! -f "$file" ]; then
    echo "ERROR: required file '$file' was not found in the repository root."
    exit 1
  fi
  cp "$file" dist/
done

# Optional public assets. Missing files should not break Cloudflare Pages deployment.
for file in favicon.svg site.webmanifest 404.html _headers; do
  if [ -f "$file" ]; then
    cp "$file" dist/
  fi
done

# GitHub Pages can use this marker, but do not require it to exist in the repository.
# This also avoids failures when hidden dotfiles were omitted during a browser upload.
: > dist/.nojekyll

echo "FontFX Studio static site prepared successfully in ./dist"
