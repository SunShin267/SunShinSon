"use client";

import { SunLogo } from "./SunLogo";

type AppHeaderProps = {
  name: string;
  onHome: () => void;
  onLogout: () => void;
  onHelp?: () => void;
};

export function AppHeader({ name, onHome, onLogout, onHelp }: AppHeaderProps) {
  return (
    <header className="app-header">
      <button className="logo-button" onClick={onHome} aria-label="Về trang chủ">
        <SunLogo compact />
      </button>
      <div className="header-actions">
        <div className="mini-avatar" aria-hidden="true">{name.charAt(0).toUpperCase()}</div>
        <span className="header-name">{name}</span>
        {onHelp ? <button className="help-button" onClick={onHelp} aria-label="Xem hướng dẫn" title="Xem hướng dẫn">?</button> : null}
        <button className="logout-button" onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất">↗</button>
      </div>
    </header>
  );
}
