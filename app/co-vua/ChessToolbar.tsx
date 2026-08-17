"use client";

import { useEffect, useRef, useState } from "react";
import { CHESS_BOARD_THEMES, CHESS_PIECE_THEMES, type ChessBoardThemeId, type ChessPieceThemeId } from "./chess-themes";

type ChessToolbarProps = {
  boardTheme: ChessBoardThemeId;
  pieceTheme: ChessPieceThemeId;
  onBoardTheme: (theme: ChessBoardThemeId) => void;
  onPieceTheme: (theme: ChessPieceThemeId) => void;
  gameActions?: {
    onFlip: () => void;
    onHistory: () => void;
    onRestart: () => void;
    onNewSetup: () => void;
  };
};

type OpenMenu = "board" | "piece" | null;

export function ChessToolbar({ boardTheme, pieceTheme, onBoardTheme, onPieceTheme, gameActions }: ChessToolbarProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const toolbarRef = useRef<HTMLElement | null>(null);
  const boardColors = CHESS_BOARD_THEMES[boardTheme];
  const pieceColors = CHESS_PIECE_THEMES[pieceTheme];

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!toolbarRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  return <section ref={toolbarRef} className="chess-toolbar" aria-label="Tùy chọn bàn cờ">
    <div className="chess-palette-row">
      <div className="chess-visual-dropdown">
        <button type="button" className="chess-dropdown-trigger" aria-label="Chọn màu bàn cờ" aria-haspopup="listbox" aria-expanded={openMenu === "board"} onClick={() => setOpenMenu((value) => value === "board" ? null : "board")}>
          <span className="chess-dropdown-kind" aria-hidden="true">▦</span>
          <span className="chess-board-swatch" style={{ background: `linear-gradient(135deg, ${boardColors.light} 0 50%, ${boardColors.dark} 50%)` }} aria-hidden="true" />
          <span className="chess-dropdown-chevron" aria-hidden="true">⌄</span>
        </button>
        {openMenu === "board" ? <div className="chess-dropdown-menu" role="listbox" aria-label="Màu bàn cờ">
          {(Object.entries(CHESS_BOARD_THEMES) as [ChessBoardThemeId, (typeof CHESS_BOARD_THEMES)[ChessBoardThemeId]][]).map(([id, theme]) => <button key={id} type="button" role="option" aria-selected={boardTheme === id} aria-label={`Bàn cờ ${theme.label}`} title={theme.label} className={boardTheme === id ? "is-selected" : ""} onClick={() => { onBoardTheme(id); setOpenMenu(null); }}><span className="chess-board-swatch" style={{ background: `linear-gradient(135deg, ${theme.light} 0 50%, ${theme.dark} 50%)` }} aria-hidden="true" /></button>)}
        </div> : null}
      </div>

      <div className="chess-visual-dropdown">
        <button type="button" className="chess-dropdown-trigger" aria-label="Chọn màu quân cờ" aria-haspopup="listbox" aria-expanded={openMenu === "piece"} onClick={() => setOpenMenu((value) => value === "piece" ? null : "piece")}>
          <span className="chess-dropdown-kind" aria-hidden="true">♟</span>
          <span className="chess-piece-swatch" aria-hidden="true"><i style={{ color: pieceColors.white }}>♔</i><i style={{ color: pieceColors.black }}>♚</i></span>
          <span className="chess-dropdown-chevron" aria-hidden="true">⌄</span>
        </button>
        {openMenu === "piece" ? <div className="chess-dropdown-menu" role="listbox" aria-label="Màu quân cờ">
          {(Object.entries(CHESS_PIECE_THEMES) as [ChessPieceThemeId, (typeof CHESS_PIECE_THEMES)[ChessPieceThemeId]][]).map(([id, theme]) => <button key={id} type="button" role="option" aria-selected={pieceTheme === id} aria-label={`Quân cờ ${theme.label}`} title={theme.label} className={pieceTheme === id ? "is-selected" : ""} onClick={() => { onPieceTheme(id); setOpenMenu(null); }}><span className="chess-piece-swatch" aria-hidden="true"><i style={{ color: theme.white }}>♔</i><i style={{ color: theme.black }}>♚</i></span></button>)}
        </div> : null}
      </div>
    </div>

    {gameActions ? <div className="chess-toolbar-actions">
      <button type="button" onClick={gameActions.onFlip}>⇅ <span>Lật bàn</span></button>
      <button type="button" onClick={gameActions.onHistory}>☷ <span>Lịch sử</span></button>
      <button type="button" onClick={gameActions.onRestart}>↻ <span>Chơi lại</span></button>
      <button type="button" onClick={gameActions.onNewSetup}>⚙ <span>Thiết lập</span></button>
    </div> : null}
  </section>;
}
