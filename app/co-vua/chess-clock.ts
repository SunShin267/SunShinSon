import type { Color } from "chess.js";

export type ClockState = {
  whiteMs: number;
  blackMs: number;
  active: Color | null;
  lastTick: number;
  expired: Color | null;
};

export function createClock(initialMs: number, now: number): ClockState {
  return { whiteMs: initialMs, blackMs: initialMs, active: "w", lastTick: now, expired: null };
}

export function tickClock(state: ClockState, now: number): ClockState {
  if (!state.active || state.expired) return { ...state, lastTick: now };
  const elapsed = Math.max(0, now - state.lastTick);
  const key = state.active === "w" ? "whiteMs" : "blackMs";
  const remaining = Math.max(0, state[key] - elapsed);
  return { ...state, [key]: remaining, lastTick: now, expired: remaining === 0 ? state.active : null };
}

export function switchClock(state: ClockState, now: number): ClockState {
  const ticked = tickClock(state, now);
  if (ticked.expired || !ticked.active) return ticked;
  return { ...ticked, active: ticked.active === "w" ? "b" : "w", lastTick: now };
}

export function pauseClock(state: ClockState, now: number): ClockState {
  return { ...tickClock(state, now), active: null, lastTick: now };
}

export function formatClock(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
