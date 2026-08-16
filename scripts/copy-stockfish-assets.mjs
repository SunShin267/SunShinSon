import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "stockfish");
const destination = join(root, "public", "engines", "stockfish");
const files = [
  ["bin/stockfish-18-lite-single.js", "stockfish-18-lite-single.js"],
  ["bin/stockfish-18-lite-single.wasm", "stockfish-18-lite-single.wasm"],
  ["Copying.txt", "COPYING.txt"],
];

await mkdir(destination, { recursive: true });
for (const [from, to] of files) {
  await copyFile(join(source, from), join(destination, to));
}

console.log(`Copied Stockfish 18.0.8 lite single-threaded assets to ${destination}`);
