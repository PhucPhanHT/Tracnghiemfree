# UniPrep - Nền Tảng Luyện Thi & Trắc Nghiệm Trực Tuyến

Hệ thống luyện thi trắc nghiệm trực tuyến hiện đại, thiết kế chuẩn UI/UX theo mẫu giao diện UniPrep, tích hợp cơ sở dữ liệu SQLite lưu trữ đề thi và trang Dashboard dành riêng cho Admin để đăng tải/quản lý đề thi.

---

## 🌟 Tính Năng Nổi Bật

### 1. Giao Diện Người Dùng (Theo Mẫu Chuẩn)
- **Kho đề thi (Screenshot 3)**:
  - Danh mục đề thi dạng pill tabs: *Tất cả*, *Triết học Mác-Lênin*, *Kinh tế Chính trị*, *Toán Cao cấp*, *Vật lý Đại cương*, *Lịch sử Đảng*...
  - Thẻ đề thi hiển thị huy hiệu môn học, số lượng câu hỏi, tiêu đề, tóm tắt và 2 chế độ:
    - **Luyện tập**: Tự do làm bài, hiển thị kết quả và giải thích lời giải AI ngay tức thì cho từng câu hỏi.
    - **Kiểm tra**: Chế độ thi tính giờ (countdown timer), nộp bài và chấm điểm tổng kết.
- **Giao diện làm bài (Screenshot 2)**:
  - Thanh tiêu đề: Nút quay lại, Logo UniPrep, Tên đề thi, Đồng hồ đếm ngược và nút **Nộp bài**.
  - 🔀 **Tự động tráo câu hỏi (Shuffle Questions)**: Mỗi lần học viên bấm làm bài hoặc "Làm lại cả đề", hệ thống sẽ tự động xáo trộn ngẫu nhiên thứ tự các câu hỏi (thuật toán Fisher-Yates), giúp chống học vẹt và tạo mã đề thi mới ngẫu nhiên.
  - Danh sách câu hỏi cuộn mượt, câu hỏi đang chọn được làm nổi bật viền xanh ngọc emerald và huy hiệu số thứ tự.
  - Tùy chọn A, B, C, D dạng radio box trực quan, phản hồi nhanh khi hover và chọn.
  - Bảng danh sách câu hỏi bên phải (5 cột), phân biệt trạng thái: **Đã làm** (xanh), **Chưa làm** (xám) và vị trí đang chọn.
- **Modal kết quả & Chấm điểm (Screenshot 1)**:
  - Huy hiệu trạng thái: `Đã nộp bài hoàn tất`.
  - 3 khối thống kê kết quả:
    - **Điểm số (thang 10)**: Điểm số tính theo tỉ lệ câu đúng (Ví dụ: `4.0` / 10).
    - **Số câu đúng**: Tỉ lệ đúng trên tổng số câu (Ví dụ: `10/25`).
    - **Số câu sai**: Số câu làm sai (Ví dụ: `3`).
  - 4 nút thao tác thông minh:
    - ↺ **Làm lại [X] câu sai ngay**: Lọc riêng các câu làm sai để học viên luyện tập lại.
    - ⚡ **Làm lại cả câu sai & câu chưa làm ([Y] câu)**: Tập trung vào những câu chưa đạt yêu cầu.
    - **Xem lại bài & Lời giải AI**: Hiển thị lại toàn bộ đề thi kèm đáp án đúng/sai và phân tích giải thích AI.
    - **Làm lại cả đề**: Khởi động lại toàn bộ đề thi từ đầu.

### 2. Trang Quản Trị Admin (Dashboard)
- **Bảo mật đăng nhập Quản trị viên**:
  - Yêu cầu đăng nhập tài khoản trước khi truy cập Dashboard hoặc thao tác cơ sở dữ liệu.
  - **Tài khoản mặc định**:
    - Tên đăng nhập: `admin`
    - Mật khẩu: `admin123`
  - Cơ chế xác thực an toàn qua Token và mã hóa SHA-256. Có nút Đăng xuất trên thanh điều hướng.
- **Tải lên đề thi mới (Exam Uploader)**:
  - 📄 **Tải lên file Word (.docx) tự động (Tính năng mới)**: Kéo thả hoặc tải trực tiếp file `.docx` từ máy tính. Hệ thống tự động đọc nội dung Word, bóc tách câu hỏi, 4 phương án A-B-C-D, đáp án đúng và lời giải chi tiết, đồng thời nhận diện tiêu đề đề thi. Có sẵn nút "Tải file Word mẫu" để dùng thử.
  - ⚡ **Bộ phân tích văn bản thông minh (Smart AI Text Parser)**: Dán đoạn văn bản thô từ Word/PDF/Web (dạng `Câu 1: ... A. ... B. ... C. ... D. ... Đáp án: A. Giải thích: ...`).
  - ✍️ **Nhập thủ công (Interactive Builder)**: Giao diện trực quan tự thêm câu hỏi và chọn đáp án.
  - 📂 **Nhập bằng file JSON**: Tải lên file cấu trúc JSON đề thi.
- **Quản lý danh sách đề thi**:
  - Xem danh sách, làm thử đề ngay lập tức, xóa đề thi khỏi cơ sở dữ liệu.
- **Lịch sử làm bài**: Theo dõi thời gian nộp bài, điểm số, tỉ lệ đúng/sai và thời gian làm bài của học viên.

### 3. Cơ Sở Dữ Liệu SQLite Lưu Trữ
- Dữ liệu được lưu trữ tự động trong file SQLite tại `data/uniprep.db`:
  - Bảng `admin_users`: Lưu tài khoản và mật khẩu mã hóa của Quản trị viên.
  - Bảng `exams`: Lưu thông tin đề thi (tiêu đề, danh mục, thời gian, mô tả).
  - Bảng `questions`: Lưu danh sách câu hỏi, 4 phương án lựa chọn, đáp án chuẩn và giải thích chi tiết.
  - Bảng `submissions`: Lưu lịch sử nộp bài của học viên.
- Cơ sở dữ liệu đã được nạp sẵn 6 bộ đề mẫu thực tế bám sát hình ảnh đề xuất.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Yêu Cầu
- Đã cài đặt **Node.js** (v18 trở lên).

### Khởi Động Server
1. Mở cửa sổ terminal / PowerShell tại thư mục dự án `d:\Project\Tracnghiemfree`.
2. Khởi động ứng dụng:
   ```bash
   npm start
   ```
   hoặc:
   ```bash
   node server.js
   ```
3. Mở trình duyệt web và truy cập:
   ```text
   http://localhost:3000
   ```

---

## 📁 Cấu Trúc Dự Án

```
d:\Project\Tracnghiemfree/
├── server.js              # Server Express và REST API endpoints
├── db.js                  # Khởi tạo SQLite database, định nghĩa bảng & nạp dữ liệu mẫu
├── parser.js              # Trình phân tích văn bản đề thi thông minh (Smart Parser)
├── data/
│   └── uniprep.db         # File cơ sở dữ liệu SQLite
├── public/                # Giao diện Frontend Single Page App
│   ├── index.html         # Trang chính ứng dụng
│   ├── favicon.svg        # Logo biểu tượng mũ tốt nghiệp UniPrep
│   ├── css/
│   │   └── style.css      # Tùy chỉnh hiệu ứng, animation và màu sắc
│   └── js/
│       ├── api.js         # Client API giao tiếp với Backend
│       ├── exam.js        # Engine làm bài, đếm giờ, câu hỏi & modal kết quả
│       ├── admin.js       # Quản trị Admin, phân tích văn bản & đăng đề
│       └── app.js         # Điều hướng ứng dụng và bộ lọc đề thi
└── package.json           # Cấu hình dự án và dependencies
```