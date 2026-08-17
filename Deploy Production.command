#!/bin/sh

pause_and_exit() {
  status="$1"
  shift
  printf "\n%s\n" "$*"
  printf "Press Enter to close this window..."
  read -r _
  exit "$status"
}

cd -- "$(dirname -- "$0")" || pause_and_exit 1 "Could not open the project folder."

command -v node >/dev/null 2>&1 || pause_and_exit 1 "Node.js is required. Install it from https://nodejs.org and try again."
command -v npm >/dev/null 2>&1 || pause_and_exit 1 "npm is required. Reinstall Node.js and try again."

printf "Preparing dependencies...\n"
npm install || pause_and_exit 1 "Dependency installation failed."

printf "Checking Cloudflare login...\n"
npx wrangler whoami || pause_and_exit 1 "Cloudflare login is required. Run 'npx wrangler login' and try again."

printf "Building and deploying SunShinSon to Cloudflare...\n"
npm run deploy:cloudflare || pause_and_exit 1 "Cloudflare deployment failed."

pause_and_exit 0 "Deployment completed: https://sunshinson.phanthanhtai-cmu-fd4.workers.dev"
