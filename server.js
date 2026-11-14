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
// Tự động truy vấn nhẹ (SELECT 1) tới cơ sở dữ liệu để giữ Supabase / PostgreSQL không bị tạm dừng (Paused sau 7 ngày)
app.all(/^\/+health\/?$/i, async (req, res) => {
  try {
    await get('SELECT 1 as alive');
    res.status(200).send('OK (Server & Database Active)');
  } catch (err) {
    // Nếu DB đang trong quá trình resume hoặc có sự cố, vẫn trả về 200 để giữ Render luôn sống
    res.status(200).send(`OK (Server Active, DB Connecting: ${err.message})`);
  }
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

// --- Smart Question Deduplication Helpers ---
function normalizeExamText(text) {
  if (!text) return '';
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/^(câu\s*\d+|bài\s*\d+(\s*câu\s*\d+)?|\d+[\.:\)\/\-–])\s*/i, '')
    .replace(/^[\(\[]?[a-d][\)\]\.\:\-–\s]\s*/i, '')
    .replace(/[\.,;:!\?\"'“”‘’`\-_–—\(\)\[\]\{\}\/\\…]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNormalizedCorrectAnswer(q) {
  const ansLetter = (q.correct_answer || 'A').trim().toUpperCase();
  const key = `option_${ansLetter.toLowerCase()}`;
  return normalizeExamText(q[key]);
}

function getSortedNormalizedOptions(q) {
  return [
    normalizeExamText(q.option_a),
    normalizeExamText(q.option_b),
    normalizeExamText(q.option_c),
    normalizeExamText(q.option_d)
  ].filter(Boolean).sort().join('###');
}

function areQuestionsDuplicate(q1, q2) {
  const q1Text = normalizeExamText(q1.question_text);
  const q2Text = normalizeExamText(q2.question_text);

  if (q1Text !== q2Text) {
    const minLen = Math.min(q1Text.length, q2Text.length);
    if (minLen > 35 && Math.abs(q1Text.length - q2Text.length) <= 5) {
      if (!q1Text.startsWith(q2Text.slice(0, 35)) && !q2Text.startsWith(q1Text.slice(0, 35))) {
        return false;
      }
    } else {
      return false;
    }
  }

  // 1. If sorted normalized options match (regardless of A, B, C, D order)
  const opts1 = getSortedNormalizedOptions(q1);
  const opts2 = getSortedNormalizedOptions(q2);
  if (opts1 && opts2 && opts1 === opts2) {
    return true;
  }

  // 2. If correct answer texts match or have high word overlap
  const ans1 = getNormalizedCorrectAnswer(q1);
  const ans2 = getNormalizedCorrectAnswer(q2);
  if (ans1 && ans2) {
    if (ans1 === ans2) return true;

    const words1 = new Set(ans1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(ans2.split(' ').filter(w => w.length > 2));
    if (words1.size > 0 && words2.size > 0) {
      let common = 0;
      for (const w of words1) {
        if (words2.has(w)) common++;
      }
      const overlap = (2 * common) / (words1.size + words2.size);
      if (overlap >= 0.8) return true;
    }
  }

  return false;
}

function deduplicateExamQuestions(questions) {
  const result = [];
  const buckets = new Map();

  for (const q of questions) {
    const normQ = normalizeExamText(q.question_text);
    const bucketKey = normQ.slice(0, 40);
    const candidates = buckets.get(bucketKey) || [];

    const isDup = candidates.some(existing => areQuestionsDuplicate(existing, q));
    if (!isDup) {
      result.push(q);
      candidates.push(q);
      buckets.set(bucketKey, candidates);
    }
  }

  return result;
}

/**
 * Truly Balanced & Fair Stratified Random Sampling
 * When combining multiple exams and picking N questions:
 * 1. Shuffles questions within each exam using cryptographic randomness (crypto.randomInt)
 * 2. Fairly distributes quota across all selected exams so EVERY exam is represented
 * 3. Handles deficits (if an exam has fewer questions than quota, takes all and reallocates remainder)
 * 4. Multi-pass shuffles the final combined questions so questions from different exams are completely intermingled
 */
function secureRandomInt(min, max) {
  try {
    return crypto.randomInt(min, max);
  } catch (_) {
    return Math.floor(Math.random() * (max - min)) + min;
  }
}

function secureShuffleArray(array) {
  if (!array || array.length <= 1) return [...(array || [])];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Smart Question Options Shuffler (A, B, C, D)
 * Randomizes the 4 option choices while:
 * 1. Automatically tracking and updating correct_answer to the new option letter
 * 2. Preserving interdependent options (e.g. keeping 'Tất cả các phương án trên' / 'Cả 3 phương án trên' at the end)
 * 3. Keeping questions with explicit letter references ('Cả A và B', 'Phương án A và C') intact so logical meaning is not broken
 * 4. Cleaning accidental letter prefixes (e.g. 'A. ', 'b) ') so display remains pristine
 */
function shuffleQuestionOptionsServer(q) {
  if (!q) return q;

  const rawOpts = [
    { key: 'A', text: q.option_a },
    { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c },
    { key: 'D', text: q.option_d }
  ].filter(o => o.text && typeof o.text === 'string' && o.text.trim());

  if (rawOpts.length <= 1) return { ...q };

  const cleanedOpts = rawOpts.map(o => ({
    key: o.key,
    text: (o.text || '').replace(/^[A-Da-d][\.\)\:\-]\s*/, '').trim()
  }));

  // Preserve questions that explicitly reference letters like 'Cả A và B', 'Phương án B và C'
  const letterRefRegex = /(cả|phương án|đáp án)\s+([A-D]\s*(và|,|&)\s*)+[A-D]\b/i;
  const hasLetterRef = cleanedOpts.some(o => letterRefRegex.test(o.text));
  if (hasLetterRef) {
    return { ...q, is_options_shuffled: false };
  }

  const origCorrectKey = (q.original_correct_answer || q.correct_answer || 'A').trim().toUpperCase();
  const correctOpt = cleanedOpts.find(o => o.key.toUpperCase() === origCorrectKey);
  const correctText = correctOpt ? correctOpt.text : cleanedOpts[0].text;

  // If the last option is 'Tất cả...', 'Cả 3...', keep it at the end and shuffle preceding options
  const allAboveRegex = /(tất cả|cả 3|cả ba|cả 4|cả bốn)\s+(phương án|đáp án|yếu tố|câu|trên)/i;
  const lastOpt = cleanedOpts[cleanedOpts.length - 1];
  const isLastAllAbove = allAboveRegex.test(lastOpt.text);

  let poolToShuffle;
  let fixedEnd = null;

  if (isLastAllAbove && cleanedOpts.length >= 3) {
    poolToShuffle = cleanedOpts.slice(0, cleanedOpts.length - 1);
    fixedEnd = lastOpt;
  } else {
    poolToShuffle = [...cleanedOpts];
  }

  const shuffledPool = secureShuffleArray(poolToShuffle);
  if (fixedEnd) {
    shuffledPool.push(fixedEnd);
  }

  const letters = ['A', 'B', 'C', 'D'];
  const newQ = { ...q, is_options_shuffled: true, original_correct_answer: origCorrectKey };
  let newCorrectAnswer = origCorrectKey;

  shuffledPool.forEach((opt, idx) => {
    const letter = letters[idx];
    newQ['option_' + letter.toLowerCase()] = opt.text;
    if (opt.text === correctText) {
      newCorrectAnswer = letter;
    }
  });

  newQ.correct_answer = newCorrectAnswer;

  if (newQ.explanation && origCorrectKey !== newCorrectAnswer) {
    newQ.explanation = newQ.explanation.replace(
      new RegExp('(phương án đúng là|đáp án đúng là|đáp án là|chọn)\\s+' + origCorrectKey + '\\b', 'gi'),
      `$1 ${newCorrectAnswer}`
    );
  }

  return newQ;
}

function sampleBalancedQuestions(questions, maxQuestions, shuffleQuestions = true) {
  if (!questions || questions.length === 0) return [];
  
  const totalCount = questions.length;
  const targetCount = (maxQuestions && Number(maxQuestions) > 0 && Number(maxQuestions) < totalCount)
    ? Number(maxQuestions)
    : totalCount;

  // Group questions by exam_id
  const examGroups = new Map();
  for (const q of questions) {
    const eid = q.exam_id !== undefined ? String(q.exam_id) : 'default';
    if (!examGroups.has(eid)) examGroups.set(eid, []);
    examGroups.get(eid).push(q);
  }

  const examIds = Array.from(examGroups.keys());
  const numExams = examIds.length;

  // If only 1 exam, simply shuffle and slice
  if (numExams <= 1) {
    const list = shuffleQuestions ? secureShuffleArray(questions) : [...questions];
    return list.slice(0, targetCount);
  }

  // Shuffle questions inside each individual exam pool first
  for (const eid of examIds) {
    examGroups.set(eid, secureShuffleArray(examGroups.get(eid)));
  }

  // Fair Stratified Quota Allocation: guarantees all selected exams are represented proportionally
  const quotas = new Map();
  let remainingSlots = targetCount;
  const availableExams = new Set(examIds);

  while (remainingSlots > 0 && availableExams.size > 0) {
    const share = Math.max(1, Math.floor(remainingSlots / availableExams.size));
    let allocatedThisRound = 0;

    // Shuffle exam order each round to ensure fair distribution of remainders
    const roundExams = secureShuffleArray(Array.from(availableExams));

    for (const eid of roundExams) {
      const pool = examGroups.get(eid);
      const currentQuota = quotas.get(eid) || 0;
      const canTake = Math.min(pool.length - currentQuota, share, remainingSlots);

      if (canTake > 0) {
        quotas.set(eid, currentQuota + canTake);
        remainingSlots -= canTake;
        allocatedThisRound += canTake;
      }

      if ((quotas.get(eid) || 0) >= pool.length || remainingSlots === 0) {
        availableExams.delete(eid);
      }
      if (remainingSlots === 0) break;
    }

    if (allocatedThisRound === 0) break;
  }

  // Collect sampled questions from each exam
  const sampled = [];
  for (const eid of examIds) {
    const count = quotas.get(eid) || 0;
    const pool = examGroups.get(eid);
    sampled.push(...pool.slice(0, count));
  }

  // Thoroughly multi-pass shuffle and interleave the final selected pool
  if (shuffleQuestions) {
    return secureShuffleArray(secureShuffleArray(sampled));
  }
  return sampled;
}

// 3.5 Combine multiple exams on-the-fly for practice / test (Public)
app.post('/api/exams/combine', async (req, res) => {
  try {
    const { examIds, duration_minutes, shuffle = false, deduplicate = true } = req.body;
    const maxQ = req.body.max_questions !== undefined ? req.body.max_questions : req.body.maxQuestions;
    const isDedup = deduplicate !== false && deduplicate !== 'false' && deduplicate !== 0 && deduplicate !== '0';
    const isShuffle = shuffle === true || shuffle === 'true' || shuffle === 1 || shuffle === '1';
    const isShuffleOptions = req.body.shuffle_options === true || req.body.shuffleOptions === true;

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

    let finalQuestions = isDedup ? deduplicateExamQuestions(rawQuestions) : [...rawQuestions];

    // High quality balanced random sampling across all selected exams
    finalQuestions = sampleBalancedQuestions(finalQuestions, maxQ, isShuffle);

    // Shuffle options for each question if requested
    if (isShuffleOptions) {
      finalQuestions = finalQuestions.map(q => shuffleQuestionOptionsServer(q));
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

    const removedDupsCount = rawQuestions.length - finalQuestions.length;
    const msg = (isDedup && removedDupsCount > 0)
      ? `Đã gộp thành công ${exams.length} bộ đề (${finalQuestions.length} câu hỏi, đã tự động lọc ${removedDupsCount} câu trùng lặp)!`
      : `Đã gộp thành công ${exams.length} bộ đề (${finalQuestions.length} câu hỏi)!`;

    res.json({
      success: true,
      message: msg,
      data: {
        id: 'combined',
        isVirtual: true,
        title: combinedTitle,
        category: exams[0].category || 'Tổng hợp',
        description: `Bộ đề tổng hợp từ ${exams.length} đề thi: ${exams.map(e => e.title).join(', ')}`,
        duration_minutes: duration,
        question_count: finalQuestions.length,
        removed_duplicates_count: removedDupsCount,
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

    const clientQuestionsMap = new Map();
    if (Array.isArray(questionsList)) {
      questionsList.forEach(cq => {
        if (cq && (cq.id || cq.question_number)) {
          if (cq.id) clientQuestionsMap.set(String(cq.id), cq);
          if (cq.question_number) clientQuestionsMap.set('qn_' + cq.question_number, cq);
        }
      });
    }

    questions.forEach((q) => {
      const clientQ = clientQuestionsMap.get(String(q.id)) || clientQuestionsMap.get('qn_' + q.question_number);
      const studentAns = userAnswers[q.id] || userAnswers[String(q.id)] || userAnswers[q.question_number];
      const isAnswered = Boolean(studentAns);

      let isCorrect = false;
      let effectiveCorrectAnswer = q.correct_answer;

      if (isAnswered) {
        if (clientQ && clientQ.is_options_shuffled) {
          // If options were shuffled on client, match chosen option text with DB correct option text
          const dbCorrectText = normalizeExamText(q[`option_${(q.correct_answer || 'A').toLowerCase()}`]);
          const chosenOptKey = `option_${studentAns.toLowerCase()}`;
          const clientChosenText = normalizeExamText(clientQ[chosenOptKey]);

          isCorrect = Boolean(clientChosenText && dbCorrectText && clientChosenText === dbCorrectText);
          effectiveCorrectAnswer = clientQ.correct_answer || q.correct_answer;
        } else {
          isCorrect = studentAns.toUpperCase() === (q.correct_answer || 'A').toUpperCase();
        }
      }

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
        correctAnswer: effectiveCorrectAnswer,
        isCorrect,
        isAnswered,
        explanation: (clientQ && clientQ.explanation) || q.explanation || 'Không có giải thích chi tiết.'
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

    let mergedQuestions = isDedup ? deduplicateExamQuestions(rawQuestions) : [...rawQuestions];
    const removedDupsCount = rawQuestions.length - mergedQuestions.length;

    // High quality balanced random sampling across all selected exams
    mergedQuestions = sampleBalancedQuestions(mergedQuestions, maxQ, isShuffle);

    const isShuffleOptions = req.body.shuffle_options === true || req.body.shuffleOptions === true;
    if (isShuffleOptions) {
      mergedQuestions = mergedQuestions.map(q => shuffleQuestionOptionsServer(q));
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

    const msg = (isDedup && removedDupsCount > 0)
      ? `Đã gộp thành công ${exams.length} bộ đề thành đề mới với ${mergedQuestions.length} câu hỏi (đã tự động lọc ${removedDupsCount} câu trùng lặp)!`
      : `Đã gộp thành công ${exams.length} bộ đề thành đề mới với ${mergedQuestions.length} câu hỏi!`;

    res.json({
      success: true,
      message: msg,
      data: {
        id: newExamId,
        title: finalTitle,
        question_count: mergedQuestions.length,
        removed_duplicates_count: removedDupsCount,
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
