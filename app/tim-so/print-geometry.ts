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
const HEADER_HEIGHT = 12;

export function getPrintGeometry(count: number): PrintGeometry | null {
  if (!Number.isInteger(count) || count < 1 || count > 500) return null;
  const options = (["portrait", "landscape"] as const).map((orientation) => {
    const page = PAGE[orientation];
    const gridHeight = page.height - HEADER_HEIGHT;
    const ratio = page.width / gridHeight;
    const columns = Math.ceil(Math.sqrt(count * ratio));
    const rows = Math.ceil(count / columns);
    const cellWidth = page.width / columns;
    const cellHeight = gridHeight / rows;
    return { orientation, columns, rows, cellWidth, cellHeight, fontSize: Math.max(5, Math.min(18, Math.min(cellWidth, cellHeight) * 0.45)) };
  });
  return options.sort((left, right) => {
    const sizeDifference = Math.min(right.cellWidth, right.cellHeight) - Math.min(left.cellWidth, left.cellHeight);
    if (sizeDifference !== 0) return sizeDifference;
    return left.orientation === "landscape" ? -1 : 1;
  })[0];
}
