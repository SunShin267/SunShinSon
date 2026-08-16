import type { Metadata } from "next";
import "./globals.css";

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
const siteUrl = process.env.SITE_URL?.trim() || `https://sunshin267.github.io${basePath || "/SunShinSon"}`;
const metadataBase = new URL(`${siteUrl.replace(/\/$/, "")}/`);
const socialImageUrl = new URL("og.png", metadataBase).toString();
const title = "SunShinSon · Vui học mỗi ngày";
const description = "Không gian vui học dành cho bé với Tìm số, Cờ caro, Cờ vua và nhiều hoạt động khám phá mỗi ngày.";

export const metadata: Metadata = {
  metadataBase,
  title,
  description,
  applicationName: "SunShinSon",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "SunShinSon",
    title,
    description,
    url: siteUrl,
    images: [{
      url: socialImageUrl,
      width: 1734,
      height: 907,
      alt: "SunShinSon với các hoạt động Tìm số, Cờ caro và Cờ vua",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImageUrl],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
