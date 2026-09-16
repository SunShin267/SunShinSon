export function printColoringImage(src: string, title: string) {
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    window.alert("Trình duyệt đang chặn cửa sổ in. Ba mẹ hãy cho phép cửa sổ bật lên rồi thử lại nhé.");
    return;
  }

  printWindow.opener = null;
  const { document } = printWindow;
  document.title = title;

  const style = document.createElement("style");
  style.textContent = `
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; }
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      overflow: hidden;
      background: #fff;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      display: block;
      width: auto;
      height: auto;
      max-width: 194mm;
      max-height: 281mm;
      object-fit: contain;
      break-inside: avoid;
      page-break-inside: avoid;
    }
  `;

  const image = document.createElement("img");
  image.alt = title;
  image.src = src.startsWith("data:") ? src : new URL(src, window.location.href).toString();
  image.onload = () => {
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 100);
  };
  image.onerror = () => {
    document.body.textContent = "Không thể mở tranh để in. Ba mẹ vui lòng thử lại nhé.";
  };

  document.head.append(style);
  document.body.append(image);
  document.close();
}
