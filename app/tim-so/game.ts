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
