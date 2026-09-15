import { VIETNAMESE_ALPHABET, WORLD_TOPICS, numberToVietnamese, type CategoryId } from "./curriculum.ts";

export type PracticeQuestion = {
  prompt: string;
  hint: string;
  visual: string;
  choices: string[];
  answer: string;
};

export type PracticeLesson = {
  id: string;
  category: CategoryId;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  duration: string;
  color: string;
  soft: string;
  questions: PracticeQuestion[];
};

const alphabetGroups = [
  { id: "bang-chu-cai-1", label: "A đến C", start: 0, end: 5 },
  { id: "bang-chu-cai-2", label: "D đến G", start: 5, end: 10 },
  { id: "bang-chu-cai-3", label: "H đến M", start: 10, end: 15 },
  { id: "bang-chu-cai-4", label: "N đến P", start: 15, end: 20 },
  { id: "bang-chu-cai-5", label: "Q đến U", start: 20, end: 25 },
  { id: "bang-chu-cai-6", label: "Ư đến Y", start: 25, end: 29 },
];

function rotateChoices(choices: string[], targetIndex: number) {
  const offset = targetIndex % choices.length;
  return [...choices.slice(offset), ...choices.slice(0, offset)];
}

const alphabetLessons: PracticeLesson[] = alphabetGroups.map((group, groupIndex) => {
  const items = VIETNAMESE_ALPHABET.slice(group.start, group.end);
  const questions = items.map((item, itemIndex) => {
    const absoluteIndex = group.start + itemIndex;
    const next = VIETNAMESE_ALPHABET[(absoluteIndex + 1) % VIETNAMESE_ALPHABET.length];
    const afterNext = VIETNAMESE_ALPHABET[(absoluteIndex + 2) % VIETNAMESE_ALPHABET.length];
    return {
      prompt: `Từ “${item.word}” bắt đầu bằng chữ nào?`,
      hint: "Đọc chậm từ gợi ý và nghe âm đầu tiên nhé.",
      visual: `${item.icon}  ${item.word}`,
      choices: rotateChoices([item.upper, next.upper, afterNext.upper], absoluteIndex),
      answer: item.upper,
    };
  });
  return {
    id: group.id,
    category: "chu-cai",
    eyebrow: "Luyện trọn bảng chữ cái",
    title: `Chặng ${groupIndex + 1}: ${group.label}`,
    description: `Ôn đủ ${items.map((item) => item.upper).join(", ")} qua từ và hình gợi nhớ.`,
    icon: `${items[0].upper}–${items.at(-1)?.upper}`,
    duration: `${Math.max(5, questions.length + 1)} phút`,
    color: ["#e86752", "#d76587", "#8a64bd", "#557cc4", "#d98635", "#389ca0"][groupIndex],
    soft: ["#fff0e8", "#fff0f5", "#f4efff", "#edf3ff", "#fff3e5", "#e8f8f6"][groupIndex],
    questions,
  };
});

function numberChoices(target: number) {
  const candidates: number[] = [target];
  for (const candidate of [target + 1, target - 1, target + 2, target - 2, target + 3]) {
    if (candidate >= 0 && candidate <= 100 && !candidates.includes(candidate)) candidates.push(candidate);
    if (candidates.length === 3) break;
  }
  return rotateChoices(candidates.map(String), target);
}

const numberLessons: PracticeLesson[] = Array.from({ length: 11 }, (_, groupIndex) => {
  const start = groupIndex * 10;
  const end = groupIndex === 10 ? 100 : start + 9;
  const values = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const questions = values.map((value) => ({
    prompt: value % 2 === 0 || value === 0
      ? `Cách viết số “${numberToVietnamese(value)}” là gì?`
      : `Số nào đứng ngay sau số ${value - 1}?`,
    hint: value % 2 === 0 || value === 0
      ? "Đọc chậm tên số rồi chọn chữ số đúng."
      : "Đếm tiến thêm một bước trên dãy số.",
    visual: value % 2 === 0 || value === 0 ? "🔢" : `${value - 1} → ?`,
    choices: numberChoices(value),
    answer: String(value),
  }));
  const palette = [
    ["#3d8e68", "#e8f7ed"],
    ["#389ca0", "#e8f8f6"],
    ["#557cc4", "#edf3ff"],
    ["#8a64bd", "#f4efff"],
    ["#d76587", "#fff0f5"],
    ["#e86752", "#fff0e8"],
    ["#d98635", "#fff3e5"],
  ][groupIndex % 7];
  return {
    id: `day-so-${start}-${end}`,
    category: "con-so",
    eyebrow: "Luyện trọn dãy số",
    title: start === end ? `Chạm đích số ${start}` : `Chặng ${start}–${end}`,
    description: `Nhận biết cách viết, cách đọc và thứ tự các số từ ${start} đến ${end}.`,
    icon: start === end ? String(start) : `${start}–${end}`,
    duration: `${Math.max(4, Math.ceil(values.length * .7))} phút`,
    color: palette[0],
    soft: palette[1],
    questions,
  };
});

const worldLessons: PracticeLesson[] = WORLD_TOPICS.map((topic, index) => {
  const palette = [
    ["#557cc4", "#edf3ff"],
    ["#669552", "#eef8e9"],
    ["#389ca0", "#e8f8f6"],
    ["#8a64bd", "#f4efff"],
    ["#d98635", "#fff3e5"],
    ["#e86752", "#fff0e8"],
  ][index];
  return {
    id: `quanh-em-${topic.id}`,
    category: "the-gioi",
    eyebrow: "Luyện khám phá quanh em",
    title: topic.title,
    description: topic.description,
    icon: topic.icon,
    duration: `${Math.max(5, topic.questions.length + 1)} phút`,
    color: palette[0],
    soft: palette[1],
    questions: topic.questions.map((question) => ({ ...question, choices: [...question.choices] })),
  };
});

export const FULL_COVERAGE_LESSONS: PracticeLesson[] = [
  ...alphabetLessons,
  ...numberLessons,
  ...worldLessons,
];

export const PRACTICE_COVERAGE = {
  alphabetLetters: new Set(alphabetLessons.flatMap((lesson) => lesson.questions.map((question) => question.answer))).size,
  numbers: new Set(numberLessons.flatMap((lesson) => lesson.questions.map((question) => Number(question.answer)))).size,
  worldTopics: worldLessons.length,
};
