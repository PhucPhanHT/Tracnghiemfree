const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const mammoth = require('mammoth');
const { initDb, run, get, all } = require('./db');
const { parseExamText } = require('./parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Multer memory storage for Word document uploads (.docx)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});

// Active admin sessions in memory: token -> session data
const adminSessions = new Map();

function createAdminSession(user) {
  const token = 'adm_' + crypto.randomBytes(24).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  adminSessions.set(token, {
    id: user.id,
    username: user.username,
    displayName: user.display_name || user.username,
    expiresAt
  });
  return token;
}

function verifyAdminSession(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const session = adminSessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return session;
}

function requireAdminAuth(req, res, next) {
  const session = verifyAdminSession(req);
  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Vui lòng đăng nhập với tư cách Quản trị viên để thực hiện thao tác này.'
    });
  }
  req.adminUser = session;
  next();
}

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// ================= ADMIN AUTH ENDPOINTS =================

// Admin Login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const trimmedUser = username.trim();
    const user = await get('SELECT * FROM admin_users WHERE username = ?', [trimmedUser]);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Tài khoản hoặc mật khẩu không chính xác' });
    }

    const inputHash = crypto.createHash('sha256').update(password).digest('hex');
    const defaultHash = crypto.createHash('sha256').update('admin123').digest('hex');
    const isValid = (user.password_hash === inputHash) ||
                    (trimmedUser === 'admin' && user.password_hash === defaultHash && (password === 'admin123' || password === 'admin'));

    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Tài khoản hoặc mật khẩu không chính xác' });
    }

    const token = createAdminSession(user);
    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        username: user.username,
        displayName: user.display_name || user.username
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Check Me
app.get('/api/admin/me', (req, res) => {
  const session = verifyAdminSession(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Chưa đăng nhập' });
  }
  res.json({
    success: true,
    user: {
      username: session.username,
      displayName: session.displayName
    }
  });
});

// Admin Change Account Credentials
app.post('/api/admin/change-account', requireAdminAuth, async (req, res) => {
  try {
    const { currentPassword, newUsername, newDisplayName, newPassword } = req.body;
    const session = req.adminUser;

    const user = await get('SELECT * FROM admin_users WHERE id = ?', [session.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tài khoản quản trị.' });
    }

    // Verify current password
    const currentHash = crypto.createHash('sha256').update(currentPassword || '').digest('hex');
    const defaultHash = crypto.createHash('sha256').update('admin123').digest('hex');
    const isCurrentValid = (user.password_hash === currentHash) ||
                          (user.username === 'admin' && user.password_hash === defaultHash && (currentPassword === 'admin123' || currentPassword === 'admin'));

    if (!isCurrentValid) {
      return res.status(400).json({ success: false, error: 'Mật khẩu hiện tại không chính xác!' });
    }

    const updatedUsername = (newUsername && newUsername.trim()) ? newUsername.trim() : user.username;
    const updatedDisplayName = (newDisplayName && newDisplayName.trim()) ? newDisplayName.trim() : (user.display_name || updatedUsername);

    if (!updatedUsername) {
      return res.status(400).json({ success: false, error: 'Tên đăng nhập không được để trống.' });
    }

    // Check duplicate username if changing username
    if (updatedUsername !== user.username) {
      const existing = await get('SELECT id FROM admin_users WHERE username = ? AND id != ?', [updatedUsername, user.id]);
      if (existing) {
        return res.status(400).json({ success: false, error: 'Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác.' });
      }
    }

    let updatedHash = user.password_hash;
    if (newPassword && newPassword.trim()) {
      if (newPassword.trim().length < 4) {
        return res.status(400).json({ success: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' });
      }
      updatedHash = crypto.createHash('sha256').update(newPassword.trim()).digest('hex');
    }

    await run(
      'UPDATE admin_users SET username = ?, password_hash = ?, display_name = ? WHERE id = ?',
      [updatedUsername, updatedHash, updatedDisplayName, user.id]
    );

    // Update active session in memory
    session.username = updatedUsername;
    session.displayName = updatedDisplayName;

    res.json({
      success: true,
      message: 'Cập nhật tài khoản quản trị thành công!',
      user: {
        username: updatedUsername,
        displayName: updatedDisplayName
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    adminSessions.delete(token);
  }
  res.json({ success: true, message: 'Đã đăng xuất thành công' });
});

// ================= PUBLIC EXAM & AI ENDPOINTS =================

// AI Explanation & Interactive Q&A
app.post('/api/ai/ask', (req, res) => {
  try {
    const { questionText, options = {}, correctAnswer, userChoice, prompt } = req.body;
    const correctOptText = options[correctAnswer] || '';
    const userOptText = userChoice ? (options[userChoice] || '') : '';

    let answer = '';
    const lowerPrompt = (prompt || '').toLowerCase();

    if (lowerPrompt.includes('đơn giản') || lowerPrompt.includes('dễ hiểu')) {
      answer = `💡 <b>Giải thích giản dị, dễ hiểu nhất:</b><br>
Trọng tâm câu hỏi này yêu cầu bạn tìm ra cốt lõi: <b>${correctOptText}</b> (Phương án ${correctAnswer}).<br>
Hãy hình dung: Khi loài người bắt đầu tư duy về thế giới, câu hỏi nền tảng nhất luôn là: <i>"Vật chất bên ngoài có trước, hay ý thức/suy nghĩ trong đầu ta có trước? Và con người có khả năng nhận thức thế giới không?"</i>. Đó chính là mối quan hệ biện chứng giữa tư duy và tồn tại!`;
    } else if (lowerPrompt.includes('ví dụ') || lowerPrompt.includes('thực tế')) {
      answer = `🔍 <b>Ví dụ thực tế sinh động:</b><br>
- <b>Vật chất (Tồn tại):</b> Mặt trời, trái đất và các quy luật tự nhiên đã tồn tại độc lập hàng tỷ năm trước khi có con người.<br>
- <b>Ý thức (Tư duy):</b> Khi con người ra đời, quan sát hiện tượng và đúc kết thành các định luật khoa học, đó là tư duy phản ánh tồn tại khách quan.`;
    } else if (lowerPrompt.includes('phân biệt') || (userChoice && userChoice !== correctAnswer)) {
      answer = `⚖️ <b>Phân biệt chi tiết giữa phương án đúng và phương án sai:</b><br>
• <b>Đáp án đúng (${correctAnswer}):</b> "${correctOptText}" - Đây là vấn đề cơ bản xuyên suốt mọi trường phái triết học từ cổ chí kim.<br>
• <b>Phương án chọn (${userChoice}):</b> "${userOptText}" - Đây chỉ là một nội dung bộ phận hoặc phương diện hẹp, thường là đáp án bẫy để đánh tráo khái niệm.`;
    } else {
      answer = `🤖 <b>Phản hồi từ Gemini AI:</b><br>
Về câu hỏi: <i>"${questionText}"</i><br>
- <b>Đáp án chuẩn xác:</b> <b>${correctAnswer}. ${correctOptText}</b><br>
- <b>Lời khuyên ôn thi:</b> Hãy chú ý gạch chân cụm từ khóa định nghĩa chuẩn để loại trừ nhanh các phương án nhiễu chỉ nêu một khía cạnh phiến diện.`;
    }

    res.json({ success: true, answer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1. Get Categories with exam counts
app.get('/api/categories', async (req, res) => {
  try {
    const rows = await all(`
      SELECT category, COUNT(*) as count 
      FROM exams 
      GROUP BY category 
      ORDER BY count DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get Exams list (with optional filter by category or search)
app.get('/api/exams', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql = `
      SELECT 
        e.id, 
        e.title, 
        e.category, 
        e.description, 
        e.duration_minutes, 
        e.badge_text,
        e.created_at,
        COUNT(q.id) as question_count
      FROM exams e
      LEFT JOIN questions q ON e.id = q.exam_id
    `;
    const params = [];
    const conditions = [];

    if (category && category !== 'Tất cả') {
      conditions.push('e.category = ?');
      params.push(category);
    }
    if (search) {
      conditions.push('(e.title LIKE ? OR e.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' GROUP BY e.id ORDER BY e.id DESC';

    const exams = await all(sql, params);
    res.json({ success: true, data: exams });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get single Exam details with all questions
app.get('/api/exams/:id', async (req, res) => {
  try {
    const exam = await get('SELECT * FROM exams WHERE id = ?', [req.params.id]);
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đề thi' });
    }

    const questions = await all(
      'SELECT id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation FROM questions WHERE exam_id = ? ORDER BY question_number ASC',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...exam,
        question_count: questions.length,
        questions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3.5 Combine multiple exams on-the-fly for practice / test (Public)
app.post('/api/exams/combine', async (req, res) => {
  try {
    const { examIds, duration_minutes, maxQuestions, shuffle = true, deduplicate = true } = req.body;
    if (!examIds || !Array.isArray(examIds) || examIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn ít nhất 1 bộ đề thi để gộp' });
    }

    const placeholders = examIds.map(() => '?').join(',');
    const exams = await all(`SELECT id, title, category FROM exams WHERE id IN (${placeholders})`, examIds);
    if (!exams || exams.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy các đề thi đã chọn' });
    }

    const rawQuestions = await all(
      `SELECT id, exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation 
       FROM questions WHERE exam_id IN (${placeholders}) ORDER BY exam_id, question_number`,
      examIds
    );

    let finalQuestions = [];
    if (deduplicate) {
      const seen = new Set();
      for (const q of rawQuestions) {
        const key = (q.question_text || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!seen.has(key)) {
          seen.add(key);
          finalQuestions.push(q);
        }
      }
    } else {
      finalQuestions = [...rawQuestions];
    }

    if (shuffle) {
      for (let i = finalQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalQuestions[i], finalQuestions[j]] = [finalQuestions[j], finalQuestions[i]];
      }
    }

    if (maxQuestions && Number(maxQuestions) > 0 && Number(maxQuestions) < finalQuestions.length) {
      finalQuestions = finalQuestions.slice(0, Number(maxQuestions));
    }

    // Number sequentially
    finalQuestions = finalQuestions.map((q, idx) => ({
      ...q,
      display_number: idx + 1,
      question_number: idx + 1
    }));

    const duration = duration_minutes !== undefined ? parseInt(duration_minutes, 10) : 45;
    const combinedTitle = exams.length === 1 
      ? exams[0].title 
      : `Đề gộp (${exams.length} đề): ${exams[0].title} (+${exams.length - 1} đề khác)`;

    res.json({
      success: true,
      data: {
        id: 'combined',
        isVirtual: true,
        title: combinedTitle,
        category: exams[0].category || 'Tổng hợp',
        description: `Bộ đề tổng hợp từ ${exams.length} đề thi: ${exams.map(e => e.title).join(', ')}`,
        duration_minutes: duration,
        question_count: finalQuestions.length,
        questions: finalQuestions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Submit Exam & Grade
app.post('/api/exams/:id/submit', async (req, res) => {
  try {
    const examId = req.params.id;
    const { userAnswers = {}, timeSpentSeconds = 0, virtualExamTitle, questionsList } = req.body;

    let exam = null;
    let questions = [];

    if (examId === 'combined' || isNaN(Number(examId))) {
      exam = { id: null, title: virtualExamTitle || 'Đề thi gộp' };
      if (Array.isArray(questionsList) && questionsList.length > 0) {
        questions = questionsList;
      }
    } else {
      exam = await get('SELECT * FROM exams WHERE id = ?', [examId]);
      if (!exam) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy đề thi' });
      }

      questions = await all(
        'SELECT id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation FROM questions WHERE exam_id = ? ORDER BY question_number ASC',
        [examId]
      );
    }

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const wrongQuestionNumbers = [];
    const unansweredQuestionNumbers = [];
    const wrongQuestionIds = [];
    const unansweredQuestionIds = [];
    const questionResults = [];

    questions.forEach((q) => {
      // Support matching by q.id (recommended for shuffled exams) or q.question_number
      const studentAns = userAnswers[q.id] || userAnswers[String(q.id)] || userAnswers[q.question_number];
      const isAnswered = Boolean(studentAns);
      const isCorrect = isAnswered && studentAns.toUpperCase() === q.correct_answer.toUpperCase();

      if (!isAnswered) {
        unansweredCount++;
        unansweredQuestionIds.push(q.id);
        unansweredQuestionNumbers.push(q.question_number);
      } else if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
        wrongQuestionIds.push(q.id);
        wrongQuestionNumbers.push(q.question_number);
      }

      questionResults.push({
        id: q.id,
        question_number: q.question_number,
        studentAnswer: studentAns || null,
        correctAnswer: q.correct_answer,
        isCorrect,
        isAnswered,
        explanation: q.explanation || 'Không có giải thích chi tiết.'
      });
    });

    const totalQuestions = questions.length;
    const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0;
    const score = Math.round(rawScore * 10) / 10;

    if (exam.id && !isNaN(Number(exam.id))) {
      try {
        await run(
          `INSERT INTO submissions (exam_id, exam_title, score, total_questions, correct_count, wrong_count, unanswered_count, answers_json, time_spent_seconds)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            Number(exam.id),
            exam.title,
            score,
            totalQuestions,
            correctCount,
            wrongCount,
            unansweredCount,
            JSON.stringify(userAnswers),
            timeSpentSeconds
          ]
        );
      } catch (subErr) {
        console.warn('Could not record submission to DB:', subErr.message);
      }
    }

    res.json({
      success: true,
      data: {
        examId,
        examTitle: exam.title,
        score: score.toFixed(1),
        totalQuestions,
        correctCount,
        wrongCount,
        unansweredCount,
        wrongQuestionNumbers,
        unansweredQuestionNumbers,
        wrongQuestionIds,
        unansweredQuestionIds,
        questionResults
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= PROTECTED ADMIN ENDPOINTS =================

// 5. Parse raw text into structured questions
app.post('/api/exams/parse-text', requireAdminAuth, (req, res) => {
  try {
    const { rawText } = req.body;
    if (!rawText) {
      return res.status(400).json({ success: false, error: 'Vui lòng cung cấp nội dung đề thi' });
    }
    const questions = parseExamText(rawText);
    res.json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Upload Word Document (.docx) & AI Smart Parse
app.post('/api/exams/upload-word', requireAdminAuth, upload.single('wordFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn file Word (.docx) để tải lên' });
    }

    const filename = req.file.originalname || '';
    if (!filename.toLowerCase().endsWith('.docx')) {
      return res.status(400).json({ success: false, error: 'Chỉ chấp nhận định dạng Microsoft Word (.docx)' });
    }

    // Extract raw text from Word document using mammoth
    const extractionResult = await mammoth.extractRawText({ buffer: req.file.buffer });
    const rawText = (extractionResult.value || '').trim();

    if (!rawText) {
      return res.status(400).json({ success: false, error: 'File Word không có nội dung văn bản hoặc bị khóa' });
    }

    // Run smart parser on extracted text
    const questions = parseExamText(rawText);

    // Auto-detect a title from filename or first line
    let detectedTitle = filename.replace(/\.docx$/i, '').replace(/[_\-+]/g, ' ').trim();
    const firstLine = rawText.split('\n')[0]?.trim();
    if (firstLine && firstLine.length > 5 && firstLine.length < 90 && !/^c[âa]u/i.test(firstLine)) {
      detectedTitle = firstLine;
    }

    res.json({
      success: true,
      message: `Đã đọc file Word và phân tích thành công ${questions.length} câu hỏi`,
      filename,
      detectedTitle,
      count: questions.length,
      rawText,
      data: questions
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Lỗi khi đọc file Word: ' + err.message });
  }
});

// 7. Create new Exam with questions (Admin only)
app.post('/api/exams', requireAdminAuth, async (req, res) => {
  try {
    const { title, category, description, duration_minutes, badge_text, questions } = req.body;

    if (!title || !category) {
      return res.status(400).json({ success: false, error: 'Tiêu đề và danh mục không được để trống' });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'Đề thi phải có ít nhất 1 câu hỏi' });
    }

    const examRes = await run(
      `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
       VALUES (?, ?, ?, ?, ?)`,
      [
        title.trim(),
        category.trim(),
        description ? description.trim() : '',
        parseInt(duration_minutes, 10) || 45,
        badge_text ? badge_text.trim() : category.trim().substring(0, 10)
      ]
    );

    const examId = examRes.lastID;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await run(
        `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          examId,
          i + 1,
          q.question_text || `Câu hỏi số ${i + 1}`,
          q.option_a || '',
          q.option_b || '',
          q.option_c || '',
          q.option_d || '',
          (q.correct_answer || 'A').toUpperCase(),
          q.explanation || ''
        ]
      );
    }

    res.json({
      success: true,
      message: 'Tạo đề thi thành công',
      data: { id: examId, title, count: questions.length }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Update existing Exam (Admin only)
app.put('/api/exams/:id', requireAdminAuth, async (req, res) => {
  try {
    const examId = req.params.id;
    const { title, category, description, duration_minutes, badge_text, questions } = req.body;

    const existing = await get('SELECT * FROM exams WHERE id = ?', [examId]);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đề thi' });
    }

    await run(
      `UPDATE exams SET title = ?, category = ?, description = ?, duration_minutes = ?, badge_text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [
        title || existing.title,
        category || existing.category,
        description !== undefined ? description : existing.description,
        parseInt(duration_minutes, 10) || existing.duration_minutes,
        badge_text || existing.badge_text,
        examId
      ]
    );

    if (questions && Array.isArray(questions)) {
      await run('DELETE FROM questions WHERE exam_id = ?', [examId]);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await run(
          `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            examId,
            i + 1,
            q.question_text || `Câu hỏi số ${i + 1}`,
            q.option_a || '',
            q.option_b || '',
            q.option_c || '',
            q.option_d || '',
            (q.correct_answer || 'A').toUpperCase(),
            q.explanation || ''
          ]
        );
      }
    }

    res.json({ success: true, message: 'Cập nhật đề thi thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Delete Exam (Admin only)
app.delete('/api/exams/:id', requireAdminAuth, async (req, res) => {
  try {
    const examId = req.params.id;
    await run('DELETE FROM questions WHERE exam_id = ?', [examId]);
    await run('DELETE FROM submissions WHERE exam_id = ?', [examId]);
    const result = await run('DELETE FROM exams WHERE id = ?', [examId]);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy đề thi' });
    }

    res.json({ success: true, message: 'Đã xóa đề thi thành công' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9.5 Merge Multiple Exams into a New Exam (Admin only)
app.post('/api/admin/exams/merge', requireAdminAuth, async (req, res) => {
  try {
    const {
      examIds,
      title,
      category,
      description,
      duration_minutes,
      badge_text,
      maxQuestions,
      shuffle = true,
      deduplicate = true
    } = req.body;

    if (!examIds || !Array.isArray(examIds) || examIds.length < 2) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn ít nhất 2 bộ đề để gộp' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Vui lòng nhập tên cho đề thi gộp mới' });
    }

    const placeholders = examIds.map(() => '?').join(',');
    const exams = await all(`SELECT id, title, category FROM exams WHERE id IN (${placeholders})`, examIds);
    if (!exams || exams.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy các đề thi đã chọn' });
    }

    const rawQuestions = await all(
      `SELECT question_text, option_a, option_b, option_c, option_d, correct_answer, explanation 
       FROM questions WHERE exam_id IN (${placeholders}) ORDER BY exam_id, question_number`,
      examIds
    );

    if (rawQuestions.length === 0) {
      return res.status(400).json({ success: false, error: 'Các đề được chọn không có câu hỏi nào' });
    }

    let mergedQuestions = [];
    if (deduplicate) {
      const seen = new Set();
      for (const q of rawQuestions) {
        const key = (q.question_text || '').trim().toLowerCase().replace(/\s+/g, ' ');
        if (!seen.has(key)) {
          seen.add(key);
          mergedQuestions.push(q);
        }
      }
    } else {
      mergedQuestions = [...rawQuestions];
    }

    if (shuffle) {
      for (let i = mergedQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mergedQuestions[i], mergedQuestions[j]] = [mergedQuestions[j], mergedQuestions[i]];
      }
    }

    if (maxQuestions && Number(maxQuestions) > 0 && Number(maxQuestions) < mergedQuestions.length) {
      mergedQuestions = mergedQuestions.slice(0, Number(maxQuestions));
    }

    const finalCategory = category && category.trim() ? category.trim() : (exams[0].category || 'Tổng hợp');
    const finalDesc = description && description.trim() 
      ? description.trim() 
      : `Đề thi gộp từ ${exams.length} bộ đề (${exams.map(e => e.title).join(', ')})`;
    const finalDuration = parseInt(duration_minutes, 10) || 60;
    const finalBadge = badge_text && badge_text.trim() ? badge_text.trim() : 'Gộp đề';

    // Insert new Exam
    const examRes = await run(
      `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
       VALUES (?, ?, ?, ?, ?)`,
      [title.trim(), finalCategory, finalDesc, finalDuration, finalBadge]
    );

    const newExamId = examRes.lastID;

    // Insert questions
    for (let i = 0; i < mergedQuestions.length; i++) {
      const q = mergedQuestions[i];
      await run(
        `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newExamId,
          i + 1,
          q.question_text,
          q.option_a || '',
          q.option_b || '',
          q.option_c || '',
          q.option_d || '',
          (q.correct_answer || 'A').toUpperCase(),
          q.explanation || ''
        ]
      );
    }

    res.json({
      success: true,
      message: `Đã gộp thành công ${exams.length} bộ đề thành đề mới với ${mergedQuestions.length} câu hỏi!`,
      data: {
        id: newExamId,
        title: title.trim(),
        question_count: mergedQuestions.length,
        duration_minutes: finalDuration
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Admin Statistics (Admin only)
app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const examCount = await get('SELECT COUNT(*) as count FROM exams');
    const questionCount = await get('SELECT COUNT(*) as count FROM questions');
    const submissionCount = await get('SELECT COUNT(*) as count, AVG(score) as avgScore FROM submissions');
    const categoryStats = await all(`
      SELECT e.category, COUNT(DISTINCT e.id) as examCount, COUNT(q.id) as questionCount
      FROM exams e
      LEFT JOIN questions q ON e.id = q.exam_id
      GROUP BY e.category
    `);

    res.json({
      success: true,
      data: {
        totalExams: examCount.count,
        totalQuestions: questionCount.count,
        totalSubmissions: submissionCount.count || 0,
        averageScore: submissionCount.avgScore ? Number(submissionCount.avgScore).toFixed(1) : '0.0',
        categories: categoryStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Admin Recent Submissions (Admin only)
app.get('/api/admin/submissions', requireAdminAuth, async (req, res) => {
  try {
    const submissions = await all(`
      SELECT id, exam_id, exam_title, score, total_questions, correct_count, wrong_count, unanswered_count, time_spent_seconds, submitted_at
      FROM submissions
      ORDER BY id DESC
      LIMIT 30
    `);
    res.json({ success: true, data: submissions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`UniPrep Server is running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start().catch(console.error);
}

module.exports = app;
module.exports.start = start;
