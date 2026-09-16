"use client";

import { useEffect, useState, type ChangeEvent } from "react";

import { SunLogo } from "../components/SunLogo";
import { readChildName } from "../lib/child-session";
import { navigateInternal } from "../lib/navigation";
import { readVersionedStorage, writeVersionedStorage } from "../lib/versioned-storage";
import { ColoringCanvas } from "./ColoringCanvas";
import {
  addSavedColoringArt,
  isSavedColoringCollection,
  SAVED_COLORING_STORAGE_KEY,
  SAVED_COLORING_STORAGE_VERSION,
  type SavedColoringArt,
} from "./saved-coloring";
import {
  coloringArts,
  coloringDownloadExtension,
  getColoringArtById,
  libraryThemes,
  suggestions,
  type ColoringArt,
} from "./coloring-arts";
import { printColoringImage } from "./print-coloring";
import "./to-mau.css";

type ColoringApiResponse = {
  image?: string;
  error?: { message?: string };
};

const galleryThemes = ["Tất cả", "Mẫu của bé", ...libraryThemes];
const MAX_LOCAL_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_LOCAL_IMAGE_DIMENSION = 1_600;

function loadLocalImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("invalid-image"));
    image.src = url;
  });
}

async function normalizeLocalImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("invalid-type");
  if (file.size > MAX_LOCAL_IMAGE_BYTES) throw new Error("too-large");

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadLocalImage(objectUrl);
    const scale = Math.min(1, MAX_LOCAL_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function chooseFallbackArt(prompt: string) {
  const normalized = prompt.toLocaleLowerCase("vi");
  if (normalized.includes("siêu nhân") || normalized.includes("anh hùng")) return getColoringArtById("sieu-nhan-anh-duong")!;
  if (normalized.includes("thỏ") || normalized.includes("cà rốt")) return getColoringArtById("rabbit")!;
  if (normalized.includes("khủng") || normalized.includes("dinosaur")) return getColoringArtById("dinosaur")!;
  if (normalized.includes("biển") || normalized.includes("tàu ngầm") || normalized.includes("rùa")) return getColoringArtById("submarine")!;
  return getColoringArtById("astronaut")!;
}

export default function ColoringPage() {
  const [childName, setChildName] = useState("Bé");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"describe" | "library">("describe");
  const [selectedArt, setSelectedArt] = useState<ColoringArt | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTheme, setActiveTheme] = useState("Tất cả");
  const [generationNotice, setGenerationNotice] = useState("");
  const [savedArts, setSavedArts] = useState<SavedColoringArt[]>([]);
  const [artModalMode, setArtModalMode] = useState<"preview" | "paint" | null>(null);

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      if (!isActive) return;
      const savedName = readChildName().trim();
      if (savedName) setChildName(savedName);
      const savedCollection = readVersionedStorage(
        SAVED_COLORING_STORAGE_KEY,
        SAVED_COLORING_STORAGE_VERSION,
        isSavedColoringCollection,
      );
      if (savedCollection) setSavedArts(savedCollection);
    });
    return () => { isActive = false; };
  }, []);

  useEffect(() => {
    if (!artModalMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setArtModalMode(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [artModalMode]);

  async function draw() {
    if (!prompt.trim() || isDrawing) return;
    setIsDrawing(true);
    setGenerationNotice("");

    try {
      const response = await fetch("/api/coloring/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const payload = await response.json() as ColoringApiResponse;
      if (!response.ok || !payload.image) throw new Error(payload.error?.message || "AI unavailable");

      const generatedArt: ColoringArt = {
        id: `sun-ai-${Date.now()}`,
        title: prompt.trim(),
        prompt: prompt.trim(),
        src: payload.image,
        icon: "✨",
        theme: "Tranh AI",
        generated: true,
      };
      setSelectedArt(generatedArt);
      setArtModalMode("preview");
      setGenerationNotice("Sun vừa vẽ riêng một bức tranh mới từ ý tưởng của bé!");
    } catch {
      setSelectedArt(chooseFallbackArt(prompt));
      setArtModalMode("preview");
      setGenerationNotice("Xưởng vẽ AI đang nghỉ một chút, Sun đã chọn một tranh mẫu gần nhất để bé vẫn có thể tô ngay.");
    } finally {
      setIsDrawing(false);
    }
  }

  function openArt(art: ColoringArt) {
    setPrompt(art.prompt);
    setSelectedArt(art);
    setGenerationNotice("");
    setArtModalMode("preview");
  }

  async function importLocalArt(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const src = await normalizeLocalImage(file);
      const fileTitle = file.name.replace(/\.[^.]+$/, "").trim().slice(0, 140) || "Tranh của bé";
      const importedArt: ColoringArt = {
        id: `sun-ai-local-${Date.now()}`,
        title: fileTitle,
        prompt: `Tranh nhập từ máy: ${fileTitle}`.slice(0, 160),
        src,
        icon: "📁",
        theme: "Tranh AI",
        generated: true,
      };
      setPrompt(fileTitle);
      setSelectedArt(importedArt);
      setArtModalMode("preview");
      setGenerationNotice("Đã nhập tranh từ máy. Bé có thể in, tô hoặc lưu tranh vào “Mẫu của bé”!");
    } catch (error) {
      setGenerationNotice(error instanceof Error && error.message === "too-large"
        ? "Ảnh lớn hơn 10 MB. Ba mẹ hãy chọn một ảnh nhỏ hơn nhé."
        : "Sun chưa đọc được ảnh này. Ba mẹ hãy chọn ảnh JPG, PNG hoặc WebP nhé.");
    } finally {
      input.value = "";
    }
  }

  function saveSelectedArt() {
    if (!selectedArt?.generated || savedArts.some((art) => art.id === selectedArt.id)) return;
    const nextArts = addSavedColoringArt(savedArts, {
      id: selectedArt.id,
      title: selectedArt.title,
      prompt: selectedArt.prompt,
      src: selectedArt.src,
      icon: "💛",
      theme: "Mẫu của bé",
      generated: true,
      saved: true,
    });

    if (!nextArts.some((art) => art.id === selectedArt.id)) {
      setGenerationNotice("Bức tranh này hơi lớn nên thiết bị chưa thể lưu vào bộ sưu tập.");
      return;
    }
    if (!writeVersionedStorage(SAVED_COLORING_STORAGE_KEY, SAVED_COLORING_STORAGE_VERSION, nextArts)) {
      setGenerationNotice("Bộ nhớ trên thiết bị đã đầy. Bé có thể xóa một mẫu cũ rồi thử lại nhé.");
      return;
    }

    setSavedArts(nextArts);
    setGenerationNotice("Đã lưu tranh vào “Mẫu của bé” trên thiết bị này!");
  }

  function removeSavedArt(id: string) {
    const nextArts = savedArts.filter((art) => art.id !== id);
    if (!writeVersionedStorage(SAVED_COLORING_STORAGE_KEY, SAVED_COLORING_STORAGE_VERSION, nextArts)) return;
    setSavedArts(nextArts);
    setGenerationNotice("Đã bỏ tranh khỏi “Mẫu của bé”.");
  }

  function startPainting(art: ColoringArt) {
    setSelectedArt(art);
    setArtModalMode("paint");
  }

  const allArts: ColoringArt[] = [...savedArts, ...coloringArts];
  const visibleArts = allArts.filter((art) => activeTheme === "Tất cả" || art.theme === activeTheme);
  const selectedIsSaved = Boolean(selectedArt && savedArts.some((art) => art.id === selectedArt.id));

  return (
    <div className="coloring-page">
      <header className="coloring-header">
        <button className="coloring-brand" onClick={() => navigateInternal("/")} aria-label="Về trang chủ SunShinSon">
          <SunLogo compact />
        </button>
        <nav aria-label="Điều hướng góc tô màu">
          <a href="#ve"><span aria-hidden="true">✎</span> Vẽ tranh</a>
          <a href="#bo-suu-tap"><span aria-hidden="true">▦</span> Bộ sưu tập</a>
          <button onClick={() => navigateInternal("/")}><span aria-hidden="true">⌂</span> Góc vui học</button>
        </nav>
      </header>

      <main>
        <section className="coloring-hero" id="ve" aria-labelledby="coloring-title">
          <div className="coloring-intro">
            <p className="coloring-kicker">Góc sáng tạo của {childName}</p>
            <h1 id="coloring-title">Bé nghĩ gì, <span>Sun vẽ nấy</span></h1>
            <p>Bé kể một ý tưởng, Sun sẽ tìm tranh nét thật rõ để mình in ra và tô màu ngay tại nhà.</p>
          </div>

          <div className="coloring-workspace">
            <div className="coloring-controls">
              <div className="coloring-tabs" role="tablist" aria-label="Cách chọn tranh">
                <button role="tab" aria-selected={mode === "describe"} onClick={() => setMode("describe")}>
                  <span aria-hidden="true">✎</span> Kể bằng lời
                </button>
                <button role="tab" aria-selected={mode === "library"} onClick={() => setMode("library")}>
                  <span aria-hidden="true">▦</span> Chọn tranh mẫu
                </button>
              </div>

              <label htmlFor="coloring-prompt">{mode === "describe" ? "Bé muốn tô hình gì?" : "Chọn ý tưởng bé thích"}</label>
              <div className="coloring-textarea-wrap">
                <textarea
                  id="coloring-prompt"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Ví dụ: Bạn phi hành gia đang vẫy tay trên Mặt Trăng"
                  maxLength={160}
                />
                <span>{prompt.length}/160</span>
              </div>

              <div className="coloring-suggestions" aria-label="Ý tưởng nhanh">
                {suggestions.map((art) => (
                  <button key={art.id} onClick={() => setPrompt(art.prompt)}>{art.icon} {art.title}</button>
                ))}
              </div>

              <div className="coloring-actions">
                <button className="coloring-draw" onClick={draw} disabled={!prompt.trim() || isDrawing}>
                  <span aria-hidden="true">✎</span> {isDrawing ? "Sun đang vẽ..." : "Vẽ cùng Sun"}
                </button>
                <label className="coloring-import">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={importLocalArt} />
                  <span aria-hidden="true">↑</span> Nhập tranh từ máy
                </label>
                <div className="coloring-name"><span aria-hidden="true">☺</span><span>Tranh của <strong>{childName}</strong></span></div>
              </div>

              {generationNotice ? <p className="coloring-generation-notice" role="status">{generationNotice}</p> : null}

              <div className="coloring-tip"><span aria-hidden="true">☀</span><p><strong>Mẹo nhỏ</strong> Bé kể thêm nơi chốn hoặc người bạn đi cùng để ý tưởng sinh động hơn nhé.</p></div>
            </div>

            <div className={`coloring-preview ${selectedArt ? "has-art" : ""}`} aria-live="polite">
              {selectedArt ? (
                <>
                  <div className="coloring-paper coloring-view-paper">
                    <div className="coloring-paper-heading"><span>SunShinSon</span><strong>Tranh của {childName}</strong></div>
                    <div className="coloring-view-image"><img src={selectedArt.src} alt={selectedArt.title} /></div>
                    <p>{selectedArt.title}</p>
                  </div>
                  <div className="coloring-preview-actions">
                    <button onClick={() => printColoringImage(selectedArt.src, selectedArt.title)}>⌁ In tranh</button>
                    <a href={selectedArt.src} download={`${selectedArt.id}-sunshinson.${coloringDownloadExtension(selectedArt.src)}`}>↓ Tải tranh</a>
                    <button className="coloring-start-paint" onClick={() => startPainting(selectedArt)}>✎ Tô tranh</button>
                    {selectedArt.generated ? (
                      <button className="coloring-save" onClick={saveSelectedArt} disabled={selectedIsSaved}>{selectedIsSaved ? "✓ Đã lưu" : "♡ Lưu vào mẫu"}</button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="coloring-empty">
                  <span aria-hidden="true">✦</span>
                  <h2>Tranh của bé sẽ hiện ở đây</h2>
                  <p>Kể ý tưởng rồi bấm “Vẽ cùng Sun” nhé.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="coloring-gallery" id="bo-suu-tap" aria-labelledby="gallery-title">
          <div className="coloring-section-heading">
            <div><p className="coloring-kicker">Thư viện tranh nét</p><h2 id="gallery-title">Chọn một tranh, tô cả thế giới</h2></div>
            <p>{coloringArts.length} ý tưởng có sẵn · {savedArts.length} mẫu của bé</p>
          </div>
          <div className="coloring-filters" aria-label="Chủ đề tranh">
            {galleryThemes.map((theme) => (
              <button className={activeTheme === theme ? "is-active" : ""} key={theme} onClick={() => setActiveTheme(theme)}>{theme}</button>
            ))}
          </div>
          {visibleArts.length ? (
            <div className="coloring-grid">
              {visibleArts.map((art) => (
                <div className="coloring-card-shell" key={art.id}>
                  <button className="coloring-card" onClick={() => openArt(art)}>
                    <span className="coloring-card-image"><img src={art.src} alt="" loading="lazy" decoding="async" /></span>
                    <span className="coloring-card-copy"><small>{art.icon} {art.theme}</small><strong>{art.title}</strong><span>Chọn tranh này <b aria-hidden="true">→</b></span></span>
                  </button>
                  {art.saved ? (
                    <button className="coloring-card-remove" onClick={() => removeSavedArt(art.id)} aria-label={`Xóa ${art.title} khỏi mẫu của bé`}>×</button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="coloring-gallery-empty"><span>♡</span><strong>Chưa có mẫu nào được lưu</strong><p>Bé hãy tạo một bức tranh AI rồi bấm “Lưu vào mẫu” nhé.</p></div>
          )}
        </section>
      </main>

      <footer className="coloring-footer"><SunLogo compact /><p>Mỗi nét màu là một câu chuyện nhỏ · SunShinSon</p></footer>

      {selectedArt && artModalMode ? (
        <div
          className="coloring-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setArtModalMode(null);
          }}
        >
          <section
            className={`coloring-art-modal ${artModalMode === "paint" ? "is-painting" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coloring-modal-title"
          >
            <header className="coloring-modal-header">
              <div>
                <small>{artModalMode === "paint" ? "Xưởng tô màu" : "Xem tranh"}</small>
                <h2 id="coloring-modal-title">{selectedArt.title}</h2>
              </div>
              <button onClick={() => setArtModalMode(null)} aria-label="Đóng cửa sổ tranh">×</button>
            </header>

            {artModalMode === "preview" ? (
              <div className="coloring-modal-preview">
                <div className="coloring-paper coloring-view-paper">
                  <div className="coloring-paper-heading"><span>SunShinSon</span><strong>Tranh của {childName}</strong></div>
                  <div className="coloring-view-image"><img src={selectedArt.src} alt={selectedArt.title} /></div>
                  <p>{selectedArt.title}</p>
                </div>
                <div className="coloring-preview-actions">
                  <button onClick={() => printColoringImage(selectedArt.src, selectedArt.title)}>⌁ In tranh</button>
                  <a href={selectedArt.src} download={`${selectedArt.id}-sunshinson.${coloringDownloadExtension(selectedArt.src)}`}>↓ Tải tranh</a>
                  <button className="coloring-start-paint" onClick={() => startPainting(selectedArt)}>✎ Tô tranh</button>
                  {selectedArt.generated ? (
                    <button className="coloring-save" onClick={saveSelectedArt} disabled={selectedIsSaved}>{selectedIsSaved ? "✓ Đã lưu" : "♡ Lưu vào mẫu"}</button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="coloring-modal-paint-body">
                <ColoringCanvas key={selectedArt.id} art={selectedArt} childName={childName} />
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
