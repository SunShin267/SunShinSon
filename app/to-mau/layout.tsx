import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Góc tô màu · SunShinSon",
  description: "Bé kể điều mình tưởng tượng, chọn một tranh nét đậm và in ra để tô màu cùng SunShinSon.",
};

export default function ColoringLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
