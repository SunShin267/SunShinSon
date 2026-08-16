export type PrintGeometry = {
  orientation: "portrait" | "landscape";
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  fontSize: number;
};

const PAGE = {
  portrait: { width: 190, height: 277 },
  landscape: { width: 277, height: 190 },
};

export function getPrintGeometry(count: number): PrintGeometry | null {
  if (!Number.isInteger(count) || count < 1 || count > 500) return null;
  const options = (["portrait", "landscape"] as const).map((orientation) => {
    const page = PAGE[orientation];
    const ratio = page.width / page.height;
    const columns = Math.ceil(Math.sqrt(count * ratio));
    const rows = Math.ceil(count / columns);
    const cellWidth = page.width / columns;
    const cellHeight = page.height / rows;
    return { orientation, columns, rows, cellWidth, cellHeight, fontSize: Math.max(5, Math.min(18, Math.min(cellWidth, cellHeight) * 0.45)) };
  });
  return options.sort((left, right) => Math.min(right.cellWidth, right.cellHeight) - Math.min(left.cellWidth, left.cellHeight))[0];
}
