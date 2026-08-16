#!/bin/sh

pause_and_exit() {
  printf "\n%s\n" "$1"
  printf "Press Enter to close this window..."
  read -r _
  exit 1
}

cd -- "$(dirname -- "$0")" || pause_and_exit "Could not open the project folder."

command -v node >/dev/null 2>&1 || pause_and_exit "Node.js is required. Install it from https://nodejs.org and try again."
command -v npm >/dev/null 2>&1 || pause_and_exit "npm is required. Reinstall Node.js and try again."

printf "Preparing dependencies...\n"
npm install || pause_and_exit "Dependency installation failed."

printf "Building the local site...\n"
npm run build || pause_and_exit "The local site could not be built."

printf "Starting the local site...\n"
printf "Open http://127.0.0.1:3000 in your browser.\n\n"
npm run start -- --hostname 127.0.0.1
status=$?

if [ "$status" -ne 0 ] && [ "$status" -ne 130 ]; then
  pause_and_exit "The local site could not be started."
fi
