#!/bin/sh
set -eu

# Install step for Vercel. The private `darshana-ai-core` package lives in a private GitHub repo, so
# git needs a read token to fetch it. A branch that does not depend on the package needs no token.
if grep -q '"darshana-ai-core"' package.json; then
  if [ -z "${GH_READ_TOKEN:-}" ]; then
    echo "ERROR: GH_READ_TOKEN is missing. It is required to install the private darshana-ai-core package."
    echo "Set it in Vercel > Project > Settings > Environment Variables (Production and Preview)."
    exit 1
  fi

  # npm asks for the package over https first and falls back to ssh when that fails, so both forms
  # are rewritten to the authenticated https URL. The token is never printed.
  git config --global url."https://x-access-token:${GH_READ_TOKEN}@github.com/Dz-02/darshana-ai-core.git".insteadOf "https://github.com/Dz-02/darshana-ai-core.git"
  git config --global --add url."https://x-access-token:${GH_READ_TOKEN}@github.com/Dz-02/darshana-ai-core.git".insteadOf "ssh://git@github.com/Dz-02/darshana-ai-core.git"
fi

npm ci
