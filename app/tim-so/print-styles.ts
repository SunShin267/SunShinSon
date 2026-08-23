export type PrintOrientation = "portrait" | "landscape";

export function getPrintDocumentCss(orientation: PrintOrientation) {
  return `@media print {
    @page { size: A4 ${orientation}; margin: 10mm; }
    html, body { height: auto !important; overflow: visible !important; }
    body > :not(#number-hunt-print-sheet) { display: none !important; }
    #number-hunt-print-sheet { display: block !important; visibility: visible !important; position: relative; left: auto; top: auto; margin: 0; padding: 0; color: #111; background: #fff; overflow: hidden; break-inside: avoid; page-break-inside: avoid; break-after: avoid-page; page-break-after: avoid; }
    #number-hunt-print-sheet * { visibility: visible !important; }
    .number-hunt-print-cell { display: grid; place-items: center; min-width: 0; min-height: 0; border: 0 !important; border-radius: 0 !important; outline: 0 !important; box-shadow: none !important; background: transparent !important; font: bold var(--print-font-size) Arial, sans-serif; break-inside: avoid; }
  }`;
}
