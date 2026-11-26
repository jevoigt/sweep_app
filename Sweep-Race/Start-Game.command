#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Install Node.js LTS from https://nodejs.org, then run this again."
  read -r "reply?Press Return to close. "
  exit 1
fi
echo "Open http://localhost:3000 in your browser. Press Control-C here to stop."
npm start
