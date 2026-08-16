"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GameShell } from "../components/GameShell";
import { readChildName } from "../lib/child-session";
import { readVersionedStorage, writeVersionedStorage } from "../lib/versioned-storage";
import { createNumberHunt, createNumberOrder, hasEveryNumberOnce, isValidMaximum, selectNumber, type NumberHuntState } from "./game";
import { getPrintGeometry } from "./print-geometry";
import { PrintSheet } from "./PrintSheet";

const SETTINGS_KEY = "sunshinson-number-hunt-settings";
const SETTINGS_VERSION = 1;
type Settings = { sound: boolean };

function isSettings(value: unknown): value is Settings {
  return value !== null && typeof value === "object" && "sound" in value && typeof value.sound === "boolean";
}

function formatTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function NumberHuntPage() {
  const [maximumInput, setMaximumInput] = useState("100");
  const [game, setGame] = useState<NumberHuntState | null>(null);
  const [message, setMessage] = useState("Chọn một cỡ bảng rồi bắt đầu nhé!");
  const [elapsed, setElapsed] = useState(0);
  const [sound, setSound] = useState(true);
  const [childName, setChildName] = useState("");
  const [printValues, setPrintValues] = useState<number[] | null>(null);
  const wrongTimeout = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const [wrongValue, setWrongValue] = useState<number | null>(null);
  const completed = Boolean(game && game.next > game.order.length);
  const geometry = useMemo(() => game ? getPrintGeometry(game.order.length) : null, [game]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setChildName(readChildName());
      const saved = readVersionedStorage(SETTINGS_KEY, SETTINGS_VERSION, isSettings);
      if (saved) setSound(saved.sound);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!game || completed || startedAt.current === null) return;
    const refresh = () => setElapsed(Math.floor((performance.now() - startedAt.current!) / 1000));
    refresh();
    const timer = window.setInterval(refresh, 250);
    return () => window.clearInterval(timer);
  }, [game, completed]);
  useEffect(() => () => {
    if (wrongTimeout.current) window.clearTimeout(wrongTimeout.current);
    if (audioContext.current && audioContext.current.state !== "closed") void audioContext.current.close();
  }, []);

  function start(order?: number[]) {
    const maximum = Number(maximumInput);
    if (!isValidMaximum(maximum)) { setMessage("Hãy nhập số nguyên từ 10 đến 500 nhé."); return; }
    startedAt.current = performance.now();
    setGame(createNumberHunt(maximum, order)); setElapsed(0); setWrongValue(null); setMessage("Tìm số 1 trước nào!");
  }
  function reshuffle() {
    if (game && !completed && !window.confirm("Bảng hiện tại chưa hoàn thành. Bé muốn xáo lại và bắt đầu từ đầu?")) return;
    start();
  }
  function playSuccessTone() {
    try {
      const context = audioContext.current ?? new AudioContext();
      audioContext.current = context;
      const soundTone = () => {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(660, now);
        oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.11);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.17);
      };
      if (context.state === "suspended") void context.resume().then(soundTone).catch(() => undefined);
      else soundTone();
    } catch {
      // Sound is optional; gameplay remains available when Web Audio is unavailable.
    }
  }
  function choose(value: number) {
    if (!game || completed) return;
    const result = selectNumber(game, value); setGame(result.state);
    if (result.correct) {
      setMessage(result.completed ? "Tuyệt vời! Bé đã tìm hết các số." : `Đúng rồi! Tìm số ${result.state.next} nhé.`);
      if (result.completed && startedAt.current !== null) {
        const gameStartedAt = startedAt.current;
        window.setTimeout(() => setElapsed(Math.floor((performance.now() - gameStartedAt) / 1000)), 0);
      }
      if (sound) playSuccessTone();
    } else {
      setWrongValue(value); setMessage(`Chưa đúng rồi, hãy tìm số ${game.next} trước nhé.`);
      if (wrongTimeout.current) window.clearTimeout(wrongTimeout.current);
      wrongTimeout.current = window.setTimeout(() => setWrongValue(null), 480);
    }
  }
  function updateSound(enabled: boolean) { setSound(enabled); writeVersionedStorage(SETTINGS_KEY, SETTINGS_VERSION, { sound: enabled }); }
  function printBoard() {
    if (!game || !geometry) return;
    const fresh = createNumberOrder(game.order.length);
    if (!hasEveryNumberOnce(fresh, game.order.length)) { setMessage("Không thể tạo bảng in an toàn. Hãy thử lại nhé."); return; }
    // Render a separate immutable sheet before measuring it on the next frame.
    setPrintValues(fresh);
  }
  useEffect(() => {
    if (!printValues || !game || !geometry) return;
    const frame = window.requestAnimationFrame(() => {
      const sheet = document.getElementById("number-hunt-print-sheet");
      const header = sheet?.querySelector<HTMLElement>("[data-print-header]");
      const grid = sheet?.querySelector<HTMLElement>(".number-hunt-print-grid");
      const fields = Array.from(sheet?.querySelectorAll<HTMLElement>("[data-print-field]") ?? []);
      const cells = sheet?.querySelectorAll("[data-print-value]") ?? [];
      const values = new Set(Array.from(cells, (cell) => Number((cell as HTMLElement).dataset.printValue)));
      const box = sheet?.getBoundingClientRect();
      const headerBox = header?.getBoundingClientRect();
      const gridBox = grid?.getBoundingClientRect();
      const expected = game.order.length;
      const within = (child: DOMRect, parent: DOMRect) => child.left >= parent.left - 1 && child.top >= parent.top - 1 && child.right <= parent.right + 1 && child.bottom <= parent.bottom + 1;
      const noScrollOverflow = (element: HTMLElement) => element.scrollWidth <= element.clientWidth + 1 && element.scrollHeight <= element.clientHeight + 1;
      const cellsFit = Boolean(box) && Array.from(cells).every((cell) => {
        const cellBox = cell.getBoundingClientRect();
        return cellBox.width > 0 && cellBox.height > 0 && within(cellBox, box!);
      });
      const fieldNames = new Set(fields.map((field) => field.dataset.printField));
      const fieldsValid = ["title", "name", "date", "time"].every((name) => fieldNames.has(name))
        && fields.every((field) => Boolean(field.textContent?.trim()) && Boolean(headerBox) && within(field.getBoundingClientRect(), headerBox!) && noScrollOverflow(field));
      const headerFits = Boolean(header && headerBox && box) && headerBox!.width > 0 && headerBox!.height > 0 && within(headerBox!, box!) && noScrollOverflow(header!);
      const gridFits = Boolean(grid && gridBox && box) && gridBox!.width > 0 && gridBox!.height > 0 && within(gridBox!, box!) && noScrollOverflow(grid!);
      const sheetFits = Boolean(sheet && box) && noScrollOverflow(sheet!) && box!.width <= 1120 && box!.height <= 1120;
      if (!sheet || !box || cells.length !== expected || values.size !== expected || !hasEveryNumberOnce([...values], expected) || !cellsFit || !fieldsValid || !headerFits || !gridFits || !sheetFits) {
        setMessage("Bảng in chưa vừa một trang A4. Sun đã chặn lệnh in để bảo vệ đủ các số."); setPrintValues(null); return;
      }
      window.print(); setPrintValues(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [printValues, game, geometry]);

  return (
    <GameShell isGameInProgress={Boolean(game && !completed)} onLeaveGame={() => setGame(null)} helpContent={<div><p><strong>Cách chơi:</strong> tìm các số theo thứ tự từ 1 đến số lớn nhất.</p><p>Chạm hoặc bấm vào ô số. Bấm nhầm không làm mất điểm đã tìm được.</p></div>}>
      <main className="number-hunt-page">
        <section className="number-hunt-hero"><div><p className="kicker">Nhanh mắt nhanh tay</p><h1>Tìm số cùng Sun</h1><p>Tìm lần lượt các số đang trốn trong khu vườn nhé!</p></div><span aria-hidden="true">🔢</span></section>
        {!game ? <section className="number-hunt-card number-hunt-setup"><h2>Tạo bảng số</h2><label htmlFor="number-hunt-maximum">Số lớn nhất (10–500)</label><div><input id="number-hunt-maximum" inputMode="numeric" type="number" min="10" max="500" step="1" value={maximumInput} onChange={(event) => setMaximumInput(event.target.value)} /><button onClick={() => start()}>Tạo bảng</button></div><p className="number-hunt-message" role="status">{message}</p></section> : <>
          <section className="number-hunt-card number-hunt-toolbar"><div><span>Đang tìm</span><strong>{completed ? "Hoàn thành!" : game.next}</strong></div><div><span>Thời gian</span><strong>{formatTime(elapsed)}</strong></div><div><span>Đã tìm</span><strong>{game.found.length}/{game.order.length}</strong></div><div><span>Lỗi</span><strong>{game.mistakes}</strong></div><label className="sound-toggle"><input type="checkbox" checked={sound} onChange={(event) => updateSound(event.target.checked)} /> 🔊 Âm thanh</label></section>
          <p className="number-hunt-message" role="status" aria-live="polite">{message}</p>
          <section className="number-hunt-grid" style={{ "--number-columns": Math.ceil(Math.sqrt(game.order.length)) } as React.CSSProperties} aria-label="Bảng tìm số">
            {game.order.map((value) => { const found = game.found.includes(value); return <button key={value} disabled={found || completed} onClick={() => choose(value)} className={`number-hunt-cell${found ? " is-found" : ""}${wrongValue === value ? " is-wrong" : ""}`} aria-label={`Số ${value}${found ? ", đã tìm" : ""}`}>{value}</button>; })}
          </section>
          {completed ? <section className="number-hunt-card number-hunt-complete"><span>🌟</span><div><h2>Giỏi quá, {childName || "bé"} ơi!</h2><p>Bé hoàn thành trong <strong>{formatTime(elapsed)}</strong> với {game.mistakes} lần chọn nhầm.</p></div><button onClick={() => start(game.order)}>Chơi lại</button><button className="secondary" onClick={() => start()}>Xáo lại</button><button className="secondary" onClick={printBoard}>In bảng mới</button></section> : <div className="number-hunt-actions"><button className="secondary" onClick={reshuffle}>Xáo lại bảng</button><button className="secondary" onClick={printBoard}>In bảng mới</button></div>}
        </>}
      </main>
      {printValues && geometry ? <PrintSheet values={printValues} geometry={geometry} childName={childName} /> : null}
    </GameShell>
  );
}
