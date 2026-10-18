/**
 * UniPrep Main Application Router & Controller
 */

const ThemeManager = {
  THEME_KEY: 'uniprep_theme',

  init() {
    this.updateIcons();
    this.bindEvents();
  },

  isDark() {
    return document.documentElement.classList.contains('dark');
  },

  setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem(this.THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(this.THEME_KEY, 'light');
    }
    this.updateIcons();
  },

  toggle() {
    const nextTheme = this.isDark() ? 'light' : 'dark';
    this.setTheme(nextTheme);
    showToast(nextTheme === 'dark' ? '🌙 Đã chuyển sang giao diện tối' : '☀️ Đã chuyển sang giao diện sáng', 'info');
  },

  updateIcons() {
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const isDark = this.isDark();

    if (sunIcon && moonIcon) {
      if (isDark) {
        sunIcon.classList.remove('hidden');
        sunIcon.classList.add('block');
        moonIcon.classList.remove('block');
        moonIcon.classList.add('hidden');
      } else {
        sunIcon.classList.remove('block');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
        moonIcon.classList.add('block');
      }
    }

    if (toggleBtn) {
      toggleBtn.setAttribute('title', isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối');
    }
  },

  bindEvents() {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    toggleBtn?.addEventListener('click', () => this.toggle());

    // Listen for system theme change if user hasn't explicitly set preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(this.THEME_KEY)) {
        this.setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
};

const App = {
  currentCategory: 'Tất cả',
  searchQuery: '',

  async init() {
    ThemeManager.init();
    this.bindEvents();
    AdminController.init();
    await this.loadCategories();
    await this.loadExams();
  },

  bindEvents() {
    // Navigation bar buttons
    document.getElementById('nav-brand-btn')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showView('home');
    });

    document.getElementById('nav-kho-de-btn')?.addEventListener('click', () => {
      this.showView('home');
    });

    document.getElementById('nav-admin-btn')?.addEventListener('click', () => {
      AdminController.checkAuthAndOpen();
    });

    document.getElementById('admin-home-btn')?.addEventListener('click', () => {
      this.showView('home');
    });

    document.getElementById('nav-back-btn')?.addEventListener('click', () => {
      this.showView('home');
    });

    document.getElementById('bottom-back-btn')?.addEventListener('click', () => {
      this.showView('home');
    });

    // Exam submit buttons
    document.getElementById('nav-submit-btn')?.addEventListener('click', () => {
      ExamRunner.submitExam();
    });

    document.getElementById('bottom-submit-btn')?.addEventListener('click', () => {
      ExamRunner.submitExam();
    });

    document.getElementById('sidebar-submit-btn')?.addEventListener('click', () => {
      ExamRunner.submitExam();
    });

    // Modal action buttons (Matching Screenshot 1)
    document.getElementById('modal-close-btn')?.addEventListener('click', () => {
      ExamRunner.closeResultModal();
    });

    document.getElementById('modal-retry-wrong-btn')?.addEventListener('click', () => {
      ExamRunner.retryWrongQuestions();
    });

    document.getElementById('modal-retry-incomplete-btn')?.addEventListener('click', () => {
      ExamRunner.retryIncompleteQuestions();
    });

    document.getElementById('modal-review-btn')?.addEventListener('click', () => {
      ExamRunner.reviewWithExplanations();
    });

    document.getElementById('modal-retry-all-btn')?.addEventListener('click', () => {
      ExamRunner.retryWholeExam();
    });

    // Search input
    let searchTimer = null;
    document.getElementById('exam-search-input')?.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        this.searchQuery = e.target.value.trim();
        this.loadExams();
      }, 300);
    });

    // Start-Exam Duration Modal Events
    document.getElementById('start-exam-modal-close-btn')?.addEventListener('click', () => {
      document.getElementById('modal-start-exam')?.classList.add('hidden');
    });

    document.getElementById('start-exam-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('modal-start-exam')?.classList.add('hidden');
    });

    document.getElementById('start-exam-confirm-btn')?.addEventListener('click', () => {
      const modal = document.getElementById('modal-start-exam');
      modal?.classList.add('hidden');
      if (this.pendingExam) {
        const customMins = parseInt(document.getElementById('start-exam-custom-mins')?.value, 10);
        this.openExam(this.pendingExam.id, this.pendingExam.mode, isNaN(customMins) ? 45 : customMins);
      }
    });

    // Start-Exam Duration Pills
    const startDurPills = document.querySelectorAll('.start-dur-btn');
    startDurPills.forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = btn.dataset.mins;
        const input = document.getElementById('start-exam-custom-mins');
        if (input) input.value = mins;

        startDurPills.forEach(p => {
          if (p === btn) {
            p.className = 'start-dur-btn active px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-600 bg-emerald-600 text-white transition-all shadow-2xs cursor-pointer';
          } else if (p.dataset.mins === '0') {
            p.className = 'start-dur-btn px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer';
          } else {
            p.className = 'start-dur-btn px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-500 transition-all cursor-pointer';
          }
        });
      });
    });

    document.getElementById('start-exam-custom-mins')?.addEventListener('input', (e) => {
      const val = e.target.value;
      startDurPills.forEach(p => {
        if (p.dataset.mins === val) {
          p.className = 'start-dur-btn active px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-600 bg-emerald-600 text-white transition-all shadow-2xs cursor-pointer';
        } else if (p.dataset.mins === '0') {
          p.className = 'start-dur-btn px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer';
        } else {
          p.className = 'start-dur-btn px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-500 transition-all cursor-pointer';
        }
      });
    });

    // Combine Exams Modal Events
    document.getElementById('open-combine-modal-btn')?.addEventListener('click', () => {
      this.openCombineModal();
    });

    document.getElementById('combine-modal-close-btn')?.addEventListener('click', () => {
      document.getElementById('modal-combine-exam')?.classList.add('hidden');
    });

    document.getElementById('combine-modal-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('modal-combine-exam')?.classList.add('hidden');
    });

    // Combine Duration Pills
    const combineDurPills = document.querySelectorAll('.user-dur-btn');
    combineDurPills.forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = btn.dataset.mins;
        const input = document.getElementById('combine-custom-duration');
        if (input) input.value = mins;

        combineDurPills.forEach(p => {
          if (p === btn) {
            p.className = 'user-dur-btn active px-3.5 py-1.5 rounded-xl text-xs font-bold border border-emerald-600 bg-emerald-600 text-white transition-all shadow-2xs cursor-pointer';
          } else if (p.dataset.mins === '0') {
            p.className = 'user-dur-btn px-3.5 py-1.5 rounded-xl text-xs font-bold border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer';
          } else {
            p.className = 'user-dur-btn px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-500 transition-all cursor-pointer';
          }
        });
      });
    });

    document.getElementById('combine-custom-duration')?.addEventListener('input', (e) => {
      const val = e.target.value;
      combineDurPills.forEach(p => {
        if (p.dataset.mins === val) {
          p.className = 'user-dur-btn active px-3.5 py-1.5 rounded-xl text-xs font-bold border border-emerald-600 bg-emerald-600 text-white transition-all shadow-2xs cursor-pointer';
        } else if (p.dataset.mins === '0') {
          p.className = 'user-dur-btn px-3.5 py-1.5 rounded-xl text-xs font-bold border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer';
        } else {
          p.className = 'user-dur-btn px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-500 transition-all cursor-pointer';
        }
      });
    });

    // Combine Category Filter
    document.getElementById('combine-category-filter')?.addEventListener('change', (e) => {
      const cat = e.target.value;
      const items = document.querySelectorAll('.combine-exam-item');
      items.forEach(item => {
        if (cat === 'all' || item.dataset.cat === cat) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });

    // Combine Select All / Deselect All
    document.getElementById('combine-select-all-btn')?.addEventListener('click', () => {
      const visibleCheckboxes = document.querySelectorAll('.combine-exam-item:not(.hidden) .combine-exam-cb');
      visibleCheckboxes.forEach(cb => cb.checked = true);
      this.updateCombineSelectedSummary();
    });

    document.getElementById('combine-deselect-all-btn')?.addEventListener('click', () => {
      const checkboxes = document.querySelectorAll('.combine-exam-cb');
      checkboxes.forEach(cb => cb.checked = false);
      this.updateCombineSelectedSummary();
    });

    // Combine Start Exam Button
    document.getElementById('combine-start-btn')?.addEventListener('click', async () => {
      const checkedBoxes = Array.from(document.querySelectorAll('.combine-exam-cb:checked'));
      const examIds = checkedBoxes.map(cb => parseInt(cb.value, 10));

      if (examIds.length < 2) {
        showToast('Vui lòng chọn ít nhất 2 bộ đề để gộp!', 'error');
        return;
      }

      const durVal = document.getElementById('combine-custom-duration')?.value;
      const durationMinutes = (durVal !== '' && !isNaN(Number(durVal))) ? parseInt(durVal, 10) : 45;
      const maxQuestions = parseInt(document.getElementById('combine-max-questions')?.value, 10) || 0;
      const mode = document.querySelector('input[name="combine_mode"]:checked')?.value || 'practice';

      const btn = document.getElementById('combine-start-btn');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span>Đang gộp đề thi... ⏳</span>';
      }

      try {
        const res = await API.combineExams({
          examIds,
          duration_minutes: durationMinutes,
          max_questions: maxQuestions,
          maxQuestions,
          deduplicate: false,
          shuffle: true
        });

        if (res.success && res.data) {
          document.getElementById('modal-combine-exam')?.classList.add('hidden');
          this.showView('exam');
          ExamRunner.startExam(res.data, mode, null, durationMinutes);
          showToast(`Đã gộp thành công ${examIds.length} bộ đề (${res.data.questions.length} câu hỏi)!`, 'success');
        } else {
          showToast(res.error || 'Không thể gộp đề thi.', 'error');
        }
      } catch (err) {
        showToast('Lỗi khi gộp đề thi: ' + err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<span>Bắt đầu làm bài ngay 🚀</span>';
        }
      }
    });

    // Nav Timer Dropdown Popover
    const navTimerBtn = document.getElementById('nav-timer');
    const navTimerDropdown = document.getElementById('nav-timer-dropdown');
    navTimerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      navTimerDropdown?.classList.toggle('hidden');
    });

    // Sub Timer Dropdown Popover (Mobile / Sub-header)
    const subTimerBtn = document.getElementById('exam-sub-timer');
    const subTimerDropdown = document.getElementById('exam-sub-timer-dropdown');
    subTimerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      subTimerDropdown?.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!navTimerDropdown?.classList.contains('hidden')) {
        if (!navTimerBtn?.contains(e.target) && !navTimerDropdown?.contains(e.target)) {
          navTimerDropdown?.classList.add('hidden');
        }
      }
      if (!subTimerDropdown?.classList.contains('hidden')) {
        if (!subTimerBtn?.contains(e.target) && !subTimerDropdown?.contains(e.target)) {
          subTimerDropdown?.classList.add('hidden');
        }
      }
    });
  },

  // View Router
  showView(viewName) {
    const views = ['home', 'exam', 'admin'];
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (v === viewName) {
        el?.classList.remove('hidden');
      } else {
        el?.classList.add('hidden');
      }
    });

    // Adjust Nav Header elements
    const navExamControls = document.getElementById('nav-exam-controls');
    const navStandardLinks = document.getElementById('nav-standard-links');
    const navBackBtn = document.getElementById('nav-back-btn');
    const titleContainer = document.getElementById('nav-exam-title-container');
    const brandBtn = document.getElementById('nav-brand-btn');
    const themeBtn = document.getElementById('theme-toggle-btn');
    const mobileBottomBar = document.getElementById('exam-mobile-bottom-bar');
    const mobilePalette = document.getElementById('modal-question-palette');

    if (viewName === 'exam') {
      navExamControls?.classList.remove('hidden');
      navStandardLinks?.classList.add('hidden');
      navBackBtn?.classList.remove('hidden');
      titleContainer?.classList.remove('hidden');
      mobileBottomBar?.classList.add('hidden');

      // Hide brand logo and theme toggle on mobile in exam view (Screenshot)
      brandBtn?.classList.add('hidden');
      brandBtn?.classList.remove('flex');
      themeBtn?.classList.add('hidden');
    } else {
      navExamControls?.classList.add('hidden');
      navStandardLinks?.classList.remove('hidden');
      titleContainer?.classList.add('hidden');
      navBackBtn?.classList.add('hidden');
      mobileBottomBar?.classList.add('hidden');
      mobilePalette?.classList.add('hidden');

      // Restore brand logo and theme toggle
      brandBtn?.classList.remove('hidden');
      brandBtn?.classList.add('flex');
      themeBtn?.classList.remove('hidden');

      // Clear any exam timer
      if (ExamRunner.timerInterval) {
        clearInterval(ExamRunner.timerInterval);
      }
    }

    if (viewName === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  // Load Categories (Pills bar in Image 3)
  async loadCategories() {
    const pillsContainer = document.getElementById('category-pills');
    if (!pillsContainer) return;

    try {
      const res = await API.getCategories();
      if (!res.success) return;

      pillsContainer.innerHTML = '';

      // Default 'Tất cả' pill
      const allPill = document.createElement('button');
      allPill.className = `cat-pill px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-xs ${
        this.currentCategory === 'Tất cả' ? 'active bg-[#00a86b] text-white' : ''
      }`;
      allPill.textContent = 'Tất cả';
      allPill.addEventListener('click', () => {
        this.currentCategory = 'Tất cả';
        this.updateActivePill();
        this.loadExams();
      });
      pillsContainer.appendChild(allPill);

      // Add each category pill
      res.data.forEach(item => {
        const pill = document.createElement('button');
        pill.className = `cat-pill px-4 py-2 rounded-full text-sm font-semibold transition-all shadow-xs ${
          this.currentCategory === item.category ? 'active bg-[#00a86b] text-white' : ''
        }`;
        pill.textContent = item.category;
        pill.addEventListener('click', () => {
          this.currentCategory = item.category;
          this.updateActivePill();
          this.loadExams();
        });
        pillsContainer.appendChild(pill);
      });
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  },

  updateActivePill() {
    const pills = document.querySelectorAll('.cat-pill');
    pills.forEach(p => {
      if (p.textContent === this.currentCategory) {
        p.classList.add('active', 'bg-[#00a86b]', 'text-white');
      } else {
        p.classList.remove('active', 'bg-[#00a86b]', 'text-white');
      }
    });
  },

  // Load and Render Exam Cards (Matching Screenshot 3)
  async loadExams() {
    const grid = document.getElementById('exams-grid');
    const emptyState = document.getElementById('exams-empty');
    if (!grid) return;

    try {
      const res = await API.getExams(this.currentCategory, this.searchQuery);
      if (!res.success) return;

      grid.innerHTML = '';

      if (res.data.length === 0) {
        grid.classList.add('hidden');
        emptyState?.classList.remove('hidden');
        return;
      }

      grid.classList.remove('hidden');
      emptyState?.classList.add('hidden');

      res.data.forEach(exam => {
        const card = document.createElement('div');
        card.className = 'exam-card bg-white dark:bg-[#111827] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all';

        // Display badge text
        const badge = exam.badge_text || (exam.category ? exam.category.substring(0, 10) : 'Trắc nghiệm');

        card.innerHTML = `
          <div>
            <!-- Top badge and Question count (Screenshot 1) -->
            <div class="flex items-center justify-between mb-3 text-xs">
              <span class="px-2.5 py-1 rounded-md font-semibold bg-[#e6f9f0] dark:bg-emerald-950/50 text-[#00a86b] dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
                ${badge}
              </span>
              <div class="flex items-center space-x-1 text-gray-500 dark:text-gray-400 font-medium">
                <!-- Book/Question Icon -->
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span>${exam.question_count} câu</span>
              </div>
            </div>

            <!-- Title (Screenshot 1) -->
            <h3 class="text-base font-bold text-gray-900 dark:text-white tracking-tight leading-snug mb-1.5 line-clamp-2">
              ${exam.title}
            </h3>

            <!-- Description (Truncated) -->
            <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed mb-5">
              ${exam.description || 'Tổng hợp các câu hỏi trắc nghiệm rèn luyện tư duy và củng cố kiến thức.'}
            </p>
          </div>

          <!-- Bottom Action Buttons (Screenshot 1: Luyện tập & Kiểm tra) -->
          <div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-gray-50 dark:border-gray-800">
            <!-- Luyện tập (Outline / Secondary) -->
            <button class="btn-practice w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold text-xs sm:text-sm hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all text-center cursor-pointer">
              Luyện tập
            </button>

            <!-- Kiểm tra (Primary Emerald Green) -->
            <button class="btn-test w-full py-2.5 rounded-xl bg-[#00a86b] hover:bg-emerald-600 text-white font-bold text-xs sm:text-sm shadow-sm transition-all text-center cursor-pointer">
              Kiểm tra
            </button>
          </div>
        `;

        // Bind Card Actions
        const btnPractice = card.querySelector('.btn-practice');
        const btnTest = card.querySelector('.btn-test');

        btnPractice.addEventListener('click', () => {
          this.promptStartExam(exam, 'practice');
        });

        btnTest.addEventListener('click', () => {
          this.promptStartExam(exam, 'test');
        });

        grid.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  },

  // Prompt duration selection before starting exam
  promptStartExam(exam, mode = 'test') {
    this.pendingExam = { id: exam.id, mode, exam };

    const modal = document.getElementById('modal-start-exam');
    if (!modal) {
      this.openExam(exam.id, mode);
      return;
    }

    const badge = exam.badge_text || (exam.category ? exam.category.substring(0, 15) : 'Trắc nghiệm');
    const badgeEl = document.getElementById('start-exam-badge');
    if (badgeEl) badgeEl.textContent = badge;

    const titleEl = document.getElementById('start-exam-title');
    if (titleEl) titleEl.textContent = exam.title;

    const qcountEl = document.getElementById('start-exam-qcount');
    if (qcountEl) qcountEl.textContent = `${exam.question_count} câu`;

    const defDur = exam.duration_minutes !== undefined ? exam.duration_minutes : 45;
    const defDurEl = document.getElementById('start-exam-default-duration');
    if (defDurEl) defDurEl.textContent = defDur === 0 ? 'Không giới hạn (Tự do)' : `${defDur} phút`;

    const minsInput = document.getElementById('start-exam-custom-mins');
    if (minsInput) minsInput.value = defDur;

    // Sync pills
    const pills = document.querySelectorAll('.start-dur-btn');
    pills.forEach(pill => {
      const pMin = parseInt(pill.dataset.mins, 10);
      if (pMin === parseInt(defDur, 10)) {
        pill.className = 'start-dur-btn active px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-600 bg-emerald-600 text-white transition-all shadow-2xs cursor-pointer';
      } else if (pill.dataset.mins === '0') {
        pill.className = 'start-dur-btn px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all cursor-pointer';
      } else {
        pill.className = 'start-dur-btn px-2.5 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-500 transition-all cursor-pointer';
      }
    });

    modal.classList.remove('hidden');
  },

  // Open Combine Exams Modal for Students
  async openCombineModal() {
    const modal = document.getElementById('modal-combine-exam');
    const listEl = document.getElementById('combine-exams-list');
    const catFilter = document.getElementById('combine-category-filter');
    if (!modal || !listEl) return;

    listEl.innerHTML = '<div class="col-span-2 text-center py-6 text-gray-500 text-xs">Đang tải danh sách đề thi...</div>';
    modal.classList.remove('hidden');

    try {
      const res = await API.getExams();
      if (!res.success || !res.data) {
        listEl.innerHTML = '<div class="col-span-2 text-center py-6 text-rose-500 text-xs">Không thể tải đề thi.</div>';
        return;
      }

      // Populate category filter options
      if (catFilter) {
        const categories = Array.from(new Set(res.data.map(e => e.category).filter(Boolean)));
        catFilter.innerHTML = '<option value="all">Tất cả danh mục</option>';
        categories.forEach(cat => {
          const opt = document.createElement('option');
          opt.value = cat;
          opt.textContent = cat;
          catFilter.appendChild(opt);
        });
      }

      // Render exams list with checkboxes
      listEl.innerHTML = '';
      res.data.forEach(exam => {
        const item = document.createElement('label');
        item.className = 'combine-exam-item flex items-center space-x-2.5 p-2 rounded-xl bg-white border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer text-xs';
        item.dataset.cat = exam.category || '';

        item.innerHTML = `
          <input type="checkbox" value="${exam.id}" data-qcount="${exam.question_count}" class="combine-exam-cb rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer shrink-0">
          <div class="overflow-hidden flex-grow">
            <div class="font-bold text-gray-900 truncate" title="${exam.title}">${exam.title}</div>
            <div class="flex items-center space-x-2 text-2xs text-gray-500 mt-0.5">
              <span class="text-emerald-700 font-semibold">${exam.category}</span>
              <span>•</span>
              <span>${exam.question_count} câu</span>
            </div>
          </div>
        `;

        const cb = item.querySelector('.combine-exam-cb');
        cb.addEventListener('change', () => this.updateCombineSelectedSummary());

        listEl.appendChild(item);
      });

      this.updateCombineSelectedSummary();
    } catch (err) {
      listEl.innerHTML = `<div class="col-span-2 text-center py-6 text-rose-500 text-xs">Lỗi kết nối: ${err.message}</div>`;
    }
  },

  // Update Summary Badge in Student Combine Modal
  updateCombineSelectedSummary() {
    const checkedBoxes = Array.from(document.querySelectorAll('.combine-exam-cb:checked'));
    const totalCount = checkedBoxes.reduce((sum, cb) => sum + (parseInt(cb.dataset.qcount, 10) || 0), 0);
    const badge = document.getElementById('combine-selected-badge');
    if (badge) {
      badge.textContent = `Đã chọn: ${checkedBoxes.length} đề (${totalCount} câu)`;
    }
  },

  // Open Exam
  async openExam(examId, mode = 'test', customDurationMinutes = null) {
    try {
      const res = await API.getExamById(examId);
      if (res.success) {
        this.showView('exam');
        ExamRunner.startExam(res.data, mode, null, customDurationMinutes);
      } else {
        showToast(res.error || 'Không thể mở đề thi', 'error');
      }
    } catch (err) {
      showToast('Lỗi tải đề thi: ' + err.message, 'error');
    }
  }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

