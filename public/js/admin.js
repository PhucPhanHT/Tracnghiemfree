/**
 * UniPrep Admin Dashboard & Exam Upload Controller
 * Supports Admin Authentication and Word (.docx) Smart Parsing.
 */

const AdminController = {
  currentParsedQuestions: [],
  editingExamId: null,
  currentUser: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Admin Top Tab switching
    const tabUploadBtn = document.getElementById('admin-tab-upload-btn');
    const tabListBtn = document.getElementById('admin-tab-list-btn');
    const tabMergeBtn = document.getElementById('admin-tab-merge-btn');
    const tabHistoryBtn = document.getElementById('admin-tab-history-btn');

    tabUploadBtn?.addEventListener('click', () => this.switchTab('upload'));
    tabListBtn?.addEventListener('click', () => this.switchTab('list'));
    tabMergeBtn?.addEventListener('click', () => this.switchTab('merge'));
    tabHistoryBtn?.addEventListener('click', () => this.switchTab('history'));

    // Upload method buttons
    const mWordBtn = document.getElementById('method-word-btn');
    const mTextBtn = document.getElementById('method-text-btn');
    const mFormBtn = document.getElementById('method-form-btn');
    const mJsonBtn = document.getElementById('method-json-btn');

    mWordBtn?.addEventListener('click', () => this.switchMethod('word'));
    mTextBtn?.addEventListener('click', () => this.switchMethod('text'));
    mFormBtn?.addEventListener('click', () => this.switchMethod('form'));
    mJsonBtn?.addEventListener('click', () => this.switchMethod('json'));

    // Word Dropzone and File Input
    const wordInput = document.getElementById('word-file-input');
    const triggerWordBtn = document.getElementById('trigger-word-input-btn');
    const wordDropzone = document.getElementById('word-dropzone');

    triggerWordBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      wordInput?.click();
    });

    wordDropzone?.addEventListener('click', (e) => {
      if (e.target !== triggerWordBtn && !triggerWordBtn?.contains(e.target)) {
        wordInput?.click();
      }
    });

    // Drag & drop handlers
    wordDropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      wordDropzone.classList.add('border-emerald-500', 'bg-emerald-50/60');
    });

    wordDropzone?.addEventListener('dragleave', (e) => {
      e.preventDefault();
      wordDropzone.classList.remove('border-emerald-500', 'bg-emerald-50/60');
    });

    wordDropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      wordDropzone.classList.remove('border-emerald-500', 'bg-emerald-50/60');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.processWordFile(files[0]);
      }
    });

    wordInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.processWordFile(file);
    });

    // Smart Text Parser Sample
    const sampleBtn = document.getElementById('fill-sample-text-btn');
    sampleBtn?.addEventListener('click', () => this.fillSampleExamText());

    // Parse button for raw text
    const parseBtn = document.getElementById('parse-text-btn');
    parseBtn?.addEventListener('click', () => this.handleParseText());

    // Save Exam button
    const saveBtn = document.getElementById('save-exam-btn');
    saveBtn?.addEventListener('click', () => this.handleSaveExam());

    // Add manual question
    const addManualBtn = document.getElementById('add-manual-q-btn');
    addManualBtn?.addEventListener('click', () => this.addManualQuestion());

    // JSON upload input
    const jsonInput = document.getElementById('json-file-input');
    jsonInput?.addEventListener('change', (e) => this.handleJsonUpload(e));

    // Refresh list button
    const refreshListBtn = document.getElementById('admin-refresh-list-btn');
    refreshListBtn?.addEventListener('click', () => this.loadExamsTable());

    // Admin Logout button
    const logoutBtn = document.getElementById('admin-logout-btn');
    logoutBtn?.addEventListener('click', () => this.handleLogout());

    // Admin Change Account button & modal
    const changeAccBtn = document.getElementById('admin-change-account-btn');
    changeAccBtn?.addEventListener('click', () => this.showAccountModal());

    const accCloseBtn = document.getElementById('account-modal-close-btn');
    accCloseBtn?.addEventListener('click', () => this.closeAccountModal());

    const accCancelBtn = document.getElementById('account-cancel-btn');
    accCancelBtn?.addEventListener('click', () => this.closeAccountModal());

    const accForm = document.getElementById('admin-account-form');
    accForm?.addEventListener('submit', (e) => this.handleChangeAccount(e));

    // Admin Login Form
    const loginForm = document.getElementById('admin-login-form');
    loginForm?.addEventListener('submit', (e) => this.handleLogin(e));

    // Close Login Modal
    const loginModalClose = document.getElementById('login-modal-close-btn');
    loginModalClose?.addEventListener('click', () => this.closeLoginModal());

    // Toggle Password visibility
    const togglePwdBtn = document.getElementById('login-toggle-pwd-btn');
    togglePwdBtn?.addEventListener('click', () => {
      const pwdInput = document.getElementById('login-password');
      if (pwdInput) {
        pwdInput.type = pwdInput.type === 'password' ? 'text' : 'password';
      }
    });

    // Admin List Batch Selection (Desktop)
    document.getElementById('admin-select-all-exams')?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      const rowCbs = document.querySelectorAll('.admin-exam-row-cb');
      rowCbs.forEach(cb => cb.checked = checked);
      const mobileSelectAll = document.getElementById('admin-select-all-exams-mobile');
      if (mobileSelectAll) mobileSelectAll.checked = checked;
      this.updateAdminBatchToolbar();
    });

    // Admin List Batch Selection (Mobile)
    document.getElementById('admin-select-all-exams-mobile')?.addEventListener('change', (e) => {
      const checked = e.target.checked;
      const rowCbs = document.querySelectorAll('.admin-exam-row-cb');
      rowCbs.forEach(cb => cb.checked = checked);
      const desktopSelectAll = document.getElementById('admin-select-all-exams');
      if (desktopSelectAll) desktopSelectAll.checked = checked;
      this.updateAdminBatchToolbar();
    });

    document.getElementById('admin-batch-merge-btn')?.addEventListener('click', () => {
      const checkedBoxes = Array.from(document.querySelectorAll('.admin-exam-row-cb:checked'));
      const ids = checkedBoxes.map(cb => parseInt(cb.value, 10));
      if (ids.length < 2) {
        showToast('Vui lòng chọn ít nhất 2 bộ đề để gộp!', 'error');
        return;
      }
      this.switchTab('merge');
      this.loadMergeExams(ids);
    });

    // Admin Merge Tab Category Filter
    document.getElementById('admin-merge-cat-filter')?.addEventListener('change', (e) => {
      const cat = e.target.value;
      const items = document.querySelectorAll('.admin-merge-item');
      items.forEach(item => {
        if (cat === 'all' || item.dataset.cat === cat) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });

    // Admin Merge Select All / Deselect All
    document.getElementById('admin-merge-select-all-btn')?.addEventListener('click', () => {
      const visibleCbs = document.querySelectorAll('.admin-merge-item:not(.hidden) .admin-merge-cb');
      visibleCbs.forEach(cb => cb.checked = true);
      this.updateMergeSelectedSummary();
    });

    document.getElementById('admin-merge-deselect-all-btn')?.addEventListener('click', () => {
      const cbs = document.querySelectorAll('.admin-merge-cb');
      cbs.forEach(cb => cb.checked = false);
      this.updateMergeSelectedSummary();
    });

    // Admin Merge Duration Pills
    const adminMergeDurPills = document.querySelectorAll('.merge-dur-btn');
    adminMergeDurPills.forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = btn.dataset.mins;
        const input = document.getElementById('admin-merge-duration');
        if (input) input.value = mins;

        adminMergeDurPills.forEach(p => {
          if (p === btn) {
            p.className = 'merge-dur-btn active px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-600 bg-emerald-600 text-white transition-all shadow-2xs cursor-pointer';
          } else {
            p.className = 'merge-dur-btn px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-500 transition-all cursor-pointer';
          }
        });
      });
    });

    document.getElementById('admin-merge-duration')?.addEventListener('input', (e) => {
      const val = e.target.value;
      adminMergeDurPills.forEach(p => {
        if (p.dataset.mins === val) {
          p.className = 'merge-dur-btn active px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-600 bg-emerald-600 text-white transition-all shadow-2xs cursor-pointer';
        } else {
          p.className = 'merge-dur-btn px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-emerald-50 hover:border-emerald-500 transition-all cursor-pointer';
        }
      });
    });

    // Admin Merge Submit Button
    document.getElementById('admin-merge-submit-btn')?.addEventListener('click', () => {
      this.handleMergeExams();
    });
  },

  // Check Authentication & Open Admin Dashboard
  async checkAuthAndOpen() {
    const auth = await API.checkAdminAuth();
    if (auth.success && auth.user) {
      this.currentUser = auth.user;
      this.updateAdminUserDisplay(auth.user);
      App.showView('admin');
      this.loadDashboard();
    } else {
      this.showLoginModal();
    }
  },

  showLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    const errorEl = document.getElementById('login-error-msg');
    if (errorEl) errorEl.classList.add('hidden');
    if (modal) modal.classList.remove('hidden');
  },

  closeLoginModal() {
    const modal = document.getElementById('admin-login-modal');
    if (modal) modal.classList.add('hidden');
  },

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username')?.value.trim();
    const password = document.getElementById('login-password')?.value;
    const remember = document.getElementById('login-remember-me')?.checked ?? true;
    const errorEl = document.getElementById('login-error-msg');
    const submitBtn = document.getElementById('login-submit-btn');

    if (!username || !password) {
      if (errorEl) {
        errorEl.textContent = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Đang xác thực...</span>';
    }

    try {
      const res = await API.loginAdmin(username, password, remember);
      if (res.success) {
        this.currentUser = res.user;
        this.updateAdminUserDisplay(res.user);
        this.closeLoginModal();
        showToast('Đăng nhập Quản trị viên thành công!', 'success');
        App.showView('admin');
        this.loadDashboard();
      } else {
        if (errorEl) {
          errorEl.textContent = res.error || 'Tài khoản hoặc mật khẩu không chính xác';
          errorEl.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        errorEl.classList.remove('hidden');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Đăng Nhập Quản Trị</span>';
      }
    }
  },

  async handleLogout() {
    await API.logoutAdmin();
    this.currentUser = null;
    showToast('Đã đăng xuất khỏi tài khoản Quản trị!', 'info');
    App.showView('home');
  },

  updateAdminUserDisplay(user) {
    const displayEl = document.getElementById('admin-user-display');
    if (displayEl && user) {
      displayEl.textContent = `${user.displayName || 'Quản Trị Viên'} (${user.username})`;
    }
  },

  showAccountModal() {
    const modal = document.getElementById('admin-account-modal');
    const errEl = document.getElementById('account-error-msg');
    if (errEl) errEl.classList.add('hidden');

    const currUser = this.currentUser || { username: 'admin', displayName: 'Quản Trị Viên' };
    const usernameInput = document.getElementById('acc-new-username');
    const displayInput = document.getElementById('acc-new-displayname');
    const currPwdInput = document.getElementById('acc-curr-password');
    const newPwdInput = document.getElementById('acc-new-password');
    const confirmPwdInput = document.getElementById('acc-confirm-password');

    if (usernameInput) usernameInput.value = currUser.username || '';
    if (displayInput) displayInput.value = currUser.displayName || '';
    if (currPwdInput) currPwdInput.value = '';
    if (newPwdInput) newPwdInput.value = '';
    if (confirmPwdInput) confirmPwdInput.value = '';

    if (modal) modal.classList.remove('hidden');
  },

  closeAccountModal() {
    const modal = document.getElementById('admin-account-modal');
    if (modal) modal.classList.add('hidden');
  },

  async handleChangeAccount(e) {
    e.preventDefault();
    const currPassword = document.getElementById('acc-curr-password')?.value;
    const newUsername = document.getElementById('acc-new-username')?.value.trim();
    const newDisplayName = document.getElementById('acc-new-displayname')?.value.trim();
    const newPassword = document.getElementById('acc-new-password')?.value;
    const confirmPassword = document.getElementById('acc-confirm-password')?.value;
    const errEl = document.getElementById('account-error-msg');
    const submitBtn = document.getElementById('account-submit-btn');

    if (!currPassword) {
      if (errEl) {
        errEl.textContent = 'Vui lòng nhập mật khẩu hiện tại để xác minh danh tính.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (!newUsername) {
      if (errEl) {
        errEl.textContent = 'Tên đăng nhập mới không được để trống.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        if (errEl) {
          errEl.textContent = 'Mật khẩu mới phải có ít nhất 4 ký tự.';
          errEl.classList.remove('hidden');
        }
        return;
      }
      if (newPassword !== confirmPassword) {
        if (errEl) {
          errEl.textContent = 'Mật khẩu mới và mật khẩu xác nhận không khớp.';
          errEl.classList.remove('hidden');
        }
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Đang cập nhật...</span>';
    }

    try {
      const res = await API.changeAdminAccount({
        currentPassword: currPassword,
        newUsername,
        newDisplayName,
        newPassword: newPassword || undefined
      });

      if (res.success) {
        this.currentUser = res.user;
        this.updateAdminUserDisplay(res.user);
        this.closeAccountModal();
        showToast('Cập nhật tài khoản quản trị thành công!', 'success');
      } else {
        if (errEl) {
          errEl.textContent = res.error || 'Không thể cập nhật tài khoản.';
          errEl.classList.remove('hidden');
        }
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = 'Lỗi kết nối máy chủ: ' + err.message;
        errEl.classList.remove('hidden');
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Lưu Thay Đổi</span>';
      }
    }
  },

  async loadDashboard() {
    await this.loadStats();
    await this.loadExamsTable();
    await this.loadSubmissionsTable();
  },

  async loadStats() {
    try {
      const res = await API.getAdminStats();
      if (res.success) {
        document.getElementById('admin-stat-exams').textContent = res.data.totalExams;
        document.getElementById('admin-stat-questions').textContent = res.data.totalQuestions;
        document.getElementById('admin-stat-submissions').textContent = res.data.totalSubmissions;
        document.getElementById('admin-stat-avg').textContent = res.data.averageScore;
      } else if (res.error && res.error.includes('đăng nhập')) {
        this.showLoginModal();
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    }
  },

  switchTab(tab) {
    const tabs = ['upload', 'list', 'merge', 'history'];
    tabs.forEach(t => {
      const btn = document.getElementById(`admin-tab-${t}-btn`);
      const content = document.getElementById(`admin-content-${t}`);
      if (t === tab) {
        btn?.classList.add('border-emerald-600', 'text-emerald-700');
        btn?.classList.remove('border-transparent', 'text-gray-500');
        content?.classList.remove('hidden');
      } else {
        btn?.classList.remove('border-emerald-600', 'text-emerald-700');
        btn?.classList.add('border-transparent', 'text-gray-500');
        content?.classList.add('hidden');
      }
    });

    if (tab === 'list') this.loadExamsTable();
    if (tab === 'merge') this.loadMergeExams();
    if (tab === 'history') this.loadSubmissionsTable();
  },

  switchMethod(method) {
    const methods = ['word', 'text', 'form', 'json'];
    methods.forEach(m => {
      const btn = document.getElementById(`method-${m}-btn`);
      const section = document.getElementById(`method-${m}-section`);
      if (m === method) {
        btn?.classList.add('bg-white', 'text-emerald-700', 'shadow-xs');
        btn?.classList.remove('text-gray-600');
        section?.classList.remove('hidden');
      } else {
        btn?.classList.remove('bg-white', 'text-emerald-700', 'shadow-xs');
        btn?.classList.add('text-gray-600');
        section?.classList.add('hidden');
      }
    });

    if (method === 'form') {
      const list = document.getElementById('manual-questions-list');
      if (list && list.children.length === 0) {
        this.addManualQuestion();
      }
    }
  },

  // Process Word (.docx) Document Upload
  async processWordFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      showToast('Vui lòng chỉ tải lên file định dạng Word (.docx)!', 'error');
      return;
    }

    const badge = document.getElementById('word-selected-badge');
    const filenameText = document.getElementById('word-filename-text');
    const spinner = document.getElementById('word-spinner');

    if (badge && filenameText) {
      filenameText.textContent = file.name;
      badge.classList.remove('hidden');
    }

    if (spinner) spinner.classList.remove('hidden');

    try {
      const res = await API.uploadWordFile(file);
      if (spinner) spinner.classList.add('hidden');

      if (res.success && res.data.length > 0) {
        this.currentParsedQuestions = res.data;

        // Auto-fill title if empty
        const titleInput = document.getElementById('admin-exam-title');
        if (titleInput && (!titleInput.value || titleInput.value.includes('Mới cập nhật'))) {
          titleInput.value = res.detectedTitle || file.name.replace(/\.docx$/i, '');
        }

        // Fill raw text to textarea for user's inspection
        const textarea = document.getElementById('raw-exam-textarea');
        if (textarea) textarea.value = res.rawText || '';

        this.renderParsedPreview(res.data);
        showToast(`AI đã đọc file Word và phân tích thành công ${res.data.length} câu hỏi!`, 'success');
      } else {
        showToast(res.error || 'Không thể nhận diện câu hỏi từ file Word này. Hãy kiểm tra định dạng câu hỏi trong file.', 'error');
      }
    } catch (err) {
      if (spinner) spinner.classList.add('hidden');
      showToast('Lỗi khi tải file Word: ' + err.message, 'error');
    }
  },

  // Sample Exam Text for quick testing
  fillSampleExamText() {
    const sample = `Câu 1: Bản chất của nhận thức theo quan điểm Mác - Lênin là gì?
A. Sự phản ánh thế giới khách quan vào đầu óc con người một cách thụ động
B. Sự hồi tưởng lại của linh hồn về thế giới ý niệm
C. Quá trình phản ánh tích cực, tự giác và sáng tạo thế giới khách quan vào đầu óc con người trên cơ sở thực tiễn
D. Sự phức hợp của các cảm giác của con người
Đáp án: C
Giải thích: Theo chủ nghĩa duy vật biện chứng, nhận thức là quá trình phản ánh tích cực, tự giác và sáng tạo thế giới khách quan trên nền tảng thực tiễn.

Câu 2: Triết học Mác - Lênin ra đời trong điều kiện kinh tế - xã hội nào?
A. Chủ nghĩa tư bản chuyển sang giai đoạn độc quyền
B. Phương thức sản xuất tư bản chủ nghĩa đã trở thành phương thức thống trị
C. Giai cấp vô sản ra đời và trở thành lực lượng chính trị độc lập
D. Cả B và C đều đúng
Đáp án: D
Giải thích: Triết học Mác ra đời vào những năm 40 thế kỷ XIX khi PTSX tư bản chủ nghĩa đã thống trị và giai cấp vô sản đã bước lên vũ đài lịch sử.

Câu 3: Quy luật nào được V.I.Lênin gọi là hạt nhân của phép biện chứng duy vật?
A. Quy luật chuyển hóa từ những thay đổi về lượng thành những thay đổi về chất
B. Quy luật thống nhất và đấu tranh của các mặt đối lập
C. Quy luật phủ định của phủ định
D. Quy luật giá trị thặng dư
Đáp án: B
Giải thích: Quy luật mâu thuẫn (thống nhất và đấu tranh giữa các mặt đối lập) vạch ra nguồn gốc và động lực của sự phát triển.`;

    const textarea = document.getElementById('raw-exam-textarea');
    if (textarea) textarea.value = sample;

    const titleInput = document.getElementById('admin-exam-title');
    const catInput = document.getElementById('admin-exam-category');
    const descInput = document.getElementById('admin-exam-desc');
    const badgeInput = document.getElementById('admin-exam-badge');

    if (titleInput && !titleInput.value) titleInput.value = 'Đề thi thử Triết học Mác-Lênin (Mới cập nhật)';
    if (catInput && !catInput.value) catInput.value = 'Triết học Mác-Lênin';
    if (descInput && !descInput.value) descInput.value = 'Bộ câu hỏi chọn lọc có giải thích chi tiết.';
    if (badgeInput && !badgeInput.value) badgeInput.value = 'Triết học';

    showToast('Đã điền mẫu câu hỏi chuẩn vào ô văn bản!', 'info');
  },

  // Parse Text via API
  async handleParseText() {
    const textarea = document.getElementById('raw-exam-textarea');
    const rawText = textarea ? textarea.value.trim() : '';

    if (!rawText) {
      showToast('Vui lòng dán văn bản đề thi cần phân tích!', 'error');
      return;
    }

    const statusEl = document.getElementById('parse-status-text');
    if (statusEl) statusEl.textContent = 'Đang phân tích văn bản...';

    try {
      const res = await API.parseText(rawText);
      if (res.success && res.data.length > 0) {
        this.currentParsedQuestions = res.data;
        if (statusEl) statusEl.textContent = `✓ Đã nhận diện thành công ${res.data.length} câu hỏi!`;
        this.renderParsedPreview(res.data);
        showToast(`Phân tích thành công ${res.data.length} câu hỏi!`, 'success');
      } else {
        showToast('Không thể nhận diện câu hỏi từ văn bản. Hãy kiểm tra định dạng Câu 1, A., B., C., D., Đáp án.', 'error');
        if (statusEl) statusEl.textContent = 'Không nhận diện được câu hỏi';
      }
    } catch (err) {
      showToast('Lỗi khi phân tích: ' + err.message, 'error');
      if (statusEl) statusEl.textContent = 'Lỗi phân tích';
    }
  },

  // Render Parsed Questions Preview with Full Inline Edit Capabilities
  renderParsedPreview(questions) {
    const container = document.getElementById('parsed-preview-container');
    const listEl = document.getElementById('preview-questions-list');
    const countBadge = document.getElementById('preview-count-badge');

    if (!container || !listEl) return;

    listEl.innerHTML = '';
    countBadge.textContent = `${questions.length} câu hỏi`;

    if (questions.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          Chưa có câu hỏi nào trong danh sách. Hãy nhấn nút "+ Thêm câu hỏi mới" bên dưới hoặc tải file Word.
        </div>
      `;
    }

    questions.forEach((q, idx) => {
      const item = document.createElement('div');
      item.className = 'p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 transition-all space-y-3 shadow-2xs';
      item.id = `parsed-q-card-${idx}`;

      item.innerHTML = `
        <!-- Top bar: Question Number, Actions -->
        <div class="flex items-center justify-between pb-2 border-b border-gray-100">
          <div class="flex items-center space-x-2">
            <span class="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              ${idx + 1}
            </span>
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">Câu hỏi #${idx + 1}</span>
          </div>
          <div class="flex items-center space-x-2">
            <button type="button" onclick="AdminController.deleteParsedQuestion(${idx})" class="text-xs text-rose-600 hover:text-rose-800 font-bold px-2 py-1 rounded hover:bg-rose-50 flex items-center space-x-1 transition-colors">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              <span>Xóa</span>
            </button>
          </div>
        </div>

        <!-- Question Text Input -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Nội dung câu hỏi:</label>
          <textarea rows="2" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50/40" onchange="AdminController.updateQuestionField(${idx}, 'question_text', this.value)">${q.question_text || ''}</textarea>
        </div>

        <!-- Options A, B, C, D with Correct Answer Radio -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <!-- Option A -->
          <div class="flex items-center space-x-2 p-2 rounded-lg border ${q.correct_answer === 'A' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/20'}">
            <label class="cursor-pointer flex items-center space-x-1 shrink-0" title="Chọn làm đáp án đúng">
              <input type="radio" name="preview_correct_${idx}" value="A" ${q.correct_answer === 'A' ? 'checked' : ''} onchange="AdminController.updateQuestionField(${idx}, 'correct_answer', 'A')" class="text-emerald-600 focus:ring-emerald-500 w-4 h-4">
              <span class="font-bold text-xs text-gray-800">A.</span>
            </label>
            <input type="text" value="${(q.option_a || '').replace(/"/g, '&quot;')}" class="w-full text-xs bg-transparent border-none focus:outline-none text-gray-800" placeholder="Phương án A..." onchange="AdminController.updateQuestionField(${idx}, 'option_a', this.value)">
          </div>

          <!-- Option B -->
          <div class="flex items-center space-x-2 p-2 rounded-lg border ${q.correct_answer === 'B' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/20'}">
            <label class="cursor-pointer flex items-center space-x-1 shrink-0" title="Chọn làm đáp án đúng">
              <input type="radio" name="preview_correct_${idx}" value="B" ${q.correct_answer === 'B' ? 'checked' : ''} onchange="AdminController.updateQuestionField(${idx}, 'correct_answer', 'B')" class="text-emerald-600 focus:ring-emerald-500 w-4 h-4">
              <span class="font-bold text-xs text-gray-800">B.</span>
            </label>
            <input type="text" value="${(q.option_b || '').replace(/"/g, '&quot;')}" class="w-full text-xs bg-transparent border-none focus:outline-none text-gray-800" placeholder="Phương án B..." onchange="AdminController.updateQuestionField(${idx}, 'option_b', this.value)">
          </div>

          <!-- Option C -->
          <div class="flex items-center space-x-2 p-2 rounded-lg border ${q.correct_answer === 'C' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/20'}">
            <label class="cursor-pointer flex items-center space-x-1 shrink-0" title="Chọn làm đáp án đúng">
              <input type="radio" name="preview_correct_${idx}" value="C" ${q.correct_answer === 'C' ? 'checked' : ''} onchange="AdminController.updateQuestionField(${idx}, 'correct_answer', 'C')" class="text-emerald-600 focus:ring-emerald-500 w-4 h-4">
              <span class="font-bold text-xs text-gray-800">C.</span>
            </label>
            <input type="text" value="${(q.option_c || '').replace(/"/g, '&quot;')}" class="w-full text-xs bg-transparent border-none focus:outline-none text-gray-800" placeholder="Phương án C..." onchange="AdminController.updateQuestionField(${idx}, 'option_c', this.value)">
          </div>

          <!-- Option D -->
          <div class="flex items-center space-x-2 p-2 rounded-lg border ${q.correct_answer === 'D' ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/20'}">
            <label class="cursor-pointer flex items-center space-x-1 shrink-0" title="Chọn làm đáp án đúng">
              <input type="radio" name="preview_correct_${idx}" value="D" ${q.correct_answer === 'D' ? 'checked' : ''} onchange="AdminController.updateQuestionField(${idx}, 'correct_answer', 'D')" class="text-emerald-600 focus:ring-emerald-500 w-4 h-4">
              <span class="font-bold text-xs text-gray-800">D.</span>
            </label>
            <input type="text" value="${(q.option_d || '').replace(/"/g, '&quot;')}" class="w-full text-xs bg-transparent border-none focus:outline-none text-gray-800" placeholder="Phương án D..." onchange="AdminController.updateQuestionField(${idx}, 'option_d', this.value)">
          </div>
        </div>

        <!-- Explanation Input -->
        <div>
          <label class="block text-xs font-semibold text-gray-500 mb-1">💡 Lời giải & Phân tích AI:</label>
          <input type="text" value="${(q.explanation || '').replace(/"/g, '&quot;')}" placeholder="Nhập lời giải hoặc căn cứ trích dẫn sách giáo trình..." class="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-gray-50/30 focus:ring-1 focus:ring-emerald-500" onchange="AdminController.updateQuestionField(${idx}, 'explanation', this.value)">
        </div>
      `;

      listEl.appendChild(item);
    });

    // Add Question Button at the end of list
    const addMoreDiv = document.createElement('div');
    addMoreDiv.className = 'pt-2 flex justify-center';
    addMoreDiv.innerHTML = `
      <button type="button" onclick="AdminController.addNewQuestionToParsed()" class="px-5 py-2 rounded-xl border border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-50 font-bold text-xs flex items-center space-x-2 transition-all">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        <span>+ Thêm câu hỏi mới vào bộ đề</span>
      </button>
    `;
    listEl.appendChild(addMoreDiv);

    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  },

  updateQuestionField(idx, field, value) {
    if (this.currentParsedQuestions[idx]) {
      this.currentParsedQuestions[idx][field] = value.trim();
      // If changing correct answer, refresh borders visually
      if (field === 'correct_answer') {
        this.renderParsedPreview(this.currentParsedQuestions);
      }
    }
  },

  deleteParsedQuestion(idx) {
    if (confirm(`Bạn có chắc muốn xóa câu hỏi số ${idx + 1} khỏi danh sách?`)) {
      this.currentParsedQuestions.splice(idx, 1);
      this.currentParsedQuestions.forEach((q, i) => q.question_number = i + 1);
      this.renderParsedPreview(this.currentParsedQuestions);
      showToast(`Đã xóa câu hỏi #${idx + 1}`, 'info');
    }
  },

  addNewQuestionToParsed() {
    const newNum = this.currentParsedQuestions.length + 1;
    this.currentParsedQuestions.push({
      question_number: newNum,
      question_text: `Câu hỏi số ${newNum}: `,
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      explanation: ''
    });
    this.renderParsedPreview(this.currentParsedQuestions);
    showToast(`Đã thêm câu hỏi #${newNum}. Bạn có thể chỉnh sửa ngay.`, 'success');
  },

  // Manual Question Builder
  addManualQuestion() {
    const list = document.getElementById('manual-questions-list');
    if (!list) return;

    const qNum = list.children.length + 1;
    const card = document.createElement('div');
    card.className = 'manual-q-card p-5 rounded-2xl border border-gray-200 bg-gray-50/50 space-y-3';
    card.id = `manual-q-${qNum}`;

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-gray-800 text-sm">Câu hỏi #${qNum}</span>
        <button type="button" onclick="this.closest('.manual-q-card').remove(); AdminController.renumberManualQuestions();" class="text-xs text-rose-600 font-bold hover:underline">
          Xóa câu này
        </button>
      </div>
      <input type="text" placeholder="Nhập nội dung câu hỏi..." class="manual-q-text w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-1 focus:ring-emerald-500">
      
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-gray-200">
          <input type="radio" name="manual_correct_${qNum}" value="A" checked class="manual-correct text-emerald-600">
          <input type="text" placeholder="Phương án A" class="manual-opt-a w-full border-none focus:outline-none text-xs">
        </div>
        <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-gray-200">
          <input type="radio" name="manual_correct_${qNum}" value="B" class="manual-correct text-emerald-600">
          <input type="text" placeholder="Phương án B" class="manual-opt-b w-full border-none focus:outline-none text-xs">
        </div>
        <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-gray-200">
          <input type="radio" name="manual_correct_${qNum}" value="C" class="manual-correct text-emerald-600">
          <input type="text" placeholder="Phương án C" class="manual-opt-c w-full border-none focus:outline-none text-xs">
        </div>
        <div class="flex items-center space-x-2 bg-white p-2 rounded-lg border border-gray-200">
          <input type="radio" name="manual_correct_${qNum}" value="D" class="manual-correct text-emerald-600">
          <input type="text" placeholder="Phương án D" class="manual-opt-d w-full border-none focus:outline-none text-xs">
        </div>
      </div>

      <input type="text" placeholder="Giải thích đáp án & Lời giải AI..." class="manual-q-exp w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:ring-1 focus:ring-emerald-500">
    `;

    list.appendChild(card);
  },

  renumberManualQuestions() {
    const list = document.getElementById('manual-questions-list');
    if (!list) return;
    Array.from(list.children).forEach((card, idx) => {
      const qNum = idx + 1;
      const title = card.querySelector('span');
      if (title) title.textContent = `Câu hỏi #${qNum}`;
      card.querySelectorAll('.manual-correct').forEach(r => r.name = `manual_correct_${qNum}`);
    });
  },

  collectManualQuestions() {
    const list = document.getElementById('manual-questions-list');
    if (!list) return [];

    const questions = [];
    Array.from(list.children).forEach((card, idx) => {
      const qText = card.querySelector('.manual-q-text')?.value.trim();
      const optA = card.querySelector('.manual-opt-a')?.value.trim();
      const optB = card.querySelector('.manual-opt-b')?.value.trim();
      const optC = card.querySelector('.manual-opt-c')?.value.trim();
      const optD = card.querySelector('.manual-opt-d')?.value.trim();
      const exp = card.querySelector('.manual-q-exp')?.value.trim();
      const checkedRadio = card.querySelector(`input[name="manual_correct_${idx + 1}"]:checked`);
      const correct = checkedRadio ? checkedRadio.value : 'A';

      if (qText && optA) {
        questions.push({
          question_number: idx + 1,
          question_text: qText,
          option_a: optA,
          option_b: optB || '',
          option_c: optC || '',
          option_d: optD || '',
          correct_answer: correct,
          explanation: exp || ''
        });
      }
    });

    return questions;
  },

  // JSON File Upload
  handleJsonUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.title) document.getElementById('admin-exam-title').value = json.title;
        if (json.category) document.getElementById('admin-exam-category').value = json.category;
        if (json.description) document.getElementById('admin-exam-desc').value = json.description;
        if (json.duration_minutes) document.getElementById('admin-exam-duration').value = json.duration_minutes;
        if (json.badge_text) document.getElementById('admin-exam-badge').value = json.badge_text;

        const qs = json.questions || (Array.isArray(json) ? json : []);
        if (qs.length > 0) {
          this.currentParsedQuestions = qs;
          this.renderParsedPreview(qs);
          showToast(`Đã tải thành công file JSON với ${qs.length} câu hỏi!`, 'success');
        } else {
          showToast('File JSON không chứa danh sách câu hỏi hợp lệ.', 'error');
        }
      } catch (err) {
        showToast('File JSON không đúng cấu trúc: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  },

  // Save Exam to Database
  async handleSaveExam() {
    const title = document.getElementById('admin-exam-title')?.value.trim();
    const category = document.getElementById('admin-exam-category')?.value.trim();
    const description = document.getElementById('admin-exam-desc')?.value.trim();
    const duration_minutes = parseInt(document.getElementById('admin-exam-duration')?.value, 10) || 45;
    const badge_text = document.getElementById('admin-exam-badge')?.value.trim() || category.substring(0, 10);

    if (!title) {
      showToast('Vui lòng nhập tên đề thi!', 'error');
      document.getElementById('admin-exam-title')?.focus();
      return;
    }

    if (!category) {
      showToast('Vui lòng nhập môn học / danh mục!', 'error');
      document.getElementById('admin-exam-category')?.focus();
      return;
    }

    let questions = this.currentParsedQuestions;
    const formSection = document.getElementById('method-form-section');
    if (!formSection?.classList.contains('hidden')) {
      const manualQs = this.collectManualQuestions();
      if (manualQs.length > 0) questions = manualQs;
    }

    if (!questions || questions.length === 0) {
      showToast('Đề thi chưa có câu hỏi nào. Hãy tải file Word hoặc dán câu hỏi!', 'error');
      return;
    }

    const payload = {
      title,
      category,
      description,
      duration_minutes,
      badge_text,
      questions
    };

    try {
      let res;
      if (this.editingExamId) {
        res = await API.updateExam(this.editingExamId, payload);
      } else {
        res = await API.createExam(payload);
      }

      if (res.success) {
        showToast(this.editingExamId ? 'Cập nhật đề thi thành công!' : 'Tạo và lưu đề thi vào Database thành công!', 'success');
        this.resetForm();
        await this.loadDashboard();
        this.switchTab('list');

        if (typeof App !== 'undefined') {
          App.loadCategories();
          App.loadExams();
        }
      } else {
        if (res.error && res.error.includes('đăng nhập')) {
          this.showLoginModal();
        }
        showToast(res.error || 'Có lỗi xảy ra', 'error');
      }
    } catch (err) {
      showToast('Lỗi máy chủ: ' + err.message, 'error');
    }
  },

  resetForm() {
    this.editingExamId = null;
    this.currentParsedQuestions = [];
    document.getElementById('admin-exam-title').value = '';
    document.getElementById('admin-exam-category').value = '';
    document.getElementById('admin-exam-desc').value = '';
    document.getElementById('admin-exam-duration').value = '45';
    document.getElementById('admin-exam-badge').value = '';
    document.getElementById('raw-exam-textarea').value = '';
    document.getElementById('word-selected-badge')?.classList.add('hidden');
    document.getElementById('word-file-input').value = '';
    document.getElementById('parsed-preview-container')?.classList.add('hidden');

    const editAlert = document.getElementById('admin-edit-alert');
    if (editAlert) editAlert.classList.add('hidden');

    const saveBtn = document.getElementById('save-exam-btn');
    if (saveBtn) {
      saveBtn.className = 'px-6 py-2.5 rounded-xl bg-[#00a86b] hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center space-x-2 transition-all';
      saveBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>Lưu Bộ Đề Vào Database</span>
      `;
    }
  },

  // Open Edit Exam
  async openEditExam(examId) {
    try {
      showToast('Đang tải dữ liệu đề thi để sửa...', 'info');
      const res = await API.getExamById(examId);
      if (!res.success || !res.data) {
        showToast(res.error || 'Không tìm thấy dữ liệu đề thi', 'error');
        return;
      }

      const exam = res.data;
      this.editingExamId = exam.id;

      // Fill metadata form
      document.getElementById('admin-exam-title').value = exam.title || '';
      document.getElementById('admin-exam-category').value = exam.category || '';
      document.getElementById('admin-exam-desc').value = exam.description || '';
      document.getElementById('admin-exam-duration').value = exam.duration_minutes || 45;
      document.getElementById('admin-exam-badge').value = exam.badge_text || '';

      // Prepare questions
      this.currentParsedQuestions = (exam.questions || []).map((q, idx) => ({
        question_number: idx + 1,
        question_text: q.question_text || '',
        option_a: q.option_a || '',
        option_b: q.option_b || '',
        option_c: q.option_c || '',
        option_d: q.option_d || '',
        correct_answer: (q.correct_answer || 'A').toUpperCase(),
        explanation: q.explanation || ''
      }));

      // Show Edit Mode Banner
      const editAlert = document.getElementById('admin-edit-alert');
      const titleBadge = document.getElementById('admin-edit-title-badge');
      const idBadge = document.getElementById('admin-edit-id-badge');
      if (editAlert) editAlert.classList.remove('hidden');
      if (titleBadge) titleBadge.textContent = exam.title;
      if (idBadge) idBadge.textContent = exam.id;

      // Update Save button style and label
      const saveBtn = document.getElementById('save-exam-btn');
      if (saveBtn) {
        saveBtn.className = 'px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/25 flex items-center space-x-2 transition-all';
        saveBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
          </svg>
          <span>Lưu Cập Nhật Đề Thi #${exam.id}</span>
        `;
      }

      // Render interactive questions preview
      this.renderParsedPreview(this.currentParsedQuestions);

      // Switch to upload/edit tab
      this.switchTab('upload');

      window.scrollTo({ top: 120, behavior: 'smooth' });
      showToast(`Đã mở bộ đề "${exam.title}" để chỉnh sửa!`, 'success');
    } catch (err) {
      showToast('Lỗi khi tải đề thi: ' + err.message, 'error');
    }
  },

  cancelEdit() {
    this.resetForm();
    showToast('Đã hủy chế độ sửa, quay về tạo đề mới.', 'info');
  },

  // Update Batch Toolbar in Exam List Tab
  updateAdminBatchToolbar() {
    const checkedBoxes = Array.from(document.querySelectorAll('.admin-exam-row-cb:checked'));
    const toolbar = document.getElementById('admin-batch-actions');
    const countEl = document.getElementById('admin-batch-count');
    const selectAllCb = document.getElementById('admin-select-all-exams');
    const selectAllMobile = document.getElementById('admin-select-all-exams-mobile');

    if (countEl) countEl.textContent = checkedBoxes.length;

    if (checkedBoxes.length >= 2) {
      toolbar?.classList.remove('hidden');
      toolbar?.classList.add('flex');
    } else {
      toolbar?.classList.add('hidden');
      toolbar?.classList.remove('flex');
    }

    const allRowCbs = document.querySelectorAll('.admin-exam-row-cb');
    if (allRowCbs.length > 0) {
      const isAllSelected = checkedBoxes.length === allRowCbs.length;
      if (selectAllCb) selectAllCb.checked = isAllSelected;
      if (selectAllMobile) selectAllMobile.checked = isAllSelected;
    }
  },

  // Load Exams Table
  async loadExamsTable() {
    const tbody = document.getElementById('admin-exams-table-body');
    const mobileCardsContainer = document.getElementById('admin-exams-cards-mobile');
    if (!tbody) return;

    // Reset batch toolbar & select all checkboxes
    const selectAllCb = document.getElementById('admin-select-all-exams');
    const selectAllMobile = document.getElementById('admin-select-all-exams-mobile');
    if (selectAllCb) selectAllCb.checked = false;
    if (selectAllMobile) selectAllMobile.checked = false;
    this.updateAdminBatchToolbar();

    try {
      const res = await API.getExams();
      if (!res.success) return;

      tbody.innerHTML = '';
      if (mobileCardsContainer) mobileCardsContainer.innerHTML = '';

      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-gray-500">Chưa có đề thi nào trong cơ sở dữ liệu.</td></tr>`;
        if (mobileCardsContainer) {
          mobileCardsContainer.innerHTML = `<div class="text-center py-8 text-gray-500 text-xs">Chưa có đề thi nào trong cơ sở dữ liệu.</div>`;
        }
        return;
      }

      res.data.forEach(exam => {
        // Desktop Table Row
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors';

        tr.innerHTML = `
          <td class="py-3 px-3 text-center">
            <input type="checkbox" value="${exam.id}" data-qcount="${exam.question_count}" data-title="${exam.title.replace(/"/g, '&quot;')}" class="admin-exam-row-cb rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4">
          </td>
          <td class="py-3 px-3 font-mono text-xs text-gray-500">#${exam.id}</td>
          <td class="py-3 px-4">
            <div class="font-bold text-gray-900 dark:text-white">${exam.title}</div>
            <div class="text-xs text-gray-400 line-clamp-1">${exam.description || 'Không có mô tả'}</div>
          </td>
          <td class="py-3 px-4">
            <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
              ${exam.category}
            </span>
          </td>
          <td class="py-3 px-4 text-center font-bold text-gray-700 dark:text-gray-300">${exam.question_count} câu</td>
          <td class="py-3 px-4 text-center text-gray-600 dark:text-gray-400">${exam.duration_minutes} phút</td>
          <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
            <button onclick="AdminController.openEditExam(${exam.id})" class="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-400 text-xs font-bold transition-colors inline-flex items-center space-x-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              <span>Sửa</span>
            </button>
            <button onclick="App.openExam(${exam.id}, 'test')" class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 text-xs font-bold transition-colors inline-flex items-center space-x-1">
              <span>Thi thử</span>
            </button>
            <button onclick="AdminController.deleteExam(${exam.id}, '${exam.title.replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-400 text-xs font-bold transition-colors inline-flex items-center space-x-1">
              <span>Xóa</span>
            </button>
          </td>
        `;

        const rowCb = tr.querySelector('.admin-exam-row-cb');
        rowCb.addEventListener('change', () => this.updateAdminBatchToolbar());
        tbody.appendChild(tr);

        // Mobile Card (Screenshot 5)
        if (mobileCardsContainer) {
          const mCard = document.createElement('div');
          mCard.className = 'p-4 rounded-2xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-gray-800 shadow-2xs space-y-3';
          mCard.innerHTML = `
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <input type="checkbox" value="${exam.id}" data-qcount="${exam.question_count}" data-title="${exam.title.replace(/"/g, '&quot;')}" class="admin-exam-row-cb rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4">
                <span class="font-mono text-xs text-gray-400 font-bold">#${exam.id}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                ${exam.category}
              </span>
            </div>

            <div>
              <h4 class="text-sm font-bold text-gray-900 dark:text-white leading-snug">${exam.title}</h4>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">${exam.description || 'Không có mô tả'}</p>
            </div>

            <div class="flex items-center space-x-4 text-xs font-semibold text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-100 dark:border-gray-800/80">
              <span class="flex items-center space-x-1">
                <span>📝</span>
                <span>${exam.question_count} câu</span>
              </span>
              <span class="flex items-center space-x-1">
                <span>⏱️</span>
                <span>${exam.duration_minutes} phút</span>
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button onclick="AdminController.openEditExam(${exam.id})" class="w-full py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 text-xs font-bold transition-colors text-center">
                Sửa
              </button>
              <button onclick="App.openExam(${exam.id}, 'test')" class="w-full py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-bold transition-colors text-center">
                Thi thử
              </button>
              <button onclick="AdminController.deleteExam(${exam.id}, '${exam.title.replace(/'/g, "\\'")}')" class="w-full py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 text-xs font-bold transition-colors text-center">
                Xóa
              </button>
            </div>
          `;

          const mRowCb = mCard.querySelector('.admin-exam-row-cb');
          mRowCb.addEventListener('change', () => this.updateAdminBatchToolbar());
          mobileCardsContainer.appendChild(mCard);
        }
      });
    } catch (err) {
      console.error('Failed to load exams table:', err);
    }
  },

  // Load Admin Merge Tab Exams
  async loadMergeExams(preselectedIds = []) {
    const listEl = document.getElementById('admin-merge-exams-list');
    const catFilter = document.getElementById('admin-merge-cat-filter');
    if (!listEl) return;

    listEl.innerHTML = '<div class="col-span-full text-center py-6 text-gray-500 text-xs">Đang tải danh sách đề thi...</div>';

    try {
      const res = await API.getExams();
      if (!res.success || !res.data) {
        listEl.innerHTML = '<div class="col-span-full text-center py-6 text-rose-500 text-xs">Không thể tải đề thi.</div>';
        return;
      }

      // Populate Category Filter
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

      listEl.innerHTML = '';
      const selectedTitles = [];

      res.data.forEach(exam => {
        const isPreselected = preselectedIds.includes(exam.id);
        if (isPreselected) selectedTitles.push(exam.title);

        const item = document.createElement('label');
        item.className = 'admin-merge-item flex items-center space-x-2.5 p-2 rounded-xl bg-white border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30 transition-all cursor-pointer text-xs';
        item.dataset.cat = exam.category || '';

        item.innerHTML = `
          <input type="checkbox" value="${exam.id}" data-qcount="${exam.question_count}" data-title="${exam.title.replace(/"/g, '&quot;')}" ${isPreselected ? 'checked' : ''} class="admin-merge-cb rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer shrink-0">
          <div class="overflow-hidden flex-grow">
            <div class="font-bold text-gray-900 truncate" title="${exam.title}">${exam.title}</div>
            <div class="flex items-center space-x-2 text-2xs text-gray-500 mt-0.5">
              <span class="text-emerald-700 font-semibold">${exam.category}</span>
              <span>•</span>
              <span>${exam.question_count} câu</span>
            </div>
          </div>
        `;

        const cb = item.querySelector('.admin-merge-cb');
        cb.addEventListener('change', () => this.updateMergeSelectedSummary());

        listEl.appendChild(item);
      });

      this.updateMergeSelectedSummary();

      // Auto-suggest title if preselected
      const titleInput = document.getElementById('admin-merge-title');
      const catInput = document.getElementById('admin-merge-category');
      if (titleInput && (!titleInput.value || titleInput.value.startsWith('Đề thi tổng hợp'))) {
        if (selectedTitles.length >= 2) {
          titleInput.value = `Đề thi tổng hợp (${selectedTitles.length} đề thi)`;
        }
      }
      if (catInput && !catInput.value && res.data.length > 0) {
        catInput.value = res.data[0].category || 'Tổng hợp';
      }
    } catch (err) {
      listEl.innerHTML = `<div class="col-span-full text-center py-6 text-rose-500 text-xs">Lỗi kết nối: ${err.message}</div>`;
    }
  },

  // Update Summary Badge in Admin Merge Tab
  updateMergeSelectedSummary() {
    const checkedBoxes = Array.from(document.querySelectorAll('.admin-merge-cb:checked'));
    const totalCount = checkedBoxes.reduce((sum, cb) => sum + (parseInt(cb.dataset.qcount, 10) || 0), 0);
    const summaryEl = document.getElementById('admin-merge-selected-summary');
    if (summaryEl) {
      summaryEl.textContent = `Đã chọn: ${checkedBoxes.length} đề (${totalCount} câu)`;
    }
  },

  // Handle Permanent Merge Submit (Admin)
  async handleMergeExams() {
    const checkedBoxes = Array.from(document.querySelectorAll('.admin-merge-cb:checked'));
    const examIds = checkedBoxes.map(cb => parseInt(cb.value, 10));

    if (examIds.length < 2) {
      showToast('Vui lòng chọn ít nhất 2 bộ đề để gộp!', 'error');
      return;
    }

    const title = document.getElementById('admin-merge-title')?.value.trim();
    if (!title) {
      showToast('Vui lòng nhập tên cho đề thi gộp mới!', 'error');
      document.getElementById('admin-merge-title')?.focus();
      return;
    }

    const category = document.getElementById('admin-merge-category')?.value.trim() || 'Tổng hợp';
    const description = document.getElementById('admin-merge-desc')?.value.trim() || '';
    const badge_text = document.getElementById('admin-merge-badge')?.value.trim() || 'Tổng hợp';
    const duration_minutes = parseInt(document.getElementById('admin-merge-duration')?.value, 10) || 45;
    const max_questions = parseInt(document.getElementById('admin-merge-max-q')?.value, 10) || 0;
    const deduplicate = document.getElementById('admin-merge-dedup')?.checked ?? true;
    const shuffle = document.getElementById('admin-merge-shuffle')?.checked ?? true;

    const submitBtn = document.getElementById('admin-merge-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <div class="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
        <span>Đang tiến hành gộp đề thi...</span>
      `;
    }

    try {
      const res = await API.mergeAdminExams({
        examIds,
        title,
        category,
        description,
        badge_text,
        duration_minutes,
        max_questions,
        deduplicate,
        shuffle
      });

      if (res.success && res.data) {
        showToast(`Gộp đề thành công! Bộ đề mới "${res.data.title}" (#${res.data.id}) đã được lưu với ${res.data.question_count} câu hỏi.`, 'success');

        // Reset title & desc
        document.getElementById('admin-merge-title').value = '';
        document.getElementById('admin-merge-desc').value = '';

        // Reload dashboard & switch to list tab
        await this.loadDashboard();
        this.switchTab('list');

        if (typeof App !== 'undefined') {
          App.loadCategories();
          App.loadExams();
        }
      } else {
        if (res.error && res.error.includes('đăng nhập')) {
          this.showLoginModal();
        }
        showToast(res.error || 'Không thể gộp đề thi.', 'error');
      }
    } catch (err) {
      showToast('Lỗi máy chủ khi gộp đề: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
          </svg>
          <span>Gộp Đề & Lưu Vào Database Ngay</span>
        `;
      }
    }
  },

  async deleteExam(id, title) {
    if (!confirm(`Bạn có chắc chắn muốn xóa bộ đề "${title}" không? Dữ liệu câu hỏi và lịch sử làm bài sẽ bị xóa vĩnh viễn.`)) {
      return;
    }

    try {
      const res = await API.deleteExam(id);
      if (res.success) {
        showToast('Đã xóa bộ đề thành công!', 'success');
        await this.loadDashboard();
        if (typeof App !== 'undefined') {
          App.loadCategories();
          App.loadExams();
        }
      } else {
        if (res.error && res.error.includes('đăng nhập')) {
          this.showLoginModal();
        }
        showToast(res.error || 'Có lỗi khi xóa đề', 'error');
      }
    } catch (err) {
      showToast('Lỗi máy chủ: ' + err.message, 'error');
    }
  },

  // Load Submissions Table
  async loadSubmissionsTable() {
    const tbody = document.getElementById('admin-submissions-table-body');
    if (!tbody) return;

    try {
      const res = await API.getAdminSubmissions();
      if (!res.success) {
        if (res.error && res.error.includes('đăng nhập')) {
          this.showLoginModal();
        }
        return;
      }

      tbody.innerHTML = '';
      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">Chưa có lượt làm bài nào.</td></tr>`;
        return;
      }

      res.data.forEach(sub => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition-colors';

        const mins = Math.floor(sub.time_spent_seconds / 60);
        const secs = sub.time_spent_seconds % 60;
        const timeStr = `${mins}m ${secs}s`;

        const scoreColor = sub.score >= 8.0 ? 'text-emerald-600 bg-emerald-50' : sub.score >= 5.0 ? 'text-blue-600 bg-blue-50' : 'text-rose-600 bg-rose-50';

        tr.innerHTML = `
          <td class="py-3 px-4 text-xs text-gray-500">${new Date(sub.submitted_at).toLocaleString('vi-VN')}</td>
          <td class="py-3 px-4 font-semibold text-gray-900">${sub.exam_title}</td>
          <td class="py-3 px-4 text-center">
            <span class="inline-block px-3 py-1 rounded-full text-xs font-black ${scoreColor}">
              ${sub.score} / 10
            </span>
          </td>
          <td class="py-3 px-4 text-center text-xs">
            <span class="text-emerald-700 font-bold">${sub.correct_count} đúng</span> / 
            <span class="text-rose-600 font-bold">${sub.wrong_count} sai</span>
          </td>
          <td class="py-3 px-4 text-center text-xs text-gray-600 font-mono">${timeStr}</td>
        `;

        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load submissions table:', err);
    }
  }
};
