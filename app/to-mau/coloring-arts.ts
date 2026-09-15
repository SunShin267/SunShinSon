export type ColoringArt = {
  id: string;
  title: string;
  prompt: string;
  src: string;
  icon: string;
  theme: string;
  generated?: boolean;
  saved?: boolean;
};

type ArtEntry = [id: string, title: string, prompt: string, src?: string];

function themeArts(theme: string, icon: string, entries: ArtEntry[]): ColoringArt[] {
  return entries.map(([id, title, prompt, src]) => ({
    id,
    title,
    prompt,
    src: src ?? `/images/to-mau/${id}.webp`,
    icon,
    theme,
  }));
}

export const libraryThemes = [
  "Động vật",
  "Phương tiện",
  "Kỳ diệu",
  "Siêu nhân",
  "Vũ trụ",
  "Khủng long",
  "Đại dương",
  "Công nghệ",
] as const;

export const coloringArts: ColoringArt[] = [
  ...themeArts("Động vật", "🐾", [
    ["rabbit", "Thỏ ôm củ cà rốt", "Bạn thỏ ôm củ cà rốt thật to trong vườn hoa", "/images/to-mau/tho-ca-rot.png"],
    ["safari-friends", "Những người bạn Safari", "Voi con, hươu cao cổ và sư tử con chơi cùng nhau ở thảo nguyên", "/images/to-mau/ban-be-safari.webp"],
    ["forest-picnic", "Dã ngoại trong rừng", "Gấu con và cú mèo cùng ăn picnic trong khu rừng vui vẻ", "/images/to-mau/da-ngoai-rung.webp"],
    ["cun-con-qua-bong", "Cún con và quả bóng", "Cún con vui vẻ chơi bóng cạnh ngôi nhà nhỏ"],
    ["meo-trong-gio", "Mèo ngủ trong giỏ", "Mèo con cuộn tròn ngủ trong giỏ cạnh cuộn len"],
    ["gau-truc-an-tre", "Gấu trúc ăn tre", "Gấu trúc con ăn tre bên thác nước nhỏ"],
    ["gau-koala", "Koala trên cành cây", "Koala con ôm cành bạch đàn cùng bạn bướm"],
    ["cao-nhat-qua", "Cáo nhặt quả rừng", "Cáo con quàng khăn nhặt quả trong khu rừng thân thiện"],
    ["chim-canh-cut", "Gia đình cánh cụt", "Cánh cụt bố mẹ và cánh cụt con trượt tuyết bên lều băng"],
    ["voi-tuoi-hoa", "Voi con tưới hoa", "Voi con dùng vòi tưới những bông hoa lớn"],
  ]),
  ...themeArts("Phương tiện", "🚗", [
    ["fire-truck", "Xe cứu hỏa thân thiện", "Xe cứu hỏa vui vẻ và bạn lính cứu hỏa đang vẫy tay", "/images/to-mau/xe-cuu-hoa.webp"],
    ["excavator", "Xe xúc cát chăm chỉ", "Chiếc xe xúc thân thiện đang xúc một đống cát nhỏ", "/images/to-mau/xe-xuc-cat.webp"],
    ["xe-buyt-vui-ve", "Chuyến xe buýt vui vẻ", "Xe buýt thành phố chở các bạn nhỏ đang vẫy tay"],
    ["tau-cao-toc", "Tàu cao tốc qua đồi", "Tàu cao tốc thân thiện chạy qua đồi cây xanh"],
    ["truc-thang-cuu-ho", "Trực thăng cứu hộ", "Trực thăng cứu hộ giúp mèo con trên ngọn đồi an toàn"],
    ["xe-dap-cong-vien", "Đạp xe trong công viên", "Bạn nhỏ đội mũ bảo hiểm đạp xe chở giỏ hoa"],
    ["may-keo-nong-trai", "Máy kéo nông trại", "Máy kéo chở bí ngô đi ngang qua nông trại"],
    ["thuyen-buom", "Thuyền buồm ra khơi", "Hai bạn nhỏ mặc áo phao đi thuyền buồm gần hải đăng"],
    ["xe-may-giao-hoa", "Xe máy giao hoa", "Chiếc xe máy nhỏ chở hộp hoa qua phố"],
    ["khinh-khi-cau", "Khinh khí cầu trên đồi", "Khinh khí cầu chở bạn nhỏ và gấu bông bay trên đồi"],
  ]),
  ...themeArts("Kỳ diệu", "✨", [
    ["unicorn", "Kỳ lân dưới cầu vồng", "Bạn kỳ lân con vui vẻ đi giữa vườn hoa dưới cầu vồng", "/images/to-mau/ky-lan-cau-vong.webp"],
    ["castle-dragon", "Rồng con thăm lâu đài", "Bạn rồng con hiền lành đến thăm tòa lâu đài cổ tích", "/images/to-mau/rong-tham-lau-dai.webp"],
    ["tien-hoa", "Nàng tiên tưới hoa", "Nàng tiên nhỏ tưới những bông hoa khổng lồ cạnh nhà nấm"],
    ["phu-thuy-bong-bong", "Phù thủy pha bong bóng", "Phù thủy nhỏ pha bình bong bóng vui vẻ cùng mèo con"],
    ["ngua-bay-sao", "Ngựa bay mang đèn sao", "Ngựa bay hiền lành mang đèn sao trên những đám mây"],
    ["nam-lun-nha-nam", "Nhà nấm của bạn lùn", "Hai bạn lùn trang trí ngôi nhà nấm bằng hoa"],
    ["khong-lo-may", "Người khổng lồ trên mây", "Người khổng lồ hiền lành chia bánh sao cho chim nhỏ"],
    ["sach-than-ky", "Cuốn sách thần kỳ", "Bạn nhỏ mở cuốn sách tỏa ra sao và hoa kỳ diệu"],
    ["phuong-hoang-con", "Phượng hoàng con", "Phượng hoàng con tập dang cánh bên chiếc tổ ấm"],
    ["tho-cung-trang", "Thỏ cung trăng", "Thỏ nhỏ đi thuyền giấy trên dòng sông đầy sao"],
  ]),
  ...themeArts("Siêu nhân", "🦸", [
    ["sieu-nhan-anh-duong", "Siêu nhân Ánh Dương", "Siêu nhân nhí Ánh Dương đứng trên mái nhà và vẫy tay"],
    ["sieu-nhan-gio-xanh", "Siêu nhân Gió Xanh", "Siêu nhân nhí Gió Xanh bay cùng bạn chim trên mây"],
    ["sieu-nhan-tia-chop", "Siêu nhân Tia Chớp", "Siêu nhân nhí Tia Chớp chạy thật nhanh trong công viên"],
    ["sieu-nhan-dai-duong", "Siêu nhân Đại Dương", "Siêu nhân nhí Đại Dương giúp rùa con bên rạn san hô"],
    ["sieu-nhan-rung-xanh", "Siêu nhân Rừng Xanh", "Siêu nhân nhí Rừng Xanh trồng cây cùng thú nhỏ"],
    ["sieu-nhan-anh-trang", "Siêu nhân Ánh Trăng", "Siêu nhân nhí Ánh Trăng ngắm sao trên cung trăng"],
    ["sieu-nhan-cau-vong", "Siêu nhân Cầu Vồng", "Siêu nhân nhí tạo cầu vồng trên vườn hoa"],
    ["sieu-nhan-trai-dat", "Siêu nhân Trái Đất", "Siêu nhân nhí cùng các bạn dọn sạch công viên"],
    ["sieu-nhan-sao-bang", "Siêu nhân Sao Băng", "Siêu nhân nhí bay bên một ngôi sao băng thân thiện"],
    ["sieu-nhan-robo", "Siêu nhân Robo", "Siêu nhân nhí đập tay cùng robot trợ lý"],
  ]),
  ...themeArts("Vũ trụ", "🚀", [
    ["astronaut", "Bạn nhỏ khám phá Mặt Trăng", "Bạn phi hành gia vẫy tay bên xe thám hiểm trên Mặt Trăng", "/images/to-mau/phi-hanh-gia.png"],
    ["xe-tham-hiem-mat-trang", "Lái xe trên Mặt Trăng", "Bạn phi hành gia lái xe thám hiểm qua những miệng hố"],
    ["ten-lua-ban-be", "Tên lửa của những người bạn", "Tên lửa chở hai bạn nhỏ bay qua những đám mây"],
    ["hanh-tinh-vanh-dai", "Hành tinh vành đai", "Hành tinh vành đai vui vẻ cùng tàu vũ trụ tí hon"],
    ["ngam-sao-tren-doi", "Ngắm sao trên đồi", "Bạn nhỏ dùng kính thiên văn ngắm trăng và các chòm sao"],
    ["nguoi-ngoai-hanh-tinh", "Người bạn ngoài hành tinh", "Bạn ngoài hành tinh vẫy tay bên chiếc đĩa bay"],
    ["vuon-khong-trong-luc", "Vườn hoa không trọng lực", "Phi hành gia tưới hoa trong trạm không gian"],
    ["bong-tren-mat-trang", "Chơi bóng trên Mặt Trăng", "Hai bạn phi hành gia chơi bóng trên Mặt Trăng"],
    ["robot-nhat-da-sao", "Robot nhặt đá sao", "Robot nhỏ thu thập những viên đá hình sao"],
    ["be-bay-trong-phi-thuyen", "Bay trong phi thuyền", "Bạn nhỏ lơ lửng trong khoang phi thuyền thân thiện"],
  ]),
  ...themeArts("Khủng long", "🦕", [
    ["dinosaur", "Khủng long trong vườn dương xỉ", "Khủng long con vui vẻ khám phá khu vườn thời tiền sử", "/images/to-mau/khung-long.png"],
    ["khung-long-ba-sung", "Ba sừng ngửi hoa", "Khủng long ba sừng con ngửi bông hoa khổng lồ"],
    ["khung-long-co-dai", "Khủng long cổ dài", "Khủng long cổ dài với lá cây bên thác nước"],
    ["khung-long-lung-gai", "Lưng gai và bạn bướm", "Khủng long lưng gai con chơi cùng bướm"],
    ["khung-long-ti-rex", "T-Rex nhà thám hiểm", "Khủng long T-Rex con đeo ba lô đi khám phá"],
    ["khung-long-chia-la", "Cùng nhau chia lá", "Hai khủng long con chia nhau chiếc lá lớn"],
    ["khung-long-bay", "Khủng long bay", "Khủng long bay con lượn trên thung lũng"],
    ["khung-long-giap", "Khủng long giáp chơi bóng", "Khủng long giáp con lăn quả tròn cho bạn"],
    ["trung-khung-long", "Trứng khủng long nở", "Khủng long mẹ ngắm khủng long con nở khỏi trứng"],
    ["khung-long-mo-vit", "Mỏ vịt bên dòng sông", "Khủng long mỏ vịt con nghịch nước bên bờ sông"],
  ]),
  ...themeArts("Đại dương", "🐳", [
    ["submarine", "Tàu ngầm và rùa biển", "Tàu ngầm nhỏ gặp bạn rùa dưới đáy đại dương", "/images/to-mau/tau-ngam.png"],
    ["mermaid", "Nàng tiên cá và bạn cá", "Nàng tiên cá vui vẻ vẫy tay chào hai bạn cá dưới đại dương", "/images/to-mau/nang-tien-ca.webp"],
    ["bach-tuoc-danh-trong", "Bạch tuộc đánh trống", "Bạch tuộc con chơi trống vỏ sò cùng các bạn cá"],
    ["ca-heo-ngoai-khoi", "Cá heo ngoài khơi", "Cá heo thân thiện nhảy bên thuyền buồm"],
    ["ca-ngua-san-ho", "Cá ngựa trong vườn san hô", "Cá ngựa con khám phá vườn san hô đầy bong bóng"],
    ["be-lan-bien", "Bé lặn cùng cá đuối", "Bạn nhỏ lặn biển vẫy chào cá đuối"],
    ["ca-voi-hai-dang", "Cá voi và hải đăng", "Cá voi con thổi bong bóng bên ngọn hải đăng"],
    ["cua-xay-lau-dai", "Cua xây lâu đài", "Hai bạn cua xây lâu đài cát dưới đáy biển"],
    ["xe-so-vo-so", "Xe sò của công chúa biển", "Công chúa biển đi xe vỏ sò cùng cá ngựa"],
    ["phong-nghien-cuu-bien", "Phòng nghiên cứu biển", "Nhà khoa học nhí ngắm cá qua cửa sổ dưới biển"],
  ]),
  ...themeArts("Công nghệ", "🤖", [
    ["garden-robot", "Robot chăm vườn hoa", "Bạn robot tròn đáng yêu đang tưới một bông hoa lớn", "/images/to-mau/robot-lam-vuon.webp"],
    ["robot-xep-khoi", "Robot xếp khối", "Robot thân thiện xếp các khối hình học cạnh máy tính"],
    ["be-lap-robot", "Bé lắp robot", "Nhà khoa học nhí lắp robot ở bàn sáng chế"],
    ["robot-kham-pha-vuon", "Robot khám phá khu vườn", "Robot thám hiểm quét hình bạn bướm trong vườn"],
    ["may-bay-giao-thuoc", "Máy bay giao hàng", "Máy bay không người lái giao hộp đồ nhỏ đến khu vườn"],
    ["robot-dau-bep", "Robot đầu bếp", "Robot đầu bếp trộn trái cây trong căn bếp tròn"],
    ["robot-ngam-sao", "Robot cùng bé ngắm sao", "Bạn nhỏ và robot cùng ngắm sao bằng kính thiên văn"],
    ["robot-don-dai-duong", "Robot làm sạch đại dương", "Robot tàu ngầm nhỏ nhặt rác dưới đáy biển"],
    ["robot-sua-ve-tinh", "Robot sửa vệ tinh", "Robot không gian sửa vệ tinh cùng phi hành gia nhí"],
    ["chau-cay-biet-di", "Chậu cây biết đi", "Nhà sáng chế nhí thử chậu cây robot biết đi"],
  ]),
];

export const suggestions = [
  coloringArts.find((art) => art.id === "astronaut")!,
  coloringArts.find((art) => art.id === "rabbit")!,
  coloringArts.find((art) => art.id === "sieu-nhan-anh-duong")!,
];

export function getColoringArtById(id: string) {
  return coloringArts.find((art) => art.id === id);
}

export function coloringDownloadExtension(src: string) {
  if (/\.webp(?:\?|$)/i.test(src) || src.startsWith("data:image/webp")) return "webp";
  if (/\.png(?:\?|$)/i.test(src) || src.startsWith("data:image/png")) return "png";
  return "jpg";
}
