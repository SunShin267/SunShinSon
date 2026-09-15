import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  ANIMAL_GROUPS,
  NUMBER_RANGES,
  VIETNAMESE_ALPHABET,
  WORLD_ACTIVITIES,
  WORLD_TOPICS,
  numberToVietnamese,
} from "../app/hoc-cung-be/curriculum.ts";
import { FULL_COVERAGE_LESSONS, PRACTICE_COVERAGE } from "../app/hoc-cung-be/practice-bank.ts";

test("includes the complete 29-letter Vietnamese alphabet in order", () => {
  assert.equal(VIETNAMESE_ALPHABET.length, 29);
  assert.equal(VIETNAMESE_ALPHABET.map((item) => item.upper).join(" "), "A Ă Â B C D Đ E Ê G H I K L M N O Ô Ơ P Q R S T U Ư V X Y");
  assert.ok(VIETNAMESE_ALPHABET.every((item) => item.lower && item.word && item.icon));
});

test("number learning ranges cover every integer from 0 through 100", () => {
  const numbers = NUMBER_RANGES.flatMap((range) => Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index));
  assert.deepEqual(numbers, Array.from({ length: 101 }, (_, index) => index));
});

test("reads Vietnamese number names at important boundaries", () => {
  assert.equal(numberToVietnamese(0), "không");
  assert.equal(numberToVietnamese(10), "mười");
  assert.equal(numberToVietnamese(15), "mười lăm");
  assert.equal(numberToVietnamese(21), "hai mươi mốt");
  assert.equal(numberToVietnamese(54), "năm mươi tư");
  assert.equal(numberToVietnamese(100), "một trăm");
});

test("practice bank covers every letter, every number, and every world topic", () => {
  assert.deepEqual(PRACTICE_COVERAGE, {
    alphabetLetters: 29,
    numbers: 101,
    worldTopics: 6,
  });
  assert.ok(FULL_COVERAGE_LESSONS.every((lesson) => lesson.questions.length > 0));
  assert.ok(FULL_COVERAGE_LESSONS.every((lesson) => lesson.questions.every((question) => question.choices.includes(question.answer))));
});

test("animal explorer provides five illustrated groups with four animals each", () => {
  assert.equal(ANIMAL_GROUPS.length, 5);
  assert.ok(ANIMAL_GROUPS.every((group) => group.animals.length === 4));
  assert.ok(ANIMAL_GROUPS.every((group) => group.image.endsWith(".webp") && group.alt && group.introduction));
  assert.ok(
    ANIMAL_GROUPS.every((group) =>
      group.animals.every(
        (animal) => animal.sound && animal.motionSrc.endsWith(".mp4") && animal.audioSrc.endsWith(".mp3"),
      ),
    ),
  );
  assert.ok(
    ANIMAL_GROUPS.every((group) =>
      group.animals.every(
        (animal) => existsSync(`public${animal.motionSrc}`) && existsSync(`public${animal.audioSrc}`),
      ),
    ),
  );
});

test("every non-animal world topic has a narrated interactive activity", () => {
  const nonAnimalTopics = WORLD_TOPICS.filter((topic) => topic.id !== "dong-vat");

  assert.equal(WORLD_ACTIVITIES.length, nonAnimalTopics.length);
  assert.deepEqual(
    WORLD_ACTIVITIES.map((activity) => activity.topicId).sort(),
    nonAnimalTopics.map((topic) => topic.id).sort(),
  );
  assert.ok(WORLD_ACTIVITIES.every((activity) => activity.options.length === 4));
  assert.ok(
    WORLD_ACTIVITIES.every((activity) =>
      activity.options.every((option) => option.label && option.icon && option.description && option.narration),
    ),
  );
});
