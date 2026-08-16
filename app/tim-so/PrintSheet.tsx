"use client";

import type { PrintGeometry } from "./print-geometry";

type PrintSheetProps = { values: number[]; geometry: PrintGeometry; childName: string };

export function PrintSheet({ values, geometry, childName }: PrintSheetProps) {
  const normalizedName = childName.trim().replace(/\s+/g, " ") || "________";
  const nameCharacters = Array.from(normalizedName);
  const fittedName = nameCharacters.length > 24 ? `${nameCharacters.slice(0, 23).join("")}…` : normalizedName;
  const printDate = new Date().toLocaleDateString("vi-VN");

  return (
    <section
      id="number-hunt-print-sheet"
      className={`number-hunt-print-sheet number-hunt-print-sheet--${geometry.orientation}`}
      style={{ "--print-columns": geometry.columns, "--print-cell-height": `${geometry.cellHeight}mm`, "--print-font-size": `${geometry.fontSize}pt` } as React.CSSProperties}
      aria-hidden="true"
    >
      <style>{`@media print { @page { size: A4 ${geometry.orientation}; margin: 10mm; } }`}</style>
      <header data-print-header>
        <strong data-print-field="title">Tìm số cùng Sun</strong>
        <span className="number-hunt-print-name" data-print-field="name" title={normalizedName}>Bé: {fittedName}</span>
        <span data-print-field="date">Ngày: {printDate}</span>
        <span data-print-field="time">Thời gian: __________</span>
      </header>
      <div className="number-hunt-print-grid">
        {values.map((value) => <span className="number-hunt-print-cell" key={value} data-print-value={value}>{value}</span>)}
      </div>
    </section>
  );
}
