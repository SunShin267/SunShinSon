"use client";

import type { PrintGeometry } from "./print-geometry";

type PrintSheetProps = { values: number[]; geometry: PrintGeometry; childName: string };

export function PrintSheet({ values, geometry, childName }: PrintSheetProps) {
  return (
    <section
      id="number-hunt-print-sheet"
      className={`number-hunt-print-sheet number-hunt-print-sheet--${geometry.orientation}`}
      style={{ "--print-columns": geometry.columns, "--print-cell-height": `${geometry.cellHeight}mm`, "--print-font-size": `${geometry.fontSize}pt` } as React.CSSProperties}
      aria-hidden="true"
    >
      <style>{`@media print { @page { size: A4 ${geometry.orientation}; margin: 10mm; } }`}</style>
      <header><strong>Tìm số cùng Sun</strong><span>Bé: {childName}</span><span>Ngày: {new Date().toLocaleDateString("vi-VN")}</span><span>Thời gian: __________</span></header>
      <div className="number-hunt-print-grid">
        {values.map((value) => <span className="number-hunt-print-cell" key={value} data-print-value={value}>{value}</span>)}
      </div>
    </section>
  );
}
