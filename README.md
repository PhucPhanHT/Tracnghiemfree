# 🎓 UniPrep - Nền Tảng Luyện Thi & Trắc Nghiệm Trực Tuyến Thông Minh

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v5.x-000000.svg?logo=express&logoColor=white)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-336791.svg?logo=postgresql&logoColor=white)](https://www.sqlite.org/)
[![Google Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%203.0%20Flash-4285F4.svg?logo=google&logoColor=white)](https://aistudio.google.com/)
[![Mobile Optimized](https://img.shields.io/badge/UX-Mobile%20Optimized-00A86B.svg?logo=pwa&logoColor=white)](#-trải-nghiệm-giao-diện-di-động-đột-phá-mobile-first-ux)
[![Deployment](https://img.shields.io/badge/Deploy-Render.com-46E3B7.svg?logo=render&logoColor=white)](https://render.com/)
[![License](https://img.shields.io/badge/License-MIT-blueviolet.svg)](LICENSE)

> **UniPrep** là nền tảng ôn luyện & thi trắc nghiệm trực tuyến toàn diện, được thiết kế theo tư duy **Mobile-First UX** với giao diện mượt mà trên cả Điện thoại và Máy tính. Hệ thống tích hợp **Trợ lý Trí tuệ Nhân tạo Google Gemini 24/7** (không bị ngắt cụt nội dung), công nghệ **bóc tách đề thi tự động từ file Word (`.docx`)**, tính năng **Gộp đề thi linh hoạt**, kiến trúc **Đa cơ sở dữ liệu (SQLite & PostgreSQL)** và cơ chế **Endpoint `/health` giữ server Render hoạt động 24/7**.

---

## 📑 Mục Lục
1. [🌟 Tính Năng Nổi Bật](#-tính-năng-nổi-bật)
2. [🤖 Trợ Lý Học Tập Gemini AI 24/7](#-trợ-lý-học-tập-gemini-ai-247)
3. [📱 Trải Nghiệm Giao Diện Di Động (Mobile-First UX)](#-trải-nghiệm-giao-diện-di-động-mobile-first-ux)
4. [📁 Cấu Trúc Thư Mục Dự Án (Repository Map)](#-cấu-trúc-thư-mục-dự-án-repository-map)
5. [🗄️ Cấu Trúc Cơ Sở Dữ Liệu (Database Schema)](#️-cấu-trúc-cơ-sở-dữ-liệu-database-schema)
6. [🔄 Biểu Đồ Luồng Nghiệp Vụ (Business Flows)](#-biểu-đồ-luồng-nghiệp-vụ-business-flows)
7. [🚀 Cài Đặt & Chạy Ứng Dụng Dưới Local](#-cài-đặt--chạy-ứng-dụng-dưới-local)
8. [⚙️ Cấu Hình Biến Môi Trường (.env)](#️-cấu-hình-biến-môi-trường-env)
9. [🔐 Hướng Dẫn Quản Trị & Đổi Mật Khẩu Admin](#-hướng-dẫn-quản-trị--đổi-mật-khẩu-admin)
10. [☁️ Triển Khai Lên Render & Cấu Hình Giữ Server 24/7](#️-triển-khai-lên-render--cấu-hình-giữ-server-247)
11. [📝 Quy Chuẩn Định Dạng File Word (.docx) Đăng Đề](#-quy-chuẩn-định-dạng-file-word-docx-đăng-đề)
12. [📄 Bản Quyền & Giấy Phép (License)](#-bản-quyền--giấy-phép-license)

---

## 🌟 Tính Năng Nổi Bật

### 1. Kho Đề Thi Chuẩn Hóa Sẵn Sàng
- **Trọn bộ Ngân hàng câu hỏi Giáo dục Quốc phòng - An ninh (QPAN)**:
  - **Học phần 1**: Bài 1 đến Bài 8 + Đề thi tổng hợp đầy đủ **211 câu**.
  - **Học phần 2**: Bài 1 đến Bài 7 + Đề thi tổng hợp đầy đủ **210 câu**.
- **Các môn đại cương đại học**: *Triết học Mác - Lênin*, *Kinh tế Chính trị*, *Toán Cao cấp*, *Vật lý Đại cương*, *Lịch sử Đảng*, *Pháp luật Đại cương*...
- Thanh tìm kiếm đề tức thì và thanh danh mục dạng Pills cuộn ngang nhạy bén.

### 2. Hai Chế Độ Thi Chuyên Sâu
- 📖 **Chế độ Luyện tập (Practice Mode)**:
  - Chọn đáp án hiển thị kết quả ngay: **Xanh lá (Đúng)** hoặc **Đỏ hồng (Sai)**.
  - **Hộp Phân tích AI độc quyền**: Giải thích rõ ràng *"Vì sao đáp án bạn chọn lại sai"*.
  - Accordion mở rộng: **Giải thích kiến thức chi tiết** và **Gemini AI · Mẹo nhớ từ khóa nhanh**.
  - Khung chat AI tương tác với các câu hỏi gợi ý một chạm.
- ⏱️ **Chế độ Kiểm tra (Exam Mode)**:
  - Đồng hồ đếm ngược thời gian thực, bảng kiểm tra số câu đã làm / chưa làm.
  - Chấm điểm chính xác theo thang điểm 10.
  - Tổng kết trực quan số câu đúng, câu sai, câu bỏ qua.
  - **Nút hành động nhanh**: *"Làm lại các câu sai ngay"* (tự động lọc và đảo vị trí các câu làm sai để củng cố kiến thức tức thì).

### 3. Tính Năng Gộp Đề Thi Thông Minh (Exam Combiner)
- **Dành cho Học viên**: Chọn từ 2 đến nhiều đề thi bất kỳ để tạo một đề thi tổng hợp ôn luyện tức thì, tùy chọn số lượng câu hỏi và thời gian làm bài.
- **Dành cho Admin**: Công cụ gộp vĩnh viễn các bộ đề vào cơ sở dữ liệu:
  - **Lọc trùng lặp câu hỏi tự động (Deduplication)** dựa trên mức độ tương đồng nội dung.
  - Tự động xáo trộn câu hỏi ngẫu nhiên (**Fisher-Yates Shuffle**).
  - Thanh thao tác hàng loạt (Batch Actions) trong bảng quản trị.

### 4. Tùy Chỉnh Thời Gian Thi Linh Hoạt
- Modal cấu hình trước khi thi: **15 phút, 30 phút, 45 phút, 60 phút, 90 phút** hoặc **Không giới hạn (Tự do)**.
- **Bổ sung thời gian trực tiếp khi đang làm bài**: Bấm vào đồng hồ để thêm **+5 phút**, **+15 phút** hoặc chuyển sang **Tự do** chỉ với 1 chạm mà không làm gián đoạn bài làm.

### 5. Bảng Quản Trị Admin Tự Động Hóa
- **Tải lên đề thi trực tiếp từ file Word (`.docx`)**: Tự động bóc tách tên đề, số câu, 4 đáp án A-B-C-D, đáp án đúng và lời giải chi tiết thông qua parser thông minh.
- Hỗ trợ dán văn bản thô, nhập form thủ công hoặc xuất/nhập JSON.
- Đổi tài khoản và mật khẩu Admin linh hoạt trên giao diện Web hoặc qua công cụ CLI.
- Xem thống kê số lượt làm bài, điểm trung bình và lịch sử thi chi tiết.

### 6. Kiến Trúc Kép Database (SQLite & PostgreSQL)
- Chạy mặc định SQLite cực nhẹ trên máy cục bộ (`data/uniprep.db`).
- Tự động chuyển đổi sang PostgreSQL đám mây (Render Postgres, Neon, Supabase) khi cấu hình biến môi trường `DATABASE_URL`.
- Cung cấp sẵn script di chuyển dữ liệu tự động 1 lệnh: `npm run migrate:pg`.

### 7. Endpoint Giữ Server Hoạt Động 24/7 (`/health`)
- Cung cấp route `/health` siêu nhẹ, phản hồi `OK (200)` trong tích tắc mà không tốn truy vấn database, kết hợp với các dịch vụ uptime giữ server Render miễn phí không bị sleep.

---

## 🤖 Trợ Lý Học Tập Gemini AI 24/7

UniPrep tích hợp trực tiếp mô hình ngôn ngữ lớn **Google Gemini 3.0 Flash** (qua giao thức Google AI Studio API) nhằm đem lại trải nghiệm học tập tương tác hiện đại nhất:

```mermaid
flowchart LR
    A["Học viên đặt câu hỏi"] --> B{"Có GEMINI_API_KEY?"}
    B -->|"Có"| C["Google Gemini 3.0 Flash API"]
    B -->|"Không / Mất mạng"| D["Smart Offline AI Tutor"]
    C -->|"Token: 4096"| E["Markdown Parser: Tiêu đề, In đậm, Bullet"]
    D --> E
    E --> F["Hiển thị câu trả lời trọn vẹn, không cụt"]
```

### Các Đặc Điểm Vượt Trội Của Trợ Lý AI:
1. **Khung Chat Toàn Cục (Floating AI Drawer)**:
   - Biểu tượng 🤖 nổi ở góc dưới màn hình, sẵn sàng mở ra hỗ trợ giải đáp mọi lúc, không làm gián đoạn việc làm bài.
   - Gợi ý câu hỏi nhanh (Prompt Chips): *Mẹo nhớ từ khóa QPAN*, *Tóm tắt HP1 QPAN*, *Mẹo tránh bẫy trắc nghiệm*.
2. **Không Bao Giờ Bị Cắt Cụt Nội Dung**:
   - Được cấu hình giới hạn **`maxOutputTokens: 4096`**, đảm bảo câu trả lời tiếng Việt có dấu luôn được tạo ra đầy đủ, trọn vẹn từ mở đầu, phân tích đến kết luận.
3. **Cơ Chế Tự Động Thích Ứng Model (Auto-Model Detection & Fallback)**:
   - Hệ thống tự động truy vấn danh sách model khả dụng của tài khoản Google AI và ưu tiên model tiên tiến nhất (`gemini-3.0-flash`), tự động fallback sang `gemini-2.5-flash` hoặc `gemini-2.0-flash` nếu model gặp quá tải.
4. **Smart Offline Fallback**:
   - Khi chưa cấu hình API Key hoặc khi mất kết nối mạng, hệ thống tự động kích hoạt bộ quy tắc gia sư Offline để đưa ra gợi ý, mẹo giải đề mà không báo lỗi làm gián đoạn học viên.
5. **Trình Định Dạng Markdown Đẹp Mắt**:
   - Tự động chuyển đổi tiêu đề phân cấp (`###`), danh sách gạch đầu dòng (`•`), từ khóa in đậm (`<b>`), in nghiêng (`<i>`) và khối code (`<code>`) giúp nội dung khoa học, dễ ghi nhớ.

---

## 📱 Trải Nghiệm Giao Diện Di Động (Mobile-First UX)

UniPrep được tối ưu tỉ mỉ để học viên có thể ôn thi mọi lúc, mọi nơi ngay trên chiếc điện thoại thông minh:

| Màn hình | Tính năng tối ưu hóa đặc quyền |
| :--- | :--- |
| **Trang chủ** | Thanh tìm kiếm & nút *Gộp đề* nằm cạnh nhau; Danh mục môn học cuộn ngang; Thẻ đề thi hỗ trợ Dark/Light Mode với độ tương phản cao. |
| **Làm bài thi** | Cho phép **cuộn dọc xem liên tục toàn bộ câu hỏi**, giữ nguyên vị trí cuộn khi xem lời giải; Số thứ tự câu hỏi dạng huy hiệu tròn xanh nổi bật. |
| **Thanh Sub-Header** | Cố định trên cùng với nút `[🔀 Tráo câu]`, nút mở `[⊞ Bảng câu hỏi]`, và đồng hồ `[⏱ 00:02]` có thể chạm vào để thêm giờ làm bài. |
| **Question Palette** | Dạng **Bottom Sheet 6 cột** trượt từ đáy màn hình, đổi màu phân biệt câu đã làm (xanh) và chưa làm (xám), chạm để nhảy ngay đến câu mong muốn. |
| **Nút Chat AI** | Nút nổi tự động co giãn kích thước, không che mất các nút chức năng nộp bài hay câu hỏi trên màn hình cảm ứng nhỏ. |
| **Trang Admin** | Tự động chuyển đổi bảng dữ liệu thành **danh sách thẻ (Card View)** có checkbox chọn tất cả, thao tác sửa, thi thử, xóa dễ dàng bằng 1 tay. |

---

## 📁 Cấu Trúc Thư Mục Dự Án (Repository Map)

```text
d:\Project\Tracnghiemfree/
│
├── server.js                   # Node.js Express Server, REST API & route /health
├── db.js                       # Dual Database Adapter (SQLite & PostgreSQL Pooling)
├── parser.js                   # Bộ bóc tách câu hỏi Regex & Word thông minh
├── change_admin.js             # Công cụ CLI đổi tài khoản & mật khẩu Admin
├── migrate_to_postgres.js      # Script di chuyển dữ liệu từ SQLite sang PostgreSQL
├── seed_qpan_lessons.js        # Script nạp dữ liệu QPAN Học phần 1 (Bài 1 - 8 + Tổng hợp)
├── seed_qpan_hp2.js            # Script nạp dữ liệu QPAN Học phần 2 (Bài 1 - 7 + Tổng hợp)
├── extract_hp1_clean.js        # Script làm sạch dữ liệu câu hỏi HP1
│
├── data/
│   └── uniprep.db              # File cơ sở dữ liệu SQLite cục bộ
│
├── public/                     # Giao diện Single Page Application (SPA)
│   ├── index.html              # HTML giao diện chính (Home, Exam, Admin, Modals, AI Drawer)
│   ├── favicon.svg             # Logo mũ cử nhân UniPrep
│   ├── css/
│   │   └── style.css           # Custom styles, animation & Dark Mode utilities
│   └── js/
│       ├── api.js              # Client API Wrapper (Fetch HTTP, Token management)
│       ├── app.js              # Controller chính: SPA router, danh mục, gộp đề, AI chat
│       ├── exam.js             # Engine thi cử: bấm giờ, tráo đề, chấm điểm, lời giải AI
│       └── admin.js            # Controller quản trị: login, upload Word, sửa/xóa/gộp đề
│
├── hp1_parsed_questions.json   # Bộ dữ liệu chuẩn hóa môn QPAN HP1 (211 câu)
├── hp2_parsed_questions.json   # Bộ dữ liệu chuẩn hóa môn QPAN HP2 (210 câu)
├── CAU_HOI_TRAC_NGHIEM_HP1...  # File Word gốc môn QPAN HP1
├── CAU_HOI_TRAC_NGHIEM_HP2...  # File Word gốc môn QPAN HP2
│
├── .env.example                # File mẫu cấu hình biến môi trường
├── Dockerfile                  # Cấu hình container Docker chạy ứng dụng
├── render.yaml                 # Cấu hình Blueprint triển khai trên Render.com
├── netlify.toml                # Cấu hình định tuyến dự phòng Netlify
├── package.json                # Định nghĩa dependencies và npm scripts
├── GEMINI.md                   # Quy tắc dự án (cấm tự ý git push)
└── README.md                   # Tài liệu hướng dẫn kiến trúc & sử dụng hệ thống
```

---

## 🗄️ Cấu Trúc Cơ Sở Dữ Liệu (Database Schema)

Hệ thống sử dụng mô hình dữ liệu quan hệ đồng nhất trên cả **SQLite** và **PostgreSQL**:

```mermaid
erDiagram
    exams ||--o{ questions : "chứa (1 - N)"
    exams ||--o{ submissions : "lịch sử làm bài (1 - N)"
    
    exams {
        INTEGER id PK "Khóa chính"
        TEXT title "Tên đề thi"
        TEXT category "Danh mục / Môn học"
        TEXT description "Mô tả ngắn gọn"
        INTEGER duration_minutes "Thời lượng mặc định (phút)"
        TEXT badge_text "Huy hiệu hiển thị"
        DATETIME created_at "Thời gian tạo"
    }

    questions {
        INTEGER id PK "Khóa chính"
        INTEGER exam_id FK "Thuộc đề thi nào"
        INTEGER question_number "Số thứ tự câu"
        TEXT question_text "Nội dung câu hỏi"
        TEXT option_a "Phương án A"
        TEXT option_b "Phương án B"
        TEXT option_c "Phương án C"
        TEXT option_d "Phương án D"
        TEXT correct_answer "Đáp án đúng (A/B/C/D)"
        TEXT explanation "Lời giải thích chi tiết"
    }

    submissions {
        INTEGER id PK "Khóa chính"
        INTEGER exam_id FK "Mã đề thi"
        TEXT exam_title "Tên đề lúc thi"
        REAL score "Điểm số (Thang 10)"
        INTEGER total_questions "Tổng số câu"
        INTEGER correct_count "Số câu đúng"
        INTEGER wrong_count "Số câu sai"
        INTEGER unanswered_count "Số câu chưa làm"
        TEXT answers_json "Chi tiết lựa chọn của học viên"
        INTEGER time_spent_seconds "Thời gian hoàn thành (giây)"
        DATETIME submitted_at "Thời gian nộp bài"
    }

    admin_users {
        INTEGER id PK "Khóa chính"
        TEXT username UK "Tên đăng nhập (Duy nhất)"
        TEXT password_hash "Mật khẩu mã hóa bcrypt"
        TEXT display_name "Tên hiển thị quản trị viên"
        DATETIME created_at "Ngày tạo tài khoản"
    }
```

---

## 🔄 Biểu Đồ Luồng Nghiệp Vụ (Business Flows)

### 1. Luồng Học Viên Làm Bài & Luyện Tập
```mermaid
flowchart TD
    Start["Học viên chọn Đề thi trên Trang chủ"] --> SelectMode{"Chọn chế độ"}
    SelectMode -->|"Luyện tập"| ModePractice["Chế độ Luyện tập"]
    SelectMode -->|"Kiểm tra"| ModeExam["Chế độ Kiểm tra"]
    
    ModePractice & ModeExam --> TimeModal["Modal chọn thời gian thi (15p, 30p, 45p, Tự do)"]
    TimeModal --> InitExam["Tráo câu hỏi Fisher-Yates & Khởi chạy"]
    
    InitExam --> Running{"Trong khi làm bài"}
    Running -->|"Luyện tập: Bấm đáp án"| ShowFeedback["Hiện màu Đúng/Sai + Hộp AI phân tích lý do sai + Mẹo nhớ"]
    Running -->|"Cần thêm giờ"| AddTime["Bấm đồng hồ -> Thêm +5p, +15p hoặc chuyển Tự do"]
    Running -->|"Muốn nhảy câu"| OpenPalette["Mở Bottom Sheet 6 cột -> Nhảy câu tức thì"]
    
    ShowFeedback & Running --> Submit["Bấm Nộp bài hoặc Hết giờ"]
    Submit --> CalcScore["Chấm điểm thang 10 & Lưu vào CSDL"]
    CalcScore --> ResultModal["Modal Kết Quả: Điểm số, Thống kê, Nút 'Làm lại câu sai ngay'"]
```

### 2. Luồng Gộp Đề Thi (Exam Combiner)
```mermaid
flowchart TD
    Trigger["Bấm nút 'Gộp đề thi'"] --> PickExams["Chọn từ 2 đề thi trở lên trong danh sách"]
    PickExams --> SetConfig["Tùy chỉnh số lượng câu & thời gian làm bài"]
    SetConfig --> UserRole{"Người thực hiện?"}
    
    UserRole -->|"Học viên"| VirtualExam["API /api/exams/combine -> Tạo đề thi ảo làm ngay (không lưu DB)"]
    UserRole -->|"Admin"| PersistExam["API /api/admin/merge-exams -> Lọc trùng lặp & Lưu đề mới vào CSDL"]
    
    VirtualExam --> DoTest["Làm bài tổng hợp ngay"]
    PersistExam --> DBUpdated["Cập nhật danh sách đề thi hệ thống"]
```

### 3. Luồng Bóc Tách Đề Từ File Word (`.docx`)
```mermaid
flowchart TD
    WordFile["File Word (.docx)"] --> Upload["Admin upload qua /api/admin/upload-word"]
    Upload --> Mammoth["Thư viện Mammoth trích xuất Plain Text"]
    Mammoth --> RegexEngine["Parser Engine: Bóc tách Câu hỏi, Đáp án A-B-C-D, Đáp án đúng & Lời giải"]
    RegexEngine --> Preview["Hiển thị xem trước (Preview) cho Admin duyệt"]
    Preview --> SaveDB["Lưu toàn bộ câu hỏi chuẩn hóa vào CSDL"]
```

---

## 🚀 Cài Đặt & Chạy Ứng Dụng Dưới Local

### 1. Yêu Cầu Môi Trường
- Đã cài đặt **Node.js** (Phiên bản v18, v20 hoặc mới hơn).
- Trình quản lý gói `npm` đi kèm Node.js.

### 2. Cài Đặt Các Gói Phụ Thuộc
Mở terminal tại thư mục dự án và thực hiện:
```bash
npm install
```

### 3. Khởi Tạo Dữ Liệu Ban Đầu (Seed Data)
Để có sẵn trọn bộ 15 đề thi môn Giáo dục Quốc phòng - An ninh (QPAN) chuẩn:
```bash
# Nạp dữ liệu Học phần 1 (Bài 1 - 8 + Đề tổng hợp 211 câu)
node seed_qpan_lessons.js

# Nạp dữ liệu Học phần 2 (Bài 1 - 7 + Đề tổng hợp 210 câu)
node seed_qpan_hp2.js
```

### 4. Khởi Chạy Server
```bash
npm start
# Hoặc chạy trực tiếp: node server.js
```

Mở trình duyệt web và truy cập địa chỉ:
```text
http://localhost:3000
```

---

## ⚙️ Cấu Hình Biến Môi Trường (.env)

Tạo file `.env` tại thư mục gốc dự án (hoặc tham khảo file `.env.example`):

```env
# Cổng chạy ứng dụng (Mặc định: 3000)
PORT=3000

# Cấu hình kết nối PostgreSQL (Tùy chọn - nếu bỏ trống sẽ dùng SQLite data/uniprep.db)
# Cú pháp Local: postgres://postgres:password@localhost:5432/uniprep
# Cú pháp Cloud: postgresql://user:password@ep-xyz.render.com/dbname?sslmode=require
DATABASE_URL=

# Google Gemini API Key để kích hoạt AI trực tiếp từ Google AI Studio (Tùy chọn)
# Lấy miễn phí tại: https://aistudio.google.com/app/apikey
# Nếu bỏ trống, hệ thống sử dụng bộ quy tắc Gia sư AI Offline thông minh
GEMINI_API_KEY=AIzaSy...
```

---

## 🔐 Hướng Dẫn Quản Trị & Đổi Mật Khẩu Admin

### Tài Khoản Mặc Định Ban Đầu
- **Đường dẫn**: Bấm nút **Quản trị & Up đề** ở góc trên thanh điều hướng.
- **Tên đăng nhập**: `admin`
- **Mật khẩu**: `admin123`

### Cách 1: Đổi trực tiếp trên giao diện Dashboard
1. Đăng nhập vào trang Quản trị.
2. Trên thanh trạng thái tài khoản, bấm vào nút **🔑 Đổi tài khoản**.
3. Nhập mật khẩu hiện tại, tên đăng nhập mới, tên hiển thị và mật khẩu mới rồi bấm **Lưu thay đổi**.

### Cách 2: Đổi nhanh bằng dòng lệnh CLI (Khi quên mật khẩu)
Mở cửa sổ dòng lệnh tại thư mục dự án và thực hiện:
```bash
node change_admin.js <tên_đăng_nhập_mới> <mật_khẩu_mới> "[tên_hiển_thị]"
```
*Ví dụ:*
```bash
node change_admin.js admin 123456 "Quản Trị Viên UniPrep"
```

---

## ☁️ Triển Khai Lên Render & Cấu Hình Giữ Server 24/7

### 1. Triển Khai Lên Render.com
1. Đẩy mã nguồn dự án lên GitHub cá nhân của bạn.
2. Đăng nhập vào [Render Dashboard](https://dashboard.render.com/) -> Chọn **New +** -> **Web Service**.
3. Chọn kho chứa GitHub dự án của bạn.
4. Cấu hình dịch vụ:
   - **Name**: `uniprep-quiz` (hoặc tên tùy thích).
   - **Environment**: `Node`.
   - **Build Command**: `npm install`.
   - **Start Command**: `node server.js`.
   - **Plan**: `Free`.
5. Trong mục **Advanced** -> **Add Environment Variable**:
   - Thêm `GEMINI_API_KEY` (nếu muốn kích hoạt Trợ lý Gemini AI).
   - Thêm `DATABASE_URL` (nếu bạn sử dụng PostgreSQL trên Render/Neon).
6. Bấm **Create Web Service**. Sau vài phút, bạn sẽ nhận được địa chỉ truy cập:
   ```text
   https://ten-ung-dung-cua-ban.onrender.com
   ```

### 2. Cấu Hình Cron-job.org Giữ Server Luôn Sẵn Sàng (Không Bị Sleep)
Render bản Free sẽ tự động "ngủ đông" (sleep) nếu không có yêu cầu truy cập trong vòng 15 phút, khiến lần truy cập sau bị trễ từ 30 - 50 giây. UniPrep được tích hợp sẵn endpoint `/health` siêu nhẹ để xử lý triệt để vấn đề này:

1. Đăng ký tài khoản miễn phí tại [cron-job.org](https://cron-job.org).
2. Vào mục **Cronjobs** -> Bấm **Create cronjob**.
3. Cấu hình như sau:
   - **Title**: `Keep Alive UniPrep Render`
   - **URL**: Điền địa chỉ ứng dụng kèm đuôi `/health` *(lưu ý chỉ 1 dấu gạch chéo)*:
     ```text
     https://ten-ung-dung-cua-ban.onrender.com/health
     ```
   - **Schedule**: Chọn **Every 10 minutes** (Mỗi 10 phút ping một lần).
   - **Request Method**: `GET`.
4. Bấm **Create** để lưu. Từ thời điểm này, server của bạn sẽ luôn thức 24/7 với thời gian phản hồi tức thì.

---

## 📝 Quy Chuẩn Định Dạng File Word (.docx) Đăng Đề

Để hệ thống bóc tách câu hỏi tự động với độ chính xác cao nhất từ file Word, văn bản nên tuân theo định dạng chuẩn sau:

```text
Câu 1: Chiến lược "Diễn biến hòa bình" là chiến lược của thế lực nào?
A. Các thế lực thù địch chống phá cách mạng Việt Nam.
B. Các quốc gia trong khối ASEAN.
C. Liên Hợp Quốc và các tổ chức quốc tế.
D. Các phong trào độc lập dân tộc.
Đáp án: A
Lời giải: Chiến lược "Diễn biến hòa bình" là chiến lược tổng hợp của chủ nghĩa đế quốc và các thế lực thù địch nhằm lật đổ chế độ chính trị của các nước XHCN từ bên trong.

Câu 2: ...
A. ...
B. ...
C. ...
D. ...
Đáp án: B
```

*Hệ thống cũng hỗ trợ nhận diện các kiểu đánh dấu đáp án bằng cách bôi vàng, in đậm hoặc gạch chân phương án đúng.*

---

## 📦 Chuyển Đổi Dữ Liệu SQLite sang PostgreSQL

Nếu bạn muốn chuyển toàn bộ ngân hàng câu hỏi và tài khoản quản trị từ SQLite cục bộ lên cơ sở dữ liệu đám mây PostgreSQL (Neon, Supabase, Render PostgreSQL):

1. Tạo cơ sở dữ liệu PostgreSQL và lấy chuỗi kết nối (`Connection String`).
2. Khai báo biến `DATABASE_URL` trong file `.env`:
   ```env
   DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
   ```
3. Chạy lệnh chuyển đổi dữ liệu:
   ```bash
   npm run migrate:pg
   ```
4. Khởi động lại server (`npm start`), hệ thống sẽ tự động phát hiện và kết nối với PostgreSQL.

---

## 📄 Bản Quyền & Giấy Phép (License)

Dự án được phân phối dưới giấy phép mã nguồn mở **[MIT License](LICENSE)**. 

Bạn hoàn toàn có quyền tự do sử dụng, chỉnh sửa, nâng cấp và triển khai cho các trường học, câu lạc bộ học thuật hoặc cộng đồng học tập phi lợi nhuận.

---

<p align="center">
  Được phát triển với niềm đam mê nâng cao hiệu quả học tập cho sinh viên Việt Nam 🇻🇳
</p>