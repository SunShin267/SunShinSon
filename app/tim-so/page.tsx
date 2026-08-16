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
  const wrongTimeout = useRef<number | null>(null);
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
  useEffect(() => { if (game && !completed) { const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000); return () => window.clearInterval(timer); } }, [game, completed]);
  useEffect(() => () => { if (wrongTimeout.current) window.clearTimeout(wrongTimeout.current); }, []);

  function start(order?: number[]) {
    const maximum = Number(maximumInput);
    if (!isValidMaximum(maximum)) { setMessage("Hãy nhập số nguyên từ 10 đến 500 nhé."); return; }
    setGame(createNumberHunt(maximum, order)); setElapsed(0); setWrongValue(null); setMessage("Tìm số 1 trước nào!");
  }
  function choose(value: number) {
    if (!game || completed) return;
    const result = selectNumber(game, value); setGame(result.state);
    if (result.correct) {
      setMessage(result.completed ? "Tuyệt vời! Bé đã tìm hết các số." : `Đúng rồi! Tìm số ${result.state.next} nhé.`);
      if (sound) { try { new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play(); } catch {} }
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
  const [printValues, setPrintValues] = useState<number[] | null>(null);
  useEffect(() => {
    if (!printValues || !game || !geometry) return;
    const frame = window.requestAnimationFrame(() => {
      const sheet = document.getElementById("number-hunt-print-sheet");
      const cells = sheet?.querySelectorAll("[data-print-value]") ?? [];
      const values = new Set(Array.from(cells, (cell) => Number((cell as HTMLElement).dataset.printValue)));
      const box = sheet?.getBoundingClientRect();
      const expected = game.order.length;
      const cellsFit = Boolean(box) && Array.from(cells).every((cell) => {
        const cellBox = cell.getBoundingClientRect();
        return cellBox.width > 0 && cellBox.height > 0 && cellBox.left >= box!.left && cellBox.top >= box!.top && cellBox.right <= box!.right + 1 && cellBox.bottom <= box!.bottom + 1;
      });
      if (!sheet || !box || cells.length !== expected || values.size !== expected || !hasEveryNumberOnce([...values], expected) || !cellsFit || box.width > 1120 || box.height > 1120) {
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
          {completed ? <section className="number-hunt-card number-hunt-complete"><span>🌟</span><div><h2>Giỏi quá, {childName || "bé"} ơi!</h2><p>Bé hoàn thành trong <strong>{formatTime(elapsed)}</strong> với {game.mistakes} lần chọn nhầm.</p></div><button onClick={() => start(game.order)}>Chơi lại</button><button className="secondary" onClick={() => start()}>Xáo lại</button><button className="secondary" onClick={printBoard}>In bảng mới</button></section> : <div className="number-hunt-actions"><button className="secondary" onClick={() => start()}>Xáo lại bảng</button><button className="secondary" onClick={printBoard}>In bảng mới</button></div>}
        </>}
      </main>
      {printValues && geometry ? <PrintSheet values={printValues} geometry={geometry} childName={childName} /> : null}
    </GameShell>
  );
}
