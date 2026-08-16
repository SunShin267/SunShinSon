"use client";

import { ReactNode, useEffect, useState } from "react";

import { clearChildName, readChildName } from "../lib/child-session";
import { navigateInternal } from "../lib/navigation";
import { AppHeader } from "./AppHeader";
import { SunLogo } from "./SunLogo";

type GameShellProps = {
  children: ReactNode;
  helpContent?: ReactNode;
  isGameInProgress?: boolean;
  onLeaveGame?: () => void;
};

type LeaveIntent = "home" | "logout";

export function GameShell({ children, helpContent, isGameInProgress = false, onLeaveGame }: GameShellProps) {
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [leaveIntent, setLeaveIntent] = useState<LeaveIntent | null>(null);

  useEffect(() => {
    const childName = readChildName();
    const timer = window.setTimeout(() => {
      setName(childName);
      setReady(true);
      if (!childName) navigateInternal("/", true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function completeLeave(intent: LeaveIntent) {
    onLeaveGame?.();
    setLeaveIntent(null);

    if (intent === "logout") {
      clearChildName();
      setName("");
      navigateInternal("/", true);
      return;
    }

    navigateInternal("/");
  }

  function requestLeave(intent: LeaveIntent) {
    if (isGameInProgress) {
      setLeaveIntent(intent);
      return;
    }

    completeLeave(intent);
  }

  if (!ready || !name) {
    return <main className="loading-screen"><SunLogo /></main>;
  }

  return (
    <div className="app-shell">
      <AppHeader
        name={name}
        onHome={() => requestLeave("home")}
        onLogout={() => requestLeave("logout")}
        onHelp={helpContent ? () => setHelpOpen(true) : undefined}
      />
      {children}
      {helpOpen && helpContent ? (
        <section className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="game-help-title">
          <div className="game-dialog game-dialog--help">
            <div className="game-dialog-heading">
              <h2 id="game-help-title">Hướng dẫn</h2>
              <button className="game-dialog-close" onClick={() => setHelpOpen(false)} aria-label="Đóng hướng dẫn">×</button>
            </div>
            <div className="game-help-content">{helpContent}</div>
          </div>
        </section>
      ) : null}
      {leaveIntent ? (
        <section className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-game-title">
          <div className="game-dialog">
            <h2 id="leave-game-title">Bé muốn rời trò chơi chứ?</h2>
            <p>Ván chơi này chưa xong. Tiến trình hiện tại sẽ không được lưu lại.</p>
            <div className="game-dialog-actions">
              <button className="game-dialog-secondary" onClick={() => setLeaveIntent(null)}>Ở lại chơi tiếp</button>
              <button className="game-dialog-primary" onClick={() => completeLeave(leaveIntent)}>Rời trò chơi</button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
