export type NumberHuntState = {
  order: number[];
  next: number;
  mistakes: number;
  found: number[];
};

export function isValidMaximum(value: number) {
  return Number.isInteger(value) && value >= 10 && value <= 500;
}

export function createNumberOrder(maximum: number, random: () => number = Math.random) {
  const values = Array.from({ length: maximum }, (_, index) => index + 1);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

const NUMBER_OFFSET_X = [-12, 6, 14, -6, 10, -14, 3, 12, -9, 8, -3, 13, -11, 4, -7, 11, -1, 7, -13, 2, 9, -5, 5];
const NUMBER_OFFSET_Y = [8, -12, 3, 14, -7, 11, -3, -14, 6, -9, 13, -5, 9, -11, 4, 12, -1, -8, 7];

export function getNumberOffset(index: number) {
  const safeIndex = Number.isInteger(index) && index >= 0 ? index : 0;
  return {
    x: NUMBER_OFFSET_X[safeIndex % NUMBER_OFFSET_X.length],
    y: NUMBER_OFFSET_Y[safeIndex % NUMBER_OFFSET_Y.length],
  };
}

export function createNumberHunt(maximum: number, order = createNumberOrder(maximum)): NumberHuntState {
  if (!isValidMaximum(maximum) || !hasEveryNumberOnce(order, maximum)) {
    throw new Error("Bảng số không hợp lệ");
  }
  return { order, next: 1, mistakes: 0, found: [] };
}

export function selectNumber(state: NumberHuntState, value: number) {
  if (state.found.includes(value) || state.next > state.order.length) return { state, correct: false, completed: false };
  if (value !== state.next) return { state: { ...state, mistakes: state.mistakes + 1 }, correct: false, completed: false };

  const next = state.next + 1;
  return {
    state: { ...state, next, found: [...state.found, value] },
    correct: true,
    completed: next > state.order.length,
  };
}

export function hasEveryNumberOnce(values: number[], maximum: number) {
  return values.length === maximum && new Set(values).size === maximum && values.every((value) => Number.isInteger(value) && value >= 1 && value <= maximum);
}
