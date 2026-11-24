#!/bin/sh
# Collects the public files into dist/ for deployment.
set -eu
cd "$(dirname "$0")"
rm -rf dist
mkdir -p dist
cp index.html styles.css app.js dist/
