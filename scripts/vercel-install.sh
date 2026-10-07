#!/bin/sh
set -eu

if [ -z "${GH_READ_TOKEN:-}" ]; then
  echo "ERROR: GH_READ_TOKEN is missing"
  exit 1
fi

git config --global url."https://x-access-token:${GH_READ_TOKEN}@github.com/Dz-02/darshana-ai-core.git".insteadOf "https://github.com/Dz-02/darshana-ai-core.git"

npm ci
