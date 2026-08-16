# Stockfish WebAssembly source notice

This directory redistributes the lite, single-threaded browser build from the
exact npm package `stockfish@18.0.8` under the GNU General Public License v3.

- Upstream JavaScript port: https://github.com/nmrugg/stockfish.js
- Upstream chess engine: https://github.com/official-stockfish/Stockfish
- License: GPL-3.0; the full text is included as `COPYING.txt`.
- Distributed files: `stockfish-18-lite-single.js` and
  `stockfish-18-lite-single.wasm`.

To obtain the corresponding source, download the `stockfish@18.0.8` npm source
package (`npm pack stockfish@18.0.8`) or clone the tagged/released upstream
Stockfish.js source linked above. The package documents its Emscripten build
process and the `--single-threaded --lite` build options. This application does
not modify the copied engine binaries.
