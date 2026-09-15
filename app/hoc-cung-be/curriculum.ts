export type CategoryId = "chu-cai" | "con-so" | "the-gioi";

export type AlphabetItem = {
  upper: string;
  lower: string;
  word: string;
  icon: string;
};

export const VIETNAMESE_ALPHABET: AlphabetItem[] = [
  { upper: "A", lower: "a", word: "Áo", icon: "👕" },
  { upper: "Ă", lower: "ă", word: "Ăn", icon: "🍚" },
  { upper: "Â", lower: "â", word: "Ấm", icon: "🫖" },
  { upper: "B", lower: "b", word: "Bóng", icon: "⚽" },
  { upper: "C", lower: "c", word: "Cá", icon: "🐟" },
  { upper: "D", lower: "d", word: "Dê", icon: "🐐" },
  { upper: "Đ", lower: "đ", word: "Đèn", icon: "💡" },
  { upper: "E", lower: "e", word: "Em bé", icon: "👶" },
  { upper: "Ê", lower: "ê", word: "Ếch", icon: "🐸" },
  { upper: "G", lower: "g", word: "Gấu", icon: "🐻" },
  { upper: "H", lower: "h", word: "Hoa", icon: "🌸" },
  { upper: "I", lower: "i", word: "Ít", icon: "🤏" },
  { upper: "K", lower: "k", word: "Kẹo", icon: "🍬" },
  { upper: "L", lower: "l", word: "Lá", icon: "🍃" },
  { upper: "M", lower: "m", word: "Mèo", icon: "🐱" },
  { upper: "N", lower: "n", word: "Nón", icon: "👒" },
  { upper: "O", lower: "o", word: "Ong", icon: "🐝" },
  { upper: "Ô", lower: "ô", word: "Ô tô", icon: "🚗" },
  { upper: "Ơ", lower: "ơ", word: "Ớt", icon: "🌶️" },
  { upper: "P", lower: "p", word: "Pin", icon: "🔋" },
  { upper: "Q", lower: "q", word: "Quả", icon: "🍊" },
  { upper: "R", lower: "r", word: "Rùa", icon: "🐢" },
  { upper: "S", lower: "s", word: "Sóc", icon: "🐿️" },
  { upper: "T", lower: "t", word: "Táo", icon: "🍎" },
  { upper: "U", lower: "u", word: "Ủng", icon: "🥾" },
  { upper: "Ư", lower: "ư", word: "Ước mơ", icon: "🌈" },
  { upper: "V", lower: "v", word: "Voi", icon: "🐘" },
  { upper: "X", lower: "x", word: "Xe", icon: "🚲" },
  { upper: "Y", lower: "y", word: "Y tá", icon: "🩺" },
];

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

export function numberToVietnamese(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 100) return "";
  if (value < 10) return DIGITS[value];
  if (value === 10) return "mười";
  if (value < 20) {
    const unit = value % 10;
    if (unit === 5) return "mười lăm";
    return `mười ${DIGITS[unit]}`;
  }
  if (value === 100) return "một trăm";

  const tens = Math.floor(value / 10);
  const unit = value % 10;
  if (unit === 0) return `${DIGITS[tens]} mươi`;
  if (unit === 1) return `${DIGITS[tens]} mươi mốt`;
  if (unit === 4) return `${DIGITS[tens]} mươi tư`;
  if (unit === 5) return `${DIGITS[tens]} mươi lăm`;
  return `${DIGITS[tens]} mươi ${DIGITS[unit]}`;
}

export const NUMBER_RANGES = [
  { id: "0-20", label: "Từ 0 đến 20", start: 0, end: 20 },
  { id: "21-50", label: "Từ 21 đến 50", start: 21, end: 50 },
  { id: "51-100", label: "Từ 51 đến 100", start: 51, end: 100 },
] as const;

export const ANIMAL_GROUPS = [
  {
    id: "thu-cung",
    label: "Thú cưng",
    icon: "🏡",
    image: "/images/animals/thu-cung.webp",
    layout: "row",
    alt: "Chó, mèo, thỏ và chim yến phụng trong những khung cảnh thân thiện",
    introduction: "Những người bạn gần gũi sống cùng con người và cần được chăm sóc dịu dàng.",
    animals: [
      { name: "Chó", icon: "🐶", fact: "Thính giác và khứu giác rất nhạy.", sound: "Tiếng chó sủa", motionSrc: "/media/animals/motion/dog.mp4", audioSrc: "/media/animals/sounds/dog.mp3" },
      { name: "Mèo", icon: "🐱", fact: "Có ria giúp cảm nhận không gian xung quanh.", sound: "Tiếng mèo kêu", motionSrc: "/media/animals/motion/cat.mp4", audioSrc: "/media/animals/sounds/cat.mp3" },
      { name: "Thỏ", icon: "🐰", fact: "Đôi tai dài giúp nghe âm thanh rất tốt.", sound: "Tiếng thỏ khịt và rít nhẹ", motionSrc: "/media/animals/motion/rabbit.mp4", audioSrc: "/media/animals/sounds/rabbit.mp3" },
      { name: "Chim yến phụng", icon: "🐦", fact: "Thích hót, bay và sống cùng bạn bè.", sound: "Tiếng yến phụng líu lo", motionSrc: "/media/animals/motion/budgie.mp4", audioSrc: "/media/animals/sounds/budgie.mp3" },
    ],
  },
  {
    id: "nong-trai",
    label: "Nông trại",
    icon: "🌾",
    image: "/images/animals/nong-trai.webp",
    layout: "row",
    alt: "Bò, lợn, cừu và gà trong trang trại xanh",
    introduction: "Các con vật quen thuộc ở nông trại có thức ăn, nơi ở và ích lợi khác nhau.",
    animals: [
      { name: "Bò", icon: "🐮", fact: "Ăn cỏ và thường sống theo đàn.", sound: "Tiếng bò rống", motionSrc: "/media/animals/motion/cow.mp4", audioSrc: "/media/animals/sounds/cow.mp3" },
      { name: "Lợn", icon: "🐷", fact: "Có chiếc mũi rất khỏe để tìm thức ăn.", sound: "Tiếng lợn ủn ỉn", motionSrc: "/media/animals/motion/pig.mp4", audioSrc: "/media/animals/sounds/pig.mp3" },
      { name: "Cừu", icon: "🐑", fact: "Bộ lông dày giúp giữ ấm cơ thể.", sound: "Tiếng cừu kêu", motionSrc: "/media/animals/motion/sheep.mp4", audioSrc: "/media/animals/sounds/sheep.mp3" },
      { name: "Gà", icon: "🐔", fact: "Dùng mỏ để nhặt hạt và bới đất tìm thức ăn.", sound: "Tiếng gà cục tác", motionSrc: "/media/animals/motion/chicken.mp4", audioSrc: "/media/animals/sounds/chicken.mp3" },
    ],
  },
  {
    id: "duoi-nuoc",
    label: "Dưới nước",
    icon: "🌊",
    image: "/images/animals/duoi-nuoc.webp",
    layout: "grid",
    alt: "Cá heo, rùa biển, cá hề và bạch tuộc dưới đại dương",
    introduction: "Đại dương là ngôi nhà rộng lớn của nhiều con vật biết bơi và thở theo những cách đặc biệt.",
    animals: [
      { name: "Cá heo", icon: "🐬", fact: "Là động vật có vú và phải ngoi lên để thở.", sound: "Tiếng cá heo giao tiếp", motionSrc: "/media/animals/motion/dolphin.mp4", audioSrc: "/media/animals/sounds/dolphin.mp3" },
      { name: "Rùa biển", icon: "🐢", fact: "Dùng bốn chiếc vây lớn để bơi xa.", sound: "Nghe môi trường dưới nước", soundNote: "Rùa biển hầu như không có tiếng kêu quen thuộc, nên bé sẽ nghe âm thanh môi trường sống của rùa.", motionSrc: "/media/animals/motion/turtle.mp4", audioSrc: "/media/animals/sounds/turtle.mp3" },
      { name: "Cá hề", icon: "🐠", fact: "Thường sống gần những chiếc hải quỳ.", sound: "Nghe môi trường dưới nước", soundNote: "Âm cá phát ra rất nhỏ; đoạn này giúp bé hình dung môi trường nước quanh cá hề.", motionSrc: "/media/animals/motion/clownfish.mp4", audioSrc: "/media/animals/sounds/clownfish.mp3" },
      { name: "Bạch tuộc", icon: "🐙", fact: "Có tám xúc tu rất linh hoạt.", sound: "Nghe chuyển động dưới nước", soundNote: "Bạch tuộc không có tiếng kêu quen thuộc; bé đang nghe âm nước khi bạn ấy di chuyển.", motionSrc: "/media/animals/motion/octopus.mp4", audioSrc: "/media/animals/sounds/octopus.mp3" },
    ],
  },
  {
    id: "tren-troi",
    label: "Biết bay",
    icon: "☁️",
    image: "/images/animals/tren-troi.webp",
    layout: "grid",
    alt: "Vẹt, chim sẻ, bồ câu và bướm đang bay trong khu vườn",
    introduction: "Đôi cánh giúp nhiều loài chim và côn trùng di chuyển trong không trung.",
    animals: [
      { name: "Vẹt", icon: "🦜", fact: "Có bộ lông rực rỡ và chiếc mỏ cong khỏe.", sound: "Tiếng vẹt gọi", motionSrc: "/media/animals/motion/parrot.mp4", audioSrc: "/media/animals/sounds/parrot.mp3" },
      { name: "Chim sẻ", icon: "🐦", fact: "Nhỏ bé, nhanh nhẹn và thường sống gần con người.", sound: "Tiếng chim sẻ líu ríu", motionSrc: "/media/animals/motion/sparrow.mp4", audioSrc: "/media/animals/sounds/sparrow.mp3" },
      { name: "Bồ câu", icon: "🕊️", fact: "Có thể ghi nhớ đường về tổ rất giỏi.", sound: "Tiếng bồ câu gù", motionSrc: "/media/animals/motion/pigeon.mp4", audioSrc: "/media/animals/sounds/pigeon.mp3" },
      { name: "Bướm", icon: "🦋", fact: "Dùng vòi dài để hút mật hoa.", sound: "Nghe đôi cánh vỗ", soundNote: "Cánh bướm thật gần như không nghe thấy; âm thanh được phóng đại để bé dễ hình dung.", motionSrc: "/media/animals/motion/butterfly.mp4", audioSrc: "/media/animals/sounds/butterfly.mp3" },
    ],
  },
  {
    id: "hoang-da",
    label: "Hoang dã",
    icon: "🌳",
    image: "/images/animals/hoang-da.webp",
    layout: "row",
    alt: "Voi, sư tử, hươu cao cổ và khỉ trong thiên nhiên hoang dã",
    introduction: "Động vật hoang dã sống trong rừng, đồng cỏ và cần môi trường tự nhiên được bảo vệ.",
    animals: [
      { name: "Voi", icon: "🐘", fact: "Dùng chiếc vòi dài để uống nước và cầm đồ vật.", sound: "Tiếng voi rống", motionSrc: "/media/animals/motion/elephant.mp4", audioSrc: "/media/animals/sounds/elephant.mp3" },
      { name: "Sư tử", icon: "🦁", fact: "Sống theo đàn và giao tiếp bằng tiếng gầm.", sound: "Tiếng sư tử gầm", motionSrc: "/media/animals/motion/lion.mp4", audioSrc: "/media/animals/sounds/lion.mp3" },
      { name: "Hươu cao cổ", icon: "🦒", fact: "Chiếc cổ dài giúp ăn lá trên cành cao.", sound: "Tiếng hươu cao cổ ngân trầm", motionSrc: "/media/animals/motion/giraffe.mp4", audioSrc: "/media/animals/sounds/giraffe.mp3" },
      { name: "Khỉ", icon: "🐒", fact: "Bàn tay khéo léo giúp leo trèo và hái quả.", sound: "Tiếng khỉ gọi đàn", motionSrc: "/media/animals/motion/monkey.mp4", audioSrc: "/media/animals/sounds/monkey.mp3" },
    ],
  },
] as const;

export const WORLD_TOPICS = [
  {
    id: "dong-vat",
    icon: "🐾",
    title: "Các con vật",
    description: "Gọi tên con vật, nơi ở và âm thanh quen thuộc.",
    introduction: "Mỗi con vật có một nơi sống, cách di chuyển và tiếng kêu riêng. Quan sát những đặc điểm này giúp bé nhận ra các bạn thật nhanh.",
    facts: [
      { icon: "🐟", title: "Dưới nước", text: "Cá dùng vây để bơi và dùng mang để thở dưới nước." },
      { icon: "🐦", title: "Trên bầu trời", text: "Chim có cánh, lông vũ và nhiều loài làm tổ trên cây." },
      { icon: "🐶", title: "Bên con người", text: "Chó và mèo là những vật nuôi gần gũi trong gia đình." },
    ],
    questions: [
      { prompt: "Cá thường sống ở đâu?", hint: "Cá dùng mang để thở trong môi trường này.", visual: "🐟", choices: ["Dưới nước", "Trên cây", "Trong tổ"], answer: "Dưới nước" },
      { prompt: "Con vật nào có lông vũ và đôi cánh?", hint: "Bạn này thường làm tổ trên cây.", visual: "🪶", choices: ["Chim", "Cá", "Mèo"], answer: "Chim" },
      { prompt: "Bạn nào thường kêu gâu gâu?", hint: "Đây là một người bạn trung thành của con người.", visual: "🏡", choices: ["Chó", "Gà", "Vịt"], answer: "Chó" },
      { prompt: "Bộ phận nào giúp cá bơi?", hint: "Cá quẫy bộ phận này để di chuyển trong nước.", visual: "🐠", choices: ["Vây", "Cánh", "Chân"], answer: "Vây" },
    ],
  },
  {
    id: "cay-va-hoa",
    icon: "🌱",
    title: "Cây và hoa",
    description: "Tìm hiểu cây lớn lên nhờ nước, đất và ánh sáng.",
    introduction: "Cây bắt đầu từ hạt nhỏ, mọc rễ xuống đất và vươn lá về phía ánh sáng. Khi được chăm sóc, cây có thể nở hoa và cho quả.",
    facts: [
      { icon: "🌰", title: "Hạt nảy mầm", text: "Hạt gặp đủ nước và không khí sẽ thức dậy thành mầm non." },
      { icon: "🌿", title: "Rễ và lá", text: "Rễ hút nước từ đất, còn lá đón ánh sáng mặt trời." },
      { icon: "🌸", title: "Hoa và quả", text: "Nhiều bông hoa sau khi được thụ phấn sẽ phát triển thành quả." },
    ],
    questions: [
      { prompt: "Bộ phận nào của cây hút nước từ đất?", hint: "Bộ phận này thường nằm dưới mặt đất.", visual: "🌱", choices: ["Rễ", "Hoa", "Quả"], answer: "Rễ" },
      { prompt: "Lá cây thường đón gì để giúp cây lớn?", hint: "Nguồn sáng ấm áp này đến từ bầu trời.", visual: "🌿", choices: ["Ánh sáng", "Đồ chơi", "Tiếng nhạc"], answer: "Ánh sáng" },
      { prompt: "Điều gì có thể mọc ra từ một hạt nhỏ?", hint: "Hạt thức dậy rồi nhú lên khỏi mặt đất.", visual: "🌰 → ?", choices: ["Mầm cây", "Viên đá", "Đám mây"], answer: "Mầm cây" },
      { prompt: "Bé nên làm gì để chăm cây?", hint: "Cây cũng cần uống mỗi ngày.", visual: "🪴", choices: ["Tưới nước vừa đủ", "Bẻ lá", "Giẫm lên cây"], answer: "Tưới nước vừa đủ" },
    ],
  },
  {
    id: "thoi-tiet",
    icon: "🌦️",
    title: "Thời tiết",
    description: "Quan sát nắng, mưa, gió và chọn trang phục phù hợp.",
    introduction: "Thời tiết có thể thay đổi trong ngày. Nhìn bầu trời và cảm nhận không khí giúp bé biết nên mang theo mũ, áo mưa hay áo ấm.",
    facts: [
      { icon: "☀️", title: "Trời nắng", text: "Nắng làm không khí ấm hơn; bé nên đội mũ và uống đủ nước." },
      { icon: "🌧️", title: "Trời mưa", text: "Mây mang nhiều giọt nước sẽ tạo thành mưa rơi xuống." },
      { icon: "💨", title: "Trời gió", text: "Không nhìn thấy gió, nhưng bé có thể thấy lá và tóc chuyển động." },
    ],
    questions: [
      { prompt: "Khi trời mưa, bé nên mang theo gì?", hint: "Đồ vật này giúp quần áo không bị ướt.", visual: "🌧️", choices: ["Ô hoặc áo mưa", "Kính bơi", "Quạt giấy"], answer: "Ô hoặc áo mưa" },
      { prompt: "Dấu hiệu nào cho thấy trời có gió?", hint: "Gió làm những vật nhẹ chuyển động.", visual: "💨", choices: ["Lá cây lay động", "Đèn trong nhà sáng", "Đồng hồ chạy"], answer: "Lá cây lay động" },
      { prompt: "Trời nắng nóng, bé cần nhớ điều gì?", hint: "Cơ thể cần được mát và đủ nước.", visual: "☀️", choices: ["Uống đủ nước", "Mặc áo thật dày", "Không đội mũ"], answer: "Uống đủ nước" },
      { prompt: "Tiếng sấm thường xuất hiện khi nào?", hint: "Hiện tượng này thường đi cùng mây đen và mưa lớn.", visual: "⚡", choices: ["Trời dông", "Trời quang", "Trời có cầu vồng"], answer: "Trời dông" },
    ],
  },
  {
    id: "ngay-va-dem",
    icon: "🌅",
    title: "Ngày và đêm",
    description: "Nhận biết buổi sáng, buổi trưa, buổi tối và giờ đi ngủ.",
    introduction: "Một ngày có buổi sáng, trưa, chiều và tối. Mặt trời giúp bé nhận biết ban ngày, còn mặt trăng và các vì sao thường xuất hiện ban đêm.",
    facts: [
      { icon: "🌄", title: "Buổi sáng", text: "Mặt trời mọc, bé thức dậy, vệ sinh cá nhân và ăn sáng." },
      { icon: "🌞", title: "Buổi trưa", text: "Mặt trời lên cao; bé ăn trưa và nghỉ ngơi để lấy lại sức." },
      { icon: "🌙", title: "Buổi tối", text: "Trời tối dần; bé chuẩn bị đồ cho ngày mai và đi ngủ đúng giờ." },
    ],
    questions: [
      { prompt: "Mặt trời thường mọc vào lúc nào?", hint: "Đây là lúc một ngày mới bắt đầu.", visual: "🌄", choices: ["Buổi sáng", "Buổi trưa", "Nửa đêm"], answer: "Buổi sáng" },
      { prompt: "Bé thường ăn trưa vào lúc nào?", hint: "Thời điểm này nằm giữa buổi sáng và buổi chiều.", visual: "🍚", choices: ["Buổi trưa", "Nửa đêm", "Sáng sớm"], answer: "Buổi trưa" },
      { prompt: "Vật nào thường nhìn thấy rõ trên trời đêm?", hint: "Vật này có hình tròn hoặc hình lưỡi liềm.", visual: "✨", choices: ["Mặt trăng", "Cầu vồng", "Mặt trời mọc"], answer: "Mặt trăng" },
      { prompt: "Trước khi đi ngủ, bé nên làm gì?", hint: "Việc này giúp răng sạch và khỏe.", visual: "🛏️", choices: ["Đánh răng", "Ăn thêm kẹo", "Chạy ra đường"], answer: "Đánh răng" },
    ],
  },
  {
    id: "mau-sac",
    icon: "🎨",
    title: "Màu sắc",
    description: "Nhìn, gọi tên và tìm màu trong những đồ vật quanh bé.",
    introduction: "Màu sắc giúp thế giới dễ nhận biết và vui mắt hơn. Bé có thể học màu bằng cách quan sát trái cây, cây cối, bầu trời và đồ dùng mỗi ngày.",
    facts: [
      { icon: "🍌", title: "Màu vàng", text: "Quả chuối chín và ánh nắng thường gợi cho bé nhớ màu vàng." },
      { icon: "🍃", title: "Màu xanh lá", text: "Lá cây khỏe mạnh thường có màu xanh lá." },
      { icon: "🌊", title: "Màu xanh dương", text: "Bầu trời quang và mặt biển thường gợi màu xanh dương." },
    ],
    questions: [
      { prompt: "Quả chuối chín thường có màu gì?", hint: "Đó là màu của nắng ấm.", visual: "🍌", choices: ["Vàng", "Tím", "Đen"], answer: "Vàng" },
      { prompt: "Lá cây khỏe mạnh thường có màu gì?", hint: "Tên màu này cũng có chữ lá.", visual: "🍃", choices: ["Xanh lá", "Hồng", "Cam"], answer: "Xanh lá" },
      { prompt: "Bầu trời quang thường có màu gì?", hint: "Đây cũng là màu thường thấy của biển.", visual: "☁️", choices: ["Xanh dương", "Nâu", "Đỏ"], answer: "Xanh dương" },
      { prompt: "Quả cà chua chín thường có màu gì?", hint: "Đó là màu rất nổi bật và ấm áp.", visual: "🍅", choices: ["Đỏ", "Xám", "Trắng"], answer: "Đỏ" },
    ],
  },
  {
    id: "gia-dinh",
    icon: "🏡",
    title: "Gia đình",
    description: "Học cách quan tâm, chia sẻ và giữ an toàn cùng người thân.",
    introduction: "Gia đình là nơi mọi người yêu thương, lắng nghe và giúp đỡ nhau. Bé cũng có thể góp sức bằng những việc nhỏ phù hợp với mình.",
    facts: [
      { icon: "💛", title: "Biết quan tâm", text: "Hỏi thăm, ôm và lắng nghe là những cách thể hiện tình yêu thương." },
      { icon: "🧸", title: "Cùng chia sẻ", text: "Bé có thể cất đồ chơi, giữ góc học tập gọn gàng và chia sẻ việc nhỏ." },
      { icon: "🤝", title: "Nhờ giúp đỡ", text: "Khi lo lắng hoặc gặp nguy hiểm, hãy nói ngay với người lớn đáng tin cậy." },
    ],
    questions: [
      { prompt: "Việc nào thể hiện bé biết giúp đỡ gia đình?", hint: "Một việc nhỏ bé có thể tự làm sau khi chơi.", visual: "🧸", choices: ["Cất đồ chơi", "Vứt đồ ra sàn", "La hét"], answer: "Cất đồ chơi" },
      { prompt: "Khi cảm thấy không an toàn, bé nên làm gì?", hint: "Hãy tìm người có thể bảo vệ và giúp bé.", visual: "🤝", choices: ["Nói với người lớn đáng tin cậy", "Giữ kín một mình", "Đi theo người lạ"], answer: "Nói với người lớn đáng tin cậy" },
      { prompt: "Khi được người khác giúp, bé nên nói gì?", hint: "Hai tiếng lịch sự này làm mọi người vui.", visual: "💛", choices: ["Cảm ơn", "Không cần", "Tránh ra"], answer: "Cảm ơn" },
      { prompt: "Cách nào giúp cả nhà hiểu nhau hơn?", hint: "Mọi người lần lượt nói và nghe nhau.", visual: "👨‍👩‍👧", choices: ["Lắng nghe và chia sẻ", "Không nói chuyện", "Tranh giành"], answer: "Lắng nghe và chia sẻ" },
    ],
  },
] as const;

export const WORLD_ACTIVITIES = [
  {
    topicId: "cay-va-hoa",
    title: "Từ hạt nhỏ đến bông hoa",
    instruction: "Chạm theo từng bước để xem cây lớn lên.",
    options: [
      { label: "Hạt", icon: "🌰", color: "#b77b45", description: "Hạt nằm trong đất và chờ đủ nước để nảy mầm.", narration: "Hạt nhỏ đang nằm trong đất." },
      { label: "Mầm", icon: "🌱", color: "#69a34f", description: "Rễ mọc xuống, mầm non bắt đầu vươn lên đón sáng.", narration: "Mầm non nhú lên rồi!" },
      { label: "Cây non", icon: "🪴", color: "#3f8c51", description: "Cây có thêm lá mới và cần được tưới nước vừa đủ.", narration: "Cây non đang lớn lên mỗi ngày." },
      { label: "Ra hoa", icon: "🌻", color: "#e2a42b", description: "Cây khỏe mạnh nở hoa rực rỡ và thu hút ong bướm.", narration: "Bông hoa đã nở thật đẹp!" },
    ],
  },
  {
    topicId: "thoi-tiet",
    title: "Hôm nay trời thế nào?",
    instruction: "Chọn kiểu thời tiết để biết bé nên chuẩn bị gì.",
    options: [
      { label: "Nắng", icon: "☀️", color: "#e6aa28", description: "Đội mũ, chơi ở nơi mát và nhớ uống đủ nước.", narration: "Trời nắng. Bé nhớ đội mũ và uống nước nhé." },
      { label: "Mưa", icon: "🌧️", color: "#4f89c8", description: "Mang ô hoặc áo mưa và đi chậm trên nền đường ướt.", narration: "Trời mưa. Bé mang áo mưa nhé." },
      { label: "Gió", icon: "💨", color: "#51a6a0", description: "Quan sát lá cây lay động và giữ chắc chiếc mũ của bé.", narration: "Gió đang thổi làm lá cây lay động." },
      { label: "Dông", icon: "⛈️", color: "#755fa5", description: "Ở trong nhà, tránh xa cửa sổ và nghe lời người lớn.", narration: "Trời dông. Mình cùng ở trong nhà cho an toàn." },
    ],
  },
  {
    topicId: "ngay-va-dem",
    title: "Một ngày của bé",
    instruction: "Chạm vào từng thời điểm để xem hoạt động phù hợp.",
    options: [
      { label: "Buổi sáng", icon: "🌄", color: "#efad38", description: "Thức dậy, đánh răng, ăn sáng và bắt đầu ngày mới.", narration: "Chào buổi sáng! Mình thức dậy và ăn sáng nhé." },
      { label: "Buổi trưa", icon: "🌞", color: "#e18d2e", description: "Ăn trưa đủ chất và nghỉ một lát để lấy lại năng lượng.", narration: "Buổi trưa, bé ăn ngon và nghỉ ngơi." },
      { label: "Buổi chiều", icon: "🌤️", color: "#6e9fc6", description: "Học, vui chơi và vận động khi trời dịu hơn.", narration: "Buổi chiều là lúc học và vui chơi." },
      { label: "Buổi tối", icon: "🌙", color: "#675a9e", description: "Cất đồ, đánh răng và đi ngủ đúng giờ.", narration: "Buổi tối, bé chuẩn bị đi ngủ thôi." },
    ],
  },
  {
    topicId: "mau-sac",
    title: "Săn tìm màu sắc",
    instruction: "Chọn một màu rồi tìm đồ vật cùng màu quanh bé.",
    options: [
      { label: "Vàng", icon: "🍌", color: "#e8b928", description: "Màu vàng có ở chuối chín, hoa hướng dương và nắng ấm.", narration: "Màu vàng như quả chuối chín." },
      { label: "Xanh lá", icon: "🍃", color: "#58a653", description: "Màu xanh lá thường thấy ở lá, cỏ và nhiều loại rau.", narration: "Màu xanh lá như chiếc lá non." },
      { label: "Xanh dương", icon: "🌊", color: "#438fc5", description: "Màu xanh dương gợi bầu trời quang và biển rộng.", narration: "Màu xanh dương như bầu trời." },
      { label: "Đỏ", icon: "🍅", color: "#df5c4b", description: "Màu đỏ nổi bật ở cà chua chín, táo và nhiều bông hoa.", narration: "Màu đỏ như quả cà chua chín." },
    ],
  },
  {
    topicId: "gia-dinh",
    title: "Việc nhỏ đầy yêu thương",
    instruction: "Chọn một việc bé có thể làm cùng gia đình.",
    options: [
      { label: "Cất đồ chơi", icon: "🧸", color: "#dc8747", description: "Chơi xong, bé đưa từng món về đúng chỗ để nhà cửa gọn gàng.", narration: "Bé giỏi quá, mình cùng cất đồ chơi nhé." },
      { label: "Nói cảm ơn", icon: "💛", color: "#dcaa2d", description: "Một lời cảm ơn chân thành cho người khác biết bé trân trọng sự giúp đỡ.", narration: "Cảm ơn là hai tiếng thật đẹp." },
      { label: "Lắng nghe", icon: "👂", color: "#5f96c2", description: "Nhìn người đang nói và chờ đến lượt giúp mọi người hiểu nhau hơn.", narration: "Mình cùng lắng nghe người thân nói nhé." },
      { label: "Nhờ giúp đỡ", icon: "🤝", color: "#6a9a57", description: "Khi lo lắng hoặc gặp khó, bé hãy nói với người lớn đáng tin cậy.", narration: "Khi cần, bé hãy nhờ người lớn đáng tin cậy giúp đỡ." },
    ],
  },
] as const;
