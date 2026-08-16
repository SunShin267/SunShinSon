import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SunShinSon · Vui học mỗi ngày",
  description: "Không gian vui học và khám phá dành cho bé.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
