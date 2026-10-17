/**
 * UniPrep Exam Runner Engine
 * Handles test-taking, practice mode, countdown, question palette, and result modal.
 * Features:
 * - Instant right/wrong feedback & rich Gemini AI explanation in Practice Mode
 * - Automatic question shuffling on every session
 * - Interactive "Hỏi thêm AI" Q&A
 */

const ExamRunner = {
  currentExam: null,
  activeQuestions: [], // Shuffled questions with display_number 1..N
  userAnswers: {}, // { [question_id]: 'A' }
  mode: 'test', // 'test' | 'practice'
  isReviewMode: false,
  timerInterval: null,
  remainingSeconds: 0,
  timeSpentSeconds: 0,
  activeQuestionNumber: 1, // Current display_number (1..N)
  lastSubmissionResult: null,
  instantAiExplanation: true, // Toggleable via [✔ AI giải thích ngay]
  hiddenAiBoxes: new Set(), // Set of qIds where user clicked "Ẩn phân tích AI"

  // Helper to remove any duplicate "Câu X:" prefix from text
  cleanQuestionText(text) {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/^(?:c[âa]u\s*\d+[\s.:\-–—]|\d+[\s.:\)\/–—])\s*/i, '').trim();
  },

  // Fisher-Yates Shuffle Algorithm to randomize questions
  // Ensures order is genuinely different when array.length > 1
  shuffleArray(array) {
    if (!array || array.length <= 1) return [...(array || [])];
    const arr = [...array];
    let attempts = 0;
    let isSameOrder = true;

    while (isSameOrder && attempts < 10) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      // Check if order changed
      isSameOrder = arr.every((item, idx) => item.id === array[idx].id);
      attempts++;
    }
    return arr;
  },

  // On-demand shuffle button handler (can be clicked anytime during test)
  shuffleExam(showToastMsg = true) {
    if (!this.currentExam || !this.currentExam.questions) return;

    if (Object.keys(this.userAnswers).length > 0) {
      if (!confirm('Bạn đã chọn đáp án cho một số câu hỏi. Tráo câu hỏi sẽ làm mới vị trí các câu. Bạn có muốn tiếp tục?')) {
        return;
      }
      this.userAnswers = {};
    }

    const source = [...this.currentExam.questions];
    const shuffled = this.shuffleArray(source);

    this.activeQuestions = shuffled.map((q, idx) => ({
      ...q,
      display_number: idx + 1
    }));
    this.activeQuestionNumber = 1;

    this.renderQuestions();
    this.renderPalette();
    this.renderMobilePalette();
    this.updateStatsBanner();
    this.setActiveQuestion(1, true);

    if (showToastMsg) {
      showToast('🔀 Đã tráo ngẫu nhiên toàn bộ thứ tự câu hỏi!', 'success');
    }
  },

  // Start Exam (Randomizes/shuffles questions every time)
  startExam(examData, mode = 'test', customQuestions = null, customDurationMinutes = null) {
    this.currentExam = examData;
    this.mode = mode;
    this.isReviewMode = false;
    this.userAnswers = {};
    this.lastSubmissionResult = null;
    this.timeSpentSeconds = 0;
    this.hiddenAiBoxes.clear();

    const chosenDuration = (customDurationMinutes !== null && customDurationMinutes !== undefined)
      ? parseInt(customDurationMinutes, 10)
      : (examData.duration_minutes !== undefined ? parseInt(examData.duration_minutes, 10) : 45);
    this.durationMinutes = chosenDuration;

    // Check toggle state from DOM
    const toggleEl = document.getElementById('toggle-instant-ai');
    this.instantAiExplanation = toggleEl ? toggleEl.checked : true;

    // Shuffle questions every time entering the exam or retaking
    const sourceQuestions = customQuestions ? [...customQuestions] : [...examData.questions];
    const shuffled = this.shuffleArray(sourceQuestions);

    // Re-index display_number sequentially (1, 2, ..., N)
    this.activeQuestions = shuffled.map((q, idx) => ({
      ...q,
      display_number: idx + 1
    }));
    this.activeQuestionNumber = 1;

    // Setup Header UI
    const titleEl = document.getElementById('nav-exam-title');
    if (titleEl) titleEl.textContent = examData.title;

    const navExamControls = document.getElementById('nav-exam-controls');
    if (navExamControls) navExamControls.classList.remove('hidden');

    const navStandardLinks = document.getElementById('nav-standard-links');
    if (navStandardLinks) navStandardLinks.classList.add('hidden');

    const navBackBtn = document.getElementById('nav-back-btn');
    if (navBackBtn) navBackBtn.classList.remove('hidden');

    const titleContainer = document.getElementById('nav-exam-title-container');
    if (titleContainer) titleContainer.classList.remove('hidden');

    const subTitleEl = document.getElementById('nav-exam-subtitle');
    if (subTitleEl) {
      const modeLabel = mode === 'practice' ? 'Luyện tập' : 'Kiểm tra';
      subTitleEl.textContent = `${modeLabel} · Đã làm 0/${this.activeQuestions.length} câu`;
    }

    // Show/hide Instant AI toggle in header (shown in practice mode)
    const toggleAiContainer = document.getElementById('toggle-instant-ai-container');
    if (toggleAiContainer) {
      if (mode === 'practice') {
        toggleAiContainer.classList.remove('hidden');
      } else {
        toggleAiContainer.classList.add('hidden');
      }
    }

    // Setup Mode Banner
    const modeBadge = document.getElementById('mode-badge');
    const modeDesc = document.getElementById('mode-desc');
    const durationLabel = chosenDuration === 0 ? 'Không giới hạn thời gian' : `${chosenDuration} phút`;
    if (mode === 'practice') {
      modeBadge.textContent = 'Luyện tập';
      modeBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white';
      modeDesc.innerHTML = `Chế độ luyện tập: Chọn đáp án để biết ngay đúng/sai và xem phân tích AI. <span class="ml-1 inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">⏱️ ${durationLabel}</span> <span class="ml-1 inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">🔀 Đã tráo câu hỏi</span>`;
    } else {
      modeBadge.textContent = 'Kiểm tra';
      modeBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white';
      modeDesc.innerHTML = `Thời gian làm bài: <b>${durationLabel}</b>. Nhấn "Nộp bài" khi hoàn thành. <span class="ml-1 inline-flex items-center text-xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">🔀 Đã tráo câu hỏi</span>`;
    }

    // Bind instant AI toggle change
    if (toggleEl && !toggleEl._bound) {
      toggleEl._bound = true;
      toggleEl.addEventListener('change', (e) => {
        this.instantAiExplanation = e.target.checked;
        this.renderQuestions();
      });
    }

    // Setup Timer
    this.initTimer(chosenDuration);

    // Render questions & palette
    this.renderQuestions();
    this.renderPalette();
    this.renderMobilePalette();
    this.updateStatsBanner();
    this.setActiveQuestion(1, false);

    // Show mobile bottom navigation bar on mobile
    const bottomBar = document.getElementById('exam-mobile-bottom-bar');
    if (bottomBar) bottomBar.classList.remove('hidden');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // Setup Timer (supports 0 = unlimited / tự do)
  initTimer(durationMinutes) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.isUnlimited = (durationMinutes === 0);
    this.remainingSeconds = durationMinutes * 60;
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      this.timeSpentSeconds++;
      if (this.mode === 'test' && !this.isUnlimited) {
        this.remainingSeconds--;
        this.updateTimerDisplay();

        if (this.remainingSeconds <= 0) {
          clearInterval(this.timerInterval);
          showToast('Hết giờ làm bài! Hệ thống đang tự động nộp bài...', 'info');
          this.submitExam();
        }
      } else {
        this.updateTimerDisplay();
      }
    }, 1000);
  },

  // Add more time during exam (+5, +10, +15 mins)
  addExtraTime(minutes) {
    if (this.isUnlimited) {
      showToast('Đang ở chế độ Không giới hạn thời gian làm bài.', 'info');
      return;
    }
    this.remainingSeconds += minutes * 60;
    this.updateTimerDisplay();
    showToast(`⏱️ Đã cộng thêm +${minutes} phút vào thời gian làm bài!`, 'success');
  },

  setUnlimitedTime() {
    this.isUnlimited = true;
    this.updateTimerDisplay();
    showToast('⏱️ Đã chuyển sang chế độ Không giới hạn thời gian!', 'info');
  },

  updateTimerDisplay() {
    const timerText = document.getElementById('nav-timer-text');
    const timerContainer = document.getElementById('nav-timer');
    if (!timerText) return;

    if (this.isUnlimited || this.mode === 'practice') {
      const mins = Math.floor(this.timeSpentSeconds / 60);
      const secs = this.timeSpentSeconds % 60;
      timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}${this.isUnlimited ? ' (Tự do)' : ''}`;
      if (timerContainer) {
        timerContainer.classList.remove('bg-rose-100', 'text-rose-700');
        timerContainer.classList.add('bg-gray-100', 'text-gray-700');
      }
      return;
    }

    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (timerContainer) {
      if (this.remainingSeconds < 300) {
        timerContainer.classList.add('bg-rose-100', 'text-rose-700');
        timerContainer.classList.remove('bg-gray-100', 'text-gray-700');
      } else {
        timerContainer.classList.remove('bg-rose-100', 'text-rose-700');
        timerContainer.classList.add('bg-gray-100', 'text-gray-700');
      }
    }
  },

  // Helper: Why the user's wrong answer was incorrect
  getWhyWrongText(q, userChoice) {
    if (q.question_text.includes('Vấn đề cơ bản') && userChoice === 'C') {
      return 'Nhận thức luận chỉ là mặt thứ hai của vấn đề cơ bản của triết học.';
    }
    if (q.question_text.includes('Vấn đề cơ bản') && userChoice === 'A') {
      return 'Vấn đề giải phóng con người là mục tiêu của chủ nghĩa xã hội khoa học, không phải vấn đề nền tảng phân định các trường phái triết học.';
    }
    if (q.question_text.includes('Vấn đề cơ bản') && userChoice === 'D') {
      return 'Quy luật vận động chung nhất là đối tượng nghiên cứu của triết học Mác - Lênin, không phải vấn đề cơ bản lớn xuyên suốt.';
    }
    if (q.question_text.includes('nhận thức') && (userChoice === 'A' || userChoice === 'B' || userChoice === 'D')) {
      return 'Quan niệm coi nhận thức là "thụ động" hoặc "hồi tưởng linh hồn" thuộc lập trường duy tâm hoặc siêu hình máy móc.';
    }

    const chosenText = q[`option_${userChoice.toLowerCase()}`] || '';
    if (chosenText) {
      return `Phương án "${chosenText}" chưa phản ánh đúng bản chất hoặc chỉ là khía cạnh phái sinh, không phải câu trả lời toàn diện của câu hỏi này.`;
    }
    return `Phương án ${userChoice} không chính xác so với định nghĩa chuẩn của giáo trình.`;
  },

  // Helper: Mnemonic keyword tip
  getMnemonicTip(q) {
    if (q.question_text.includes('Vấn đề cơ bản')) {
      return `Khi gặp câu hỏi này trong đề thi Triết học Mác-Lênin, bạn hãy gạch chân cụm từ khóa trong đáp án đúng "B. Vấn đề mối quan hệ giữa tư duy và tồn tại (giữa ý thức và vật chất)". Các phương án còn lại thường đánh tráo giữa phạm trù "hình thức/phương thức" hoặc chỉ nêu một mặt phiến diện.`;
    }
    if (q.question_text.includes('nhận thức')) {
      return `Ghi nhớ cụm từ khóa vàng: "phản ánh tích cực, tự giác và sáng tạo trên cơ sở thực tiễn". Bất kỳ phương án nào chứa từ "thụ động", "hồi tưởng" đều là phương án bẫy.`;
    }
    if (q.question_text.includes('kinh tế - xã hội')) {
      return `Ghi nhớ cụm từ: "những năm 40 thế kỷ XIX" đi liền với 2 điều kiện: phương thức sản xuất TBCN thống trị và giai cấp vô sản trở thành lực lượng chính trị độc lập.`;
    }
    if (q.question_text.includes('hạt nhân')) {
      return `Thuật ngữ "hạt nhân của phép biện chứng" luôn luôn là "quy luật thống nhất và đấu tranh giữa các mặt đối lập" (quy luật mâu thuẫn).`;
    }

    const correctText = q[`option_${q.correct_answer.toLowerCase()}`] || '';
    return `Khi làm bài thi, hãy tập trung vào cụm từ khóa cốt lõi trong đáp án đúng "${q.correct_answer}. ${correctText.substring(0, 60)}..." để dễ dàng loại trừ các phương án gây nhiễu.`;
  },

  // Render Question Cards
  renderQuestions() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    container.innerHTML = '';

    this.activeQuestions.forEach((q) => {
      const displayNum = q.display_number;
      const qId = q.id;
      const isActive = displayNum === this.activeQuestionNumber;
      const selectedOption = this.userAnswers[qId];

      const isAnswerRevealed = (this.mode === 'practice' && Boolean(selectedOption)) || this.isReviewMode;
      const isBoxHidden = this.hiddenAiBoxes.has(qId);

      const card = document.createElement('div');
      card.id = `q-card-${displayNum}`;
      card.className = `question-card bg-white dark:bg-[#111827] rounded-2xl border p-4 sm:p-6 transition-all ${
        isActive ? 'block active-question border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' : 'hidden lg:block border-gray-200 dark:border-gray-800 shadow-xs'
      }`;

      // Card Header (Matching Screenshot 2: CÂU X on top, followed by question text)
      const headerDiv = document.createElement('div');
      headerDiv.className = 'mb-4';

      const qLabel = document.createElement('div');
      qLabel.className = 'text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5';
      qLabel.textContent = `CÂU ${displayNum}`;

      const qText = document.createElement('h3');
      qText.className = 'text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug';
      qText.textContent = this.cleanQuestionText(q.question_text);

      headerDiv.appendChild(qLabel);
      headerDiv.appendChild(qText);
      card.appendChild(headerDiv);

      // Options List (A, B, C, D)
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'space-y-2.5 sm:space-y-3';

      const options = [
        { key: 'A', text: q.option_a },
        { key: 'B', text: q.option_b },
        { key: 'C', text: q.option_c },
        { key: 'D', text: q.option_d }
      ];

      options.forEach(opt => {
        if (!opt.text) return;

        const isChecked = selectedOption === opt.key;
        let optClass = 'option-label flex items-start p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ';
        let radioIconHtml = '';
        let subTextHtml = '';

        if (isAnswerRevealed) {
          const isCorrect = opt.key === q.correct_answer;
          const isUserPickWrong = isChecked && !isCorrect;

          if (isCorrect) {
            // Correct Answer style (Matching exact Screenshot 2!)
            optClass += 'border-2 border-emerald-500 bg-[#ecfdf5] dark:bg-emerald-950/30 ';
            radioIconHtml = `
              <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#00a86b] text-white flex items-center justify-center mr-3 shrink-0 shadow-xs font-bold text-xs">
                <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            `;
            subTextHtml = `
              <div class="text-xs font-bold text-[#00a86b] dark:text-emerald-400 mt-1 flex items-center space-x-1">
                <span>·</span>
                <span>Đáp án đúng</span>
              </div>
            `;
          } else if (isUserPickWrong) {
            // User Selected Wrong Answer style (Matching exact Screenshot 2!)
            optClass += 'border-2 border-rose-500 bg-[#fff1f2] dark:bg-rose-950/30 ';
            radioIconHtml = `
              <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#e11d48] text-white flex items-center justify-center mr-3 shrink-0 shadow-xs font-bold text-xs">
                <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
            `;
            subTextHtml = `
              <div class="text-xs font-bold text-[#e11d48] dark:text-rose-400 mt-1 flex items-center space-x-1">
                <span>·</span>
                <span>Bạn chọn (Sai)</span>
              </div>
            `;
          } else {
            // Neutral unselected options
            optClass += 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] hover:bg-gray-50 dark:hover:bg-gray-800/60 ';
            radioIconHtml = `
              <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center justify-center mr-3 shrink-0 border border-gray-200 dark:border-gray-700">${opt.key}</div>
            `;
          }
        } else {
          // Normal test mode before selection/submission
          if (isChecked) {
            optClass += 'selected border-2 border-emerald-500 bg-[#f0fdf4] dark:bg-emerald-950/20 ';
            radioIconHtml = `
              <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500 text-white font-bold text-xs flex items-center justify-center mr-3 shrink-0 shadow-xs">${opt.key}</div>
            `;
          } else {
            optClass += 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] hover:border-gray-300 dark:hover:border-gray-700 ';
            radioIconHtml = `
              <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs flex items-center justify-center mr-3 shrink-0 border border-gray-200 dark:border-gray-700">${opt.key}</div>
            `;
          }
        }

        const optLabel = document.createElement('label');
        optLabel.className = optClass;
        optLabel.innerHTML = `
          <input type="radio" name="q_${qId}" value="${opt.key}" ${isChecked ? 'checked' : ''} class="hidden">
          ${radioIconHtml}
          <div class="flex-grow pt-0.5 min-w-0">
            <span class="text-sm sm:text-base text-gray-800 dark:text-gray-200 font-medium leading-relaxed block">${opt.text}</span>
            ${subTextHtml}
          </div>
        `;

        // Click handler to select answer
        optLabel.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectAnswer(qId, opt.key, displayNum);
        });

        optionsContainer.appendChild(optLabel);
      });

      card.appendChild(optionsContainer);

      // AI Explanation Section (Matching exact Screenshot 2!)
      if (isAnswerRevealed && this.instantAiExplanation) {
        const isUserCorrect = selectedOption === q.correct_answer;
        const whyWrongText = !isUserCorrect ? this.getWhyWrongText(q, selectedOption) : null;
        const detailedExp = q.explanation || 'Nội dung kiến thức bám sát quy định giáo trình chính thức.';
        const mnemonicTip = this.getMnemonicTip(q);

        const expWrapper = document.createElement('div');
        expWrapper.className = 'mt-5 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3';

        // Header row: Phân tích AI & Hỏi thêm AI (Screenshot 2)
        const headerActionRow = document.createElement('div');
        headerActionRow.className = 'flex items-center justify-between text-xs font-bold pt-1';

        headerActionRow.innerHTML = `
          <span class="text-[#00a86b] dark:text-emerald-400">Phân tích AI</span>
          <button type="button" onclick="ExamRunner.toggleAiChat(${qId})" class="text-[#00a86b] dark:text-emerald-400 hover:underline flex items-center space-x-1">
            <span>Hỏi thêm AI</span>
          </button>
        `;
        expWrapper.appendChild(headerActionRow);

        // Block 1: Vì sao đáp án sai (Only if user picked wrong, Screenshot 2)
        if (whyWrongText) {
          const wrongBox = document.createElement('div');
          wrongBox.className = 'p-3.5 sm:p-4 rounded-2xl bg-[#fff1f2] dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-900 dark:text-rose-200 leading-relaxed';
          wrongBox.innerHTML = `<span class="font-bold">Vì sao đáp án ${selectedOption} sai:</span> ${whyWrongText}`;
          expWrapper.appendChild(wrongBox);
        }

        // Accordion 1: Giải thích chi tiết (Screenshot 2)
        const acc1 = document.createElement('div');
        acc1.className = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] overflow-hidden';
        acc1.innerHTML = `
          <button type="button" onclick="ExamRunner.toggleAccordion('exp-${qId}')" class="w-full p-3.5 text-left text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <span>Giải thích chi tiết</span>
            <svg id="icon-exp-${qId}" class="w-4 h-4 text-gray-400 transition-transform transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <div id="content-exp-${qId}" class="hidden p-3.5 pt-0 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed border-t border-gray-100 dark:border-gray-800/60">
            ${detailedExp}
          </div>
        `;
        expWrapper.appendChild(acc1);

        // Accordion 2: Gemini AI · Mẹo nhớ từ khóa nhanh (Screenshot 2)
        const acc2 = document.createElement('div');
        acc2.className = 'rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111827] overflow-hidden';
        acc2.innerHTML = `
          <button type="button" onclick="ExamRunner.toggleAccordion('tip-${qId}')" class="w-full p-3.5 text-left text-xs sm:text-sm font-bold text-[#00a86b] dark:text-emerald-400 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <span>Gemini AI · Mẹo nhớ từ khóa nhanh</span>
            <svg id="icon-tip-${qId}" class="w-4 h-4 text-gray-400 transition-transform transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </button>
          <div id="content-tip-${qId}" class="hidden p-3.5 pt-0 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed border-t border-gray-100 dark:border-gray-800/60">
            ${mnemonicTip}
          </div>
        `;
        expWrapper.appendChild(acc2);

        // Interactive "Hỏi thêm AI" Drawer
        const chatDrawer = document.createElement('div');
        chatDrawer.id = `ai-chat-${qId}`;
        chatDrawer.className = 'hidden mt-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 space-y-3';
        chatDrawer.innerHTML = `
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-gray-800 dark:text-gray-200 flex items-center space-x-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Trợ lý Gemini AI - Giải đáp câu ${displayNum}</span>
            </span>
            <button type="button" onclick="document.getElementById('ai-chat-${qId}').classList.add('hidden')" class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs font-semibold">✕ Đóng</button>
          </div>

          <div id="ai-chat-reply-${qId}" class="hidden p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-gray-800 dark:text-gray-200 leading-relaxed shadow-xs"></div>

          <!-- Quick Prompts Chips -->
          <div class="flex flex-wrap gap-1.5 text-xs">
            <button type="button" onclick="ExamRunner.askAiQuick(${qId}, 'Giải thích đơn giản dễ hiểu hơn')" class="px-3 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">💡 Giải thích đơn giản hơn</button>
            <button type="button" onclick="ExamRunner.askAiQuick(${qId}, 'Cho ví dụ thực tế sinh động')" class="px-3 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">🔍 Cho ví dụ thực tế</button>
            <button type="button" onclick="ExamRunner.askAiQuick(${qId}, 'Phân biệt chi tiết đáp án đúng và đáp án sai')" class="px-3 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors">⚖️ Phân biệt đúng - sai</button>
          </div>

          <!-- Input bar -->
          <div class="flex items-center space-x-2">
            <input type="text" id="ai-chat-input-${qId}" placeholder="Nhập câu hỏi của bạn cho Gemini AI..." class="flex-grow px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs sm:text-sm bg-white dark:bg-[#111827] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" onkeydown="if(event.key === 'Enter') ExamRunner.sendAiQuestion(${qId});">
            <button type="button" id="ai-chat-send-${qId}" onclick="ExamRunner.sendAiQuestion(${qId})" class="px-4 py-2 rounded-xl bg-[#00a86b] hover:bg-emerald-700 text-white font-bold text-xs shrink-0 flex items-center space-x-1 shadow-xs transition-colors">
              <span>Hỏi AI</span>
            </button>
          </div>
        `;
        expWrapper.appendChild(chatDrawer);

        card.appendChild(expWrapper);
      }

      card.addEventListener('click', () => {
        this.setActiveQuestion(displayNum, false);
      });

      container.appendChild(card);
    });
  },

  // Toggle AI Box open/collapse
  toggleAiBox(qId) {
    const box = document.getElementById(`ai-box-${qId}`);
    const textSpan = document.getElementById(`ai-toggle-text-${qId}`);
    if (!box) return;

    if (box.classList.contains('hidden')) {
      box.classList.remove('hidden');
      this.hiddenAiBoxes.delete(qId);
      if (textSpan) textSpan.textContent = 'Ẩn phân tích AI ⌃';
    } else {
      box.classList.add('hidden');
      this.hiddenAiBoxes.add(qId);
      if (textSpan) textSpan.textContent = 'Hiện phân tích AI ⌄';
    }
  },

  // Toggle Accordion (Screenshot 2: Giải thích chi tiết & Gemini AI mẹo nhớ)
  toggleAccordion(id) {
    const content = document.getElementById(`content-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    if (content) {
      content.classList.toggle('hidden');
    }
    if (icon) {
      icon.classList.toggle('rotate-180');
    }
  },

  // Toggle AI Chat drawer
  toggleAiChat(qId) {
    const drawer = document.getElementById(`ai-chat-${qId}`);
    if (!drawer) return;
    drawer.classList.toggle('hidden');
    if (!drawer.classList.contains('hidden')) {
      document.getElementById(`ai-chat-input-${qId}`)?.focus();
    }
  },

  // Send AI Quick Chip Prompt
  async askAiQuick(qId, prompt) {
    const input = document.getElementById(`ai-chat-input-${qId}`);
    if (input) input.value = prompt;
    await this.sendAiQuestion(qId, prompt);
  },

  // Send Custom Question to AI
  async sendAiQuestion(qId, overridePrompt = '') {
    const input = document.getElementById(`ai-chat-input-${qId}`);
    const replyBox = document.getElementById(`ai-chat-reply-${qId}`);
    const sendBtn = document.getElementById(`ai-chat-send-${qId}`);
    const prompt = overridePrompt || input?.value.trim();

    if (!prompt) return;

    const q = this.activeQuestions.find(item => item.id === qId);
    if (!q) return;

    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerHTML = '<span>Đang hỏi...</span>';
    }

    if (replyBox) {
      replyBox.classList.remove('hidden');
      replyBox.innerHTML = '<span class="text-gray-500 italic flex items-center space-x-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span><span>Gemini AI đang tổng hợp câu trả lời...</span></span>';
    }

    try {
      const payload = {
        questionText: q.question_text,
        options: {
          A: q.option_a,
          B: q.option_b,
          C: q.option_c,
          D: q.option_d
        },
        correctAnswer: q.correct_answer,
        userChoice: this.userAnswers[qId] || null,
        prompt
      };

      const res = await API.askAi(payload);
      if (res.success && replyBox) {
        replyBox.innerHTML = res.answer;
      } else if (replyBox) {
        replyBox.textContent = res.error || 'Không nhận được phản hồi từ AI.';
      }
    } catch (err) {
      if (replyBox) {
        replyBox.textContent = 'Lỗi kết nối AI: ' + err.message;
      }
    } finally {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span>Hỏi AI</span>';
      }
      if (input) input.value = '';
    }
  },

  // Render Right Palette Grid
  renderPalette() {
    const paletteGrid = document.getElementById('palette-grid');
    if (!paletteGrid) return;

    paletteGrid.innerHTML = '';

    this.activeQuestions.forEach(q => {
      const displayNum = q.display_number;
      const isAnswered = Boolean(this.userAnswers[q.id]);
      const isCurrent = displayNum === this.activeQuestionNumber;

      const btn = document.createElement('button');
      btn.id = `palette-btn-${displayNum}`;
      btn.className = `palette-btn rounded-xl text-sm font-bold flex items-center justify-center transition-all ${
        isAnswered ? 'answered bg-[#00a86b] text-white' : 'unanswered bg-gray-100 text-gray-700'
      } ${isCurrent ? 'current ring-2 ring-emerald-500' : ''}`;

      // In Review Mode or Practice Mode when answered: show correct green / wrong red
      if (this.isReviewMode || (this.mode === 'practice' && isAnswered)) {
        const isCorrect = this.userAnswers[q.id] === q.correct_answer;
        if (isCorrect) {
          btn.className = `palette-btn rounded-xl text-sm font-bold flex items-center justify-center bg-emerald-600 text-white ${isCurrent ? 'ring-2 ring-emerald-500' : ''}`;
        } else {
          btn.className = `palette-btn rounded-xl text-sm font-bold flex items-center justify-center bg-rose-600 text-white ${isCurrent ? 'ring-2 ring-emerald-500' : ''}`;
        }
      }

      btn.textContent = displayNum;

      btn.addEventListener('click', () => {
        this.setActiveQuestion(displayNum, true);
      });

      paletteGrid.appendChild(btn);
    });
  },

  // Set Active Question by display number (1..N) & Scroll
  setActiveQuestion(displayNum, shouldScroll = true) {
    this.activeQuestionNumber = displayNum;

    // Mobile single question visibility + desktop all questions visibility
    document.querySelectorAll('.question-card').forEach(c => {
      c.classList.remove('block', 'active-question', 'border-emerald-500', 'ring-1', 'ring-emerald-500/20');
      c.classList.add('hidden', 'lg:block', 'border-gray-200', 'dark:border-gray-800');
    });

    const activeCard = document.getElementById(`q-card-${displayNum}`);
    if (activeCard) {
      activeCard.classList.remove('hidden', 'border-gray-200', 'dark:border-gray-800');
      activeCard.classList.add('block', 'active-question', 'border-emerald-500', 'ring-1', 'ring-emerald-500/20');

      if (shouldScroll) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    // Desktop palette active highlight
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('current', 'ring-2', 'ring-emerald-500'));
    const paletteBtn = document.getElementById(`palette-btn-${displayNum}`);
    if (paletteBtn) {
      paletteBtn.classList.add('current', 'ring-2', 'ring-emerald-500');
    }

    // Mobile palette active highlight
    document.querySelectorAll('#mobile-palette-grid button').forEach(b => b.classList.remove('ring-2', 'ring-emerald-400', 'ring-offset-2', 'ring-offset-[#0f172a]'));
    const mobileBtn = document.getElementById(`mobile-palette-btn-${displayNum}`);
    if (mobileBtn) {
      mobileBtn.classList.add('ring-2', 'ring-emerald-400', 'ring-offset-2', 'ring-offset-[#0f172a]');
    }

    // Update bottom bar state
    this.updateMobileBottomBar();
  },

  // Mobile Question Navigation
  prevQuestion() {
    if (this.activeQuestionNumber > 1) {
      this.setActiveQuestion(this.activeQuestionNumber - 1, true);
    }
  },

  nextQuestion() {
    if (this.activeQuestionNumber < this.activeQuestions.length) {
      this.setActiveQuestion(this.activeQuestionNumber + 1, true);
    } else {
      // Last question - submit exam
      this.submitExam();
    }
  },

  updateMobileBottomBar() {
    const totalCount = this.activeQuestions.length;
    const currentNum = this.activeQuestionNumber;

    const paletteBtnText = document.getElementById('mobile-palette-q-text');
    if (paletteBtnText) {
      paletteBtnText.textContent = `${currentNum} / ${totalCount}`;
    }

    const prevBtn = document.getElementById('mobile-prev-q-btn');
    if (prevBtn) {
      prevBtn.disabled = (currentNum <= 1);
    }

    const nextBtnText = document.getElementById('mobile-next-btn-text');
    if (nextBtnText) {
      nextBtnText.textContent = (currentNum >= totalCount) ? 'Nộp bài' : 'Câu sau';
    }
  },

  openMobilePalette() {
    this.renderMobilePalette();
    const modal = document.getElementById('modal-question-palette');
    if (modal) modal.classList.remove('hidden');
  },

  closeMobilePalette() {
    const modal = document.getElementById('modal-question-palette');
    if (modal) modal.classList.add('hidden');
  },

  renderMobilePalette() {
    const grid = document.getElementById('mobile-palette-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const answeredCount = Object.keys(this.userAnswers).length;
    const totalCount = this.activeQuestions.length;

    // Update stat
    const statEl = document.getElementById('mobile-palette-stat');
    if (statEl) {
      statEl.textContent = `Đã làm ${answeredCount}/${totalCount} câu`;
    }

    this.activeQuestions.forEach(q => {
      const displayNum = q.display_number;
      const isAnswered = Boolean(this.userAnswers[q.id]);
      const isCurrent = displayNum === this.activeQuestionNumber;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = `mobile-palette-btn-${displayNum}`;

      // Styling matching Screenshot 3:
      // Green #00a86b if answered, dark slate #1e293b if unanswered
      let btnClass = 'h-11 rounded-xl text-sm font-bold flex items-center justify-center transition-all ';

      if (this.isReviewMode || (this.mode === 'practice' && isAnswered)) {
        const isCorrect = this.userAnswers[q.id] === q.correct_answer;
        if (isCorrect) {
          btnClass += 'bg-[#00a86b] text-white ';
        } else {
          btnClass += 'bg-[#e11d48] text-white ';
        }
      } else if (isAnswered) {
        btnClass += 'bg-[#00a86b] text-white shadow-xs ';
      } else {
        btnClass += 'bg-[#1e293b] text-gray-300 border border-gray-700 hover:border-gray-500 ';
      }

      if (isCurrent) {
        btnClass += 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#0f172a] ';
      }

      btn.className = btnClass;
      btn.textContent = displayNum;

      btn.addEventListener('click', () => {
        this.setActiveQuestion(displayNum, true);
        this.closeMobilePalette();
      });

      grid.appendChild(btn);
    });
  },

  // Select Answer
  selectAnswer(qId, optionKey, displayNum) {
    if (this.isReviewMode) return;

    this.userAnswers[qId] = optionKey;
    this.activeQuestionNumber = displayNum;

    // In Practice Mode, re-render immediately to reveal right/wrong badges & AI explanation
    if (this.mode === 'practice') {
      this.renderQuestions();
      this.renderPalette();
      this.renderMobilePalette();
      this.updateStatsBanner();
      this.setActiveQuestion(displayNum, false);
      return;
    }

    // In Test mode, update radio check mark state normally
    const card = document.getElementById(`q-card-${displayNum}`);
    if (card) {
      const labels = card.querySelectorAll('.option-label');
      labels.forEach(l => {
        const input = l.querySelector('input');
        if (input && input.value === optionKey) {
          l.classList.add('selected', 'border-emerald-500', 'bg-[#f0fdf4]', 'dark:bg-emerald-950/20');
          input.checked = true;
        } else {
          l.classList.remove('selected', 'border-emerald-500', 'bg-[#f0fdf4]', 'dark:bg-emerald-950/20');
          if (input) input.checked = false;
        }
      });
    }

    const pBtn = document.getElementById(`palette-btn-${displayNum}`);
    if (pBtn) {
      pBtn.classList.remove('unanswered', 'bg-gray-100', 'text-gray-700');
      pBtn.classList.add('answered', 'bg-[#00a86b]', 'text-white');
    }

    const mBtn = document.getElementById(`mobile-palette-btn-${displayNum}`);
    if (mBtn) {
      mBtn.classList.remove('bg-[#1e293b]', 'text-gray-300', 'border', 'border-gray-700');
      mBtn.classList.add('bg-[#00a86b]', 'text-white', 'shadow-xs');
    }

    this.updateStatsBanner();
  },

  updateStatsBanner() {
    const answeredCount = Object.keys(this.userAnswers).length;
    const totalCount = this.activeQuestions.length;

    const answeredStat = document.getElementById('stat-answered-count');
    const totalStat = document.getElementById('stat-total-count');

    if (answeredStat) answeredStat.textContent = answeredCount;
    if (totalStat) totalStat.textContent = totalCount;

    // Mobile subtitle in top navbar (Screenshot 2: "Luyện tập · Đã làm X/Y câu")
    const subTitleEl = document.getElementById('nav-exam-subtitle');
    if (subTitleEl) {
      const modeLabel = this.mode === 'practice' ? 'Luyện tập' : 'Kiểm tra';
      subTitleEl.textContent = `${modeLabel} · Đã làm ${answeredCount}/${totalCount} câu`;
    }

    // Mobile palette footer stat (Screenshot 3: "Đã làm X/Y câu")
    const paletteStatEl = document.getElementById('mobile-palette-stat');
    if (paletteStatEl) {
      paletteStatEl.textContent = `Đã làm ${answeredCount}/${totalCount} câu`;
    }
  },

  // Submit Exam
  async submitExam() {
    if (!this.currentExam) return;

    if (this.timerInterval) clearInterval(this.timerInterval);

    try {
      const isVirtual = this.currentExam.id === 'combined' || this.currentExam.isVirtual;
      const res = await API.submitExam(
        this.currentExam.id,
        this.userAnswers,
        this.timeSpentSeconds,
        isVirtual ? {
          virtualExamTitle: this.currentExam.title,
          questionsList: this.activeQuestions
        } : {}
      );

      if (res && res.success) {
        this.lastSubmissionResult = res.data;
        this.showResultModal(res.data);
      } else {
        this.gradeExamLocally();
      }
    } catch (err) {
      this.gradeExamLocally();
    }
  },

  // Fallback local grading for virtual / combined exams or offline
  gradeExamLocally() {
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    const wrongQuestionNumbers = [];
    const unansweredQuestionNumbers = [];
    const wrongQuestionIds = [];
    const unansweredQuestionIds = [];
    const questionResults = [];

    this.activeQuestions.forEach(q => {
      const studentAns = this.userAnswers[q.id] || this.userAnswers[String(q.id)] || this.userAnswers[q.display_number];
      const isAnswered = Boolean(studentAns);
      const isCorrect = isAnswered && studentAns.toUpperCase() === q.correct_answer.toUpperCase();

      if (!isAnswered) {
        unansweredCount++;
        unansweredQuestionIds.push(q.id);
        unansweredQuestionNumbers.push(q.display_number);
      } else if (isCorrect) {
        correctCount++;
      } else {
        wrongCount++;
        wrongQuestionIds.push(q.id);
        wrongQuestionNumbers.push(q.display_number);
      }

      questionResults.push({
        id: q.id,
        question_number: q.display_number,
        studentAnswer: studentAns || null,
        correctAnswer: q.correct_answer,
        isCorrect,
        isAnswered,
        explanation: q.explanation || 'Không có giải thích chi tiết.'
      });
    });

    const totalQuestions = this.activeQuestions.length;
    const rawScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0;
    const score = (Math.round(rawScore * 10) / 10).toFixed(1);

    const data = {
      examId: this.currentExam.id,
      examTitle: this.currentExam.title,
      score,
      totalQuestions,
      correctCount,
      wrongCount,
      unansweredCount,
      wrongQuestionNumbers,
      unansweredQuestionNumbers,
      wrongQuestionIds,
      unansweredQuestionIds,
      questionResults
    };

    this.lastSubmissionResult = data;
    this.showResultModal(data);
  },

  // Show Result Modal
  showResultModal(data) {
    const modal = document.getElementById('result-modal');
    if (!modal) return;

    document.getElementById('modal-exam-title').textContent = data.examTitle;
    document.getElementById('modal-score').textContent = data.score;
    document.getElementById('modal-correct').textContent = `${data.correctCount}/${data.totalQuestions}`;
    document.getElementById('modal-wrong').textContent = data.wrongCount;

    // Red button: Làm lại câu sai
    const retryWrongText = document.getElementById('modal-retry-wrong-text');
    const retryWrongBtn = document.getElementById('modal-retry-wrong-btn');
    if (data.wrongCount > 0) {
      retryWrongText.textContent = `↺ Làm lại ${data.wrongCount} câu sai ngay`;
      retryWrongBtn.classList.remove('opacity-50', 'pointer-events-none');
    } else {
      retryWrongText.textContent = `✓ Bạn không có câu sai nào!`;
      retryWrongBtn.classList.add('opacity-50', 'pointer-events-none');
    }

    // Yellow button: Làm lại câu sai & chưa làm
    const incompleteCount = data.wrongCount + data.unansweredCount;
    const retryIncompleteText = document.getElementById('modal-retry-incomplete-text');
    const retryIncompleteBtn = document.getElementById('modal-retry-incomplete-btn');
    if (incompleteCount > 0) {
      retryIncompleteText.textContent = `⚡ Làm lại cả câu sai & câu chưa làm (${incompleteCount} câu)`;
      retryIncompleteBtn.classList.remove('opacity-50', 'pointer-events-none');
    } else {
      retryIncompleteText.textContent = `⚡ Xuất sắc! Bạn đã làm đúng toàn bộ đề thi!`;
      retryIncompleteBtn.classList.add('opacity-50', 'pointer-events-none');
    }

    modal.classList.remove('hidden');
  },

  closeResultModal() {
    const modal = document.getElementById('result-modal');
    if (modal) modal.classList.add('hidden');
  },

  // 1. Action: Làm lại câu sai ngay (tự động đảo vị trí câu sai)
  retryWrongQuestions() {
    if (!this.lastSubmissionResult) return;
    const wrongIds = new Set(this.lastSubmissionResult.wrongQuestionIds || []);
    const filtered = this.currentExam.questions.filter(q => wrongIds.has(q.id));
    
    this.closeResultModal();
    if (filtered.length === 0) {
      showToast('Bạn không có câu sai nào!', 'info');
      return;
    }

    showToast(`Bắt đầu luyện tập lại ${filtered.length} câu đã làm sai (đã tráo câu)!`, 'success');
    this.startExam(this.currentExam, 'practice', filtered);
  },

  // 2. Action: Làm lại câu sai & câu chưa làm (tự động đảo vị trí)
  retryIncompleteQuestions() {
    if (!this.lastSubmissionResult) return;
    const incompleteIds = new Set([
      ...(this.lastSubmissionResult.wrongQuestionIds || []),
      ...(this.lastSubmissionResult.unansweredQuestionIds || [])
    ]);
    const filtered = this.currentExam.questions.filter(q => incompleteIds.has(q.id));

    this.closeResultModal();
    if (filtered.length === 0) {
      showToast('Bạn đã làm đúng toàn bộ!', 'success');
      return;
    }

    showToast(`Bắt đầu làm lại ${filtered.length} câu sai & chưa làm (đã tráo câu)!`, 'success');
    this.startExam(this.currentExam, 'practice', filtered);
  },

  // 3. Action: Xem lại bài & Lời giải AI
  reviewWithExplanations() {
    this.closeResultModal();
    this.isReviewMode = true;
    if (this.timerInterval) clearInterval(this.timerInterval);

    const modeBadge = document.getElementById('mode-badge');
    const modeDesc = document.getElementById('mode-desc');
    if (modeBadge) {
      modeBadge.textContent = 'Xem lời giải';
      modeBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-600 text-white';
    }
    if (modeDesc) {
      modeDesc.textContent = 'Chế độ xem lại bài thi: Hiển thị đáp án đúng và phân tích lời giải AI.';
    }

    this.renderQuestions();
    this.renderPalette();
    this.renderMobilePalette();
    this.updateStatsBanner();
    this.setActiveQuestion(1, true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // 4. Action: Làm lại cả đề (tự động đảo ngẫu nhiên toàn bộ câu hỏi)
  retryWholeExam() {
    this.closeResultModal();
    showToast('Bắt đầu làm lại toàn bộ đề thi (đã đảo thứ tự câu ngẫu nhiên)!', 'info');
    this.startExam(this.currentExam, 'test');
  }
};
