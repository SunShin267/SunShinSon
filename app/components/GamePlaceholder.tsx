"use client";

import { GameShell } from "./GameShell";

type GamePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  accent: string;
};

export function GamePlaceholder({ eyebrow, title, description, icon, color, accent }: GamePlaceholderProps) {
  return (
    <GameShell>
      <main className="topic-content">
        <section className="topic-hero" style={{ "--topic": color, "--topic-soft": accent } as React.CSSProperties}>
          <div className="topic-hero-copy">
            <p className="kicker" style={{ color }}>{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <div className="hero-icon" aria-hidden="true">{icon}</div>
        </section>
        <section className="preview-panel">
          <div className="preview-heading">
            <div>
              <span className="tiny-sun" style={{ background: color }}>☀</span>
              <div><small style={{ color }}>SUNSHINSON</small><h2>Trò chơi đang được chuẩn bị</h2></div>
            </div>
            <span className="coming-pill" style={{ background: accent, color }}>Sắp ra mắt</span>
          </div>
          <p className="intro">Sun đang chuẩn bị thật kỹ để bé có thể bắt đầu chơi thật vui.</p>
        </section>
      </main>
    </GameShell>
  );
}
