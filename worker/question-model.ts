import { questions } from "../db/schema";

const TOPICS = ["dongvat", "tunhien", "toanhoc", "domeo", "vanhoa"] as const;
const AGES = ["de", "vua", "kho"] as const;
const TAGS = ["đố vui", "đố mẹo"] as const;

export type QuestionTopic = (typeof TOPICS)[number];
export type QuestionAge = (typeof AGES)[number];
export type QuestionTag = (typeof TAGS)[number];

export interface QuestionInput {
  topic: QuestionTopic;
  age: QuestionAge;
  tag: QuestionTag;
  q: string;
  opts: [string, string, string, string];
  correct: number;
  explain: string;
  isActive: boolean;
}

export interface PublicQuestion {
  id: number;
  topic: QuestionTopic;
  age: QuestionAge;
  tag: QuestionTag;
  q: string;
  opts: [string, string, string, string];
  correct: number;
  explain: string;
  isActive?: boolean;
}

export type QuestionValidationResult =
  | { ok: true; value: QuestionInput }
  | { ok: false; fields: Record<string, string> };

type QuestionRow = typeof questions.$inferSelect;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isOneOf<const Values extends readonly string[]>(
  value: unknown,
  allowedValues: Values,
): value is Values[number] {
  return typeof value === "string" && allowedValues.includes(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeQuestion(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
}

export function validateQuestionInput(value: unknown): QuestionValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      fields: { body: "Dữ liệu câu hỏi phải là một object." },
    };
  }

  const fields: Record<string, string> = {};

  if (!isOneOf(value.topic, TOPICS)) {
    fields.topic = "Chủ đề không hợp lệ.";
  }

  if (!isOneOf(value.age, AGES)) {
    fields.age = "Độ khó không hợp lệ.";
  }

  if (!isOneOf(value.tag, TAGS)) {
    fields.tag = "Loại câu hỏi không hợp lệ.";
  }

  if (!nonEmptyString(value.q)) {
    fields.q = "Nội dung câu hỏi không được để trống.";
  }

  const validOptions =
    Array.isArray(value.opts)
    && value.opts.length === 4
    && value.opts.every(nonEmptyString);
  if (!validOptions) {
    fields.opts = "Câu hỏi phải có đúng bốn đáp án không để trống.";
  }

  if (!Number.isInteger(value.correct) || (value.correct as number) < 0 || (value.correct as number) > 3) {
    fields.correct = "Đáp án đúng phải là số nguyên từ 0 đến 3.";
  }

  if (!nonEmptyString(value.explain)) {
    fields.explain = "Lời giải thích không được để trống.";
  }

  if (typeof value.isActive !== "boolean") {
    fields.isActive = "Trạng thái xuất bản phải là boolean.";
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: {
      topic: value.topic as QuestionTopic,
      age: value.age as QuestionAge,
      tag: value.tag as QuestionTag,
      q: (value.q as string).trim(),
      opts: (value.opts as string[]).map((option) => option.trim()) as QuestionInput["opts"],
      correct: value.correct as number,
      explain: (value.explain as string).trim(),
      isActive: value.isActive as boolean,
    },
  };
}

export function toPublicQuestion(row: QuestionRow): PublicQuestion {
  return {
    id: row.id,
    topic: row.topic as QuestionTopic,
    age: row.age as QuestionAge,
    tag: row.tag as QuestionTag,
    q: row.questionText,
    opts: [row.optionA, row.optionB, row.optionC, row.optionD],
    correct: row.correctIndex,
    explain: row.explanation,
    isActive: row.isActive,
  };
}
