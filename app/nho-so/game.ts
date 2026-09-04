export const MEMORY_LEVELS = [
  {
    id: "warmup",
    name: "Khởi động",
    description: "Dễ nhìn, đủ thời gian làm quen",
    startLength: 3,
    baseDurationMs: 1_650,
    perDigitMs: 430,
    icon: "🌱",
  },
  {
    id: "focus",
    name: "Tập trung",
    description: "Nhịp vừa, tăng dần thử thách",
    startLength: 5,
    baseDurationMs: 1_350,
    perDigitMs: 400,
    icon: "🎯",
  },
  {
    id: "challenge",
    name: "Thách đấu",
    description: "Chuỗi dài hơn, thời gian ngắn hơn",
    startLength: 7,
    baseDurationMs: 1_050,
    perDigitMs: 360,
    icon: "🚀",
  },
] as const;

export type MemoryLevelId = (typeof MEMORY_LEVELS)[number]["id"];

export type RecallResult = {
  answer: string;
  correct: boolean;
  matched: number;
  positions: boolean[];
};

export function getMemoryLevel(levelId: MemoryLevelId) {
  return MEMORY_LEVELS.find((level) => level.id === levelId) ?? MEMORY_LEVELS[1];
}

export function generateDigitSequence(length: number, random: () => number = Math.random) {
  if (!Number.isInteger(length) || length < 1 || length > 24) {
    throw new Error("Độ dài chuỗi số không hợp lệ");
  }

  return Array.from({ length }, () => String(Math.min(9, Math.floor(random() * 10)))).join("");
}

export function normalizeDigits(value: string, maximumLength = 24) {
  return value.replace(/\D/g, "").slice(0, maximumLength);
}

export function evaluateRecall(expected: string, rawAnswer: string): RecallResult {
  const answer = normalizeDigits(rawAnswer, expected.length);
  const positions = Array.from({ length: expected.length }, (_, index) => answer[index] === expected[index]);
  const matched = positions.filter(Boolean).length;

  return {
    answer,
    correct: answer.length === expected.length && matched === expected.length,
    matched,
    positions,
  };
}

export function getMemorizeDurationMs(length: number, levelId: MemoryLevelId) {
  const level = getMemoryLevel(levelId);
  return Math.max(2_000, Math.min(8_500, level.baseDurationMs + length * level.perDigitMs));
}

export function calculateRoundScore(length: number, matched: number, correct: boolean, streakBeforeRound: number) {
  if (correct) return length * 10 + Math.min(streakBeforeRound, 5) * 5;
  return matched * 2;
}

export function getNextLength(length: number, correct: boolean) {
  return correct ? Math.min(24, length + 1) : length;
}

export function groupDigits(sequence: string, size = 3) {
  if (!sequence) return [];
  const groups: string[] = [];
  for (let index = 0; index < sequence.length; index += size) {
    groups.push(sequence.slice(index, index + size));
  }
  return groups;
}
