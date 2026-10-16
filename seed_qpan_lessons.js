const fs = require('fs');
const { run, get, all } = require('./db');

async function seedQpanLessons() {
  console.log('Reading hp1_parsed_questions.json...');
  const questions = JSON.parse(fs.readFileSync('hp1_parsed_questions.json', 'utf-8'));
  console.log('Total questions loaded:', questions.length);

  // Group questions by lesson
  const bai1 = questions.filter(q => q.question_number >= 1 && q.question_number <= 20);
  const bai2 = questions.filter(q => (q.question_number >= 21 && q.question_number <= 40) || (q.question_number >= 163 && q.question_number <= 182));
  const bai3 = questions.filter(q => q.question_number >= 41 && q.question_number <= 60);
  const bai4 = questions.filter(q => (q.question_number >= 61 && q.question_number <= 80) || (q.question_number >= 142 && q.question_number <= 162));
  const bai5 = questions.filter(q => (q.question_number >= 81 && q.question_number <= 100) || q.question_number === 166);
  const bai6 = questions.filter(q => q.question_number >= 101 && q.question_number <= 120);
  const bai7 = questions.filter(q => q.question_number >= 121 && q.question_number <= 141);
  const bai8 = questions.filter(q => q.question_number >= 183 && q.question_number <= 216);

  console.log(`Group counts:
  Bài 1: ${bai1.length} câu
  Bài 2: ${bai2.length} câu
  Bài 3: ${bai3.length} câu
  Bài 4: ${bai4.length} câu
  Bài 5: ${bai5.length} câu
  Bài 6: ${bai6.length} câu
  Bài 7: ${bai7.length} câu
  Bài 8: ${bai8.length} câu
  Full:  ${questions.length} câu`);

  // Remove old partial QPAN exam if exists (id: 13 or title like '%Câu hỏi trắc nghiệm HP1%')
  const oldExam = await get(`SELECT id FROM exams WHERE id = 13 OR title LIKE '%Câu hỏi trắc nghiệm HP1%'`);
  if (oldExam) {
    console.log('Removing old partial exam ID:', oldExam.id);
    await run('DELETE FROM questions WHERE exam_id = ?', [oldExam.id]);
    await run('DELETE FROM submissions WHERE exam_id = ?', [oldExam.id]);
    await run('DELETE FROM exams WHERE id = ?', [oldExam.id]);
  }

  // Remove any previously created QPAN Bài exams to allow clean re-seeding
  const existingQpan = await all(`SELECT id FROM exams WHERE category = 'Quốc phòng An ninh'`);
  for (const ex of existingQpan) {
    await run('DELETE FROM questions WHERE exam_id = ?', [ex.id]);
    await run('DELETE FROM submissions WHERE exam_id = ?', [ex.id]);
    await run('DELETE FROM exams WHERE id = ?', [ex.id]);
  }

  const examDefinitions = [
    {
      title: 'QPAN HP1 - Bài 1: Quan điểm của CN Mác-Lênin, tư tưởng Hồ Chí Minh về chiến tranh, quân đội và bảo vệ Tổ quốc',
      category: 'Quốc phòng An ninh',
      description: 'Nguồn gốc, bản chất chiến tranh, bản chất quân đội nhân dân và quan điểm bảo vệ Tổ quốc XHCN theo chủ nghĩa Mác - Lênin và tư tưởng Hồ Chí Minh.',
      duration: 25,
      badge: 'QPAN Bài 1',
      questions: bai1
    },
    {
      title: 'QPAN HP1 - Bài 2: Xây dựng nền quốc phòng toàn dân, an ninh nhân dân',
      category: 'Quốc phòng An ninh',
      description: 'Mục đích, đặc trưng, nội dung xây dựng tiềm lực chính trị - tinh thần, tiềm lực kinh tế, tiềm lực quân sự và thế trận QPTD gắn với ANND.',
      duration: 45,
      badge: 'QPAN Bài 2',
      questions: bai2
    },
    {
      title: 'QPAN HP1 - Bài 3: Chiến tranh nhân dân bảo vệ Tổ quốc Việt Nam XHCN',
      category: 'Quốc phòng An ninh',
      description: 'Mục đích, tính chất, đặc điểm, đối tượng tác chiến và quan điểm toàn dân đánh giặc, tiến hành chiến tranh toàn diện bảo vệ Tổ quốc.',
      duration: 25,
      badge: 'QPAN Bài 3',
      questions: bai3
    },
    {
      title: 'QPAN HP1 - Bài 4: Xây dựng lực lượng vũ trang nhân dân Việt Nam',
      category: 'Quốc phòng An ninh',
      description: 'Đặc điểm, quan điểm, nguyên tắc lãnh đạo của Đảng đối với LLVTND; xây dựng Quân đội, Công an, Dân quân tự vệ và Lực lượng Dự bị động viên.',
      duration: 45,
      badge: 'QPAN Bài 4',
      questions: bai4
    },
    {
      title: 'QPAN HP1 - Bài 5: Kết hợp phát triển kinh tế - xã hội với tăng cường củng cố QP - AN',
      category: 'Quốc phòng An ninh',
      description: 'Bản chất, mối quan hệ biện chứng và nội dung kết hợp KT-XH với QP-AN trong chiến lược phát triển, các vùng kinh tế trọng điểm, biển đảo và biên giới.',
      duration: 25,
      badge: 'QPAN Bài 5',
      questions: bai5
    },
    {
      title: 'QPAN HP1 - Bài 6: Những vấn đề cơ bản về lịch sử nghệ thuật quân sự Việt Nam',
      category: 'Quốc phòng An ninh',
      description: 'Truyền thống đánh giặc của tổ tiên qua các triều đại Lý, Trần, Lê Lợi - Nguyễn Trãi, Quang Trung và nghệ thuật quân sự từ khi có Đảng lãnh đạo.',
      duration: 25,
      badge: 'QPAN Bài 6',
      questions: bai6
    },
    {
      title: 'QPAN HP1 - Bài 7: Xây dựng và bảo vệ chủ quyền lãnh thổ, biên giới quốc gia',
      category: 'Quốc phòng An ninh',
      description: 'Chiến lược bảo vệ Tổ quốc, Luật Biển Việt Nam 2012, các vùng biển đảo, biên giới quốc gia trên đất liền, trên biển, trên không và Ngày biên phòng toàn dân.',
      duration: 25,
      badge: 'QPAN Bài 7',
      questions: bai7
    },
    {
      title: 'QPAN HP1 - Bài 8: Bảo vệ an ninh quốc gia và giữ gìn trật tự, an toàn xã hội',
      category: 'Quốc phòng An ninh',
      description: 'Khái niệm, nội dung, biện pháp bảo vệ an ninh quốc gia, trật tự an toàn xã hội; trách nhiệm của Đảng, Nhà nước, LLVT, công dân và học sinh.',
      duration: 35,
      badge: 'QPAN Bài 8',
      questions: bai8
    },
    {
      title: 'QPAN HP1 - Ngân hàng câu hỏi Tổng hợp (Full 211 câu)',
      category: 'Quốc phòng An ninh',
      description: 'Tổng hợp toàn bộ 211 câu hỏi trắc nghiệm Học phần 1 QPAN (Đường lối quốc phòng và an ninh của Đảng) phục vụ ôn tập toàn diện trước kỳ thi kết thúc học phần.',
      duration: 60,
      badge: 'QPAN Full',
      questions: questions
    }
  ];

  for (const def of examDefinitions) {
    const res = await run(
      `INSERT INTO exams (title, category, description, duration_minutes, badge_text)
       VALUES (?, ?, ?, ?, ?)`,
      [def.title, def.category, def.description, def.duration, def.badge]
    );
    const examId = res.lastID;
    console.log(`Created exam ID ${examId}: "${def.title}" (${def.questions.length} questions)`);

    for (let i = 0; i < def.questions.length; i++) {
      const q = def.questions[i];
      const correctOpt = q.correct_answer;
      const correctText = q[`option_${correctOpt.toLowerCase()}`] || '';
      const exp = q.explanation || `Theo giáo trình Giáo dục Quốc phòng và An ninh (Học phần 1), phương án đúng là ${correctOpt}: "${correctText}".`;

      await run(
        `INSERT INTO questions (exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          examId,
          i + 1,
          q.question_text,
          q.option_a,
          q.option_b,
          q.option_c,
          q.option_d,
          correctOpt,
          exp
        ]
      );
    }
  }

  console.log('\nAll QPAN lesson exams seeded successfully into uniprep.db!');
}

seedQpanLessons().catch(console.error);

