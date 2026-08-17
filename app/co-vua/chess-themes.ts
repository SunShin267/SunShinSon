export type ChessBoardThemeId = "classic" | "purple" | "forest" | "ocean";
export type ChessPieceThemeId = "ink" | "royal" | "berry" | "emerald";

export const CHESS_BOARD_THEMES: Record<ChessBoardThemeId, { label: string; light: string; dark: string; border: string }> = {
  classic: { label: "Cổ điển", light: "#f2e2bd", dark: "#b8895b", border: "#6f4b32" },
  purple: { label: "Tím", light: "#f0e9fb", dark: "#8c72b6", border: "#4e3b73" },
  forest: { label: "Rừng xanh", light: "#e7f0d5", dark: "#71926b", border: "#405f43" },
  ocean: { label: "Biển xanh", light: "#e3f2f6", dark: "#5f91aa", border: "#365f73" },
};

export const CHESS_PIECE_THEMES: Record<ChessPieceThemeId, { label: string; white: string; black: string }> = {
  ink: { label: "Mực", white: "#f8f5eb", black: "#27232d" },
  royal: { label: "Hoàng gia", white: "#fff1ae", black: "#49307f" },
  berry: { label: "Dâu", white: "#fff4ee", black: "#9d3f52" },
  emerald: { label: "Ngọc", white: "#e7fff3", black: "#17664d" },
};
