"use client";

import { useEffect, useState } from "react";

import { SunLogo } from "../components/SunLogo";
import { readChildName } from "../lib/child-session";
import { navigateInternal } from "../lib/navigation";
import "./to-mau.css";

type ColoringArt = {
  id: string;
  title: string;
  prompt: string;
  src: string;
  icon: string;
  theme: string;
  generated?: boolean;
};

type ColoringApiResponse = {
  image?: string;
  error?: { message?: string };
};

const coloringArts: ColoringArt[] = [
  {
    id: "astronaut",
    title: "Bạn nhỏ khám phá Mặt Trăng",
    prompt: "Bạn phi hành gia vẫy tay bên xe thám hiểm trên Mặt Trăng",
    src: "/images/to-mau/phi-hanh-gia.png",
    icon: "🚀",
    theme: "Vũ trụ",
  },
  {
    id: "dinosaur",
    title: "Khủng long trong vườn dương xỉ",
    prompt: "Khủng long con vui vẻ khám phá khu vườn thời tiền sử",
    src: "/images/to-mau/khung-long.png",
    icon: "🦕",
    theme: "Khủng long",
  },
  {
    id: "rabbit",
    title: "Thỏ ôm củ cà rốt",
    prompt: "Bạn thỏ ôm củ cà rốt thật to trong vườn hoa",
    src: "/images/to-mau/tho-ca-rot.png",
    icon: "🐰",
    theme: "Động vật",
  },
  {
    id: "submarine",
    title: "Tàu ngầm và rùa biển",
    prompt: "Tàu ngầm nhỏ gặp bạn rùa dưới đáy đại dương",
    src: "/images/to-mau/tau-ngam.png",
    icon: "🐢",
    theme: "Đại dương",
  },
];

const suggestions = coloringArts.slice(0, 3);
const galleryThemes = ["Tất cả", "Vũ trụ", "Động vật", "Khủng long", "Đại dương"];

function chooseFallbackArt(prompt: string) {
  const normalized = prompt.toLocaleLowerCase("vi");
  if (normalized.includes("thỏ") || normalized.includes("cà rốt")) return coloringArts[2];
  if (normalized.includes("khủng") || normalized.includes("dinosaur")) return coloringArts[1];
  if (normalized.includes("biển") || normalized.includes("tàu ngầm") || normalized.includes("rùa")) return coloringArts[3];
  return coloringArts[0];
}

export default function ColoringPage() {
  const [childName, setChildName] = useState("Bé");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"describe" | "library">("describe");
  const [selectedArt, setSelectedArt] = useState<ColoringArt | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTheme, setActiveTheme] = useState("Tất cả");
  const [generationNotice, setGenerationNotice] = useState("");

  useEffect(() => {
    const savedName = readChildName().trim();
    if (savedName) setChildName(savedName);
  }, []);

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

      setSelectedArt({
        id: `sun-ai-${Date.now()}`,
        title: prompt.trim(),
        prompt: prompt.trim(),
        src: payload.image,
        icon: "✨",
        theme: "Tranh AI",
        generated: true,
      });
      setGenerationNotice("Sun vừa vẽ riêng một bức tranh mới từ ý tưởng của bé!");
    } catch {
      setSelectedArt(chooseFallbackArt(prompt));
      setGenerationNotice("Xưởng vẽ AI đang nghỉ một chút, Sun đã chọn một tranh mẫu gần nhất để bé vẫn có thể tô ngay.");
    } finally {
      setIsDrawing(false);
    }
  }

  function openArt(art: ColoringArt) {
    setPrompt(art.prompt);
    setSelectedArt(art);
    document.getElementById("ve")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
                <div className="coloring-name"><span aria-hidden="true">☺</span><span>Tranh của <strong>{childName}</strong></span></div>
              </div>

              {generationNotice ? <p className="coloring-generation-notice" role="status">{generationNotice}</p> : null}

              <div className="coloring-tip"><span aria-hidden="true">☀</span><p><strong>Mẹo nhỏ</strong> Bé kể thêm nơi chốn hoặc người bạn đi cùng để ý tưởng sinh động hơn nhé.</p></div>
            </div>

            <div className={`coloring-preview ${selectedArt ? "has-art" : ""}`} aria-live="polite">
              {selectedArt ? (
                <>
                  <div className="coloring-paper">
                    <div className="coloring-paper-heading"><span>SunShinSon</span><strong>Tranh của {childName}</strong></div>
                    <img src={selectedArt.src} alt={selectedArt.title} />
                    <p>{selectedArt.title}</p>
                  </div>
                  <div className="coloring-preview-actions">
                    <button onClick={() => window.print()}>⌁ In tranh A4</button>
                    <a href={selectedArt.src} download={`${selectedArt.id}-sunshinson.${selectedArt.generated ? "jpg" : "png"}`}>↓ Tải ảnh</a>
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
            <p>4 ý tưởng được Sun chuẩn bị sẵn</p>
          </div>
          <div className="coloring-filters" aria-label="Chủ đề tranh">
            {galleryThemes.map((theme) => (
              <button className={activeTheme === theme ? "is-active" : ""} key={theme} onClick={() => setActiveTheme(theme)}>{theme}</button>
            ))}
          </div>
          <div className="coloring-grid">
            {coloringArts.filter((art) => activeTheme === "Tất cả" || art.theme === activeTheme).map((art) => (
              <button className="coloring-card" key={art.id} onClick={() => openArt(art)}>
                <span className="coloring-card-image"><img src={art.src} alt="" /></span>
                <span className="coloring-card-copy"><small>{art.icon} {art.theme}</small><strong>{art.title}</strong><span>Chọn tranh này <b aria-hidden="true">→</b></span></span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="coloring-footer"><SunLogo compact /><p>Mỗi nét màu là một câu chuyện nhỏ · SunShinSon</p></footer>
    </div>
  );
}
