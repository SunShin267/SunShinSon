import type { Metadata } from "next";

import { XiangqiGame } from "./XiangqiGame";
import "./xiangqi.css";

export const metadata: Metadata = {
  title: "Cờ tướng · SunShinSon",
  description: "Chơi Cờ tướng và Cờ úp cùng máy hoặc bạn bè trong không gian SunShinSon.",
};

export default function XiangqiPage() {
  return <XiangqiGame />;
}
