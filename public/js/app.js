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

    if (viewName === 'exam') {
      navExamControls?.classList.remove('hidden');
      navStandardLinks?.classList.add('hidden');
      navBackBtn?.classList.remove('hidden');
      titleContainer?.classList.remove('hidden');
    } else {
      navExamControls?.classList.add('hidden');
      navStandardLinks?.classList.remove('hidden');
      titleContainer?.classList.add('hidden');
      navBackBtn?.classList.add('hidden');

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
        card.className = 'exam-card bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition-all';

        // Display badge text
        const badge = exam.badge_text || (exam.category ? exam.category.substring(0, 10) : 'Trắc nghiệm');

        card.innerHTML = `
          <div>
            <!-- Top badge and Question count (Exact match of Image 3) -->
            <div class="flex items-center justify-between mb-3 text-xs">
              <span class="px-2.5 py-1 rounded-md font-semibold bg-[#e6f9f0] text-[#00a86b]">
                ${badge}
              </span>
              <div class="flex items-center space-x-1 text-gray-500 font-medium">
                <!-- Book/Question Icon -->
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <span>${exam.question_count} câu</span>
              </div>
            </div>

            <!-- Title (Exact match of Image 3) -->
            <h3 class="text-base font-bold text-gray-900 tracking-tight leading-snug mb-2 line-clamp-2">
              ${exam.title}
            </h3>

            <!-- Description (Truncated) -->
            <p class="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-6">
              ${exam.description || 'Tổng hợp các câu hỏi trắc nghiệm rèn luyện tư duy và củng cố kiến thức.'}
            </p>
          </div>

          <!-- Bottom Action Buttons (Matching Image 3: Luyện tập & Kiểm tra) -->
          <div class="grid grid-cols-2 gap-2.5 pt-2 border-t border-gray-50">
            <!-- Luyện tập (Outline / Secondary) -->
            <button class="btn-practice w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs sm:text-sm hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/50 transition-all text-center">
              Luyện tập
            </button>

            <!-- Kiểm tra (Primary Emerald Green) -->
            <button class="btn-test w-full py-2.5 rounded-xl bg-[#00a86b] hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all text-center">
              Kiểm tra
            </button>
          </div>
        `;

        // Bind Card Actions
        const btnPractice = card.querySelector('.btn-practice');
        const btnTest = card.querySelector('.btn-test');

        btnPractice.addEventListener('click', () => {
          this.openExam(exam.id, 'practice');
        });

        btnTest.addEventListener('click', () => {
          this.openExam(exam.id, 'test');
        });

        grid.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load exams:', err);
    }
  },

  // Open Exam
  async openExam(examId, mode = 'test') {
    try {
      const res = await API.getExamById(examId);
      if (res.success) {
        this.showView('exam');
        ExamRunner.startExam(res.data, mode);
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

