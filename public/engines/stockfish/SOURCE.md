# Stockfish WebAssembly source notice

This directory redistributes the lite, single-threaded browser build from the
exact npm package `stockfish@18.0.8` under the GNU General Public License v3.

- Upstream JavaScript port: https://github.com/nmrugg/stockfish.js
- Upstream chess engine: https://github.com/official-stockfish/Stockfish
- License: GPL-3.0; the full text is included as `COPYING.txt`.
- Distributed files: `stockfish-18-lite-single.js` and
  `stockfish-18-lite-single.wasm`.

The npm registry metadata for `stockfish@18.0.8` records this exact immutable
source revision (`gitHead`):

`93c994592dcf3b4b21052ab925e9b534df9c0918`

SunShinSon offers equivalent access to the complete corresponding source at no
charge through the immutable upstream archive:

- Commit: https://github.com/nmrugg/stockfish.js/commit/93c994592dcf3b4b21052ab925e9b534df9c0918
- Source archive: https://github.com/nmrugg/stockfish.js/archive/93c994592dcf3b4b21052ab925e9b534df9c0918.tar.gz

That revision contains the Stockfish.js build scripts and its `src` tree. Build
the distributed flavor with Emscripten 3.1.7 using
`node build.js --single-threaded --lite -f` (the upstream
`npm run build-single-lite` script invokes the same command). The npm tarball is
the binary distribution and is not presented as corresponding source. This
application does not modify the copied engine binaries.
