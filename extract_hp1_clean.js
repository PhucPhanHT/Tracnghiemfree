const mammoth = require('mammoth');
const fs = require('fs');

async function extractHp1() {
  const buffer = fs.readFileSync('D:\\Project\\Tracnghiemfree\\CAU_HOI_TRAC_NGHIEM_HP1_DANH_SO_CAU.docx');
  const result = await mammoth.extractRawText({ buffer });
  let rawText = result.value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Fix typo in question 159/160
  rawText = rawText.replace(/Câu 160\.\s*\(quận, thị xã, thành phố thuộc tỉnh\)/g, '(quận, thị xã, thành phố thuộc tỉnh)');

  // Merge situation 138 into question 139
  rawText = rawText.replace(/Câu 138\.\s*(Tình huống:[^\n]+)\s*\n+\s*Câu 139\.\s*/i, 'Câu 139. $1 ');

  // Fix inline option B in question 169
  rawText = rawText.replace(/nhiêm vụ chiến lược\s+B,\s+/i, 'nhiệm vụ chiến lược\nB, ');

  const lines = rawText.split('\n');
  const questions = [];
  let currentQ = null;

  function commitCurrent() {
    if (currentQ) {
      currentQ.question_text = (currentQ.question_text || '').replace(/\s+/g, ' ').trim();
      currentQ.option_a = (currentQ.option_a || '').replace(/\s+/g, ' ').trim();
      currentQ.option_b = (currentQ.option_b || '').replace(/\s+/g, ' ').trim();
      currentQ.option_c = (currentQ.option_c || '').replace(/\s+/g, ' ').trim();
      currentQ.option_d = (currentQ.option_d || '').replace(/\s+/g, ' ').trim();
      currentQ.correct_answer = (currentQ.correct_answer || 'A').toUpperCase();
      currentQ.explanation = (currentQ.explanation || '').trim();

      if (currentQ.question_text && currentQ.option_a) {
        questions.push(currentQ);
      }
      currentQ = null;
    }
  }

  const qRegex = /^câu\s*(\d+)[\.:\s\-–—]\s*(.*)$/i;
  const optARegex = /^[(\[]?[A|a][)\]\.,:\s-]\s*(.*)$/;
  const optBRegex = /^[(\[]?[B|b][)\]\.,:\s-]\s*(.*)$/;
  const optCRegex = /^[(\[]?[C|c][)\]\.,:\s-]\s*(.*)$/;
  const optDRegex = /^[(\[]?[D|d][)\]\.,:\s-]\s*(.*)$/;
  const ansRegex = /^(?:đáp\s*án|key|đ\/a|ans)\s*[:\.\s\-–—]*([A-D])/i;

  let currentField = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    let line = rawLine.trim();
    if (!line) continue;

    const inlineOptMatch = line.match(/^([A-D][\.,\)]\s*.*?)(?:\s{2,}|\.\s+)([B-D][\.,\)]\s*.*)$/i);
    if (inlineOptMatch) {
      lines.splice(i, 1, inlineOptMatch[1], inlineOptMatch[2]);
      line = lines[i].trim();
    }

    const qMatch = line.match(qRegex);
    if (qMatch) {
      commitCurrent();
      currentQ = {
        question_number: parseInt(qMatch[1], 10),
        question_text: qMatch[2] || '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_answer: 'A',
        explanation: ''
      };
      currentField = 'question';
      continue;
    }

    if (!currentQ) continue;

    const ansMatch = line.match(ansRegex);
    if (ansMatch) {
      currentQ.correct_answer = ansMatch[1].toUpperCase();
      currentField = 'answer';
      continue;
    }

    const aMatch = line.match(optARegex);
    if (aMatch) {
      currentQ.option_a = aMatch[1];
      currentField = 'a';
      continue;
    }

    const bMatch = line.match(optBRegex);
    if (bMatch) {
      currentQ.option_b = bMatch[1];
      currentField = 'b';
      continue;
    }

    const cMatch = line.match(optCRegex);
    if (cMatch) {
      currentQ.option_c = cMatch[1];
      currentField = 'c';
      continue;
    }

    const dMatch = line.match(optDRegex);
    if (dMatch) {
      currentQ.option_d = dMatch[1];
      currentField = 'd';
      continue;
    }

    if (currentField === 'question') {
      currentQ.question_text += ' ' + line;
    } else if (currentField === 'a') {
      currentQ.option_a += ' ' + line;
    } else if (currentField === 'b') {
      currentQ.option_b += ' ' + line;
    } else if (currentField === 'c') {
      currentQ.option_c += ' ' + line;
    } else if (currentField === 'd') {
      currentQ.option_d += ' ' + line;
    }
  }
  commitCurrent();

  console.log('Total extracted questions:', questions.length);
  const incomplete = questions.filter(q => !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_answer);
  console.log('Incomplete count:', incomplete.length);
  if (incomplete.length > 0) {
    incomplete.forEach(q => console.log('Incomplete question #' + q.question_number, q));
  }

  fs.writeFileSync('hp1_parsed_questions.json', JSON.stringify(questions, null, 2), 'utf-8');
  console.log('Saved all questions to hp1_parsed_questions.json');
}

extractHp1().catch(console.error);

