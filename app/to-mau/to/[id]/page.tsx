"use client";

import { useSyncExternalStore } from "react";

import { SunLogo } from "../../../components/SunLogo";
import { readChildName } from "../../../lib/child-session";
import { navigateInternal } from "../../../lib/navigation";
import { readVersionedStorage } from "../../../lib/versioned-storage";
import { ColoringCanvas } from "../../ColoringCanvas";
import { getColoringArtById, type ColoringArt } from "../../coloring-arts";
import { readPaintingSession } from "../../painting-session";
import {
  isSavedColoringCollection,
  SAVED_COLORING_STORAGE_KEY,
  SAVED_COLORING_STORAGE_VERSION,
} from "../../saved-coloring";
import "../../to-mau.css";

function artIdFromLocation() {
  const segment = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function subscribeToBrowserReady() {
  return () => undefined;
}

function resolveArt(id: string) {
  const savedArts = readVersionedStorage(
    SAVED_COLORING_STORAGE_KEY,
    SAVED_COLORING_STORAGE_VERSION,
    isSavedColoringCollection,
  ) ?? [];
  return getColoringArtById(id) ?? readPaintingSession(id) ?? savedArts.find((item) => item.id === id) ?? null;
}

export default function PaintColoringPage() {
  const isReady = useSyncExternalStore(subscribeToBrowserReady, () => true, () => false);
  const id = isReady ? artIdFromLocation() : "";
  const art: ColoringArt | null = isReady ? resolveArt(id) : null;
  const childName = isReady ? readChildName().trim() || "Bé" : "Bé";

  return (
    <div className="coloring-page coloring-paint-page">
      <header className="coloring-header">
        <button className="coloring-brand" onClick={() => navigateInternal("/to-mau")} aria-label="Về bộ sưu tập tranh">
          <SunLogo compact />
        </button>
        <nav aria-label="Điều hướng trang tô tranh">
          <button onClick={() => navigateInternal("/to-mau#bo-suu-tap")}><span aria-hidden="true">←</span> Chọn tranh khác</button>
          <button onClick={() => navigateInternal("/")}><span aria-hidden="true">⌂</span> Góc vui học</button>
        </nav>
      </header>

      <main className="coloring-paint-main">
        <div className="coloring-paint-intro">
          <p className="coloring-kicker">Xưởng màu của {childName}</p>
          <h1>{art ? <>Cùng tô <span>{art.title}</span></> : "Sẵn sàng tô màu"}</h1>
          <p>Chọn màu, chỉnh độ to của nét rồi rê bút trên tranh. Vòng tròn trên đầu bút cho bé biết chính xác vùng sắp tô.</p>
        </div>

        {art ? (
          <section className="coloring-paint-workspace coloring-preview has-art" aria-label={`Tô tranh ${art.title}`}>
            <ColoringCanvas key={art.id} art={art} childName={childName} />
          </section>
        ) : isReady ? (
          <section className="coloring-paint-missing">
            <span aria-hidden="true">✦</span>
            <h2>Sun chưa tìm thấy tranh này</h2>
            <p>Tranh AI có thể chỉ được giữ trong phiên hiện tại. Bé hãy chọn lại một tranh từ bộ sưu tập nhé.</p>
            <button onClick={() => navigateInternal("/to-mau#bo-suu-tap")}>Về bộ sưu tập</button>
          </section>
        ) : (
          <section className="coloring-paint-missing" aria-live="polite"><p>Sun đang chuẩn bị hộp màu…</p></section>
        )}
      </main>
    </div>
  );
}
