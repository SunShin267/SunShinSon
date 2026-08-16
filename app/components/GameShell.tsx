"use client";

import { ReactNode, useEffect, useState } from "react";

import { clearChildName, readChildName } from "../lib/child-session";
import { navigateInternal } from "../lib/navigation";
import { AppHeader } from "./AppHeader";
import { SunLogo } from "./SunLogo";

type GameShellProps = {
  children: ReactNode;
};

export function GameShell({ children }: GameShellProps) {
  const [name, setName] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const childName = readChildName();
    const timer = window.setTimeout(() => {
      setName(childName);
      setReady(true);
      if (!childName) navigateInternal("/", true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function goHome() {
    navigateInternal("/");
  }

  function logout() {
    clearChildName();
    setName("");
    navigateInternal("/", true);
  }

  if (!ready || !name) {
    return <main className="loading-screen"><SunLogo /></main>;
  }

  return (
    <div className="app-shell">
      <AppHeader name={name} onHome={goHome} onLogout={logout} />
      {children}
    </div>
  );
}
