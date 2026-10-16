/**
 * Script sao chép toàn bộ dữ liệu từ SQLite (data/uniprep.db) sang PostgreSQL
 * Sử dụng: node migrate_to_postgres.js <DATABASE_URL>
 * Ví dụ:   node migrate_to_postgres.js "postgres://user:pass@host:5432/dbname"
 */
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

async function migrate() {
  let dbUrl = process.argv[2] || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Lỗi: Vui lòng cung cấp URL kết nối PostgreSQL.');
    console.log('Cú pháp: node migrate_to_postgres.js "postgres://user:pass@host:5432/dbname"');
    process.exit(1);
  }

  // Supabase direct connection uses IPv6 by default. Auto-convert to IPv4 pooler if needed:
  if (dbUrl.includes('.supabase.co')) {
    try {
      const parsed = new URL(dbUrl);
      if (parsed.hostname.startsWith('db.') && parsed.hostname.endsWith('.supabase.co')) {
        const projectRef = parsed.hostname.split('.')[1];
        const region = process.env.SUPABASE_REGION || (projectRef === 'mflrfyibkqltrasjvhap' ? 'ap-northeast-1' : 'ap-southeast-1');
        parsed.hostname = `aws-0-${region}.pooler.supabase.com`;
        parsed.port = '6543';
        if (!parsed.username.includes('.')) {
          parsed.username = `${parsed.username}.${projectRef}`;
        }
        dbUrl = parsed.toString();
        console.log(`[Supabase IPv4 Adapter] Chuyển đổi sang Transaction Pooler IPv4: ${parsed.hostname}:6543`);
      }
    } catch (e) {}
  }

  const sqlitePath = path.join(__dirname, 'data', 'uniprep.db');
  if (!fs.existsSync(sqlitePath)) {
    console.error(`❌ Không tìm thấy file SQLite tại: ${sqlitePath}`);
    process.exit(1);
  }

  console.log('========================================================');
  console.log('   Chuyển đổi dữ liệu từ SQLite sang PostgreSQL         ');
  console.log('========================================================\n');
  console.log(`📂 Nguồn SQLite: ${sqlitePath}`);
  console.log(`🌐 Đích PostgreSQL: ${dbUrl.replace(/:[^:@]+@/, ':****@')}\n`);

  // Connect SQLite
  const sqliteDb = new sqlite3.Database(sqlitePath);
  const sqliteAll = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  // Connect Postgres
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }
  });

  // 1. Tạo các bảng trên PostgreSQL
  console.log('1. Khởi tạo cấu trúc các bảng trên PostgreSQL...');
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
  console.log('   ✅ Đã khởi tạo bảng xong.');

  // 2. Chuyển đổi admin_users
  console.log('\n2. Chuyển đổi tài khoản quản trị (admin_users)...');
  const adminUsers = await sqliteAll('SELECT * FROM admin_users');
  for (const u of adminUsers) {
    await pool.query(`
      INSERT INTO admin_users (id, username, password_hash, display_name, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE 
      SET username = EXCLUDED.username, password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name
    `, [u.id, u.username, u.password_hash, u.display_name, u.created_at || new Date()]);
  }
  console.log(`   ✅ Đã chuyển ${adminUsers.length} tài khoản.`);

  // 3. Chuyển đổi exams
  console.log('\n3. Chuyển đổi danh sách đề thi (exams)...');
  const exams = await sqliteAll('SELECT * FROM exams ORDER BY id ASC');
  for (const e of exams) {
    await pool.query(`
      INSERT INTO exams (id, title, category, description, duration_minutes, badge_text, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE 
      SET title = EXCLUDED.title, category = EXCLUDED.category, description = EXCLUDED.description,
          duration_minutes = EXCLUDED.duration_minutes, badge_text = EXCLUDED.badge_text
    `, [e.id, e.title, e.category, e.description, e.duration_minutes, e.badge_text, e.created_at || new Date()]);
  }
  console.log(`   ✅ Đã chuyển ${exams.length} bộ đề thi.`);

  // 4. Chuyển đổi questions
  console.log('\n4. Chuyển đổi toàn bộ câu hỏi (questions)...');
  const questions = await sqliteAll('SELECT * FROM questions ORDER BY id ASC');
  let qCount = 0;
  for (const q of questions) {
    await pool.query(`
      INSERT INTO questions (id, exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE 
      SET question_text = EXCLUDED.question_text, option_a = EXCLUDED.option_a, option_b = EXCLUDED.option_b,
          option_c = EXCLUDED.option_c, option_d = EXCLUDED.option_d, correct_answer = EXCLUDED.correct_answer,
          explanation = EXCLUDED.explanation
    `, [q.id, q.exam_id, q.question_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer, q.explanation]);
    qCount++;
  }
  console.log(`   ✅ Đã chuyển ${qCount} câu hỏi.`);

  // 5. Chuyển đổi submissions
  console.log('\n5. Chuyển đổi lịch sử làm bài (submissions)...');
  const submissions = await sqliteAll('SELECT * FROM submissions ORDER BY id ASC');
  for (const s of submissions) {
    await pool.query(`
      INSERT INTO submissions (id, exam_id, exam_title, score, total_questions, correct_count, wrong_count, unanswered_count, answers_json, time_spent_seconds, submitted_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING
    `, [s.id, s.exam_id, s.exam_title, s.score, s.total_questions, s.correct_count, s.wrong_count, s.unanswered_count, s.answers_json, s.time_spent_seconds, s.submitted_at || new Date()]);
  }
  console.log(`   ✅ Đã chuyển ${submissions.length} lượt nộp bài.`);

  // 6. Cập nhật lại chuỗi Sequence để tự tăng ID đúng
  console.log('\n6. Cập nhật chuỗi Auto Increment (Sequences)...');
  await pool.query(`
    SELECT setval(pg_get_serial_sequence('exams', 'id'), COALESCE((SELECT MAX(id) FROM exams), 1));
    SELECT setval(pg_get_serial_sequence('questions', 'id'), COALESCE((SELECT MAX(id) FROM questions), 1));
    SELECT setval(pg_get_serial_sequence('submissions', 'id'), COALESCE((SELECT MAX(id) FROM submissions), 1));
    SELECT setval(pg_get_serial_sequence('admin_users', 'id'), COALESCE((SELECT MAX(id) FROM admin_users), 1));
  `);
  console.log('   ✅ Đã đồng bộ Sequence thành công.');

  console.log('\n========================================================');
  console.log('🎉 CHUYỂN ĐỔI SANG POSTGRESQL HOÀN TẤT THÀNH CÔNG!');
  console.log('========================================================\n');

  sqliteDb.close();
  await pool.end();
}

migrate().catch(err => {
  console.error('\n❌ Lỗi trong quá trình chuyển đổi:', err);
  process.exit(1);
});

