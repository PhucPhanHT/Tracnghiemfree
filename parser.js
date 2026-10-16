/**
 * Robust Smart Exam Parser for Vietnamese Exam Formats
 * Parses text copied from Word, PDF, Google Docs, Web into structured questions.
 * Supports both accented and unaccented Vietnamese, asterisk-marked answers (*A, A*),
 * and various option/explanation formats.
 */

function parseExamText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  // Normalize line endings
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');

  const questions = [];
  let currentQ = null;
  let currentField = null; // 'question', 'a', 'b', 'c', 'd', 'explanation'

  // Regex patterns
  // Matches "Câu 1:", "Cau 1:", "Câu 1.", "Câu 1 -", "1.", "1/", "1:"
  const questionRegex = /^(?:c[âa]u\s*(\d+)[\s.:\-–—]|(\d+)[\s.:\)\/–—])\s*(.*)$/i;

  // Matches "A.", "A,", "A)", "[A]", "a.", "a,", "a)", "*A.", "A*."
  const optARegex = /^[*]?\s*[(\[]?[A|a][*]?\s*[)\]\.,:\s-]\s*(.*)$/;
  const optBRegex = /^[*]?\s*[(\[]?[B|b][*]?\s*[)\]\.,:\s-]\s*(.*)$/;
  const optCRegex = /^[*]?\s*[(\[]?[C|c][*]?\s*[)\]\.,:\s-]\s*(.*)$/;
  const optDRegex = /^[*]?\s*[(\[]?[D|d][*]?\s*[)\]\.,:\s-]\s*(.*)$/;

  // Check if line marks option with an asterisk (*A or A*)
  const markedOptRegex = /^\s*[*]\s*[(\[]?([A-D])[)\]\.,:\s-]|^\s*[(\[]?([A-D])\s*[*][)\]\.,:\s-]/i;

  // Matches "Đáp án: A", "Dap an: A", "Đ/a: B", "Key: C", "Đáp án đúng: D"
  const answerRegex = /^(?:đ[áa]p\s*[áa]n(?:\s*đ[úu]ng)?|[đd]\/a|key|ch[ọo]n|ans|answer)\s*[:=\-–]?\s*([A-D])/i;

  // Matches "Giải thích:", "Giai thich:", "Lời giải:", "Loi giai:", "HD:", "HDG:"
  const explanationRegex = /^(?:gi[ảa]i\s*th[íi]ch|l[ờo]i\s*gi[ảa]i|h[ưu][ớo]ng\s*d[ẫa]n(?:\s*gi[ảa]i)?|hdg?|explanation)\s*[:=\-–]?\s*(.*)$/i;

  function commitCurrent() {
    if (currentQ) {
      // Clean up fields
      currentQ.question_text = (currentQ.question_text || '').trim();
      currentQ.option_a = (currentQ.option_a || '').trim();
      currentQ.option_b = (currentQ.option_b || '').trim();
      currentQ.option_c = (currentQ.option_c || '').trim();
      currentQ.option_d = (currentQ.option_d || '').trim();
      currentQ.explanation = (currentQ.explanation || '').trim();
      currentQ.correct_answer = (currentQ.correct_answer || 'A').toUpperCase();

      if (currentQ.question_text && (currentQ.option_a || currentQ.option_b)) {
        questions.push(currentQ);
      }
      currentQ = null;
      currentField = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line) continue;

    // Check if new question starts
    const qMatch = line.match(questionRegex);
    const isOptionStart = optARegex.test(line) || optBRegex.test(line) || optCRegex.test(line) || optDRegex.test(line);

    if (qMatch && !isOptionStart) {
      commitCurrent();
      const qNum = parseInt(qMatch[1] || qMatch[2] || (questions.length + 1), 10);
      currentQ = {
        question_number: qNum,
        question_text: qMatch[3] || '',
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

    if (!currentQ) {
      currentQ = {
        question_number: questions.length + 1,
        question_text: line,
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

    // Check Answer
    const ansMatch = line.match(answerRegex);
    if (ansMatch) {
      currentQ.correct_answer = ansMatch[1].toUpperCase();
      continue;
    }

    // Check Explanation
    const expMatch = line.match(explanationRegex);
    if (expMatch) {
      currentQ.explanation = expMatch[1] || '';
      currentField = 'explanation';
      continue;
    }

    // Check if option line has an asterisk marking it correct
    const markedMatch = line.match(markedOptRegex);
    if (markedMatch) {
      currentQ.correct_answer = (markedMatch[1] || markedMatch[2]).toUpperCase();
    }

    // Check Option A
    const aMatch = line.match(optARegex);
    if (aMatch) {
      currentQ.option_a = aMatch[1];
      currentField = 'a';
      continue;
    }

    // Check Option B
    const bMatch = line.match(optBRegex);
    if (bMatch) {
      currentQ.option_b = bMatch[1];
      currentField = 'b';
      continue;
    }

    // Check Option C
    const cMatch = line.match(optCRegex);
    if (cMatch) {
      currentQ.option_c = cMatch[1];
      currentField = 'c';
      continue;
    }

    // Check Option D
    const dMatch = line.match(optDRegex);
    if (dMatch) {
      currentQ.option_d = dMatch[1];
      currentField = 'd';
      continue;
    }

    // Continuation of current field
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
    } else if (currentField === 'explanation') {
      currentQ.explanation += ' ' + line;
    }
  }

  commitCurrent();

  // Renumber sequentially
  questions.forEach((q, idx) => {
    q.question_number = idx + 1;
  });

  return questions;
}

module.exports = { parseExamText };

