import type { Metadata } from "next";

import { XiangqiGame } from "../../XiangqiGame";
import "../../xiangqi.css";

export const metadata: Metadata = {
  title: "Phòng Cờ tướng · SunShinSon",
  description: "Mở link mời và chơi Cờ tướng online cùng bạn bè.",
};

type XiangqiRoomPageProps = {
  params: Promise<{ code: string }>;
};

export default async function XiangqiRoomPage({ params }: XiangqiRoomPageProps) {
  const { code } = await params;
  return <XiangqiGame inviteCode={code.trim().toUpperCase()} />;
}
