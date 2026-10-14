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
    this.updateStatsBanner();
    this.setActiveQuestion(1, true);

    if (showToastMsg) {
      showToast('🔀 Đã tráo ngẫu nhiên toàn bộ thứ tự câu hỏi!', 'success');
    }
  },

  // Start Exam (Randomizes/shuffles questions every time)
  startExam(examData, mode = 'test', customQuestions = null) {
    this.currentExam = examData;
    this.mode = mode;
    this.isReviewMode = false;
    this.userAnswers = {};
    this.lastSubmissionResult = null;
    this.timeSpentSeconds = 0;
    this.hiddenAiBoxes.clear();

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
    if (mode === 'practice') {
      modeBadge.textContent = 'Luyện tập';
      modeBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-600 text-white';
      modeDesc.innerHTML = 'Chế độ luyện tập: Chọn đáp án để biết ngay đúng/sai và xem phân tích AI. <span class="ml-1 inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">🔀 Đã tráo câu hỏi</span>';
    } else {
      modeBadge.textContent = 'Kiểm tra';
      modeBadge.className = 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white';
      modeDesc.innerHTML = 'Thời gian có giới hạn. Nhấn "Nộp bài" khi hoàn thành. <span class="ml-1 inline-flex items-center text-xs font-semibold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">🔀 Đã tráo câu hỏi</span>';
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
    this.initTimer(examData.duration_minutes || 45);

    // Render questions & palette
    this.renderQuestions();
    this.renderPalette();
    this.updateStatsBanner();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // Setup Timer
  initTimer(durationMinutes) {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.remainingSeconds = durationMinutes * 60;
    this.updateTimerDisplay();

    this.timerInterval = setInterval(() => {
      this.timeSpentSeconds++;
      if (this.mode === 'test') {
        this.remainingSeconds--;
        this.updateTimerDisplay();

        if (this.remainingSeconds <= 0) {
          clearInterval(this.timerInterval);
          showToast('Hết giờ làm bài! Hệ thống đang tự động nộp bài...', 'info');
          this.submitExam();
        }
      }
    }, 1000);
  },

  updateTimerDisplay() {
    const timerText = document.getElementById('nav-timer-text');
    const timerContainer = document.getElementById('nav-timer');
    if (!timerText) return;

    if (this.mode === 'practice') {
      const mins = Math.floor(this.timeSpentSeconds / 60);
      const secs = this.timeSpentSeconds % 60;
      timerText.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      if (timerContainer) timerContainer.classList.remove('bg-rose-100', 'text-rose-700');
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
      card.className = `question-card bg-white rounded-2xl border p-5 sm:p-6 transition-all ${
        isActive ? 'active-question border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' : 'border-gray-200 shadow-xs'
      }`;

      // Card Header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'flex items-start space-x-3 mb-4';

      // Badge Number
      const badge = document.createElement('span');
      badge.className = `q-badge w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
        isActive ? 'bg-[#00a86b] text-white' : 'bg-gray-100 text-gray-700'
      }`;
      badge.textContent = displayNum;

      // Question Text
      const qText = document.createElement('h3');
      qText.className = 'text-base sm:text-lg font-bold text-gray-900 leading-snug pt-0.5';
      qText.textContent = this.cleanQuestionText(q.question_text);

      headerDiv.appendChild(badge);
      headerDiv.appendChild(qText);
      card.appendChild(headerDiv);

      // Options List (A, B, C, D)
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'space-y-3 pl-0 sm:pl-11';

      const options = [
        { key: 'A', text: q.option_a },
        { key: 'B', text: q.option_b },
        { key: 'C', text: q.option_c },
        { key: 'D', text: q.option_d }
      ];

      options.forEach(opt => {
        if (!opt.text) return;

        const isChecked = selectedOption === opt.key;
        let optClass = 'option-label flex items-center p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ';
        let radioIconHtml = '';
        let badgeHtml = '';

        if (isAnswerRevealed) {
          const isCorrect = opt.key === q.correct_answer;
          const isUserPickWrong = isChecked && !isCorrect;

          if (isCorrect) {
            // Correct Answer style (Matching exact screenshot!)
            optClass += 'border-2 border-emerald-500 bg-[#ecfdf5] ';
            radioIconHtml = `
              <div class="w-6 h-6 rounded-full bg-[#00a86b] text-white flex items-center justify-center mr-3 shrink-0 shadow-xs font-bold text-xs">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            `;
            badgeHtml = `
              <span class="ml-auto text-xs font-bold text-[#00a86b] flex items-center space-x-1 shrink-0">
                <svg class="w-4 h-4 text-[#00a86b]" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
                </svg>
                <span>Đáp án đúng</span>
              </span>
            `;
          } else if (isUserPickWrong) {
            // User Selected Wrong Answer style (Matching exact screenshot!)
            optClass += 'border-2 border-rose-400 bg-[#fff1f2] ';
            radioIconHtml = `
              <div class="w-6 h-6 rounded-full bg-[#e11d48] text-white flex items-center justify-center mr-3 shrink-0 shadow-xs font-bold text-xs">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
            `;
            badgeHtml = `
              <span class="ml-auto text-xs font-bold text-[#e11d48] flex items-center space-x-1 shrink-0">
                <svg class="w-4 h-4 text-[#e11d48]" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
                </svg>
                <span>Bạn chọn (Sai)</span>
              </span>
            `;
          } else {
            // Neutral unselected options
            optClass += 'border-gray-200 bg-white hover:bg-gray-50/80 ';
            radioIconHtml = `
              <div class="w-5 h-5 rounded-full border-2 border-gray-300 mr-3 shrink-0"></div>
            `;
          }
        } else {
          // Normal test mode before selection/submission
          if (isChecked) {
            optClass += 'selected border-emerald-500 bg-[#f0fdf4] ';
            radioIconHtml = `
              <div class="radio-circle w-5 h-5 rounded-full border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center mr-3 shrink-0">
                <div class="w-2 h-2 rounded-full bg-white"></div>
              </div>
            `;
          } else {
            optClass += 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 ';
            radioIconHtml = `
              <div class="radio-circle w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center mr-3 shrink-0"></div>
            `;
          }
        }

        const optLabel = document.createElement('label');
        optLabel.className = optClass;
        optLabel.innerHTML = `
          <input type="radio" name="q_${qId}" value="${opt.key}" ${isChecked ? 'checked' : ''} class="hidden">
          ${radioIconHtml}
          <span class="text-sm sm:text-base text-gray-800 leading-relaxed">
            <b class="mr-1 text-gray-900">${opt.key}.</b> ${opt.text}
          </span>
          ${badgeHtml}
        `;

        // Click handler to select answer
        optLabel.addEventListener('click', (e) => {
          e.preventDefault();
          this.selectAnswer(qId, opt.key, displayNum);
        });

        optionsContainer.appendChild(optLabel);
      });

      card.appendChild(optionsContainer);

      // AI Explanation Section (Matching exact screenshot!)
      if (isAnswerRevealed && this.instantAiExplanation) {
        const isUserCorrect = selectedOption === q.correct_answer;
        const whyWrongText = !isUserCorrect ? this.getWhyWrongText(q, selectedOption) : null;
        const detailedExp = q.explanation || 'Vấn đề quan hệ giữa tư duy và tồn tại (giữa ý thức và vật chất) là nội dung trung tâm của mọi học thuyết triết học.';
        const mnemonicTip = this.getMnemonicTip(q);

        const expWrapper = document.createElement('div');
        expWrapper.className = 'mt-5 pt-3 border-t border-gray-100 pl-0 sm:pl-11 space-y-2';

        // Header row: Ẩn/Hiện phân tích AI & Hỏi thêm AI button (Exact match of Screenshot!)
        const headerActionRow = document.createElement('div');
        headerActionRow.className = 'flex items-center justify-between text-xs pt-1';

        headerActionRow.innerHTML = `
          <button type="button" onclick="ExamRunner.toggleAiBox(${qId})" class="text-[#e11d48] font-bold hover:underline flex items-center space-x-1">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
            </svg>
            <span id="ai-toggle-text-${qId}">${isBoxHidden ? 'Hiện phân tích AI ⌄' : 'Ẩn phân tích AI ⌃'}</span>
          </button>

          <button type="button" onclick="ExamRunner.toggleAiChat(${qId})" class="px-3 py-1.5 rounded-xl bg-[#e6f9f0] hover:bg-[#d0f5e2] text-[#00a86b] font-bold text-xs flex items-center space-x-1.5 transition-colors shadow-2xs">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
            </svg>
            <span>Hỏi thêm AI</span>
          </button>
        `;
        expWrapper.appendChild(headerActionRow);

        // Main AI Box (Exact match of Screenshot!)
        const aiBox = document.createElement('div');
        aiBox.id = `ai-box-${qId}`;
        aiBox.className = `${isBoxHidden ? 'hidden' : 'block'} rounded-2xl border border-emerald-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5 mt-2 transition-all`;

        aiBox.innerHTML = `
          <!-- Block 1: Vì sao đáp án sai (Only if wrong) -->
          ${whyWrongText ? `
            <div class="bg-[#fff1f2] border-l-4 border-rose-500 rounded-r-xl p-3 text-xs sm:text-sm text-rose-900 leading-relaxed">
              <span class="font-bold text-rose-800">Vì sao đáp án ${selectedOption} sai:</span> ${whyWrongText}
            </div>
          ` : ''}

          <!-- Block 2: Giải thích chi tiết -->
          <div class="text-xs sm:text-sm text-gray-800 leading-relaxed">
            <span class="font-bold text-gray-900">💡 Giải thích chi tiết:</span> ${detailedExp}
          </div>

          <!-- Block 3: Gemini AI phân tích mở rộng & Mẹo nhớ -->
          <div class="pt-2.5 border-t border-gray-100 text-xs sm:text-sm text-gray-800 space-y-1.5 leading-relaxed">
            <div class="font-bold text-[#00a86b] flex items-center space-x-1.5">
              <svg class="w-4 h-4 text-[#00a86b]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14H8a4 4 0 01-.8-7.92A5 5 0 0117 9c0 1.95-1.12 3.65-2.8 4.4z"/>
              </svg>
              <span>Gemini AI phân tích mở rộng:</span>
            </div>
            <div class="text-gray-700 pl-5">
              <span class="font-bold text-amber-800">🔑 Mẹo nhớ từ khóa nhanh:</span> ${mnemonicTip}
            </div>
          </div>
        `;
        expWrapper.appendChild(aiBox);

        // Interactive "Hỏi thêm AI" Drawer
        const chatDrawer = document.createElement('div');
        chatDrawer.id = `ai-chat-${qId}`;
        chatDrawer.className = 'hidden mt-3 p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3';
        chatDrawer.innerHTML = `
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-gray-800 flex items-center space-x-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Trợ lý Gemini AI - Giải đáp câu ${displayNum}</span>
            </span>
            <button type="button" onclick="document.getElementById('ai-chat-${qId}').classList.add('hidden')" class="text-gray-400 hover:text-gray-700 text-xs font-semibold">✕ Đóng</button>
          </div>

          <div id="ai-chat-reply-${qId}" class="hidden p-3.5 rounded-xl bg-white border border-emerald-200 text-xs sm:text-sm text-gray-800 leading-relaxed shadow-xs"></div>

          <!-- Quick Prompts Chips -->
          <div class="flex flex-wrap gap-1.5 text-xs">
            <button type="button" onclick="ExamRunner.askAiQuick(${qId}, 'Giải thích đơn giản dễ hiểu hơn')" class="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors">💡 Giải thích đơn giản hơn</button>
            <button type="button" onclick="ExamRunner.askAiQuick(${qId}, 'Cho ví dụ thực tế sinh động')" class="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors">🔍 Cho ví dụ thực tế</button>
            <button type="button" onclick="ExamRunner.askAiQuick(${qId}, 'Phân biệt chi tiết đáp án đúng và đáp án sai')" class="px-3 py-1 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors">⚖️ Phân biệt đúng - sai</button>
          </div>

          <!-- Input bar -->
          <div class="flex items-center space-x-2">
            <input type="text" id="ai-chat-input-${qId}" placeholder="Nhập câu hỏi của bạn cho Gemini AI..." class="flex-grow px-3.5 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" onkeydown="if(event.key === 'Enter') ExamRunner.sendAiQuestion(${qId});">
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

    document.querySelectorAll('.question-card').forEach(c => {
      c.classList.remove('active-question', 'border-emerald-500', 'ring-1', 'ring-emerald-500/20');
      c.classList.add('border-gray-200');
      const badge = c.querySelector('.q-badge');
      if (badge) {
        badge.classList.remove('bg-[#00a86b]', 'text-white');
        badge.classList.add('bg-gray-100', 'text-gray-700');
      }
    });

    const activeCard = document.getElementById(`q-card-${displayNum}`);
    if (activeCard) {
      activeCard.classList.add('active-question', 'border-emerald-500', 'ring-1', 'ring-emerald-500/20');
      activeCard.classList.remove('border-gray-200');
      const badge = activeCard.querySelector('.q-badge');
      if (badge) {
        badge.classList.add('bg-[#00a86b]', 'text-white');
        badge.classList.remove('bg-gray-100', 'text-gray-700');
      }

      if (shouldScroll) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('current', 'ring-2', 'ring-emerald-500'));
    const paletteBtn = document.getElementById(`palette-btn-${displayNum}`);
    if (paletteBtn) {
      paletteBtn.classList.add('current', 'ring-2', 'ring-emerald-500');
    }
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
          l.classList.add('selected', 'border-emerald-500', 'bg-[#f0fdf4]');
          input.checked = true;
        } else {
          l.classList.remove('selected', 'border-emerald-500', 'bg-[#f0fdf4]');
          if (input) input.checked = false;
        }
      });
    }

    const pBtn = document.getElementById(`palette-btn-${displayNum}`);
    if (pBtn) {
      pBtn.classList.remove('unanswered');
      pBtn.classList.add('answered', 'bg-[#00a86b]', 'text-white');
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
  },

  // Submit Exam
  async submitExam() {
    if (!this.currentExam) return;

    if (this.timerInterval) clearInterval(this.timerInterval);

    try {
      const res = await API.submitExam(
        this.currentExam.id,
        this.userAnswers,
        this.timeSpentSeconds
      );

      if (res.success) {
        this.lastSubmissionResult = res.data;
        this.showResultModal(res.data);
      } else {
        showToast(res.error || 'Có lỗi khi nộp bài', 'error');
      }
    } catch (err) {
      showToast('Lỗi máy chủ: ' + err.message, 'error');
    }
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // 4. Action: Làm lại cả đề (tự động đảo ngẫu nhiên toàn bộ câu hỏi)
  retryWholeExam() {
    this.closeResultModal();
    showToast('Bắt đầu làm lại toàn bộ đề thi (đã đảo thứ tự câu ngẫu nhiên)!', 'info');
    this.startExam(this.currentExam, 'test');
  }
};
