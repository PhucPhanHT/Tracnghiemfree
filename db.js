const path = require('path');
const fs = require('fs');

const isPg = !!(process.env.DATABASE_URL || process.env.PGHOST);
let pool = null;
let sqliteDb = null;

if (isPg) {
  const { Pool } = require('pg');
  const connStr = process.env.DATABASE_URL;
  const isLocal = connStr && (connStr.includes('localhost') || connStr.includes('127.0.0.1'));
  pool = new Pool({
    connectionString: connStr,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });
  console.log('Database Engine: PostgreSQL (Connected via DATABASE_URL)');
} else {
  let sqlite3 = null;
  try {
    sqlite3 = require('sqlite3').verbose();
  } catch (e) {
    console.warn('Notice: sqlite3 module not loaded. Set DATABASE_URL to use PostgreSQL.');
  }

  if (sqlite3) {
    const isServerless = !!(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      try { fs.mkdirSync(dataDir, { recursive: true }); } catch (e) {}
    }

    let dbPath = path.join(dataDir, 'uniprep.db');
    if (isServerless) {
      const tmpDbPath = path.join('/tmp', 'uniprep.db');
      if (!fs.existsSync(tmpDbPath)) {
        try {
          if (fs.existsSync(dbPath)) {
            fs.copyFileSync(dbPath, tmpDbPath);
          }
        } catch (e) {
          console.warn('Could not copy db to /tmp:', e.message);
        }
      }
      if (fs.existsSync(tmpDbPath)) {
        dbPath = tmpDbPath;
      }
    }

    sqliteDb = new sqlite3.Database(dbPath);
    console.log('Database Engine: SQLite (' + dbPath + ')');
  }
}

// Convert SQLite ? to Postgres $1, $2 and LIKE to ILIKE
function toPgSql(sql) {
  let paramIdx = 1;
  let pgSql = sql.replace(/\?/g, () => '$' + (paramIdx++));
  pgSql = pgSql.replace(/\bLIKE\b/gi, 'ILIKE');
  if (/^\s*INSERT\s+INTO/i.test(pgSql) && !/RETURNING/i.test(pgSql)) {
    pgSql += ' RETURNING id';
  }
  return pgSql;
}

// Helper wrapper for async database queries
async function run(sql, params = []) {
  if (isPg && pool) {
    const pgSql = toPgSql(sql);
    const res = await pool.query(pgSql, params);
    const lastID = res.rows[0]?.id ? Number(res.rows[0].id) : (res.rows[0] ? Object.values(res.rows[0])[0] : null);
    return { lastID, changes: res.rowCount };
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  } else {
    throw new Error('Chưa kết nối cơ sở dữ liệu. Vui lòng thiết lập biến môi trường DATABASE_URL cho PostgreSQL.');
  }
}

async function get(sql, params = []) {
  if (isPg && pool) {
    const pgSql = toPgSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  } else {
    throw new Error('Chưa kết nối cơ sở dữ liệu. Vui lòng thiết lập biến môi trường DATABASE_URL cho PostgreSQL.');
  }
}

async function all(sql, params = []) {
  if (isPg && pool) {
    const pgSql = toPgSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows || [];
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      sqliteDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  } else {
    throw new Error('Chưa kết nối cơ sở dữ liệu. Vui lòng thiết lập biến môi trường DATABASE_URL cho PostgreSQL.');
  }
}

// Initialize tables
async function initDb() {
  if (isPg && pool) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER DEFAULT 45,
        badge_text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        question_number INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
        exam_title TEXT NOT NULL,
        score REAL NOT NULL,
        total_questions INTEGER NOT NULL,
        correct_count INTEGER NOT NULL,
        wrong_count INTEGER NOT NULL,
        unanswered_count INTEGER NOT NULL,
        answers_json TEXT,
        time_spent_seconds INTEGER DEFAULT 0,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default admin account
    const defaultAdmin = await get('SELECT * FROM admin_users WHERE username = ?', ['admin']);
    if (!defaultAdmin) {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update('admin123').digest('hex');
      await run(
        'INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)',
        ['admin', hash, 'Quản Trị Viên']
      );
      console.log('Default admin user initialized in PostgreSQL (username: admin, password: admin123)');
    }

    // Check if exams exist; if empty, auto-seed
    const anyExam = await get('SELECT id FROM exams LIMIT 1');
    if (!anyExam) {
      console.log('PostgreSQL database is empty. Seeding initial exams and QPAN...');
      await seedInitialData();
      await seedAllQpanInDb();
      console.log('PostgreSQL database seeded successfully!');
    }
  } else if (sqliteDb) {
    await run(`
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER DEFAULT 45,
        badge_text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        question_number INTEGER NOT NULL,
        question_text TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        option_c TEXT NOT NULL,
        option_d TEXT NOT NULL,
        correct_answer TEXT NOT NULL,
        explanation TEXT,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        exam_title TEXT NOT NULL,
        score REAL NOT NULL,
        total_questions INTEGER NOT NULL,
        correct_count INTEGER NOT NULL,
        wrong_count INTEGER NOT NULL,
        unanswered_count INTEGER NOT NULL,
        answers_json TEXT,
        time_spent_seconds INTEGER DEFAULT 0,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exam_id) REFERENCES exams (id) ON DELETE CASCADE
      )
    `);

    await run(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const crypto = require('crypto');
    const defaultAdmin = await get('SELECT * FROM admin_users WHERE username = ?', ['admin']);
    if (!defaultAdmin) {
      const hash = crypto.createHash('sha256').update('admin123').digest('hex');
      await run(
        'INSERT INTO admin_users (username, password_hash, display_name) VALUES (?, ?, ?)',
        ['admin', hash, 'Quản Trị Viên']
      );
      console.log('Default admin user initialized (username: admin, password: admin123)');
    }

    const trietExam = await get(`SELECT id FROM exams WHERE title LIKE '%Triết học Mác - Lênin 2023%'`);
    if (!trietExam) {
      console.log('Seeding initial exam database...');
      await seedInitialData();
      console.log('Initial data seeded successfully!');
    }
  }
}

async function seedAllQpanInDb() {
  const hp1Path = path.join(__dirname, 'hp1_parsed_questions.json');
  if (fs.existsSync(hp1Path)) {
    try {
      const qs1 = JSON.parse(fs.readFileSync(hp1Path, 'utf8'));
      const b1 = qs1.filter(q => q.question_number >= 1 && q.question_number <= 20);
      const b2 = qs1.filter(q => (q.question_number >= 21 && q.question_number <= 40) || (q.question_number >= 163 && q.question_number <= 182));
      const b3 = qs1.filter(q => q.question_number >= 41 && q.question_number <= 60);
      const b4 = qs1.filter(q => (q.question_number >= 61 && q.question_number <= 80) || (q.question_number >= 142 && q.question_number <= 162));
      const b5 = qs1.filter(q => (q.question_number >= 81 && q.question_number <= 100) || q.question_number === 166);
      const b6 = qs1.filter(q => q.question_number >= 101 && q.question_number <= 120);
      const b7 = qs1.filter(q => q.question_number >= 121 && q.question_number <= 141);
      const b8 = qs1.filter(q => q.question_number >= 183 && q.question_number <= 216);

      const hp1Defs = [
        { title: 'QPAN HP1 - Bài 1: Quan điểm của CN Mác-Lênin, tư tưởng Hồ Chí Minh về chiến tranh, quân đội và bảo vệ Tổ quốc', cat: 'Quốc phòng An ninh', dur: 25, badge: 'QPAN Bài 1', qs: b1 },
        { title: 'QPAN HP1 - Bài 2: Xây dựng nền quốc phòng toàn dân, an ninh nhân dân', cat: 'Quốc phòng An ninh', dur: 45, badge: 'QPAN Bài 2', qs: b2 },
        { title: 'QPAN HP1 - Bài 3: Chiến tranh nhân dân bảo vệ Tổ quốc Việt Nam XHCN', cat: 'Quốc phòng An ninh', dur: 25, badge: 'QPAN Bài 3', qs: b3 },
        { title: 'QPAN HP1 - Bài 4: Xây dựng lực lượng vũ trang nhân dân Việt Nam', cat: 'Quốc phòng An ninh', dur: 45, badge: 'QPAN Bài 4', qs: b4 },
        { title: 'QPAN HP1 - Bài 5: Kết hợp phát triển kinh tế - xã hội với tăng cường củng cố QP - AN', cat: 'Quốc phòng An ninh', dur: 25, badge: 'QPAN Bài 5', qs: b5 },
        { title: 'QPAN HP1 - Bài 6: Những vấn đề cơ bản về lịch sử nghệ thuật quân sự Việt Nam', cat: 'Quốc phòng An ninh', dur: 25, badge: 'QPAN Bài 6', qs: b6 },
        { title: 'QPAN HP1 - Bài 7: Xây dựng và bảo vệ chủ quyền lãnh thổ, biên giới quốc gia', cat: 'Quốc phòng An ninh', dur: 25, badge: 'QPAN Bài 7', qs: b7 },
        { title: 'QPAN HP1 - Bài 8: Bảo vệ an ninh quốc gia và giữ gìn trật tự, an toàn xã hội', cat: 'Quốc phòng An ninh', dur: 35, badge: 'QPAN Bài 8', qs: b8 },
        { title: 'QPAN HP1 - Ngân hàng câu hỏi Tổng hợp (Full 211 câu)', cat: 'Quốc phòng An ninh', dur: 60, badge: 'QPAN Full', qs: qs1 }
      ];

      for (const d of hp1Defs) {
        const res = await run('INSERT INTO exams (title, category, duration_minutes, badge_text) VALUES (?, ?, ?, ?)', [d.title, d.cat, d.dur, d.badge]);
        const examId = res.lastID;
        for (let i = 0; i < d.qs.length; i++) {
          const q = d.qs[i];
          const exp = q.explanation || `Phương án đúng là ${q.correct_answer}.`;
          await run(
            'INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [examId, i + 1, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, exp]
          );
        }
      }
    } catch (e) {
      console.warn('Auto seed HP1 error:', e.message);
    }
  }

  const hp2Path = path.join(__dirname, 'hp2_parsed_questions.json');
  if (fs.existsSync(hp2Path)) {
    try {
      const qs2 = JSON.parse(fs.readFileSync(hp2Path, 'utf8'));
      const b1 = qs2.filter(q => q.question_number >= 1 && q.question_number <= 30);
      const b2 = qs2.filter(q => q.question_number >= 31 && q.question_number <= 60);
      const b3 = qs2.filter(q => q.question_number >= 61 && q.question_number <= 97);
      const b4 = qs2.filter(q => q.question_number >= 98 && q.question_number <= 129);
      const b5 = qs2.filter(q => q.question_number >= 130 && q.question_number <= 159);
      const b6 = qs2.filter(q => q.question_number >= 160 && q.question_number <= 189);
      const b7 = qs2.filter(q => q.question_number >= 190 && q.question_number <= 219);

      const hp2Defs = [
        { title: 'QPAN HP2 - Bài 1: Phòng, chống chiến lược "Diễn biến hòa bình", bạo loạn lật đổ của các thế lực thù địch', cat: 'Quốc phòng An ninh', dur: 30, badge: 'QPAN HP2 Bài 1', qs: b1 },
        { title: 'QPAN HP2 - Bài 2: Một số nội dung cơ bản về dân tộc, tôn giáo và đấu tranh phòng chống địch lợi dụng vấn đề dân tộc, tôn giáo', cat: 'Quốc phòng An ninh', dur: 30, badge: 'QPAN HP2 Bài 2', qs: b2 },
        { title: 'QPAN HP2 - Bài 3: Phòng, chống vi phạm pháp luật về bảo vệ môi trường', cat: 'Quốc phòng An ninh', dur: 30, badge: 'QPAN HP2 Bài 3', qs: b3 },
        { title: 'QPAN HP2 - Bài 4: Phòng, chống vi phạm pháp luật về bảo đảm trật tự, an toàn giao thông', cat: 'Quốc phòng An ninh', dur: 30, badge: 'QPAN HP2 Bài 4', qs: b4 },
        { title: 'QPAN HP2 - Bài 5: Phòng, chống một số loại tội phạm xâm hại danh dự, nhân phẩm của người khác', cat: 'Quốc phòng An ninh', dur: 30, badge: 'QPAN HP2 Bài 5', qs: b5 },
        { title: 'QPAN HP2 - Bài 6: An toàn thông tin và phòng, chống vi phạm pháp luật trên không gian mạng', cat: 'Quốc phòng An ninh', dur: 30, badge: 'QPAN HP2 Bài 6', qs: b6 },
        { title: 'QPAN HP2 - Bài 7: An ninh phi truyền thống và ứng phó các mối đe dọa an ninh phi truyền thống ở Việt Nam', cat: 'Quốc phòng An ninh', dur: 30, badge: 'QPAN HP2 Bài 7', qs: b7 },
        { title: 'QPAN HP2 - Ngân hàng câu hỏi Tổng hợp (Full 210 câu)', cat: 'Quốc phòng An ninh', dur: 60, badge: 'QPAN HP2 Full', qs: qs2 }
      ];

      for (const d of hp2Defs) {
        const res = await run('INSERT INTO exams (title, category, duration_minutes, badge_text) VALUES (?, ?, ?, ?)', [d.title, d.cat, d.dur, d.badge]);
        const examId = res.lastID;
        for (let i = 0; i < d.qs.length; i++) {
          const q = d.qs[i];
          const exp = q.explanation || `Phương án đúng là ${q.correct_answer}.`;
          await run(
            'INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [examId, i + 1, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, exp]
          );
        }
      }
    } catch (e) {
      console.warn('Auto seed HP2 error:', e.message);
    }
  }
}

async function seedInitialData() {
  // Exam 1: Đề thi giữa kỳ Triết học Mác-Lênin 2023 (Matches screenshots!)
  const exam1 = await run(
    `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'Đề thi giữa kỳ Triết học Mác - Lênin 2023',
      'Triết học Mác-Lênin',
      'Tổng hợp các câu hỏi trắc nghiệm khách quan chương 1 và chương 2 bám sát đề thi chính thức.',
      45,
      'Triết học'
    ]
  );
  const exam1Id = exam1.lastID;

  const trietQuestions = [
    {
      num: 1,
      q: 'Triết học ra đời vào thời gian nào?',
      a: 'Thế kỷ VIII đến thế kỷ VI trước Công nguyên',
      b: 'Thế kỷ X trước Công nguyên',
      c: 'Đầu Công nguyên',
      d: 'Thời kỳ Phục hưng',
      correct: 'A',
      exp: 'Triết học ra đời vào khoảng từ thế kỷ VIII đến thế kỷ VI trước Công nguyên tại các trung tâm văn minh cổ đại như Ấn Độ, Trung Hoa và Hy Lạp.'
    },
    {
      num: 2,
      q: 'Đối tượng nghiên cứu của triết học Mác - Lênin là gì?',
      a: 'Toàn bộ thế giới tự nhiên thuần túy',
      b: 'Những quy luật chung nhất của tự nhiên, xã hội và tư duy',
      c: 'Tâm lý và ý thức cá nhân con người',
      d: 'Các quy luật vận động cơ học của vật thể',
      correct: 'B',
      exp: 'Đối tượng nghiên cứu của triết học Mác - Lênin là tiếp tục giải quyết mối quan hệ giữa vật chất và ý thức trên lập trường duy vật biện chứng và nghiên cứu những quy luật chung nhất của tự nhiên, xã hội và tư duy.'
    },
    {
      num: 3,
      q: 'Vấn đề cơ bản của mọi triết học, đặc biệt là của triết học hiện đại, là vấn đề gì?',
      a: 'Vấn đề con người và sự giải phóng con người khỏi áp bức',
      b: 'Vấn đề mối quan hệ giữa tư duy và tồn tại (giữa ý thức và vật chất)',
      c: 'Vấn đề nhận thức luận và phương pháp cải tạo thế giới',
      d: 'Vấn đề quy luật vận động chung nhất của tự nhiên và xã hội',
      correct: 'B',
      exp: 'Theo Ph. Ăngghen: "Vấn đề cơ bản lớn của mọi triết học, đặc biệt là của triết học hiện đại, là vấn đề quan hệ giữa tư duy và tồn tại" (hay giữa ý thức và vật chất).'
    },
    {
      num: 4,
      q: 'Trường phái triết học nào khẳng định vật chất có trước, ý thức có sau, vật chất quyết định ý thức?',
      a: 'Chủ nghĩa duy tâm chủ quan',
      b: 'Chủ nghĩa duy tâm khách quan',
      c: 'Chủ nghĩa duy vật',
      d: 'Nhị nguyên luận',
      correct: 'C',
      exp: 'Chủ nghĩa duy vật khẳng định vật chất có trước, ý thức có sau, thế giới vật chất tồn tại khách quan độc lập với ý thức con người và quyết định ý thức.'
    },
    {
      num: 5,
      q: 'Định nghĩa kinh điển về vật chất của V.I.Lênin được nêu trong tác phẩm nào?',
      a: 'Biện chứng của tự nhiên',
      b: 'Chủ nghĩa duy vật và chủ nghĩa kinh nghiệm phê phán',
      c: 'Bút ký triết học',
      d: 'Nhà nước và cách mạng',
      correct: 'B',
      exp: 'Định nghĩa vật chất được V.I.Lênin trình bày hoàn chỉnh trong tác phẩm xuất sắc "Chủ nghĩa duy vật và chủ nghĩa kinh nghiệm phê phán" (1909).'
    },
    {
      num: 6,
      q: 'Theo V.I.Lênin, thuộc tính quan trọng nhất của vật chất để phân biệt với ý thức là gì?',
      a: 'Khối lượng và quảng tính',
      b: 'Thực tại khách quan',
      c: 'Có khả năng vận động',
      d: 'Có cấu trúc nguyên tử',
      correct: 'B',
      exp: 'Thuộc tính khách quan - thực tại khách quan độc lập với ý thức con người, được cảm giác chép lại, chụp lại, phản ánh - là thuộc tính cơ bản nhất của vật chất.'
    },
    {
      num: 7,
      q: 'Hình thức vận động nào là cao nhất theo quan điểm triết học Mác - Lênin?',
      a: 'Vận động cơ học',
      b: 'Vận động vật lý',
      c: 'Vận động sinh học',
      d: 'Vận động xã hội',
      correct: 'D',
      exp: 'Ăngghen phân chia 5 hình thức vận động cơ bản: Cơ học -> Vật lý -> Hóa học -> Sinh học -> Xã hội. Vận động xã hội là hình thức vận động cao nhất và phức tạp nhất.'
    },
    {
      num: 8,
      q: 'Nguồn gốc xã hội của ý thức là gì?',
      a: 'Lao động và ngôn ngữ',
      b: 'Bộ óc người và thế giới khách quan',
      c: 'Di truyền sinh học và tập tính bầy đàn',
      d: 'Cảm giác và tri giác',
      correct: 'A',
      exp: 'Bộ óc người và thế giới khách quan tác động lên bộ óc là nguồn gốc tự nhiên; còn Lao động và Ngôn ngữ là hai sức kích thích chủ yếu tạo nên nguồn gốc xã hội của ý thức.'
    },
    {
      num: 9,
      q: 'Quy luật nào được coi là hạt nhân của phép biện chứng duy vật?',
      a: 'Quy luật chuyển hóa từ những sự thay đổi về lượng thành những thay đổi về chất và ngược lại',
      b: 'Quy luật thống nhất và đấu tranh giữa các mặt đối lập',
      c: 'Quy luật phủ định của phủ định',
      d: 'Quy luật bảo toàn và chuyển hóa năng lượng',
      correct: 'B',
      exp: 'V.I.Lênin khẳng định quy luật thống nhất và đấu tranh giữa các mặt đối lập (quy luật mâu thuẫn) là hạt nhân của phép biện chứng duy vật, chỉ ra nguồn gốc, động lực bên trong của sự phát triển.'
    },
    {
      num: 10,
      q: 'Phạm trù triết học nào dùng để chỉ ranh giới mà trong đó sự thay đổi về lượng chưa làm thay đổi căn bản về chất của sự vật?',
      a: 'Độ',
      b: 'Điểm nút',
      c: 'Bước nhảy',
      d: 'Chất mới',
      correct: 'A',
      exp: 'Độ là giới hạn mà trong đó sự thay đổi về lượng chưa dẫn tới sự thay đổi căn bản về chất của sự vật, hiện tượng.'
    },
    {
      num: 11,
      q: 'Khoảng thời gian hoặc giới hạn mà tại đó sự thay đổi về lượng đạt tới mức phá vỡ độ cũ được gọi là gì?',
      a: 'Giới hạn',
      b: 'Điểm nút',
      c: 'Trạng thái',
      d: 'Thời điểm',
      correct: 'B',
      exp: 'Điểm nút là điểm giới hạn mà tại đó sự thay đổi về lượng đạt tới chỗ phá vỡ độ cũ làm cho chất của sự vật thay đổi.'
    },
    {
      num: 12,
      q: 'Thực tiễn là gì theo quan điểm của chủ nghĩa Mác - Lênin?',
      a: 'Toàn bộ hoạt động tinh thần của con người trong lịch sử',
      b: 'Toàn bộ hoạt động vật chất - cảm tính, có tính lịch sử - xã hội của con người nhằm cải tạo tự nhiên và xã hội',
      c: 'Mọi hoạt động tư duy và nghiên cứu trong phòng thí nghiệm',
      d: 'Sự chiêm nghiệm nội tâm của cá nhân',
      correct: 'B',
      exp: 'Thực tiễn là toàn bộ hoạt động vật chất - cảm tính, có mục đích, có tính lịch sử - xã hội của con người nhằm cải tạo tự nhiên và xã hội phục vụ nhân loại.'
    },
    {
      num: 13,
      q: 'Hình thức hoạt động thực tiễn cơ bản và quan trọng nhất là gì?',
      a: 'Hoạt động chính trị - xã hội',
      b: 'Hoạt động sản xuất vật chất',
      c: 'Hoạt động thực nghiệm khoa học',
      d: 'Hoạt động đấu tranh giai cấp',
      correct: 'B',
      exp: 'Hoạt động sản xuất vật chất là hình thức cơ bản, nguyên thủy và đóng vai trò quyết định đối với mọi hình thức hoạt động thực tiễn khác.'
    },
    {
      num: 14,
      q: 'Triết học Mác - Lênin ra đời trong điều kiện kinh tế - xã hội nào?',
      a: 'Chủ nghĩa tư bản chuyển sang giai đoạn độc quyền',
      b: 'Phương thức sản xuất tư bản chủ nghĩa đã trở thành phương thức thống trị',
      c: 'Giai cấp vô sản ra đời và trở thành lực lượng chính trị độc lập',
      d: 'Cả B và C đều đúng',
      correct: 'D',
      exp: 'Triết học Mác ra đời vào những năm 40 thế kỷ XIX, khi PTSX tư bản chủ nghĩa đã trở thành phương thức thống trị ở Tây Âu và giai cấp vô sản đã trưởng thành, bước lên vũ đài chính trị như một lực lượng độc lập.'
    },
    {
      num: 15,
      q: 'Theo quan điểm của chủ nghĩa Mác - Lênin, bản chất của nhận thức là gì?',
      a: 'Sự phản ánh hiện thực khách quan vào đầu óc con người một cách thụ động',
      b: 'Sự hồi tưởng lại của linh hồn về thế giới ý niệm',
      c: 'Quá trình phản ánh tích cực, tự giác và sáng tạo thế giới khách quan vào đầu óc con người trên cơ sở thực tiễn',
      d: 'Sự phức hợp của các cảm giác của con người',
      correct: 'C',
      exp: 'Nhận thức là quá trình phản ánh hiện thực khách quan một cách tích cực, chủ động và sáng tạo bởi con người trên cơ sở thực tiễn lịch sử - xã hội.'
    },
    {
      num: 16,
      q: 'Giai đoạn đầu tiên của quá trình nhận thức là gì?',
      a: 'Nhận thức lý tính (tư duy trừu tượng)',
      b: 'Nhận thức cảm tính (trực quan sinh động)',
      c: 'Nhận thức khoa học',
      d: 'Hoạt động thực tiễn',
      correct: 'B',
      exp: 'Con đường biện chứng của nhận thức: từ trực quan sinh động (nhận thức cảm tính) đến tư duy trừu tượng (nhận thức lý tính), và từ tư duy trừu tượng đến thực tiễn.'
    },
    {
      num: 17,
      q: 'Hình thức nào sau đây thuộc giai đoạn nhận thức cảm tính?',
      a: 'Khái niệm',
      b: 'Phán đoán',
      c: 'Suy lý (suy luận)',
      d: 'Cảm giác, tri giác, biểu tượng',
      correct: 'D',
      exp: 'Nhận thức cảm tính gồm 3 hình thức: Cảm giác, Tri giác và Biểu tượng. Khái niệm, phán đoán, suy lý thuộc nhận thức lý tính.'
    },
    {
      num: 18,
      q: 'Chân lý có những tính chất cơ bản nào?',
      a: 'Tính khách quan, tính tuyệt đối, tính tương đối và tính cụ thể',
      b: 'Tính chủ quan, tính trừu tượng và tính vĩnh viễn',
      c: 'Tính ước lệ và tính số đông công nhận',
      d: 'Tính trừu tượng thuần túy và tính bất biến',
      correct: 'A',
      exp: 'Chân lý là tri thức phù hợp với hiện thực khách quan và được thực tiễn kiểm nghiệm, có 3 tính chất chủ yếu: tính khách quan, tính cụ thể, và sự thống nhất giữa tính tuyệt đối với tính tương đối.'
    },
    {
      num: 19,
      q: 'Tiêu chuẩn duy nhất của chân lý là gì?',
      a: 'Được nhiều người thừa nhận',
      b: 'Có lợi ích thực dụng trước mắt',
      c: 'Thực tiễn',
      d: 'Sự logic chặt chẽ của các định lý toán học',
      correct: 'C',
      exp: 'Thực tiễn là tiêu chuẩn duy nhất của chân lý. Chỉ có thực tiễn mới có thể kiểm tra xác nhận tri thức là đúng đắn hay sai lầm.'
    },
    {
      num: 20,
      q: 'Mối quan hệ biện chứng giữa tồn tại xã hội và ý thức xã hội là:',
      a: 'Tồn tại xã hội quyết định ý thức xã hội, nhưng ý thức xã hội có tính độc lập tương đối và tác động trở lại tồn tại xã hội',
      b: 'Ý thức xã hội luôn đi trước và quyết định hoàn toàn tồn tại xã hội',
      c: 'Tồn tại xã hội và ý thức xã hội hoàn toàn song song không liên quan',
      d: 'Ý thức xã hội phản ánh thụ động máy móc tồn tại xã hội',
      correct: 'A',
      exp: 'Tồn tại xã hội quyết định ý thức xã hội; đồng thời ý thức xã hội có tính độc lập tương đối, có thể vượt trước hoặc lạc hậu hơn và có khả năng tác động trở lại mạnh mẽ đối với tồn tại xã hội.'
    },
    {
      num: 21,
      q: 'Lực lượng sản xuất biểu hiện mối quan hệ nào?',
      a: 'Mối quan hệ giữa con người với con người trong quá trình sản xuất',
      b: 'Mối quan hệ giữa con người với tự nhiên trong quá trình sản xuất',
      c: 'Mối quan hệ trao đổi hàng hóa trên thị trường',
      d: 'Mối quan hệ giữa các giai cấp trong xã hội',
      correct: 'B',
      exp: 'Lực lượng sản xuất thể hiện mối quan hệ giữa con người với tự nhiên trong quá trình sản xuất vật chất, phản ánh trình độ chinh phục tự nhiên của con người.'
    },
    {
      num: 22,
      q: 'Yếu tố nào động nhất, cách mạng nhất trong lực lượng sản xuất?',
      a: 'Đối tượng lao động',
      b: 'Công cụ lao động',
      c: 'Phương tiện vận chuyển',
      d: 'Nhà xưởng và kho bãi',
      correct: 'B',
      exp: 'Công cụ lao động là yếu tố động nhất, cách mạng nhất trong lực lượng sản xuất. Sự biến đổi của công cụ lao động kéo theo sự phát triển của toàn bộ nền sản xuất.'
    },
    {
      num: 23,
      q: 'Quan hệ sản xuất gồm mấy mặt quan hệ cơ bản?',
      a: '2 mặt',
      b: '3 mặt (Sở hữu TLSX, Tổ chức quản lý SX, Phân phối sản phẩm)',
      c: '4 mặt',
      d: '5 mặt',
      correct: 'B',
      exp: 'Quan hệ sản xuất gồm 3 mặt: Quan hệ sở hữu đối với tư liệu sản xuất, quan hệ trong tổ chức và quản lý sản xuất, và quan hệ trong phân phối sản phẩm lao động.'
    },
    {
      num: 24,
      q: 'Theo C.Mác, lịch sử phát triển của xã hội loài người là lịch sử thay thế kế tiếp nhau của các gì?',
      a: 'Các tôn giáo lớn',
      b: 'Các hình thái kinh tế - xã hội',
      c: 'Các nền văn minh công nghiệp',
      d: 'Các thể chế nhà nước quân chủ',
      correct: 'B',
      exp: 'Sự phát triển của các hình thái kinh tế - xã hội là một quá trình lịch sử - tự nhiên (từ nguyên thủy -> chiếm hữu nô lệ -> phong kiến -> TBCN -> CSCN).'
    },
    {
      num: 25,
      q: 'Nguồn gốc sâu xa của sự vận động và phát triển của các hình thái kinh tế - xã hội là gì?',
      a: 'Sự mâu thuẫn giữa lực lượng sản xuất và quan hệ sản xuất',
      b: 'Ý muốn chủ quan của những vĩ nhân',
      c: 'Sự biến đổi của khí hậu toàn cầu',
      d: 'Sự giao lưu buôn bán quốc tế',
      correct: 'A',
      exp: 'Mâu thuẫn biện chứng giữa lực lượng sản xuất không ngừng phát triển với quan hệ sản xuất lỗi thời kìm hãm nó là cội nguồn sâu xa thúc đẩy lịch sử xã hội loài người tiến bộ.'
    }
  ];

  for (const q of trietQuestions) {
    await run(
      `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam1Id, q.num, q.q, q.a, q.b, q.c, q.d, q.correct, q.exp]
    );
  }

  // Exam 2: Đề ôn tập Kinh tế Chính trị Mác-Lênin (Full)
  const exam2 = await run(
    `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'Đề ôn tập Kinh tế Chính trị Mác - Lênin (Full)',
      'Kinh tế Chính trị',
      'Bao trùm toàn bộ kiến thức môn học. Thích hợp ôn thi cuối kỳ đạt điểm cao.',
      60,
      'Kinh tế CT'
    ]
  );
  const exam2Id = exam2.lastID;

  const ktctQuestions = [
    {
      num: 1,
      q: 'Điều kiện ra đời và tồn tại của sản xuất hàng hóa là gì?',
      a: 'Phân công lao động xã hội và sự tách biệt về mặt kinh tế của các chủ thể sản xuất',
      b: 'Xã hội xuất hiện tiền tệ và kim loại quý',
      c: 'Con người bắt đầu biết buôn bán với nước ngoài',
      d: 'Xuất hiện nhà nước và luật pháp quản lý kinh tế',
      correct: 'A',
      exp: 'Sản xuất hàng hóa ra đời khi có 2 điều kiện cần và đủ: Phân công lao động xã hội và sự tách biệt tương đối về kinh tế giữa các chủ thể sản xuất.'
    },
    {
      num: 2,
      q: 'Hàng hóa có hai thuộc tính cơ bản là gì?',
      a: 'Giá trị và giá cả',
      b: 'Giá trị sử dụng và giá trị',
      c: 'Chất lượng và công dụng',
      d: 'Giá trị cá biệt và giá trị xã hội',
      correct: 'B',
      exp: 'Hàng hóa là sản phẩm của lao động, có thể thỏa mãn nhu cầu nào đó của con người thông qua trao đổi, mua bán; gồm 2 thuộc tính: Giá trị sử dụng và Giá trị.'
    },
    {
      num: 3,
      q: 'Lượng giá trị của một đơn vị hàng hóa được đo lường bằng yếu tố nào?',
      a: 'Thời gian lao động cá biệt của người sản xuất giỏi nhất',
      b: 'Thời gian lao động xã hội cần thiết',
      c: 'Số lượng vật tư nguyên liệu tiêu hao',
      d: 'Mức giá do người bán tự quyết định',
      correct: 'B',
      exp: 'Lượng giá trị của hàng hóa được đo bằng thời gian lao động xã hội cần thiết để sản xuất ra hàng hóa đó trong điều kiện sản xuất bình thường của xã hội.'
    },
    {
      num: 4,
      q: 'Quy luật giá trị là quy luật kinh tế căn bản của hình thức kinh tế nào?',
      a: 'Kinh tế tự cung tự cấp',
      b: 'Sản xuất hàng hóa',
      c: 'Kinh tế bao cấp thời chiến',
      d: 'Kinh tế cộng sản nguyên thủy',
      correct: 'B',
      exp: 'Quy luật giá trị là quy luật kinh tế căn bản của sản xuất hàng hóa, đòi hỏi sản xuất và trao đổi hàng hóa phải dựa trên cơ sở hao phí lao động xã hội cần thiết.'
    },
    {
      num: 5,
      q: 'Mâu thuẫn chung trong công thức T - H - T\' là gì?',
      a: 'Tiền không thể tự sinh ra tiền trong lưu thông lẫn ngoài lưu thông',
      b: 'Hàng hóa không bao giờ đổi ngang giá',
      c: 'Giá trị thặng dư chỉ sinh ra khi mua rẻ bán đắt',
      d: 'Tư bản chỉ sinh lợi nhuận khi cất trữ',
      correct: 'A',
      exp: 'Tư bản không thể xuất hiện từ lưu thông và cũng không thể xuất hiện ở bên ngoài lưu thông. Nó phải xuất hiện trong lưu thông và đồng thời không phải trong lưu thông.'
    },
    {
      num: 6,
      q: 'Hàng hóa đặc biệt mà trong quá trình sử dụng có khả năng tạo ra một lượng giá trị lớn hơn giá trị bản thân nó là gì?',
      a: 'Máy móc tự động hóa hiện đại',
      b: 'Hàng hóa sức lao động',
      c: 'Vàng và bạc nguyên chất',
      d: 'Đất đai và tài nguyên thiên nhiên',
      correct: 'B',
      exp: 'Hàng hóa sức lao động có giá trị sử dụng đặc biệt là khi tiêu dùng nó tạo ra một lượng giá trị mới lớn hơn giá trị của bản thân nó, phần dôi ra đó chính là giá trị thặng dư.'
    },
    {
      num: 7,
      q: 'Bản chất của giá trị thặng dư (m) là gì?',
      a: 'Khoản tiền thưởng do nhà nước trợ cấp cho doanh nghiệp',
      b: 'Phần giá trị mới do lao động của công nhân tạo ra ngoài giá trị sức lao động và bị nhà tư bản chiếm đoạt',
      c: 'Lợi nhuận phát sinh nhờ buôn may bán đắt',
      d: 'Khoản khấu hao tài sản cố định qua các năm',
      correct: 'B',
      exp: 'Giá trị thặng dư là một bộ phận của giá trị mới dôi ra ngoài giá trị sức lao động do công nhân làm thuê tạo ra và bị nhà tư bản chiếm không.'
    },
    {
      num: 8,
      q: 'Hai phương pháp chủ yếu để sản xuất giá trị thặng dư là gì?',
      a: 'Giá trị thặng dư tuyệt đối và giá trị thặng dư tương đối',
      b: 'Giá trị thặng dư nội địa và ngoại thương',
      c: 'Giá trị thặng dư cơ học và hóa học',
      d: 'Giá trị thặng dư tiền tệ và hiện vật',
      correct: 'A',
      exp: 'Hai phương pháp cơ bản là: Sản xuất giá trị thặng dư tuyệt đối (kéo dài ngày lao động) và Sản xuất giá trị thặng dư tương đối (rút ngắn thời gian lao động tất yếu nhờ tăng NSLĐ xã hội).'
    },
    {
      num: 9,
      q: 'Tích lũy tư bản thực chất là quá trình gì?',
      a: 'Đem toàn bộ lợi nhuận chia hết cho cổ đông',
      b: 'Chuyển hóa một phần giá trị thặng dư trở lại thành tư bản phụ thêm',
      c: 'Vay nợ ngân hàng để trả lương cho công nhân',
      d: 'Bán tháo cổ phiếu trên sàn giao dịch',
      correct: 'B',
      exp: 'Tích lũy tư bản là sự tái sản xuất ra tư bản với quy mô mở rộng, bản chất là biến một phần giá trị thặng dư thành tư bản phụ thêm.'
    },
    {
      num: 10,
      q: 'Cấu tạo hữu cơ của tư bản ký hiệu là gì?',
      a: 'c + v + m',
      b: 'c / v',
      c: 'm / v',
      d: 'p / (c + v)',
      correct: 'B',
      exp: 'Cấu tạo hữu cơ của tư bản là cấu tạo giá trị của tư bản do cấu tạo kỹ thuật quyết định và phản ánh sự biến đổi của cấu tạo kỹ thuật, ký hiệu là c/v.'
    }
  ];

  for (const q of ktctQuestions) {
    await run(
      `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam2Id, q.num, q.q, q.a, q.b, q.c, q.d, q.correct, q.exp]
    );
  }

  // Exam 3: Toán Cao cấp A1 - Đề thi thử số 1
  const exam3 = await run(
    `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'Toán Cao cấp A1 - Đề thi thử số 1',
      'Toán Cao cấp',
      'Tập trung vào ma trận, định thức, hệ phương trình tuyến tính và không gian vector.',
      50,
      'Toán CC'
    ]
  );
  const exam3Id = exam3.lastID;

  const toanQuestions = [
    {
      num: 1,
      q: 'Định thức của ma trận đơn vị cấp n bằng bao nhiêu?',
      a: '0',
      b: '1',
      c: 'n',
      d: '-1',
      correct: 'B',
      exp: 'Định thức của ma trận đơn vị cấp n luôn luôn bằng tích các phần tử trên đường chéo chính = 1 * 1 * ... = 1.'
    },
    {
      num: 2,
      q: 'Khi đổi chỗ hai dòng (hoặc hai cột) của một định thức thì định thức đó sẽ như thế nào?',
      a: 'Không đổi',
      b: 'Đổi dấu',
      c: 'Bằng 0',
      d: 'Tăng lên gấp đôi',
      correct: 'B',
      exp: 'Theo tính chất cơ bản của định thức, khi hoán vị hai hàng hoặc hai cột bất kỳ, định thức đổi dấu.'
    },
    {
      num: 3,
      q: 'Điều kiện để ma trận vuông A khả nghịch (tồn tại A^-1) là gì?',
      a: 'det(A) = 0',
      b: 'det(A) != 0',
      c: 'det(A) > 0',
      d: 'Trace(A) != 0',
      correct: 'B',
      exp: 'Ma trận vuông A khả nghịch khi và chỉ khi định thức của nó khác 0 (det(A) != 0).'
    },
    {
      num: 4,
      q: 'Hệ phương trình tuyến tính thuần nhất AX = 0 có nghiệm không tầm thường khi nào?',
      a: 'Hạng của A nhỏ hơn số ẩn (r(A) < n)',
      b: 'r(A) = n',
      c: 'det(A) > 0',
      d: 'Không bao giờ có nghiệm không tầm thường',
      correct: 'A',
      exp: 'Hệ phương trình thuần nhất AX = 0 luôn có nghiệm tầm thường X = 0. Để có vô số nghiệm (có nghiệm không tầm thường), điều kiện cần và đủ là r(A) < n.'
    },
    {
      num: 5,
      q: 'Tích phân bất định của hàm số f(x) = e^(2x) dx là:',
      a: '2 e^(2x) + C',
      b: '(1/2) e^(2x) + C',
      c: 'e^(2x) + C',
      d: '(1/4) e^(2x) + C',
      correct: 'B',
      exp: 'Nguyên hàm của e^(kx) dx là (1/k) * e^(kx) + C. Với k = 2, kết quả là (1/2) e^(2x) + C.'
    }
  ];

  for (const q of toanQuestions) {
    await run(
      `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam3Id, q.num, q.q, q.a, q.b, q.c, q.d, q.correct, q.exp]
    );
  }

  // Exam 4: Cơ học - Động lực học chất điểm
  const exam4 = await run(
    `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'Cơ học - Động lực học chất điểm',
      'Vật lý Đại cương',
      'Kiểm tra kiến thức cơ bản về động học và động lực học. Yêu cầu tính toán chính xác.',
      40,
      'Vật lý ĐC'
    ]
  );
  const exam4Id = exam4.lastID;

  const vatLyQuestions = [
    {
      num: 1,
      q: 'Phương trình định luật II Newton dưới dạng vi phân là gì?',
      a: 'F = m * a = dp/dt',
      b: 'F = m * v',
      c: 'F = d(mv)/dx',
      d: 'F = 0.5 * m * v^2',
      correct: 'A',
      exp: 'Định luật II Newton phát biểu: Lực tác dụng lên vật bằng tốc độ biến thiên động lượng của vật đó theo thời gian: F = dp/dt = d(mv)/dt = m*a.'
    },
    {
      num: 2,
      q: 'Gia tốc tiếp tuyến trong chuyển động cong đặc trưng cho điều gì?',
      a: 'Sự thay đổi về phương hướng của vận tốc',
      b: 'Sự thay đổi về độ lớn của vận tốc',
      c: 'Lực hướng tâm tác dụng',
      d: 'Độ cong quỹ đạo',
      correct: 'B',
      exp: 'Gia tốc tiếp tuyến at = dv/dt đặc trưng cho sự thay đổi về độ lớn của vận tốc; gia tốc pháp tuyến an = v^2/R đặc trưng cho sự thay đổi về phương của vận tốc.'
    },
    {
      num: 3,
      q: 'Công của lực thế khi di chuyển chất điểm dọc theo một đường cong kín bằng bao nhiêu?',
      a: 'Luôn luôn lớn hơn 0',
      b: 'Bằng 0',
      c: 'Bằng động năng ban đầu',
      d: 'Phụ thuộc vào hình dạng đường cong',
      correct: 'B',
      exp: 'Lực thế là lực có công không phụ thuộc vào dạng đường đi mà chỉ phụ thuộc vào vị trí điểm đầu và điểm cuối. Do đó dọc theo đường cong khép kín thì công A = 0.'
    }
  ];

  for (const q of vatLyQuestions) {
    await run(
      `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam4Id, q.num, q.q, q.a, q.b, q.c, q.d, q.correct, q.exp]
    );
  }

  // Exam 5: Ngân hàng câu hỏi Lịch sử Đảng (Full)
  const exam5 = await run(
    `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
     VALUES (?, ?, ?, ?, ?)`,
    [
      'Ngân hàng câu hỏi Lịch sử Đảng (Full)',
      'Lịch sử Đảng',
      'Bộ ngân hàng 100 câu trắc nghiệm bao phủ toàn bộ giáo trình chuẩn.',
      60,
      'Lịch sử Đ'
    ]
  );
  const exam5Id = exam5.lastID;

  const lichSuQuestions = [
    {
      num: 1,
      q: 'Đảng Cộng sản Việt Nam được thành lập vào ngày tháng năm nào?',
      a: '3/2/1930',
      b: '19/5/1890',
      c: '2/9/1945',
      d: '30/4/1975',
      correct: 'A',
      exp: 'Đảng Cộng sản Việt Nam được thành lập ngày 3 tháng 2 năm 1930 tại Hội nghị hợp nhất các tổ chức cộng sản họp ở Cửu Long (Hương Cảng, Trung Quốc) do Nguyễn Ái Quốc chủ trì.'
    },
    {
      num: 2,
      q: 'Ai là Tổng Bí thư đầu tiên của Đảng Cộng sản Việt Nam?',
      a: 'Hồ Chí Minh',
      b: 'Trần Phú',
      c: 'Lê Hồng Phong',
      d: 'Hà Huy Tập',
      correct: 'B',
      exp: 'Đồng chí Trần Phú được bầu làm Tổng Bí thư đầu tiên của Đảng tại Hội nghị Ban Chấp hành Trung ương tháng 10 năm 1930.'
    },
    {
      num: 3,
      q: 'Cương lĩnh chính trị đầu tiên của Đảng do ai soạn thảo?',
      a: 'Trần Phú',
      b: 'Nguyễn Ái Quốc',
      c: 'Nguyễn Văn Cừ',
      d: 'Trường Chinh',
      correct: 'B',
      exp: 'Cương lĩnh chính trị đầu tiên của Đảng gồm Chính cương vắn tắt, Sách lược vắn tắt do lãnh tụ Nguyễn Ái Quốc trực tiếp soạn thảo và thông qua tại Hội nghị thành lập Đảng đầu năm 1930.'
    }
  ];

  for (const q of lichSuQuestions) {
    await run(
      `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam5Id, q.num, q.q, q.a, q.b, q.c, q.d, q.correct, q.exp]
    );
  }
}

module.exports = {
  db: sqliteDb || pool,
  sqliteDb,
  pool,
  run,
  get,
  all,
  initDb
};


