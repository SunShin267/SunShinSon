import type { Square } from "chess.js";

export type PieceLesson = {
  piece: "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
  symbol: string;
  nameVi: string;
  nameEn: string;
  value: string;
  movement: string;
  capture: string;
  exampleFen: string;
  exercise: { from: Square; prompt: string };
};

export const PIECE_LESSONS: readonly PieceLesson[] = [
  { piece: "king", symbol: "♔", nameVi: "Vua", nameEn: "King", value: "Không thể đổi", movement: "Đi một ô theo mọi hướng và không được bước vào ô đang bị tấn công.", capture: "Bắt quân ở ô kề bên nếu ô đó an toàn.", exampleFen: "7k/8/8/8/8/4K3/8/8 w - - 0 1", exercise: { from: "e3", prompt: "Hãy đưa Vua tới một ô an toàn." } },
  { piece: "queen", symbol: "♕", nameVi: "Hậu", nameEn: "Queen", value: "9 điểm", movement: "Đi bao nhiêu ô tùy ý theo hàng ngang, dọc hoặc đường chéo.", capture: "Bắt quân ở ô cuối đường đi, nhưng không thể nhảy qua quân khác.", exampleFen: "7k/8/8/8/3Q4/8/8/K7 w - - 0 1", exercise: { from: "d4", prompt: "Tìm một đường đi ngang, dọc hoặc chéo cho Hậu." } },
  { piece: "rook", symbol: "♖", nameVi: "Xe", nameEn: "Rook", value: "5 điểm", movement: "Đi bao nhiêu ô tùy ý theo hàng ngang hoặc dọc.", capture: "Bắt quân ở cuối đường thẳng và không nhảy qua quân khác.", exampleFen: "7k/8/8/8/3R4/8/8/K7 w - - 0 1", exercise: { from: "d4", prompt: "Hãy đưa Xe tới một ô cùng hàng hoặc cùng cột." } },
  { piece: "bishop", symbol: "♗", nameVi: "Tượng", nameEn: "Bishop", value: "3 điểm", movement: "Đi bao nhiêu ô tùy ý theo đường chéo và luôn ở cùng một màu ô.", capture: "Bắt quân ở cuối đường chéo, không nhảy qua quân khác.", exampleFen: "7k/8/8/8/3B4/8/8/K7 w - - 0 1", exercise: { from: "d4", prompt: "Tìm một ô nằm trên đường chéo của Tượng." } },
  { piece: "knight", symbol: "♘", nameVi: "Mã", nameEn: "Knight", value: "3 điểm", movement: "Đi theo hình chữ L: hai ô theo một hướng rồi một ô sang bên.", capture: "Mã là quân duy nhất có thể nhảy qua các quân khác.", exampleFen: "7k/8/8/8/3N4/8/8/K7 w - - 0 1", exercise: { from: "d4", prompt: "Hãy tìm một điểm đến hình chữ L." } },
  { piece: "pawn", symbol: "♙", nameVi: "Tốt", nameEn: "Pawn", value: "1 điểm", movement: "Đi thẳng một ô; ở vị trí đầu có thể đi hai ô nếu đường trống.", capture: "Bắt chéo một ô về phía trước; có thể bắt tốt qua đường trong đúng thời điểm.", exampleFen: "7k/8/8/8/8/8/3P4/K7 w - - 0 1", exercise: { from: "d2", prompt: "Đưa Tốt tiến lên một hoặc hai ô." } },
];

export type RuleLesson = { id: string; icon: string; title: string; summary: string; exampleFen: string; steps: readonly string[] };

export const RULE_LESSONS: readonly RuleLesson[] = [
  { id: "objective", icon: "🎯", title: "Mục tiêu", summary: "Chiếu hết Vua đối phương.", exampleFen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", steps: ["Vua bị chiếu phải tìm cách thoát.", "Không còn nước hợp lệ để thoát chiếu là chiếu hết."] },
  { id: "turns", icon: "↔", title: "Lượt đi", summary: "Trắng đi trước, sau đó hai bên luân phiên.", exampleFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", steps: ["Mỗi lượt đi một quân.", "Không được bỏ lượt hay đi hai lần liên tiếp."] },
  { id: "capture", icon: "⚔", title: "Bắt quân", summary: "Đi tới ô của quân đối phương để đưa quân đó khỏi bàn.", exampleFen: "7k/8/8/3p4/4P3/8/8/K7 w - - 0 1", steps: ["Mỗi quân bắt theo quy tắc di chuyển của mình, riêng Tốt bắt chéo.", "Không được bắt quân cùng màu."] },
  { id: "check", icon: "!", title: "Chiếu Vua", summary: "Vua đang bị tấn công phải được cứu ngay.", exampleFen: "4k3/8/8/8/8/8/4R3/K7 b - - 0 1", steps: ["Di chuyển Vua, che đường chiếu hoặc bắt quân đang chiếu.", "Không được thực hiện nước đi khiến Vua mình còn bị chiếu."] },
  { id: "checkmate", icon: "♚", title: "Chiếu hết", summary: "Vua bị chiếu và không còn cách thoát: ván cờ kết thúc.", exampleFen: "7k/6Q1/6K1/8/8/8/8/8 b - - 0 1", steps: ["Kiểm tra mọi ô Vua có thể đi.", "Kiểm tra khả năng bắt quân chiếu hoặc che chắn.", "Nếu đều không thể, bên chiếu thắng."] },
  { id: "castling", icon: "♔♖", title: "Nhập thành", summary: "Một nước đặc biệt đưa Vua về nơi an toàn và phát triển Xe.", exampleFen: "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", steps: ["Vua và Xe liên quan chưa từng di chuyển.", "Các ô ở giữa phải trống.", "Vua không đang bị chiếu, không đi qua hoặc tới ô bị tấn công."] },
  { id: "promotion", icon: "♙→♕", title: "Phong cấp", summary: "Tốt tới hàng cuối được đổi thành Hậu, Xe, Tượng hoặc Mã.", exampleFen: "7k/P7/8/8/8/8/8/K7 w - - 0 1", steps: ["Chọn quân phong cấp ngay trong nước đi.", "Không bắt buộc phải chọn Hậu."] },
  { id: "en-passant", icon: "↗", title: "Bắt Tốt qua đường", summary: "Tốt có thể bắt đặc biệt ngay sau khi Tốt đối phương đi hai ô.", exampleFen: "7k/8/8/3pP3/8/8/8/K7 w - d6 0 2", steps: ["Chỉ thực hiện ở lượt kế tiếp.", "Tốt bắt đi chéo tới ô mà Tốt đối phương vừa đi qua."] },
  { id: "stalemate", icon: "🤝", title: "Hết nước đi", summary: "Không bị chiếu nhưng không có nước hợp lệ: hòa.", exampleFen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", steps: ["Khác chiếu hết vì Vua không bị tấn công.", "Ván cờ kết thúc với kết quả hòa."] },
  { id: "draws", icon: "½", title: "Các kiểu hòa", summary: "Hòa khi lặp thế, thiếu quân chiếu hết, luật 50 nước hoặc hai bên đồng ý.", exampleFen: "7k/8/8/8/8/8/8/K7 w - - 0 1", steps: ["Một thế cờ xuất hiện ba lần có thể được tính hòa.", "Không đủ vật chất để chiếu hết là hòa.", "50 nước liên tiếp không đi Tốt hay bắt quân dẫn tới hòa."] },
  { id: "touch-move", icon: "☝", title: "Luật chạm quân", summary: "Khi chơi nghiêm túc, đã chạm quân mình thì nên đi quân đó nếu hợp lệ.", exampleFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", steps: ["Trong ứng dụng, chọn lại quân khác trước khi đi vẫn được.", "Ngoài đời, hãy nói “chỉnh quân” trước khi sửa vị trí quân."] },
  { id: "clock", icon: "⏱", title: "Đồng hồ cờ", summary: "Mỗi bên có quỹ thời gian riêng.", exampleFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", steps: ["Thời gian của người đang tới lượt sẽ giảm.", "Đi xong thì đồng hồ chuyển sang đối thủ.", "Hết giờ thường thua, nhưng hòa nếu đối thủ không đủ quân để chiếu hết."] },
];
