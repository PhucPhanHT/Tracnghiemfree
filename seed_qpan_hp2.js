const fs = require('fs');
const { run, get, all } = require('./db');

async function seedQpanHp2() {
  console.log('Reading hp2_parsed_questions.json...');
  const questions = JSON.parse(fs.readFileSync('hp2_parsed_questions.json', 'utf-8'));
  console.log('Total questions loaded:', questions.length);

  // Group questions by lesson (each lesson has exactly 30 questions)
  const bai1 = questions.filter(q => q.question_number >= 1 && q.question_number <= 30);
  const bai2 = questions.filter(q => q.question_number >= 31 && q.question_number <= 60);
  const bai3 = questions.filter(q => q.question_number >= 61 && q.question_number <= 97);
  const bai4 = questions.filter(q => q.question_number >= 98 && q.question_number <= 129);
  const bai5 = questions.filter(q => q.question_number >= 130 && q.question_number <= 159);
  const bai6 = questions.filter(q => q.question_number >= 160 && q.question_number <= 189);
  const bai7 = questions.filter(q => q.question_number >= 190 && q.question_number <= 219);

  console.log(`Group counts for HP2:
  Bài 1: ${bai1.length} câu
  Bài 2: ${bai2.length} câu
  Bài 3: ${bai3.length} câu
  Bài 4: ${bai4.length} câu
  Bài 5: ${bai5.length} câu
  Bài 6: ${bai6.length} câu
  Bài 7: ${bai7.length} câu
  Full:  ${questions.length} câu`);

  // Remove any previously created QPAN HP2 exams to ensure idempotency without touching HP1
  const existingHp2 = await all(`SELECT id FROM exams WHERE title LIKE '%QPAN HP2%'`);
  for (const ex of existingHp2) {
    console.log(`Cleaning up old HP2 exam ID ${ex.id}...`);
    await run('DELETE FROM questions WHERE exam_id = ?', [ex.id]);
    await run('DELETE FROM submissions WHERE exam_id = ?', [ex.id]);
    await run('DELETE FROM exams WHERE id = ?', [ex.id]);
  }

  const examDefinitions = [
    {
      title: 'QPAN HP2 - Bài 1: Phòng, chống chiến lược "Diễn biến hòa bình", bạo loạn lật đổ của các thế lực thù địch',
      category: 'Quốc phòng An ninh',
      description: 'Khái niệm, âm mưu, thủ đoạn của chiến lược "Diễn biến hòa bình", bạo loạn lật đổ và các giải pháp phòng ngừa, đấu tranh làm thất bại chiến lược của các thế lực thù địch.',
      duration: 30,
      badge: 'QPAN HP2 Bài 1',
      questions: bai1
    },
    {
      title: 'QPAN HP2 - Bài 2: Một số nội dung cơ bản về dân tộc, tôn giáo và đấu tranh phòng chống địch lợi dụng vấn đề dân tộc, tôn giáo',
      category: 'Quốc phòng An ninh',
      description: 'Quan điểm của Đảng về chính sách dân tộc, tôn giáo; âm mưu, thủ đoạn kích động, chia rẽ khối đại đoàn kết toàn dân tộc và giải pháp đấu tranh phòng chống.',
      duration: 30,
      badge: 'QPAN HP2 Bài 2',
      questions: bai2
    },
    {
      title: 'QPAN HP2 - Bài 3: Phòng, chống vi phạm pháp luật về bảo vệ môi trường',
      category: 'Quốc phòng An ninh',
      description: 'Vai trò của pháp luật trong bảo vệ môi trường, các dạng hành vi vi phạm pháp luật môi trường, biện pháp phòng chống và trách nhiệm của sinh viên.',
      duration: 30,
      badge: 'QPAN HP2 Bài 3',
      questions: bai3
    },
    {
      title: 'QPAN HP2 - Bài 4: Phòng, chống vi phạm pháp luật về bảo đảm trật tự, an toàn giao thông',
      category: 'Quốc phòng An ninh',
      description: 'Quy định pháp luật về trật tự ATGT đường bộ, đường sắt, đường thủy; dấu hiệu pháp lý của tội phạm và vi phạm hành chính về giao thông; giải pháp phòng chống trong học đường.',
      duration: 30,
      badge: 'QPAN HP2 Bài 4',
      questions: bai4
    },
    {
      title: 'QPAN HP2 - Bài 5: Phòng, chống một số loại tội phạm xâm hại danh dự, nhân phẩm của người khác',
      category: 'Quốc phòng An ninh',
      description: 'Khái niệm danh dự, nhân phẩm; các dấu hiệu cấu thành tội phạm xâm phạm nhân phẩm, danh dự theo Bộ luật Hình sự; các biện pháp phòng ngừa xã hội và kỹ năng tự bảo vệ.',
      duration: 30,
      badge: 'QPAN HP2 Bài 5',
      questions: bai5
    },
    {
      title: 'QPAN HP2 - Bài 6: An toàn thông tin và phòng, chống vi phạm pháp luật trên không gian mạng',
      category: 'Quốc phòng An ninh',
      description: 'Luật An ninh mạng; nhận diện tấn công mạng, khủng bố mạng, gián điệp mạng; các quy định về hệ thống thông tin quan trọng về ANQG và trách nhiệm của công dân.',
      duration: 30,
      badge: 'QPAN HP2 Bài 6',
      questions: bai6
    },
    {
      title: 'QPAN HP2 - Bài 7: An ninh phi truyền thống và ứng phó các mối đe dọa an ninh phi truyền thống ở Việt Nam',
      category: 'Quốc phòng An ninh',
      description: 'Đặc điểm, nội dung các mối đe dọa an ninh phi truyền thống (biến đổi khí hậu, an ninh năng lượng, dịch bệnh, an ninh mạng, tội phạm xuyên quốc gia) và phương thức ứng phó.',
      duration: 30,
      badge: 'QPAN HP2 Bài 7',
      questions: bai7
    },
    {
      title: 'QPAN HP2 - Ngân hàng câu hỏi Tổng hợp (Full 210 câu)',
      category: 'Quốc phòng An ninh',
      description: 'Trọn bộ 210 câu hỏi trắc nghiệm ôn tập toàn diện Học phần 2 Giáo dục Quốc phòng và An ninh (Công tác quốc phòng và an ninh) có đáp án và giải thích chi tiết.',
      duration: 60,
      badge: 'QPAN HP2 Full',
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
      const exp = q.explanation || `Theo giáo trình Giáo dục Quốc phòng và An ninh (Học phần 2 - Công tác quốc phòng và an ninh), phương án đúng là ${correctOpt}: "${correctText}".`;

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

  console.log('Seeding QPAN HP2 completed successfully!');
}

seedQpanHp2().catch(console.error);

