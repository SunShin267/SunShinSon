"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { GameShell } from "../components/GameShell";
import { readVersionedStorage, writeVersionedStorage } from "../lib/versioned-storage";
import {
  MEMORY_LEVELS,
  calculateRoundScore,
  evaluateRecall,
  generateDigitSequence,
  getMemorizeDurationMs,
  getMemoryLevel,
  getNextLength,
  groupDigits,
  normalizeDigits,
  type MemoryLevelId,
  type RecallResult,
} from "./game";
import "./remember-numbers.css";

type Phase = "setup" | "countdown" | "memorize" | "recall" | "result";
type MemoryStats = { bestDigits: number; bestScore: number; roundsPlayed: number };

const STATS_KEY = "sunshinson-remember-numbers-stats";
const STATS_VERSION = 1;
const EMPTY_STATS: MemoryStats = { bestDigits: 0, bestScore: 0, roundsPlayed: 0 };

function isMemoryStats(value: unknown): value is MemoryStats {
  if (!value || typeof value !== "object") return false;
  const stats = value as Partial<MemoryStats>;
  return [stats.bestDigits, stats.bestScore, stats.roundsPlayed].every((item) => typeof item === "number" && Number.isFinite(item) && item >= 0);
}

export default function RememberNumbersPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [levelId, setLevelId] = useState<MemoryLevelId>("focus");
  const [sequence, setSequence] = useState("");
  const [answer, setAnswer] = useState("");
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [remainingMs, setRemainingMs] = useState(0);
  const [lastResult, setLastResult] = useState<RecallResult | null>(null);
  const [stats, setStats] = useState<MemoryStats>(EMPTY_STATS);
  const answerRef = useRef<HTMLInputElement | null>(null);
  const selectedLevel = useMemo(() => getMemoryLevel(levelId), [levelId]);
  const memorizeDuration = getMemorizeDurationMs(sequence.length || selectedLevel.startLength, levelId);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readVersionedStorage(STATS_KEY, STATS_VERSION, isMemoryStats);
      if (saved) setStats(saved);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = window.setTimeout(() => {
      if (countdown > 1) setCountdown((value) => value - 1);
      else setPhase("memorize");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "memorize") return;
    const duration = getMemorizeDurationMs(sequence.length, levelId);
    const startedAt = performance.now();

    const timer = window.setInterval(() => {
      const next = Math.max(0, duration - (performance.now() - startedAt));
      setRemainingMs(next);
      if (next <= 0) {
        window.clearInterval(timer);
        setPhase("recall");
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [phase, sequence, levelId]);

  useEffect(() => {
    if (phase !== "recall") return;
    const timer = window.setTimeout(() => answerRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [phase]);

  function beginRound(length: number) {
    setSequence(generateDigitSequence(length));
    setAnswer("");
    setLastResult(null);
    setCountdown(3);
    setRemainingMs(getMemorizeDurationMs(length, levelId));
    setPhase("countdown");
  }

  function startGame() {
    setRound(1);
    setScore(0);
    setStreak(0);
    beginRound(selectedLevel.startLength);
  }

  function submitAnswer(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (phase !== "recall" || !answer) return;

    const result = evaluateRecall(sequence, answer);
    const earned = calculateRoundScore(sequence.length, result.matched, result.correct, streak);
    const nextScore = score + earned;
    const nextStats = {
      bestDigits: Math.max(stats.bestDigits, result.correct ? sequence.length : 0),
      bestScore: Math.max(stats.bestScore, nextScore),
      roundsPlayed: stats.roundsPlayed + 1,
    };

    setLastResult(result);
    setScore(nextScore);
    setStreak(result.correct ? streak + 1 : 0);
    setStats(nextStats);
    writeVersionedStorage(STATS_KEY, STATS_VERSION, nextStats);
    setPhase("result");
  }

  function playNextRound() {
    const nextLength = getNextLength(sequence.length, Boolean(lastResult?.correct));
    setRound((value) => value + 1);
    beginRound(nextLength);
  }

  function appendDigit(digit: string) {
    setAnswer((value) => normalizeDigits(`${value}${digit}`, sequence.length));
  }

  function resetGame() {
    setPhase("setup");
    setSequence("");
    setAnswer("");
    setLastResult(null);
    setRound(1);
    setScore(0);
    setStreak(0);
  }

  const progress = phase === "memorize" ? Math.max(0, Math.min(100, (remainingMs / memorizeDuration) * 100)) : 100;

  return (
    <GameShell
      isGameInProgress={phase !== "setup"}
      onLeaveGame={resetGame}
      helpContent={(
        <div>
          <p><strong>Cách chơi:</strong> quan sát chuỗi số trước khi đồng hồ chạy hết, sau đó nhập lại đúng thứ tự.</p>
          <p>Trả lời đúng sẽ làm chuỗi dài thêm một số. Nếu chưa đúng, bé được thử một chuỗi khác cùng độ dài.</p>
          <p>Bé có thể dùng bàn phím máy tính hoặc các nút số trên màn hình.</p>
        </div>
      )}
    >
      <main className="remember-page">
        <section className="remember-hero">
          <div>
            <p className="kicker">Rèn trí nhớ · luyện tập trung</p>
            <h1>Nhớ số siêu tốc</h1>
            <p>Nhìn thật kỹ, cất dãy số vào trí nhớ rồi gọi chúng trở lại nhé!</p>
          </div>
          <div className="remember-hero-art" aria-hidden="true">
            <span>8</span><span>3</span><span>6</span>
          </div>
        </section>

        {phase === "setup" ? (
          <section className="remember-setup" aria-labelledby="remember-level-title">
            <div className="remember-section-heading">
              <div>
                <p className="kicker">Bước 1</p>
                <h2 id="remember-level-title">Chọn nhịp ghi nhớ</h2>
              </div>
              <div className="remember-best"><span>🏆 Kỷ lục</span><strong>{stats.bestDigits || "—"} số</strong></div>
            </div>
            <div className="remember-levels">
              {MEMORY_LEVELS.map((level) => (
                <button
                  type="button"
                  key={level.id}
                  className={levelId === level.id ? "is-selected" : ""}
                  onClick={() => setLevelId(level.id)}
                  aria-pressed={levelId === level.id}
                >
                  <span className="remember-level-icon" aria-hidden="true">{level.icon}</span>
                  <span><strong>{level.name}</strong><small>{level.description}</small></span>
                  <b>{level.startLength} số</b>
                </button>
              ))}
            </div>
            <div className="remember-start-row">
              <div><span>Chuỗi đầu tiên</span><strong>{selectedLevel.startLength} chữ số</strong></div>
              <div><span>Thời gian xem</span><strong>{(getMemorizeDurationMs(selectedLevel.startLength, levelId) / 1000).toFixed(1)} giây</strong></div>
              <button type="button" onClick={startGame}>Bắt đầu ghi nhớ <span aria-hidden="true">→</span></button>
            </div>
            <div className="remember-stats" aria-label="Thành tích đã lưu">
              <span><b>{stats.roundsPlayed}</b> lượt đã chơi</span>
              <span><b>{stats.bestScore}</b> điểm cao nhất</span>
              <span><b>{stats.bestDigits}</b> số nhớ đúng</span>
            </div>
          </section>
        ) : (
          <section className="remember-game" aria-live="polite">
            <div className="remember-toolbar">
              <div><span>Vòng</span><strong>{round}</strong></div>
              <div><span>Độ dài</span><strong>{sequence.length} số</strong></div>
              <div><span>Điểm</span><strong>{score}</strong></div>
              <div><span>Chuỗi đúng</span><strong>{streak ? `🔥 ${streak}` : "—"}</strong></div>
              <button type="button" onClick={resetGame}>Đổi mức</button>
            </div>

            <div className={`remember-stage remember-stage--${phase}`}>
              {phase === "countdown" ? (
                <div className="remember-countdown">
                  <p>Sẵn sàng nhìn nhé!</p>
                  <strong key={countdown}>{countdown}</strong>
                  <span>Hít sâu và tập trung 👀</span>
                </div>
              ) : null}

              {phase === "memorize" ? (
                <div className="remember-memorize">
                  <p>Ghi nhớ theo đúng thứ tự</p>
                  <div className="remember-sequence" aria-label={`Chuỗi cần nhớ: ${sequence}`}>
                    {groupDigits(sequence).map((group, index) => <span key={`${group}-${index}`}>{group}</span>)}
                  </div>
                  <div className="remember-time"><span style={{ width: `${progress}%` }} /></div>
                  <small>Còn {(remainingMs / 1000).toFixed(1)} giây</small>
                  <button type="button" onClick={() => setPhase("recall")}>Mình nhớ rồi!</button>
                </div>
              ) : null}

              {phase === "recall" ? (
                <form className="remember-recall" onSubmit={submitAnswer}>
                  <p className="kicker">Đến lượt bé</p>
                  <h2>Chuỗi số vừa rồi là gì?</h2>
                  <div className="remember-answer-wrap">
                    <input
                      ref={answerRef}
                      value={answer}
                      onChange={(event) => setAnswer(normalizeDigits(event.target.value, sequence.length))}
                      inputMode="numeric"
                      autoComplete="off"
                      aria-label="Nhập chuỗi số đã nhớ"
                      placeholder={Array.from({ length: sequence.length }, () => "•").join("")}
                    />
                    <span>{answer.length}/{sequence.length}</span>
                  </div>
                  <div className="remember-keypad" aria-label="Bàn phím số">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => <button type="button" key={digit} onClick={() => appendDigit(String(digit))}>{digit}</button>)}
                    <button type="button" className="remember-keypad-action" onClick={() => setAnswer("")} aria-label="Xóa toàn bộ">Xóa</button>
                    <button type="button" onClick={() => appendDigit("0")}>0</button>
                    <button type="button" className="remember-keypad-action" onClick={() => setAnswer((value) => value.slice(0, -1))} aria-label="Xóa số cuối">⌫</button>
                  </div>
                  <button className="remember-submit" type="submit" disabled={!answer}>Kiểm tra đáp án</button>
                </form>
              ) : null}

              {phase === "result" && lastResult ? (
                <div className={`remember-result ${lastResult.correct ? "is-correct" : "is-wrong"}`}>
                  <span className="remember-result-icon" aria-hidden="true">{lastResult.correct ? "🌟" : "🌈"}</span>
                  <p className="kicker">{lastResult.correct ? "Chính xác!" : "Gần đúng rồi!"}</p>
                  <h2>{lastResult.correct ? `Bé nhớ trọn vẹn ${sequence.length} số!` : `Bé đã nhớ đúng ${lastResult.matched}/${sequence.length} vị trí`}</h2>
                  <div className="remember-comparison" aria-label="So sánh đáp án">
                    {sequence.split("").map((digit, index) => (
                      <div key={`${digit}-${index}`} className={lastResult.positions[index] ? "is-match" : "is-miss"}>
                        <strong>{digit}</strong>
                        <span>{lastResult.answer[index] ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div className="remember-comparison-labels"><span>Số đúng</span><span>Bé nhập</span></div>
                  <p>{lastResult.correct ? "Vòng sau sẽ dài thêm 1 số. Cố lên nào!" : "Không sao cả — mình thử lại một chuỗi mới cùng độ dài nhé."}</p>
                  <div className="remember-result-actions">
                    <button type="button" onClick={playNextRound}>{lastResult.correct ? "Tăng thử thách" : "Thử lại"} <span aria-hidden="true">→</span></button>
                    <button type="button" className="secondary" onClick={resetGame}>Về chọn mức</button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        )}
      </main>
    </GameShell>
  );
}
