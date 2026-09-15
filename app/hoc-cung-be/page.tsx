"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { GameShell } from "../components/GameShell";
import { readChildName } from "../lib/child-session";
import { readVersionedStorage, writeVersionedStorage } from "../lib/versioned-storage";
import {
  ANIMAL_GROUPS,
  NUMBER_RANGES,
  VIETNAMESE_ALPHABET,
  WORLD_ACTIVITIES,
  WORLD_TOPICS,
  numberToVietnamese,
  type AlphabetItem,
  type CategoryId,
} from "./curriculum";
import { FULL_COVERAGE_LESSONS } from "./practice-bank";
import { getProgressStorageKey } from "./progress";
import "./learning.css";

type Question = {
  prompt: string;
  hint: string;
  visual: string;
  choices: string[];
  answer: string;
};

type Lesson = {
  id: string;
  category: CategoryId;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  duration: string;
  color: string;
  soft: string;
  questions: Question[];
};

type LearningProgress = {
  completedLessonIds: string[];
  stars: number;
};

const STORAGE_VERSION = 1;
const EMPTY_PROGRESS: LearningProgress = { completedLessonIds: [], stars: 0 };

const categories: { id: CategoryId; label: string; icon: string; description: string }[] = [
  { id: "chu-cai", label: "Bảng chữ cái", icon: "A Ă Â", description: "Đủ 29 chữ cái tiếng Việt" },
  { id: "con-so", label: "Con số", icon: "123", description: "Đủ các số từ 0 đến 100" },
  { id: "the-gioi", label: "Quanh em", icon: "🌿", description: "Khám phá thế giới gần gũi" },
];

const starterLessons: Lesson[] = [
  {
    id: "chu-a-that-vui",
    category: "chu-cai",
    eyebrow: "Bảng chữ cái",
    title: "Chữ A thật vui",
    description: "Nhận biết chữ A, nghe tên chữ và tìm những từ bắt đầu bằng A.",
    icon: "A a",
    duration: "5 phút",
    color: "#e86752",
    soft: "#fff0e8",
    questions: [
      { prompt: "Đâu là chữ A in hoa?", hint: "Chữ A in hoa có hai nét xiên và một nét ngang.", visual: "A a", choices: ["A", "a", "O"], answer: "A" },
      { prompt: "Từ nào bắt đầu bằng chữ A?", hint: "Đọc chậm từng từ và nghe âm đầu tiên nhé.", visual: "👕", choices: ["Áo", "Cá", "Bé"], answer: "Áo" },
      { prompt: "Bạn chữ thường của A là chữ nào?", hint: "Chữ thường nhỏ nhắn hơn nhưng đọc giống hệt chữ hoa.", visual: "A → ?", choices: ["ă", "a", "o"], answer: "a" },
    ],
  },
  {
    id: "chu-b-bung-tron",
    category: "chu-cai",
    eyebrow: "Bảng chữ cái",
    title: "Chữ B bụng tròn",
    description: "Làm quen chữ B và tìm những tiếng bắt đầu bằng âm bờ.",
    icon: "B b",
    duration: "5 phút",
    color: "#d76587",
    soft: "#fff0f5",
    questions: [
      { prompt: "Đâu là chữ B in hoa?", hint: "Chữ B in hoa có một nét thẳng và hai bụng tròn.", visual: "B b", choices: ["D", "B", "P"], answer: "B" },
      { prompt: "Bạn nào có tên bắt đầu bằng chữ B?", hint: "Bé đọc to tên từng bạn và nghe âm đầu tiên nhé.", visual: "🐄 🐟 🐐", choices: ["Bò", "Cá", "Dê"], answer: "Bò" },
      { prompt: "Từ nào có chữ b ở đầu?", hint: "Hãy tìm chữ b nhỏ ở đầu từ.", visual: "b...", choices: ["bóng", "nắng", "mây"], answer: "bóng" },
    ],
  },
  {
    id: "phan-biet-m-va-n",
    category: "chu-cai",
    eyebrow: "Nhìn chữ thật tinh",
    title: "Phân biệt M và N",
    description: "Quan sát nét chữ và chọn đúng M, N trong những từ quen thuộc.",
    icon: "M N",
    duration: "6 phút",
    color: "#8a64bd",
    soft: "#f4efff",
    questions: [
      { prompt: "Đâu là chữ M?", hint: "Chữ M in hoa có hai nét xiên gặp nhau ở giữa.", visual: "M  N", choices: ["N", "M", "W"], answer: "M" },
      { prompt: "Từ nào bắt đầu bằng chữ N?", hint: "Nghe âm nờ ở đầu từ nhé.", visual: "☀️", choices: ["Nắng", "Mưa", "Gió"], answer: "Nắng" },
      { prompt: "Từ nào bắt đầu bằng chữ M?", hint: "Chú mèo sẽ giúp bé nhớ âm mờ.", visual: "🐱", choices: ["Mèo", "Nai", "Thỏ"], answer: "Mèo" },
    ],
  },
  {
    id: "dem-cung-sun",
    category: "con-so",
    eyebrow: "Làm quen con số",
    title: "Đếm cùng Sun",
    description: "Đếm đồ vật, nhận biết thứ tự và làm quen phép cộng thật nhẹ nhàng.",
    icon: "1 2 3",
    duration: "6 phút",
    color: "#3d8e68",
    soft: "#e8f7ed",
    questions: [
      { prompt: "Có tất cả bao nhiêu quả táo?", hint: "Bé chạm từng quả và đếm từ trái sang phải nhé.", visual: "🍎 🍎 🍎", choices: ["2", "3", "4"], answer: "3" },
      { prompt: "Số nào đứng ngay sau số 4?", hint: "Mình đếm tiếp một bước từ số 4 nào.", visual: "4 → ?", choices: ["3", "5", "6"], answer: "5" },
      { prompt: "Có 2 chú cá, thêm 1 chú bơi tới. Tất cả là bao nhiêu?", hint: "Hai thêm một là mình đếm thêm một bạn nữa.", visual: "🐟 🐟  +  🐟", choices: ["2", "3", "4"], answer: "3" },
    ],
  },
  {
    id: "nhieu-hon-it-hon",
    category: "con-so",
    eyebrow: "So sánh số lượng",
    title: "Nhiều hơn, ít hơn",
    description: "So sánh hai nhóm đồ vật bằng cách đếm thật chậm và thật chắc.",
    icon: "3 > 2",
    duration: "6 phút",
    color: "#d98635",
    soft: "#fff3e5",
    questions: [
      { prompt: "Nhóm nào có nhiều quả hơn?", hint: "Bé đếm từng nhóm rồi chọn số lớn hơn.", visual: "🍊🍊🍊   |   🍊🍊", choices: ["Nhóm bên trái", "Hai nhóm bằng nhau", "Nhóm bên phải"], answer: "Nhóm bên trái" },
      { prompt: "Số nào bé hơn số 5?", hint: "Trên dãy số, số bé hơn đứng trước số 5.", visual: "?  <  5", choices: ["7", "6", "4"], answer: "4" },
      { prompt: "Hai bên có số lượng thế nào?", hint: "Đếm số ngôi sao ở mỗi bên nhé.", visual: "⭐⭐   |   ⭐⭐", choices: ["Bên trái nhiều hơn", "Bằng nhau", "Bên phải nhiều hơn"], answer: "Bằng nhau" },
    ],
  },
  {
    id: "hinh-khoi-quanh-em",
    category: "con-so",
    eyebrow: "Hình dạng và không gian",
    title: "Hình khối quanh em",
    description: "Nhận biết hình tròn, hình vuông và hình tam giác từ đồ vật quen thuộc.",
    icon: "○ □ △",
    duration: "5 phút",
    color: "#389ca0",
    soft: "#e8f8f6",
    questions: [
      { prompt: "Mặt trời giống hình nào nhất?", hint: "Hình này tròn đều và không có góc.", visual: "☀️", choices: ["Hình tròn", "Hình vuông", "Hình tam giác"], answer: "Hình tròn" },
      { prompt: "Hình nào có 4 cạnh bằng nhau?", hint: "Bé thử đếm bốn cạnh xung quanh hình nhé.", visual: "○  □  △", choices: ["Hình tròn", "Hình vuông", "Hình tam giác"], answer: "Hình vuông" },
      { prompt: "Biển báo này có dạng hình gì?", hint: "Hình này có ba cạnh và ba góc.", visual: "⚠️", choices: ["Hình chữ nhật", "Hình tam giác", "Hình tròn"], answer: "Hình tam giác" },
    ],
  },
  {
    id: "kham-pha-khu-vuon",
    category: "the-gioi",
    eyebrow: "Thế giới quanh em",
    title: "Khám phá khu vườn",
    description: "Quan sát thiên nhiên và gọi tên những điều thân thuộc quanh bé.",
    icon: "🌻",
    duration: "5 phút",
    color: "#557cc4",
    soft: "#edf3ff",
    questions: [
      { prompt: "Bạn nào thường bay quanh những bông hoa?", hint: "Bạn nhỏ này có cánh và giúp hoa tạo ra nhiều hạt.", visual: "🌼  ?  🌼", choices: ["Ong", "Cá", "Mèo"], answer: "Ong" },
      { prompt: "Khi mặt trời mọc, đó là lúc nào?", hint: "Mặt trời đem ánh sáng đến cho mọi người.", visual: "🌅", choices: ["Ban ngày", "Ban đêm", "Giờ ngủ"], answer: "Ban ngày" },
      { prompt: "Cây cần gì để lớn lên khỏe mạnh?", hint: "Cây uống qua rễ và đón nắng qua lá.", visual: "🌱 → 🌳", choices: ["Nước và ánh sáng", "Đồ chơi", "Kẹo ngọt"], answer: "Nước và ánh sáng" },
    ],
  },
  {
    id: "nha-cua-cac-con-vat",
    category: "the-gioi",
    eyebrow: "Con vật quanh em",
    title: "Nhà của các con vật",
    description: "Ghép mỗi con vật với nơi ở thân thuộc và an toàn của bạn ấy.",
    icon: "🐾",
    duration: "5 phút",
    color: "#5678b9",
    soft: "#eef3ff",
    questions: [
      { prompt: "Cá thường sống ở đâu?", hint: "Cá dùng mang để thở trong môi trường này.", visual: "🐟", choices: ["Dưới nước", "Trên cây", "Trong tổ"], answer: "Dưới nước" },
      { prompt: "Chim thường làm tổ ở đâu?", hint: "Nhiều loài chim chọn nơi cao giữa những cành lá.", visual: "🐦", choices: ["Dưới ao", "Trên cây", "Trong cát"], answer: "Trên cây" },
      { prompt: "Bạn nào thích sống trong tổ ong?", hint: "Bạn nhỏ này làm ra mật ngọt.", visual: "🍯", choices: ["Bướm", "Kiến", "Ong"], answer: "Ong" },
    ],
  },
  {
    id: "bon-mua-ky-dieu",
    category: "the-gioi",
    eyebrow: "Thời tiết và mùa",
    title: "Bốn mùa kỳ diệu",
    description: "Nhận biết những dấu hiệu dễ nhớ của mùa xuân, hè và đông.",
    icon: "🌦️",
    duration: "6 phút",
    color: "#669552",
    soft: "#eef8e9",
    questions: [
      { prompt: "Mùa nào thường có nhiều hoa nở?", hint: "Đây là mùa cây cối đâm chồi và bắt đầu một năm mới.", visual: "🌸🌼🌷", choices: ["Mùa xuân", "Mùa hè", "Mùa đông"], answer: "Mùa xuân" },
      { prompt: "Trời nắng nóng, bé nên làm gì?", hint: "Cơ thể cần được mát và có đủ nước trong ngày nóng.", visual: "☀️", choices: ["Mặc áo ấm thật dày", "Uống đủ nước", "Không đội mũ"], answer: "Uống đủ nước" },
      { prompt: "Khi trời lạnh, đồ nào giúp bé giữ ấm?", hint: "Món đồ này được mặc bên ngoài để cơ thể ấm hơn.", visual: "❄️", choices: ["Áo khoác", "Kính bơi", "Quạt giấy"], answer: "Áo khoác" },
    ],
  },
];

const lessons: Lesson[] = [...starterLessons, ...FULL_COVERAGE_LESSONS];

function isLearningProgress(value: unknown): value is LearningProgress {
  if (!value || typeof value !== "object") return false;
  const progress = value as Partial<LearningProgress>;
  return Array.isArray(progress.completedLessonIds)
    && progress.completedLessonIds.every((id) => typeof id === "string")
    && typeof progress.stars === "number"
    && Number.isFinite(progress.stars)
    && progress.stars >= 0;
}

function LessonCard({ lesson, completed, onStart }: { lesson: Lesson; completed: boolean; onStart: () => void }) {
  return (
    <article
      className={`learning-card${completed ? " is-complete" : ""}`}
      style={{ "--lesson": lesson.color, "--lesson-soft": lesson.soft } as React.CSSProperties}
    >
      <div className="learning-card-top">
        <span className="learning-card-icon" aria-hidden="true">{lesson.icon}</span>
        <span className="learning-card-state">{completed ? "✓ Đã học" : `${lesson.questions.length} câu · ${lesson.duration}`}</span>
      </div>
      <p>{lesson.eyebrow}</p>
      <h3>{lesson.title}</h3>
      <span className="learning-card-description">{lesson.description}</span>
      <button type="button" onClick={onStart}>
        {completed ? "Học lại" : "Bắt đầu học"} <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function speakVietnamese(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "vi-VN";
  utterance.rate = .72;
  window.speechSynthesis.speak(utterance);
}

function AlphabetStudy() {
  const [selected, setSelected] = useState<AlphabetItem>(VIETNAMESE_ALPHABET[0]);

  return (
    <div className="study-layout alphabet-study">
      <aside className="study-detail" aria-live="polite">
        <p className="kicker">Chữ bé đang học</p>
        <div className="alphabet-focus"><strong>{selected.upper}</strong><span>{selected.lower}</span></div>
        <div className="study-example"><span aria-hidden="true">{selected.icon}</span><div><small>Ví dụ</small><strong>{selected.word}</strong></div></div>
        <button type="button" onClick={() => speakVietnamese(`${selected.upper}. ${selected.word}`)}><span aria-hidden="true">🔊</span> Nghe phát âm</button>
      </aside>
      <div className="study-board-wrap">
        <div className="study-board-heading"><div><h3>Bảng chữ cái tiếng Việt</h3><p>Chạm vào từng chữ để xem chữ hoa, chữ thường và từ ví dụ.</p></div><strong>29 chữ</strong></div>
        <div className="alphabet-grid" aria-label="29 chữ cái tiếng Việt">
          {VIETNAMESE_ALPHABET.map((item) => (
            <button
              type="button"
              key={item.upper}
              className={selected.upper === item.upper ? "is-selected" : ""}
              aria-pressed={selected.upper === item.upper}
              aria-label={`Chữ ${item.upper}, chữ thường ${item.lower}, ví dụ ${item.word}`}
              onClick={() => setSelected(item)}
            >
              <strong>{item.upper}</strong><span>{item.lower}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function NumberStudy() {
  const [selectedNumber, setSelectedNumber] = useState(0);
  const [rangeId, setRangeId] = useState<(typeof NUMBER_RANGES)[number]["id"]>("0-20");
  const selectedRange = NUMBER_RANGES.find((range) => range.id === rangeId) ?? NUMBER_RANGES[0];
  const visibleNumbers = useMemo(
    () => Array.from({ length: selectedRange.end - selectedRange.start + 1 }, (_, index) => selectedRange.start + index),
    [selectedRange],
  );
  const hundreds = Math.floor(selectedNumber / 100);
  const tens = Math.floor((selectedNumber % 100) / 10);
  const units = selectedNumber % 10;

  return (
    <div className="study-layout number-study">
      <aside className="study-detail number-detail" aria-live="polite">
        <p className="kicker">Số bé đang học</p>
        <strong className="number-focus">{selectedNumber}</strong>
        <span className="number-word">{numberToVietnamese(selectedNumber)}</span>
        <div className="place-values" aria-label={`Số ${selectedNumber} gồm ${hundreds} trăm, ${tens} chục và ${units} đơn vị`}>
          <div><strong>{hundreds}</strong><small>trăm</small></div>
          <div><strong>{tens}</strong><small>chục</small></div>
          <div><strong>{units}</strong><small>đơn vị</small></div>
        </div>
        <button type="button" onClick={() => speakVietnamese(`Số ${numberToVietnamese(selectedNumber)}`)}><span aria-hidden="true">🔊</span> Nghe đọc số</button>
      </aside>
      <div className="study-board-wrap">
        <div className="study-board-heading"><div><h3>Các số từ 0 đến 100</h3><p>Chọn một nhóm số, sau đó chạm vào số bé muốn học.</p></div><strong>101 số</strong></div>
        <div className="number-range-tabs" aria-label="Chọn nhóm số">
          {NUMBER_RANGES.map((range) => <button type="button" key={range.id} className={rangeId === range.id ? "is-selected" : ""} aria-pressed={rangeId === range.id} onClick={() => { setRangeId(range.id); setSelectedNumber(range.start); }}>{range.label}</button>)}
        </div>
        <div className="number-grid" aria-label={`Các số ${selectedRange.start} đến ${selectedRange.end}`}>
          {visibleNumbers.map((number) => <button type="button" key={number} className={selectedNumber === number ? "is-selected" : ""} aria-pressed={selectedNumber === number} onClick={() => setSelectedNumber(number)}>{number}</button>)}
        </div>
      </div>
    </div>
  );
}

function AnimalGallery() {
  const [selectedGroupId, setSelectedGroupId] = useState<(typeof ANIMAL_GROUPS)[number]["id"]>(ANIMAL_GROUPS[0].id);
  const [selectedAnimalName, setSelectedAnimalName] = useState<string>(ANIMAL_GROUPS[0].animals[0].name);
  const [soundState, setSoundState] = useState<"idle" | "playing" | "error">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedGroup = ANIMAL_GROUPS.find((group) => group.id === selectedGroupId) ?? ANIMAL_GROUPS[0];
  const selectedAnimal = selectedGroup.animals.find((animal) => animal.name === selectedAnimalName) ?? selectedGroup.animals[0];

  useEffect(() => () => audioRef.current?.pause(), []);

  function chooseGroup(group: (typeof ANIMAL_GROUPS)[number]) {
    audioRef.current?.pause();
    setSelectedGroupId(group.id);
    setSelectedAnimalName(group.animals[0].name);
    setSoundState("idle");
  }

  function playAnimal(animal: (typeof selectedGroup.animals)[number]) {
    audioRef.current?.pause();
    setSelectedAnimalName(animal.name);
    setSoundState("playing");

    const audio = new Audio(animal.audioSrc);
    audioRef.current = audio;
    audio.preload = "auto";
    audio.volume = .92;
    audio.onended = () => setSoundState("idle");
    audio.onerror = () => setSoundState("error");
    void audio.play().catch(() => setSoundState("error"));
  }

  return (
    <section className="animal-explorer" aria-label="Khám phá các nhóm con vật">
      <div className="animal-group-tabs" role="tablist" aria-label="Chọn nhóm con vật">
        {ANIMAL_GROUPS.map((group) => (
          <button
            type="button"
            role="tab"
            key={group.id}
            aria-selected={selectedGroup.id === group.id}
            className={selectedGroup.id === group.id ? "is-selected" : ""}
            onClick={() => chooseGroup(group)}
          >
            <span aria-hidden="true">{group.icon}</span>{group.label}
          </button>
        ))}
      </div>
      <div className="animal-gallery-visual" key={selectedGroup.id}>
        <Image src={selectedGroup.image} alt={selectedGroup.alt} width={1536} height={1024} sizes="(max-width: 620px) 100vw, 760px" />
      </div>
      <div className="animal-gallery-copy" aria-live="polite">
        <div><p className="kicker">{selectedGroup.label}</p><p>{selectedGroup.introduction}</p></div>
        <span>{selectedGroup.animals.length} bạn nhỏ</span>
      </div>
      <div className="animal-action-stage" aria-live="polite">
        <div className="animal-motion-frame">
          <video
            key={selectedAnimal.motionSrc}
            className="animal-motion-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedData={(event) => {
              if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) event.currentTarget.pause();
            }}
            aria-label={`Video ${selectedAnimal.name} đang cử động ngoài thực tế`}
          >
            <source src={selectedAnimal.motionSrc} type="video/mp4" />
          </video>
          <span>Video thật</span>
        </div>
        <div className="animal-action-copy">
          <p className="kicker">Cử động thật · tiếng kêu thật</p>
          <h4>{selectedAnimal.icon} {selectedAnimal.name}</h4>
          <p>{selectedAnimal.fact}</p>
          {"soundNote" in selectedAnimal && <p className="animal-sound-note">{selectedAnimal.soundNote}</p>}
          <button type="button" onClick={() => playAnimal(selectedAnimal)} disabled={soundState === "playing"}>
            <span aria-hidden="true">{soundState === "playing" ? "〽️" : "🔊"}</span>{soundState === "playing" ? " Đang phát..." : ` ${selectedAnimal.sound}`}
          </button>
          {soundState === "error" && <small className="animal-sound-error">Trình duyệt chưa phát được âm thanh. Bé thử chạm lại nhé.</small>}
          <a className="animal-media-credit" href="/media/animals/ATTRIBUTION.txt" target="_blank" rel="noreferrer">Nguồn video và âm thanh mở ↗</a>
        </div>
      </div>
      <div className="animal-fact-grid">
        {selectedGroup.animals.map((animal) => (
          <button
            type="button"
            key={animal.name}
            className={selectedAnimal.name === animal.name ? "is-selected" : ""}
            aria-pressed={selectedAnimal.name === animal.name}
            aria-label={`${animal.name}. Chạm để xem video và nghe tiếng thật.`}
            onClick={() => playAnimal(animal)}
          >
            <span aria-hidden="true">{animal.icon}</span>
            <div><strong>{animal.name}</strong><p>{animal.fact}</p><small>🔊 {animal.sound}</small></div>
          </button>
        ))}
      </div>
    </section>
  );
}

function WorldActivity({ topicId }: { topicId: string }) {
  const activity = WORLD_ACTIVITIES.find((item) => item.topicId === topicId);
  const [selectedLabel, setSelectedLabel] = useState(activity?.options[0]?.label ?? "");
  const [motionTick, setMotionTick] = useState(0);
  if (!activity) return null;
  const selectedOption = activity.options.find((option) => option.label === selectedLabel) ?? activity.options[0];

  function chooseOption(label: string, narration: string) {
    setSelectedLabel(label);
    setMotionTick((value) => value + 1);
    speakVietnamese(narration);
  }

  return (
    <section className="world-activity" style={{ "--activity-color": selectedOption.color } as React.CSSProperties}>
      <header><div><p className="kicker">Cùng tương tác</p><h4>{activity.title}</h4></div><p>{activity.instruction}</p></header>
      <div className="world-activity-options" role="tablist" aria-label={activity.title}>
        {activity.options.map((option) => (
          <button type="button" role="tab" key={option.label} aria-selected={selectedOption.label === option.label} className={selectedOption.label === option.label ? "is-selected" : ""} onClick={() => chooseOption(option.label, option.narration)}>
            <span aria-hidden="true">{option.icon}</span>{option.label}
          </button>
        ))}
      </div>
      <div className="world-activity-stage" aria-live="polite">
        <span key={`${selectedOption.label}-${motionTick}`} aria-hidden="true">{selectedOption.icon}</span>
        <div><strong>{selectedOption.label}</strong><p>{selectedOption.description}</p></div>
        <button type="button" onClick={() => chooseOption(selectedOption.label, selectedOption.narration)} aria-label={`Nghe nội dung ${selectedOption.label}`}>🔊 Nghe</button>
      </div>
    </section>
  );
}

function WorldStudy() {
  const [selectedTopicId, setSelectedTopicId] = useState<(typeof WORLD_TOPICS)[number]["id"]>(WORLD_TOPICS[0].id);
  const selectedTopic = WORLD_TOPICS.find((topic) => topic.id === selectedTopicId) ?? WORLD_TOPICS[0];

  return (
    <div className="world-study">
      <div className="study-board-heading"><div><h3>Những điều quanh bé</h3><p>Mỗi chủ đề là một cánh cửa nhỏ để bé quan sát và đặt câu hỏi.</p></div><strong>6 chủ đề</strong></div>
      <div className="world-study-layout">
        <div className="world-topic-list" role="tablist" aria-label="Chủ đề quanh em">
          {WORLD_TOPICS.map((topic) => (
            <button type="button" role="tab" key={topic.id} aria-selected={topic.id === selectedTopic.id} className={topic.id === selectedTopic.id ? "is-selected" : ""} onClick={() => setSelectedTopicId(topic.id)}>
              <span aria-hidden="true">{topic.icon}</span><span><strong>{topic.title}</strong><small>{topic.description}</small></span>
            </button>
          ))}
        </div>
        <article className="world-topic-detail" role="tabpanel" aria-live="polite">
          <header><span aria-hidden="true">{selectedTopic.icon}</span><div><p className="kicker">Bài học quanh em</p><h3>{selectedTopic.title}</h3></div></header>
          <p className="world-introduction">{selectedTopic.introduction}</p>
          {selectedTopic.id === "dong-vat" ? <AnimalGallery /> : (
            <>
              <div className="world-facts">
                {selectedTopic.facts.map((fact) => <div key={fact.title}><span aria-hidden="true">{fact.icon}</span><div><strong>{fact.title}</strong><p>{fact.text}</p></div></div>)}
              </div>
              <WorldActivity key={selectedTopic.id} topicId={selectedTopic.id} />
            </>
          )}
          <div className="world-study-tip"><span aria-hidden="true">👀</span><p><strong>Bé thử quan sát nhé!</strong> Tìm một ví dụ của bài học này ngay trong nhà hoặc ngoài cửa sổ.</p></div>
        </article>
      </div>
    </div>
  );
}

function LearningHub({ name, progress, onStart }: { name: string; progress: LearningProgress; onStart: (lesson: Lesson) => void }) {
  const [category, setCategory] = useState<CategoryId>("chu-cai");
  const [mode, setMode] = useState<"study" | "practice">("study");
  const categoryLessons = lessons.filter((lesson) => lesson.category === category);
  const currentCategory = categories.find((item) => item.id === category) ?? categories[0];
  const completion = Math.round((progress.completedLessonIds.length / lessons.length) * 100);

  function openCategory(nextCategory: CategoryId) {
    setCategory(nextCategory);
    setMode("study");
  }

  return (
    <main className="learn-page">
      <section className="learn-hero">
        <Image
          src="/images/sunshinson-home-hero.png"
          alt="Sun vui học với bảng số trong khu vườn"
          width={1862}
          height={845}
          priority
        />
        <div className="learn-hero-shade" aria-hidden="true" />
        <div className="learn-hero-copy">
          <p className="kicker">Mỗi ngày một điều hay</p>
          <h1>Học cùng bé</h1>
          <p>Chào {name}! Cùng khám phá đủ 29 chữ cái tiếng Việt và các số từ 0 đến 100 nhé.</p>
          <button type="button" onClick={() => document.getElementById("lesson-library-title")?.scrollIntoView({ behavior: "smooth" })}>
            Mở kho bài học <span aria-hidden="true">↓</span>
          </button>
        </div>
      </section>

      <section className="today-path" aria-labelledby="today-title">
        <div className="today-copy">
          <span className="today-icon" aria-hidden="true">☀</span>
          <div>
            <p className="kicker">Lộ trình hôm nay</p>
            <h2 id="today-title">Học trước, luyện ngay sau!</h2>
          </div>
        </div>
        <div className="today-progress" aria-label={`Đã hoàn thành ${completion}%`}>
          <div><span>Bài luyện của {name}</span><strong>{progress.completedLessonIds.length}/{lessons.length} bài</strong></div>
          <div className="today-progress-track"><span style={{ width: `${completion}%` }} /></div>
        </div>
        <div className="today-reward"><span aria-hidden="true">⭐</span><div><strong>{progress.stars}</strong><small>ngôi sao</small></div></div>
      </section>

      <section className="lesson-library" aria-labelledby="lesson-library-title">
        <div className="learning-heading">
          <div><p className="kicker">Học theo từng chủ đề</p><h2 id="lesson-library-title">Kho học của bé</h2></div>
          <p>Mỗi tab đều có phần học kiến thức và phần luyện tập tương tác.</p>
        </div>

        <div className="curriculum-tabs" role="tablist" aria-label="Chọn chủ đề học">
          {categories.map((item) => (
            <button
              type="button"
              role="tab"
              key={item.id}
              className={category === item.id ? "is-active" : ""}
              aria-selected={category === item.id}
              onClick={() => openCategory(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{item.description}</small></span>
            </button>
          ))}
        </div>

        <section className="curriculum-panel" role="tabpanel" aria-label={currentCategory.label}>
          <header className="curriculum-panel-heading">
            <div><span aria-hidden="true">{currentCategory.icon}</span><div><p className="kicker">{currentCategory.label}</p><h2>{mode === "study" ? "Cùng học nào!" : "Bé thử sức nhé!"}</h2></div></div>
            <div className="learning-mode-tabs" role="tablist" aria-label={`Chế độ ${currentCategory.label}`}>
              <button type="button" role="tab" aria-selected={mode === "study"} className={mode === "study" ? "is-active" : ""} onClick={() => setMode("study")}><span aria-hidden="true">📖</span> Học</button>
              <button type="button" role="tab" aria-selected={mode === "practice"} className={mode === "practice" ? "is-active" : ""} onClick={() => setMode("practice")}><span aria-hidden="true">✏️</span> Luyện tập</button>
            </div>
          </header>

          {mode === "study" ? (
            category === "chu-cai" ? <AlphabetStudy /> : category === "con-so" ? <NumberStudy /> : <WorldStudy />
          ) : (
            <div className="practice-section">
              <div className="practice-intro"><div><h3>Bài luyện dành cho bé</h3><p>Các chặng ngắn đã phủ đủ nội dung phần Học. Hoàn thành lần đầu để nhận ngôi sao.</p></div><strong>{categoryLessons.filter((lesson) => progress.completedLessonIds.includes(lesson.id)).length}/{categoryLessons.length} hoàn thành</strong></div>
              <div className="learning-grid">
                {categoryLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    completed={progress.completedLessonIds.includes(lesson.id)}
                    onStart={() => onStart(lesson)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </section>

      <aside className="grownup-note">
        <span aria-hidden="true">💛</span>
        <div><strong>Gợi ý cho người lớn</strong><p>Ở phần Học, hãy cùng bé đọc to từng chữ hoặc số. Sau đó chuyển sang Luyện tập để bé tự chọn câu trả lời.</p></div>
      </aside>
    </main>
  );
}

function LessonPlayer({ lesson, name, completedBefore, onComplete, onBack }: {
  lesson: Lesson;
  name: string;
  completedBefore: boolean;
  onComplete: (lesson: Lesson) => void;
  onBack: () => void;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const question = lesson.questions[questionIndex];
  const isCorrect = selectedAnswer === question.answer;
  const progress = finished ? 100 : Math.round((questionIndex / lesson.questions.length) * 100);

  function next() {
    if (!isCorrect) {
      setSelectedAnswer(null);
      return;
    }
    if (questionIndex === lesson.questions.length - 1) {
      setFinished(true);
      onComplete(lesson);
      return;
    }
    setQuestionIndex((current) => current + 1);
    setSelectedAnswer(null);
  }

  return (
    <main className="lesson-page" style={{ "--lesson": lesson.color, "--lesson-soft": lesson.soft } as React.CSSProperties}>
      <button type="button" className="lesson-back" onClick={onBack}><span aria-hidden="true">←</span> Về trang bài học</button>

      <section className="lesson-shell">
        <header className="lesson-toolbar">
          <div className="lesson-title"><span aria-hidden="true">{lesson.icon}</span><div><small>{lesson.eyebrow}</small><strong>{lesson.title}</strong></div></div>
          <div className="lesson-step"><span>{finished ? "Hoàn thành" : `Câu ${questionIndex + 1}/${lesson.questions.length}`}</span><div><i style={{ width: `${progress}%` }} /></div></div>
        </header>

        {finished ? (
          <div className="lesson-finish" role="status">
            <span className="finish-sun" aria-hidden="true">☀</span>
            <p className="kicker">Tuyệt vời!</p>
            <h1>{name} đã hoàn thành bài học</h1>
            <p>Bé đã kiên trì trả lời đúng cả {lesson.questions.length} câu. Sun tặng bé {completedBefore ? "một tràng vỗ tay thật lớn" : "3 ngôi sao mới"}!</p>
            <div className="finish-stars" aria-label={completedBefore ? "Đã hoàn thành lại bài học" : "Nhận được 3 ngôi sao"}>⭐ ⭐ ⭐</div>
            <div className="finish-actions">
              <button type="button" onClick={() => { setQuestionIndex(0); setSelectedAnswer(null); setFinished(false); }}>Học lại</button>
              <button type="button" className="primary" onClick={onBack}>Chọn bài tiếp theo <span aria-hidden="true">→</span></button>
            </div>
          </div>
        ) : (
          <div className="question-stage">
            <div className="question-visual" aria-hidden="true">{question.visual}</div>
            <p className="question-hint">{question.hint}</p>
            <h1>{question.prompt}</h1>
            <div className="answer-grid" aria-label="Các đáp án">
              {question.choices.map((choice) => {
                const chosen = selectedAnswer === choice;
                const answerClass = chosen ? (choice === question.answer ? " is-correct" : " is-wrong") : "";
                return <button type="button" key={choice} className={answerClass} aria-pressed={chosen} onClick={() => setSelectedAnswer(choice)}><span>{choice}</span>{chosen ? <b aria-hidden="true">{isCorrect ? "✓" : "×"}</b> : null}</button>;
              })}
            </div>

            <div className={`answer-feedback${selectedAnswer ? " is-visible" : ""}`} aria-live="polite">
              <div>
                <span aria-hidden="true">{isCorrect ? "🌟" : "🌱"}</span>
                <p><strong>{isCorrect ? "Đúng rồi, giỏi quá!" : "Gần đúng rồi!"}</strong>{isCorrect ? " Mình sang câu tiếp theo nhé." : " Bé thử lại một lần nữa nào."}</p>
              </div>
              <button type="button" onClick={next}>{isCorrect ? (questionIndex === lesson.questions.length - 1 ? "Xem kết quả" : "Tiếp tục") : "Thử lại"} <span aria-hidden="true">→</span></button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

export default function LearnWithChildPage() {
  const [name, setName] = useState("");
  const [progress, setProgress] = useState<LearningProgress>(EMPTY_PROGRESS);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const childName = readChildName();
      setName(childName);
      const saved = childName
        ? readVersionedStorage(getProgressStorageKey(childName), STORAGE_VERSION, isLearningProgress)
        : null;
      if (saved) setProgress(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function completeLesson(lesson: Lesson) {
    if (progress.completedLessonIds.includes(lesson.id)) return;
    const nextProgress = {
      completedLessonIds: [...progress.completedLessonIds, lesson.id],
      stars: progress.stars + 3,
    };
    setProgress(nextProgress);
    if (name) writeVersionedStorage(getProgressStorageKey(name), STORAGE_VERSION, nextProgress);
  }

  const help = (
    <div>
      <p><strong>Cách học:</strong> bé chọn một chủ đề, mở phần Học để khám phá từng chữ hoặc số rồi chuyển sang Luyện tập.</p>
      <p>Ở phần Luyện tập, nếu chọn chưa đúng bé luôn có thể thử lại. Mỗi bài hoàn thành lần đầu sẽ tặng 3 ngôi sao.</p>
      <p>Tiến độ được lưu riêng theo tên của từng bé trên thiết bị này để lần sau bé tiếp tục học.</p>
    </div>
  );

  return (
    <GameShell isGameInProgress={Boolean(activeLesson)} onLeaveGame={() => setActiveLesson(null)} helpContent={help}>
      {activeLesson ? (
        <LessonPlayer
          lesson={activeLesson}
          name={name || "Bé"}
          completedBefore={progress.completedLessonIds.includes(activeLesson.id)}
          onComplete={completeLesson}
          onBack={() => setActiveLesson(null)}
        />
      ) : (
        <LearningHub name={name || "bé"} progress={progress} onStart={setActiveLesson} />
      )}
    </GameShell>
  );
}
