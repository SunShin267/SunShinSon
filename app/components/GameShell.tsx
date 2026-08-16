"use client";

import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";

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
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const childName = readChildName();
    const timer = window.setTimeout(() => {
      setName(childName);
      setReady(true);
      if (!childName) navigateInternal("/", true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!helpOpen && !leaveIntent) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previous?.focus();
    };
  }, [helpOpen, leaveIntent]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      if (helpOpen) setHelpOpen(false);
      else setLeaveIntent(null);
      return;
    }
    if (event.key !== "Tab") return;
    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? []);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
          <div ref={dialogRef} onKeyDown={handleDialogKeyDown} className="game-dialog game-dialog--help">
            <div className="game-dialog-heading">
              <h2 id="game-help-title">Hướng dẫn</h2>
              <button className="game-dialog-close" onClick={() => setHelpOpen(false)} aria-label="Đóng hướng dẫn">×</button>
            </div>
            <div className="game-help-content">{helpContent}</div>
          </div>
        </section>
      ) : null}
      {leaveIntent ? (
        <section className="game-overlay" role="dialog" aria-modal="true" aria-labelledby="leave-game-title" aria-describedby="leave-game-description">
          <div ref={dialogRef} onKeyDown={handleDialogKeyDown} className="game-dialog">
            <h2 id="leave-game-title">Bé muốn rời trò chơi chứ?</h2>
            <p id="leave-game-description">Ván chơi này chưa xong. Tiến trình hiện tại sẽ không được lưu lại.</p>
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
