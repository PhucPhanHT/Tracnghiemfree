const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const mammoth = require('mammoth');
const { initDb, run, get, all, isPg } = require('./db');
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

// Health check endpoint for keep-alive pings (Cron-job.org / UptimeRobot)
// Matches /health, //health, /health/, etc.
app.all(/^\/+health\/?$/i, (req, res) => {
  res.status(200).send('OK');
});

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

// Cache detected active Gemini model in memory
let detectedGeminiModel = process.env.GEMINI_MODEL || null;

async function resolveGeminiModel(apiKey) {
  if (detectedGeminiModel) return detectedGeminiModel;

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      const models = data.models || [];
      const supported = models
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      // Preferred order: Gemini 3.0 series first (Google recommendation), then 3.x, then flash models
      const preferred = supported.find(m => m.includes('3.0-flash') || m.includes('3-flash'))
        || supported.find(m => m.includes('3.'))
        || supported.find(m => m.includes('2.5-flash'))
        || supported.find(m => m.includes('2.0-flash'))
        || supported.find(m => m.includes('flash'))
        || supported[0];

      if (preferred) {
        detectedGeminiModel = preferred;
        console.log(`[Gemini API] Auto-selected supported model: ${detectedGeminiModel}`);
        return detectedGeminiModel;
      }
    }
  } catch (err) {
    console.warn('[Gemini API] Error listing models:', err.message);
  }

  return 'gemini-3.0-flash';
}

// AI Explanation & Interactive Q&A (Google Gemini API with auto-model detection & smart fallback)
app.post('/api/ai/ask', async (req, res) => {
  try {
    const { questionText, options = {}, correctAnswer, userChoice, prompt } = req.body;
    const userPrompt = (prompt || '').trim();

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const systemInstruction = 'Bạn là Trợ lý Gia sư AI chuyên nghiệp của nền tảng luyện thi trắc nghiệm đại học UniPrep. Bạn luôn giải thích một cách dễ hiểu, chính xác, đầy đủ và trọn vẹn câu trả lời (tuyệt đối không bị ngắt cụt giữa chừng), mang tính sư phạm cao bằng tiếng Việt. Sử dụng gạch đầu dòng rõ ràng và in đậm các từ khóa trọng tâm để học viên dễ nắm bắt.';

        let contentsText = '';
        if (questionText) {
          const optsText = Object.entries(options)
            .map(([k, v]) => `${k}. ${v}`)
            .join('\n');
          contentsText = `Câu hỏi trắc nghiệm:\n${questionText}\n\nCác phương án:\n${optsText}\n\nĐáp án đúng: ${correctAnswer || 'Chưa xác định'}\n${userChoice ? `Học viên đã chọn: ${userChoice}\n` : ''}\nYêu cầu của học viên: "${userPrompt}"\n\nHãy giải thích và hướng dẫn cho học viên theo yêu cầu trên.`;
        } else {
          contentsText = `Câu hỏi / Thắc mắc của học viên: "${userPrompt}"\n\nHãy giải đáp chi tiết, súc tích, dễ hiểu cho học viên.`;
        }

        const activeModel = await resolveGeminiModel(apiKey);
        const candidateModels = Array.from(new Set([
          'gemini-3.0-flash',
          'gemini-3-flash-preview',
          'gemini-3-flash',
          activeModel,
          'gemini-2.5-flash',
          'gemini-2.0-flash'
        ])).filter(Boolean);

        let aiAnswer = '';
        for (let i = 0; i < candidateModels.length; i++) {
          const candidate = candidateModels[i];
          const modelName = candidate.replace(/^models\//, '');
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const aiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: systemInstruction + '\n\n' + contentsText }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096
              }
            })
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const rawAnswer = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (rawAnswer) {
              detectedGeminiModel = modelName;
              aiAnswer = rawAnswer
                .replace(/^### (.*$)/gim, '<div class="font-bold text-emerald-700 dark:text-emerald-400 mt-2 mb-1 text-sm">$1</div>')
                .replace(/^## (.*$)/gim, '<div class="font-bold text-emerald-700 dark:text-emerald-400 mt-2 mb-1 text-base">$1</div>')
                .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                .replace(/^[*-]\s+(.*$)/gim, '• $1')
                .replace(/(^|[^\*])\*([^\*\n]+)\*/g, '$1<i>$2</i>')
                .replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-emerald-600 font-mono text-xs">$1</code>')
                .replace(/\n\n/g, '<br><br>')
                .replace(/\n/g, '<br>');
              break;
            }
          } else {
            const errData = await aiResponse.json().catch(() => ({}));
            const errMsg = errData?.error?.message || '';
            console.warn(`[Gemini API] Model ${modelName} returned ${aiResponse.status}:`, errMsg || errData);

            // Auto-adapt if Google's response suggests a specific newer model
            const match = errMsg.match(/use\s+models\/([\w.-]+)/i);
            if (match && match[1] && !candidateModels.includes(match[1])) {
              console.log(`[Gemini API] Auto-enqueuing Google recommended model: ${match[1]}`);
              candidateModels.splice(i + 1, 0, match[1]);
            }

            if (aiResponse.status !== 404 && aiResponse.status !== 400) {
              // Non-404 error (e.g. invalid key or quota limit)
              break;
            }
          }
        }

        if (aiAnswer) {
          return res.json({
            success: true,
            isLiveAi: true,
            model: detectedGeminiModel,
            answer: aiAnswer
          });
        }
      } catch (geminiErr) {
        console.warn('[Gemini API] Error calling Google Gemini:', geminiErr.message);
      }
    }

    // Smart Offline Fallback (when GEMINI_API_KEY is not set or network fails)
    const correctOptText = options[correctAnswer] || '';
    const userOptText = userChoice ? (options[userChoice] || '') : '';
    let answer = '';
    const lowerPrompt = userPrompt.toLowerCase();

    if (!questionText) {
      answer = `🤖 <b>Trợ lý UniPrep AI:</b><br>
Chào bạn! Tôi là trợ lý học tập trực tuyến. Bạn có thể hỏi về kiến thức các môn học như <b>Quân sự QPAN</b>, <b>Triết học</b>, phương pháp ghi nhớ từ khóa hoặc giải thích câu hỏi trắc nghiệm.<br><br>
<i>💡 Mẹo: Để kích hoạt trí tuệ nhân tạo Gemini AI trực tiếp từ Google, Quản trị viên chỉ cần thêm <code>GEMINI_API_KEY</code> vào file <code>.env</code> hoặc cấu hình Environment Variables trên Render.</i>`;
    } else if (lowerPrompt.includes('đơn giản') || lowerPrompt.includes('dễ hiểu')) {
      answer = `💡 <b>Giải thích giản dị, dễ hiểu:</b><br>
Trọng tâm câu hỏi này nằm ở cốt lõi: <b>${correctOptText ? `${correctAnswer}. ${correctOptText}` : `Phương án ${correctAnswer}`}</b>.<br>
Hãy ghi nhớ từ khóa chính của câu hỏi: <i>"${questionText.slice(0, 80)}..."</i> gắn liền trực tiếp với bản chất của đáp án đúng.`;
    } else if (lowerPrompt.includes('ví dụ') || lowerPrompt.includes('thực tế')) {
      answer = `🔍 <b>Ví dụ minh họa thực tế:</b><br>
Trong thực tiễn, khái niệm này được áp dụng để giải quyết các tình huống phát sinh, giúp phân biệt rõ giữa nguyên lý lý thuyết và các biểu hiện đời sống thực tế.<br>
- <b>Bài học:</b> Luôn bám sát bản chất nguyên lý cốt lõi của đáp án <b>${correctAnswer}</b>.`;
    } else if (lowerPrompt.includes('phân biệt') || (userChoice && userChoice !== correctAnswer)) {
      answer = `⚖️ <b>Phân biệt phương án đúng (${correctAnswer}) và phương án chọn (${userChoice || 'khác'}):</b><br>
• <b>Đáp án chuẩn (${correctAnswer}):</b> "${correctOptText || 'Khái niệm chuẩn xác'}" - Phản ánh đúng và đầy đủ nhất theo giáo trình chuẩn.<br>
• <b>Phương án chọn (${userChoice || 'sai'}):</b> "${userOptText || 'Phương án khác'}" - Thường chỉ nêu một khía cạnh phiến diện hoặc dùng để đánh tráo khái niệm.`;
    } else {
      answer = `🤖 <b>Phản hồi hỗ trợ học tập:</b><br>
Về câu hỏi: <i>"${questionText}"</i><br>
- <b>Đáp án chuẩn xác:</b> <b>${correctAnswer}${correctOptText ? `. ${correctOptText}` : ''}</b><br>
- <b>Mẹo ôn thi:</b> Chú ý các từ khóa mang tính định nghĩa, nguyên tắc cơ bản để loại trừ nhanh các phương án gây nhiễu.<br><br>
<span class="text-2xs text-gray-400">💡 Thêm <code>GEMINI_API_KEY</code> trong .env để kết nối trực tiếp với Google Gemini AI.</span>`;
    }

    res.json({ success: true, isLiveAi: false, answer });
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
    const { examIds, duration_minutes, shuffle = true, deduplicate = false } = req.body;
    const maxQ = req.body.max_questions !== undefined ? req.body.max_questions : req.body.maxQuestions;
    const isDedup = deduplicate === true || deduplicate === 'true' || deduplicate === 'on';
    const isShuffle = shuffle !== false && shuffle !== 'false';

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
    if (isDedup) {
      const clean = str => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const seen = new Set();
      for (const q of rawQuestions) {
        const key = [clean(q.question_text), clean(q.option_a), clean(q.option_b), clean(q.option_c), clean(q.option_d)].join('|||');
        if (!seen.has(key)) {
          seen.add(key);
          finalQuestions.push(q);
        }
      }
    } else {
      finalQuestions = [...rawQuestions];
    }

    if (isShuffle) {
      for (let i = finalQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalQuestions[i], finalQuestions[j]] = [finalQuestions[j], finalQuestions[i]];
      }
    }

    if (maxQ && Number(maxQ) > 0 && Number(maxQ) < finalQuestions.length) {
      finalQuestions = finalQuestions.slice(0, Number(maxQ));
    }

    // Number sequentially
    finalQuestions = finalQuestions.map((q, idx) => ({
      ...q,
      display_number: idx + 1,
      question_number: idx + 1
    }));

    const duration = (duration_minutes !== undefined && !isNaN(Number(duration_minutes))) ? parseInt(duration_minutes, 10) : 45;
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
      shuffle = true,
      deduplicate = true
    } = req.body;
    const maxQ = req.body.max_questions !== undefined ? req.body.max_questions : req.body.maxQuestions;
    const isDedup = deduplicate !== false && deduplicate !== 'false';
    const isShuffle = shuffle !== false && shuffle !== 'false';

    if (!examIds || !Array.isArray(examIds) || examIds.length < 2) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn ít nhất 2 bộ đề để gộp' });
    }

    const placeholders = examIds.map(() => '?').join(',');
    const exams = await all(`SELECT id, title, category FROM exams WHERE id IN (${placeholders})`, examIds);
    if (!exams || exams.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy các đề thi đã chọn' });
    }

    let finalTitle = title && title.trim() ? title.trim() : '';
    if (!finalTitle) {
      finalTitle = exams.length === 2
        ? `Đề gộp: ${exams[0].title} + ${exams[1].title}`
        : `Đề thi tổng hợp (${exams.length} đề thi)`;
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
    if (isDedup) {
      const clean = str => (str || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const seen = new Set();
      for (const q of rawQuestions) {
        const key = [clean(q.question_text), clean(q.option_a), clean(q.option_b), clean(q.option_c), clean(q.option_d)].join('|||');
        if (!seen.has(key)) {
          seen.add(key);
          mergedQuestions.push(q);
        }
      }
    } else {
      mergedQuestions = [...rawQuestions];
    }

    if (isShuffle) {
      for (let i = mergedQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mergedQuestions[i], mergedQuestions[j]] = [mergedQuestions[j], mergedQuestions[i]];
      }
    }

    if (maxQ && Number(maxQ) > 0 && Number(maxQ) < mergedQuestions.length) {
      mergedQuestions = mergedQuestions.slice(0, Number(maxQ));
    }

    const finalCategory = category && category.trim() ? category.trim() : (exams[0].category || 'Tổng hợp');
    const finalDesc = description && description.trim() 
      ? description.trim() 
      : `Đề thi gộp từ ${exams.length} bộ đề (${exams.map(e => e.title).join(', ')})`;
    const finalDuration = (duration_minutes !== undefined && !isNaN(Number(duration_minutes))) ? parseInt(duration_minutes, 10) : 45;
    const finalBadge = badge_text && badge_text.trim() ? badge_text.trim() : 'Tổng hợp';

    // Insert new Exam
    const examRes = await run(
      `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
       VALUES (?, ?, ?, ?, ?)`,
      [finalTitle, finalCategory, finalDesc, finalDuration, finalBadge]
    );

    const newExamId = examRes.lastID;

    // Fast batch insertion with transaction support for SQLite
    if (!isPg) {
      await run('BEGIN TRANSACTION');
    }
    try {
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
      if (!isPg) {
        await run('COMMIT');
      }
    } catch (insertErr) {
      if (!isPg) {
        try { await run('ROLLBACK'); } catch (_) {}
      }
      throw insertErr;
    }

    res.json({
      success: true,
      message: `Đã gộp thành công ${exams.length} bộ đề thành đề mới với ${mergedQuestions.length} câu hỏi!`,
      data: {
        id: newExamId,
        title: finalTitle,
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
