"use client";

import { FormEvent, useEffect, useState } from "react";

type Topic = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  icon: string;
  color: string;
  accent: string;
  preview: string[];
};

const topics: Topic[] = [
  {
    id: "hoc-cung-be",
    title: "Học cùng bé",
    eyebrow: "Khám phá mỗi ngày",
    description: "Chữ cái, con số và những điều thú vị quanh ta.",
    icon: "📚",
    color: "#f9cf4a",
    accent: "#fff3bd",
    preview: ["Bảng chữ cái", "Làm quen con số", "Thế giới quanh em"],
  },
  {
    id: "co-caro",
    title: "Chơi cờ caro",
    eyebrow: "Rèn tư duy",
    description: "Xếp những quân cờ đầu tiên và cùng nhau suy nghĩ.",
    icon: "⭕",
    color: "#ff7b5c",
    accent: "#ffe0d8",
    preview: ["Chơi với máy", "Chơi hai người", "Cách chơi"],
  },
  {
    id: "co-vua",
    title: "Chơi cờ vua",
    eyebrow: "Thử tài chiến thuật",
    description: "Làm quen bàn cờ và những quân cờ thật dũng cảm.",
    icon: "♞",
    color: "#7159c1",
    accent: "#e6defe",
    preview: ["Nhận biết quân cờ", "Bài học đầu tiên", "Thử thách nhỏ"],
  },
  {
    id: "tim-so",
    title: "Chơi tìm số",
    eyebrow: "Nhanh mắt nhanh tay",
    description: "Tìm đúng con số đang ẩn mình trong khu vườn.",
    icon: "🔢",
    color: "#46a97a",
    accent: "#d9f5e6",
    preview: ["Từ 1 đến 10", "Từ 1 đến 20", "Tìm số bí mật"],
  },
  {
    id: "do-vui",
    title: "Đố vui cho bé",
    eyebrow: "Mỗi câu một nụ cười",
    description: "Những câu hỏi ngộ nghĩnh giúp bé học điều mới.",
    icon: "💡",
    color: "#3a9bdc",
    accent: "#dceffd",
    preview: ["Con vật đáng yêu", "Đồ vật quanh em", "Thiên nhiên kỳ thú"],
  },
];

function SunLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand--compact" : ""}`}>
      <span className="sun-mark" aria-hidden="true">
        <span className="sun-face">•ᴗ•</span>
      </span>
      <span className="brand-name">SunShinSon</span>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [name, setName] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName) onLogin(cleanName);
  }

  return (
    <main className="login-page">
      <div className="cloud cloud--one" />
      <div className="cloud cloud--two" />
      <div className="login-decoration login-decoration--left" aria-hidden="true">✿</div>
      <div className="login-decoration login-decoration--right" aria-hidden="true">✦</div>

      <section className="login-card">
        <SunLogo />
        <div className="login-copy">
          <p className="kicker">Chào mừng bé đến với khu vườn tri thức</p>
          <h1>Mỗi ngày một điều<br /><span>hay ho mới!</span></h1>
          <p className="intro">Bé hãy cho Sun biết tên để cùng bắt đầu hành trình nhé.</p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label htmlFor="child-name">Tên của bé</label>
          <div className="input-wrap">
            <span aria-hidden="true">☺</span>
            <input
              id="child-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ví dụ: Thiện Phước"
              maxLength={30}
              autoComplete="name"
              autoFocus
            />
          </div>
          <button type="submit" disabled={!name.trim()}>
            Bắt đầu khám phá <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="login-note"><span>♥</span> Không cần mật khẩu đâu bé nhé!</div>
      </section>

      <div className="ground" aria-hidden="true">
        <span>🌼</span><span>🌱</span><span>🌷</span><span>🌿</span><span>🌼</span>
      </div>
    </main>
  );
}

function AppHeader({ name, onHome, onLogout }: { name: string; onHome: () => void; onLogout: () => void }) {
  return (
    <header className="app-header">
      <button className="logo-button" onClick={onHome} aria-label="Về trang chủ"><SunLogo compact /></button>
      <div className="header-actions">
        <div className="mini-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
        <span className="header-name">{name}</span>
        <button className="logout-button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất">↗</button>
      </div>
    </header>
  );
}

function HomeScreen({ name, onSelect, onLogout }: { name: string; onSelect: (topic: Topic) => void; onLogout: () => void }) {
  return (
    <div className="app-shell">
      <AppHeader name={name} onHome={() => undefined} onLogout={onLogout} />
      <main className="home-content">
        <section className="welcome-block">
          <div>
            <p className="kicker">Hôm nay mình chơi gì nhỉ?</p>
            <h1>Xin chào, <span>{name}!</span> 👋</h1>
            <p>Chọn một hoạt động bé thích và cùng Sun khám phá nhé.</p>
          </div>
          <div className="weather-badge" aria-label="Một ngày thật vui">
            <span>☀️</span>
            <div><strong>Ngày thật vui</strong><small>Sẵn sàng khám phá!</small></div>
          </div>
        </section>

        <section className="topics-section" aria-labelledby="topics-title">
          <div className="section-heading">
            <h2 id="topics-title">Góc vui học</h2>
            <span>5 hoạt động dành cho bé</span>
          </div>
          <div className="topic-grid">
            {topics.map((topic, index) => (
              <button
                className={`topic-card ${index === 0 ? "topic-card--featured" : ""}`}
                style={{ "--topic": topic.color, "--topic-soft": topic.accent } as React.CSSProperties}
                key={topic.id}
                onClick={() => {
                  if (topic.id === "do-vui") {
                    window.location.assign(
                      process.env.NEXT_PUBLIC_QUIZ_PATH || "/do-vui-do-meo",
                    );
                    return;
                  }

                  onSelect(topic);
                }}
              >
                <span className="topic-icon" aria-hidden="true">{topic.icon}</span>
                <span className="topic-copy">
                  <small>{topic.eyebrow}</small>
                  <strong>{topic.title}</strong>
                  <span>{topic.description}</span>
                </span>
                <span className="topic-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>

        <section className="daily-note">
          <span className="note-icon">🌟</span>
          <div><strong>Mỗi ngày một chút</strong><p>Chỉ 15 phút vui học mỗi ngày cũng giúp bé tiến bộ thật nhiều!</p></div>
          <span className="sparkles" aria-hidden="true">✦ ✧</span>
        </section>
      </main>
      <footer>Made with <span>♥</span> for little explorers · SunShinSon</footer>
    </div>
  );
}

function TopicScreen({ name, topic, onBack, onLogout }: { name: string; topic: Topic; onBack: () => void; onLogout: () => void }) {
  return (
    <div className="app-shell topic-page" style={{ "--topic": topic.color, "--topic-soft": topic.accent } as React.CSSProperties}>
      <AppHeader name={name} onHome={onBack} onLogout={onLogout} />
      <main className="topic-content">
        <button className="back-button" onClick={onBack}><span>←</span> Quay lại góc vui học</button>
        <section className="topic-hero">
          <div className="topic-hero-copy">
            <p className="kicker">{topic.eyebrow}</p>
            <h1>{topic.title}</h1>
            <p>{topic.description}</p>
          </div>
          <div className="hero-icon" aria-hidden="true">{topic.icon}</div>
        </section>

        <section className="preview-panel">
          <div className="preview-heading">
            <div><span className="tiny-sun">☀</span><div><small>DÀNH RIÊNG CHO {name.toUpperCase()}</small><h2>Bài học đang chờ bé</h2></div></div>
            <span className="coming-pill">Sắp ra mắt</span>
          </div>
          <div className="preview-list">
            {topic.preview.map((item, index) => (
              <article key={item}>
                <span className="number-dot">{index + 1}</span>
                <div><strong>{item}</strong><p>Một hoạt động thú vị đang được Sun chuẩn bị.</p></div>
                <span className="lock" aria-hidden="true">●</span>
              </article>
            ))}
          </div>
        </section>

        <div className="encouragement"><span>🌈</span><p><strong>Sun đang chuẩn bị thật kỹ!</strong><br />Hoạt động này sẽ sớm sẵn sàng để bé khám phá.</p></div>
      </main>
    </div>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setName(window.localStorage.getItem("sunshinson-name") || "");
    setReady(true);
  }, []);

  function login(nextName: string) {
    window.localStorage.setItem("sunshinson-name", nextName);
    setName(nextName);
  }

  function logout() {
    window.localStorage.removeItem("sunshinson-name");
    setName("");
    setActiveTopic(null);
  }

  if (!ready) return <main className="loading-screen"><SunLogo /></main>;
  if (!name) return <LoginScreen onLogin={login} />;
  if (activeTopic) return <TopicScreen name={name} topic={activeTopic} onBack={() => setActiveTopic(null)} onLogout={logout} />;
  return <HomeScreen name={name} onSelect={setActiveTopic} onLogout={logout} />;
}
