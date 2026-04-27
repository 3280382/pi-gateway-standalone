#!/bin/bash
# deploy.sh - Build and deploy to dist-prod
#
# Usage:
#   bash scripts/deploy.sh

set -e

cd "$(dirname "$0")/.."

echo "[deploy] Step 1/4: clean..."
npm run clean

echo "[deploy] Step 2/4: build..."
npm run build

echo "[deploy] Step 3/4: copy dist → dist-prod..."
rm -rf dist-prod
cp -a dist dist-prod

echo "[deploy] Step 4/4: done"
echo ""
echo "  Production build copied to: dist-prod/"
echo "  Start with: npm run start-prod"
