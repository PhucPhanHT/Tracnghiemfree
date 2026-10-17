# 🎓 UniPrep - Nền Tảng Luyện Thi & Trắc Nghiệm Trực Tuyến Thông Minh

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-blue.svg)](https://www.sqlite.org/)
[![Deployment](https://img.shields.io/badge/Deploy-Render.com-black.svg)](https://render.com/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

> **UniPrep** là hệ thống luyện thi trắc nghiệm trực tuyến toàn diện, hiện đại, chuẩn UI/UX Responsive trên cả **Điện thoại** và **Máy tính**. Ứng dụng tích hợp công nghệ phân tích câu hỏi tự động từ file Word (`.docx`), hỗ trợ chế độ **Luyện tập có AI phân tích đúng/sai tức thì**, **Kiểm tra tính điểm thang 10**, **Gộp nhiều đề thi thông minh**, hỗ trợ đa cơ sở dữ liệu (**SQLite & PostgreSQL**) và cơ chế giữ server hoạt động 24/7 trên Render.

---

## 📑 Mục Lục
1. [🌟 Tính Năng Nổi Bật](#-tính-năng-nổi-bật)
2. [📁 Bản Đồ Cấu Trúc Dự Án (Repository Structure)](#-bản-đồ-cấu-trúc-dự-án-repository-structure)
3. [🧩 Chi Tiết Chức Năng Của Từng Thành Phần](#-chi-tiết-chức-năng-của-từng-thành-phần)
4. [🗄️ Cấu Trúc Cơ Sở Dữ Liệu (Database Schema)](#️-cấu-trúc-cơ-sở-dữ-liệu-database-schema)
5. [🔄 Các Luồng Nghiệp Vụ Chính (Business Flows)](#-các-luồng-nghiệp-vụ-chính-business-flows)
6. [📱 Trải Nghiệm Giao Diện Điện Thoại (Mobile UX)](#-trải-nghiệm-giao-diện-điện-thoại-mobile-ux)
7. [🚀 Cài Đặt & Chạy Ứng Dụng Dưới Local](#-cài-đặt--chạy-ứng-dụng-dưới-local)
8. [🔐 Hướng Dẫn Đổi Tài Khoản & Mật Khẩu Admin](#-hướng-dẫn-đổi-tài-khoản--mật-khẩu-admin)
9. [☁️ Triển Khai Lên Render & Cấu Hình Giữ Server 24/7](#️-triển-khai-lên-render--cấu-hình-giữ-server-247)
10. [📦 Chuyển Đổi Dữ Liệu SQLite sang PostgreSQL](#-chuyển-đổi-dữ-liệu-sqlite-sang-postgresql)

---

## 🌟 Tính Năng Nổi Bật

### 1. Kho Đề Thi Phong Phú & Phân Loại Môn Học
- **Trọn bộ Ngân hàng câu hỏi Quân sự - Quốc phòng An ninh (QPAN)**:
  - **Học phần 1**: Bài 1 đến Bài 8 + Đề thi tổng hợp Full 211 câu.
  - **Học phần 2**: Bài 1 đến Bài 7 + Đề thi tổng hợp Full 210 câu.
- **Các môn đại cương đại học**: *Triết học Mác - Lênin*, *Kinh tế Chính trị*, *Toán Cao cấp*, *Vật lý Đại cương*, *Lịch sử Đảng*, *Tin học*...
- Hỗ trợ thanh tìm kiếm đề thi tức thì và thanh danh mục (Category Pills) cuộn ngang mượt mà.

### 2. Hai Chế Độ Thi Chuyên Sâu
- 📖 **Chế độ Luyện tập (Practice Mode)**:
  - Chọn đáp án hiển thị ngay kết quả: **Xanh lá (Đúng)** hoặc **Đỏ hồng (Sai)**.
  - **Hộp Phân tích AI độc quyền**: Giải thích rõ ràng *"Vì sao đáp án bạn chọn lại sai"*.
  - Hai Accordion mở rộng: **Giải thích kiến thức chi tiết** và **Gemini AI · Mẹo nhớ từ khóa nhanh**.
  - Tích hợp khung chat tương tác **"Hỏi thêm AI"** với các gợi ý nhanh (lấy ví dụ thực tế, phân biệt đúng - sai).
- ⏱️ **Chế độ Kiểm tra (Exam Mode)**:
  - Đồng hồ đếm ngược thời gian thực, bảng theo dõi số lượng câu đã làm / chưa làm.
  - Nộp bài tính điểm chính xác theo thang điểm 10.
  - Tổng kết chi tiết số câu đúng, câu sai, câu bỏ qua.
  - **Nút hành động nhanh sau khi thi**: *"Làm lại các câu sai ngay"* (tự động đảo vị trí các câu làm sai để củng cố kiến thức).

### 3. Tính Năng Gộp Đề Thi Thông Minh (Exam Combiner)
- **Dành cho Học viên**: Chọn từ 2 đến nhiều đề thi bất kỳ để gộp thành 1 đề tổng hợp ôn luyện, tùy chọn số lượng câu hỏi và thời gian thi.
- **Dành cho Admin**: Tính năng gộp vĩnh viễn các bộ đề vào cơ sở dữ liệu với các công cụ:
  - Lọc trùng lặp câu hỏi (Deduplication).
  - Tự động xáo trộn ngẫu nhiên câu hỏi (Fisher-Yates Shuffle).
  - Thanh thao tác hàng loạt (Batch Actions) trong danh sách đề thi.

### 4. Tùy Chỉnh Thời Gian Linh Hoạt
- Modal chọn thời lượng trước khi bắt đầu: **15 phút, 30 phút, 45 phút, 60 phút, 90 phút** hoặc **Không giới hạn (Tự do)**.
- Bổ sung thời gian trực tiếp trong lúc đang làm bài: Thêm **+5 phút**, **+15 phút** hoặc chuyển sang **Tự do** chỉ với 1 chạm mà không làm gián đoạn bài thi.

### 5. Giao Diện Tối Ưu Toàn Diện Cho Điện Thoại (Mobile Responsive)
- Cuộn dọc xem nối tiếp toàn bộ câu hỏi trên di động, giữ nguyên vị trí cuộn khi xem lời giải.
- Huy hiệu số thứ tự tròn màu xanh ngọc đặt cạnh nội dung câu hỏi.
- Bảng danh sách câu hỏi (Question Palette) dạng **Bottom Sheet 6 cột** trực quan, chạm để nhảy nhanh đến câu cần làm.
- Trang Admin trên điện thoại tự động chuyển đổi sang giao diện dạng thẻ (Card View) kèm checkbox chọn tất cả tiện dụng.

### 6. Bảng Quản Trị Admin Tự Động Hóa
- **Tải lên đề thi trực tiếp từ file Word (`.docx`)**: Tự động bóc tách tên đề, số câu, 4 đáp án A-B-C-D, đáp án đúng và lời giải chi tiết qua AI Text Parser.
- Hỗ trợ dán văn bản thô, nhập form thủ công hoặc tải file JSON.
- Đổi tài khoản và mật khẩu Admin trực tiếp trên giao diện hoặc qua dòng lệnh CLI.
- Xem thống kê số lượt làm bài, điểm trung bình và lịch sử thi của học viên.

### 7. Hỗ Trợ Đa Cơ Sở Dữ Liệu (SQLite & PostgreSQL)
- Mặc định chạy SQLite nhẹ nhàng trên máy cục bộ (`data/uniprep.db`).
- Tự động chuyển đổi sang PostgreSQL (Neon, Supabase, Render Postgres) khi cấu hình biến môi trường `DATABASE_URL`.
- Cung cấp sẵn script chuyển đổi dữ liệu tự động `migrate_to_postgres.js`.

### 8. Endpoint Giữ Server Hoạt Động 24/7 (`/health`)
- Cung cấp endpoint `/health` siêu nhẹ, phản hồi `OK (200)` trong vài mili-giây, không truy vấn database, giúp các dịch vụ như **Cron-job.org** hay **UptimeRobot** giữ máy chủ Render miễn phí không bị sleep.

---

## 📁 Bản Đồ Cấu Trúc Dự Án (Repository Structure)

```
d:\Project\Tracnghiemfree/
│
├── server.js                   # Node.js Express Server, REST API & route /health
├── db.js                       # Module kết nối Database (hỗ trợ kép SQLite & PostgreSQL)
├── parser.js                   # Bộ phân tích văn bản thông minh (Regex & AI Parser)
├── change_admin.js             # Công cụ CLI đổi tài khoản & mật khẩu Admin
├── migrate_to_postgres.js      # Script chuyển toàn bộ dữ liệu từ SQLite sang PostgreSQL
├── seed_qpan_lessons.js        # Script nạp dữ liệu QPAN Học phần 1 (Bài 1 - 8 + Đề tổng hợp)
├── seed_qpan_hp2.js            # Script nạp dữ liệu QPAN Học phần 2 (Bài 1 - 7 + Đề tổng hợp)
│
├── data/
│   └── uniprep.db              # File cơ sở dữ liệu SQLite cục bộ
│
├── public/                     # Giao diện người dùng Single Page Application (SPA)
│   ├── index.html              # HTML tổng hợp các view (Home, Exam, Admin, Modals)
│   ├── favicon.svg             # Logo mũ cử nhân UniPrep
│   ├── css/
│   │   └── style.css           # Custom styles, animation & Dark Mode utilities
│   └── js/
│       ├── api.js              # Client API wrapper (Fetch HTTP requests & Token management)
│       ├── app.js              # Controller chính: SPA router, danh mục, gộp đề, theme sáng/tối
│       ├── exam.js             # Engine làm bài: đếm giờ, tráo đề, chấm điểm, lời giải AI, palette
│       └── admin.js            # Controller quản trị: đăng nhập, upload Word, sửa/xóa đề, gộp đề
│
├── hp1_parsed_questions.json   # Bộ dữ liệu câu hỏi chuẩn hóa QPAN HP1 (211 câu)
├── hp2_parsed_questions.json   # Bộ dữ liệu câu hỏi chuẩn hóa QPAN HP2 (210 câu)
├── CAU_HOI_TRAC_NGHIEM_HP1...  # File Word gốc môn QPAN HP1
├── CAU_HOI_TRAC_NGHIEM_HP2...  # File Word gốc môn QPAN HP2
│
├── Dockerfile                  # Cấu hình container Docker cho server
├── render.yaml                 # Cấu hình Blueprint tự động triển khai trên Render.com
├── netlify.toml                # Cấu hình định tuyến dự phòng Netlify
├── package.json                # Thư viện phụ thuộc (Express, pg, sqlite3, mammoth, multer...)
├── GEMINI.md                   # Quy tắc dự án dành cho trợ lý AI Antigravity
└── README.md                   # Tài liệu hướng dẫn sử dụng và kiến trúc hệ thống
```

---

## 🧩 Chi Tiết Chức Năng Của Từng Thành Phần

### 1. `server.js` (Backend API Engine)
- Chạy trên nền tảng **Express.js**, phục vụ các REST API:
  - **Keep-Alive**: Route `ALL /health` (và các biến thể `//health`, `/health/`) phục vụ ping uptime.
  - **Quản trị viên**: `POST /api/admin/login`, `GET /api/admin/me`, `POST /api/admin/change-account`, `POST /api/admin/logout`.
  - **Kho đề thi**: `GET /api/categories`, `GET /api/exams`, `GET /api/exams/:id`, `POST /api/exams`, `PUT /api/exams/:id`, `DELETE /api/exams/:id`.
  - **Gộp đề thi**: `POST /api/exams/combine` (tạo đề thi ảo làm ngay), `POST /api/admin/merge-exams` (gộp lưu vào database).
  - **Phân tích đề**: `POST /api/admin/upload-word` (đọc file `.docx` qua `mammoth`), `POST /api/admin/parse-text`.
  - **Trợ lý AI**: `POST /api/ai/ask` (giải thích chi tiết, đặt câu hỏi cho Gemini AI).
  - **Nộp bài**: `POST /api/submissions`, `GET /api/admin/submissions`, `GET /api/admin/stats`.

### 2. `db.js` (Dual Database Adapter)
- Tự động phát hiện môi trường:
  - Nếu có biến môi trường `DATABASE_URL` (bắt đầu bằng `postgres://` hoặc `postgresql://`), hệ thống kết nối qua `pg.Pool` với SSL.
  - Nếu không có, hệ thống sử dụng `sqlite3.Database` lưu tại `data/uniprep.db`.
- Tự động khởi tạo cấu trúc bảng (`exams`, `questions`, `submissions`, `admin_users`) và tạo tài khoản admin mặc định nếu bảng trống.

### 3. `public/js/exam.js` (Exam Engine)
- Điều phối toàn bộ vòng đời của một bài thi:
  - Thuật toán xáo trộn Fisher-Yates (`shuffleArray`).
  - Quản lý đồng hồ bấm giờ đếm ngược hoặc tự do (`initTimer`, `addExtraTime`).
  - Hiển thị đáp án đúng/sai, hộp giải thích vì sao sai và accordion mẹo nhớ từ khóa.
  - Đồng bộ trạng thái bài làm với thanh Header, phụ đề trạng thái và bảng Question Palette.
  - Chấm điểm bài thi và khởi chạy Modal kết quả.

### 4. `public/js/app.js` (App Router & View Controller)
- Điều hướng các màn hình: Trang chủ (`#view-home`), Làm bài (`#view-exam`), Quản trị (`#view-admin`).
- Xử lý tìm kiếm đề thi và lọc theo danh mục môn học.
- Quản lý modal chọn thời gian làm bài trước khi thi (`promptStartExam`).
- Quản lý modal Gộp đề thi dành cho học viên (`openCombineModal`).
- Quản lý chế độ giao diện Sáng / Tối (Dark / Light Mode) qua `localStorage`.

---

## 🗄️ Cấu Trúc Cơ Sở Dữ Liệu (Database Schema)

```mermaid
erDiagram
    exams ||--o{ questions : "chứa (1 - N)"
    exams ||--o{ submissions : "lịch sử thi (1 - N)"
    
    exams {
        INTEGER id PK
        TEXT title
        TEXT category
        TEXT description
        INTEGER duration_minutes
        TEXT badge_text
        DATETIME created_at
    }

    questions {
        INTEGER id PK
        INTEGER exam_id FK
        INTEGER question_number
        TEXT question_text
        TEXT option_a
        TEXT option_b
        TEXT option_c
        TEXT option_d
        TEXT correct_answer
        TEXT explanation
    }

    submissions {
        INTEGER id PK
        INTEGER exam_id FK
        TEXT exam_title
        REAL score
        INTEGER total_questions
        INTEGER correct_count
        INTEGER wrong_count
        INTEGER unanswered_count
        TEXT answers_json
        INTEGER time_spent_seconds
        DATETIME submitted_at
    }

    admin_users {
        INTEGER id PK
        TEXT username UK
        TEXT password_hash
        TEXT display_name
        DATETIME created_at
    }
```

---

## 🔄 Các Luồng Nghiệp Vụ Chính (Business Flows)

### 1. Luồng Học Viên Làm Bài & Luyện Tập
```mermaid
flowchart TD
    A["Trang chủ Kho đề thi"] --> B["Bấm Luyện tập hoặc Kiểm tra"]
    B --> C["Modal chọn thời gian thi (15p, 30p, 45p, Tự do)"]
    C --> D["Tự động tráo câu hỏi (Fisher-Yates) & Vẽ giao diện"]
    D --> E{"Chế độ thi?"}
    E -->|"Luyện tập"| F["Bấm đáp án -> Hiện Đúng/Sai + Khung AI giải thích vì sao sai"]
    E -->|"Kiểm tra"| G["Đồng hồ đếm ngược -> Học viên làm bài"]
    G --> H["Bấm Nộp bài hoặc Hết giờ"]
    F --> H
    H --> I["Chấm điểm thang 10 & Lưu vào Database"]
    I --> J["Modal Tổng Kết: Điểm số, Thống kê đúng/sai, Nút 'Làm lại câu sai'"]
```

### 2. Luồng Gộp Đề Thi (Exam Combiner)
```mermaid
flowchart TD
    A["Bấm nút 'Gộp đề thi'"] --> B["Chọn từ 2 đề thi trở lên trong danh sách"]
    B --> C["Thiết lập thời gian & số câu hỏi tối đa"]
    C --> D{"Đối tượng thực hiện?"}
    D -->|"Học viên"| E["API /api/exams/combine -> Tạo đề thi tổng hợp làm ngay"]
    D -->|"Admin"| F["API /api/admin/merge-exams -> Lọc trùng & Lưu đề mới vào Database"]
```

---

## 📱 Trải Nghiệm Giao Diện Điện Thoại (Mobile UX)

| Màn hình | Tính năng tối ưu hóa |
| :--- | :--- |
| **Trang chủ** | Thanh tìm kiếm & nút *Gộp đề* nằm cạnh nhau; Danh mục cuộn ngang; Thẻ đề thi hỗ trợ Dark Mode hoàn chỉnh. |
| **Làm bài thi** | Cho phép **cuộn dọc xem liên tục toàn bộ câu hỏi**; Giữ nguyên vị trí cuộn khi xem lời giải; Số thứ tự dạng huy hiệu tròn xanh nổi bật. |
| **Thanh Sub-Header** | Tích hợp nút `[🔀 Tráo câu]`, nút mở `[⊞ Bảng câu hỏi]`, và đồng hồ `[⏱ 00:02 (Tự do)]` có thể bấm để thêm giờ làm bài. |
| **Bảng câu hỏi** | Dạng **Bottom Sheet 6 cột** mở từ đáy màn hình, chạm để chuyển nhanh đến câu bất kỳ mà không cần cuộn trang. |
| **Bảng Admin** | Bảng danh sách đề thi tự động chuyển thành **danh sách thẻ (Card View)** có checkbox chọn hàng loạt, nút Sửa/Thi thử/Xóa dễ thao tác. |

---

## 🚀 Cài Đặt & Chạy Ứng Dụng Dưới Local

### 1. Yêu Cầu Môi Trường
- Đã cài đặt **Node.js** (Khuyến nghị phiên bản v18, v20 hoặc mới hơn).

### 2. Cài Đặt & Khởi Chạy
1. Mở cửa sổ dòng lệnh tại thư mục dự án:
   ```bash
   cd d:\Project\Tracnghiemfree
   ```
2. Cài đặt các gói phụ thuộc (nếu chưa cài):
   ```bash
   npm install
   ```
3. Khởi chạy ứng dụng:
   ```bash
   npm start
   # hoặc: node server.js
   ```
4. Mở trình duyệt web và truy cập:
   ```text
   http://localhost:3000
   ```

---

## 🔐 Hướng Dẫn Đổi Tài Khoản & Mật Khẩu Admin

### Cách 1: Đổi trực tiếp trên giao diện Dashboard
1. Truy cập trang web và bấm nút **Quản trị & Up đề** ở góc trên thanh điều hướng.
2. Đăng nhập với thông tin mặc định:
   - Tên đăng nhập: `admin`
   - Mật khẩu: `admin123`
3. Trên thanh thông tin tài khoản, bấm nút **🔑 Đổi tài khoản**.
4. Nhập mật khẩu hiện tại, tên đăng nhập mới, tên hiển thị và mật khẩu mới rồi bấm **Lưu thay đổi**.

### Cách 2: Đổi nhanh bằng dòng lệnh CLI (Khi quên mật khẩu)
Mở terminal tại thư mục dự án và chạy:
```bash
node change_admin.js <tên_đăng_nhập_mới> <mật_khẩu_mới> "[tên_hiển_thị]"
```
*Ví dụ:*
```bash
node change_admin.js admin 123456 "Quản Trị Viên"
```

---

## ☁️ Triển Khai Lên Render & Cấu Hình Giữ Server 24/7

### 1. Triển Khai Lên Render.com
1. Đẩy mã nguồn lên tài khoản GitHub của bạn.
2. Đăng nhập vào [Render Dashboard](https://dashboard.render.com/) và chọn **New +** -> **Web Service**.
3. Kết nối với kho chứa GitHub `Tracnghiemfree`.
4. Cấu hình dịch vụ:
   - **Name**: `tracnghiemfree` (hoặc tên tùy chọn).
   - **Environment**: `Node`.
   - **Build Command**: `npm install`.
   - **Start Command**: `node server.js`.
   - **Plan**: `Free`.
5. Bấm **Create Web Service**. Sau vài phút, bạn sẽ nhận được đường dẫn ứng dụng dạng:
   ```text
   https://ten-app-cua-ban.onrender.com
   ```

### 2. Cấu Hình Cron-job.org Để Giữ Server Luôn Thức (Không Bị Sleep)
Render bản miễn phí sẽ tự động tắt máy chủ nếu không có truy cập trong 15 phút. Sử dụng endpoint `/health` siêu nhẹ để giữ server luôn sẵn sàng:

1. Đăng ký tài khoản miễn phí tại [cron-job.org](https://cron-job.org).
2. Vào mục **Cronjobs** -> Bấm **Create cronjob**.
3. Điền thông tin:
   - **Title**: `Keep Alive UniPrep Render`
   - **URL**: Điền đường dẫn kèm đuôi `/health` (chỉ 1 dấu gạch chéo):
     ```text
     https://ten-app-cua-ban.onrender.com/health
     ```
   - **Schedule**: Chọn **Every 10 minutes** (Mỗi 10 phút).
   - **Request Method**: `GET`.
4. Bấm **Create** để lưu lại. Server của bạn sẽ luôn hoạt động 24/7 mà không lo bị đóng băng.

---

## 📦 Chuyển Đổi Dữ Liệu SQLite sang PostgreSQL

Nếu bạn muốn sử dụng cơ sở dữ liệu đám mây PostgreSQL (như Neon.tech, Supabase, Render PostgreSQL):

1. Tạo một cơ sở dữ liệu PostgreSQL và lấy chuỗi kết nối (`Connection String`).
2. Khai báo biến môi trường `DATABASE_URL` trong file `.env` hoặc trên Render:
   ```env
   DATABASE_URL=postgres://user:password@host:port/dbname?sslmode=require
   ```
3. Chạy script di chuyển toàn bộ câu hỏi, đề thi và tài khoản quản trị từ SQLite sang PostgreSQL:
   ```bash
   node migrate_to_postgres.js
   ```
4. Khởi động lại server, hệ thống sẽ tự động chuyển sang đọc/ghi trên PostgreSQL.

---

## 📄 Bản Quyền & Giấy Phép (License)
Dự án được phân phối dưới giấy phép mã nguồn mở **MIT License**. Mọi cá nhân, tổ chức đều có quyền tự do sử dụng, chỉnh sửa và triển khai phục vụ mục đích giáo dục và cộng đồng.