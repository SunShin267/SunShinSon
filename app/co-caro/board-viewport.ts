import type { BoardSize, GomokuState } from "./gomoku-types";

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;

export function clampZoom(zoom: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom * 20) / 20));
}

export function sizeForZoom(zoom: number): BoardSize {
  const safeZoom = clampZoom(zoom);
  if (safeZoom > 0.8) return 20;
  if (safeZoom > 0.65) return 30;
  if (safeZoom > 0.5) return 40;
  return 50;
}

export function expandBoard(state: GomokuState, requestedSize: BoardSize): GomokuState {
  if (requestedSize <= state.size) return state;
  const addedBefore = Math.floor((requestedSize - state.size) / 2);
  return {
    ...state,
    size: requestedSize,
    origin: [state.origin[0] - addedBefore, state.origin[1] - addedBefore],
  };
}
