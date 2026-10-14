/**
 * UniPrep API Client with Admin Authentication & Word Upload
 */
const API = {
  TOKEN_KEY: 'uniprep_admin_token',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY) || '';
  },

  setToken(token, remember = true) {
    if (remember) {
      localStorage.setItem(this.TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(this.TOKEN_KEY, token);
    }
  },

  clearToken() {
    localStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
  },

  authHeaders(extra = {}) {
    const token = this.getToken();
    return {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...extra
    };
  },

  // Admin Auth
  async loginAdmin(username, password, remember = true) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success && data.token) {
      this.setToken(data.token, remember);
    }
    return data;
  },

  async checkAdminAuth() {
    const token = this.getToken();
    if (!token) return { success: false };

    try {
      const res = await fetch('/api/admin/me', {
        headers: this.authHeaders()
      });
      return await res.json();
    } catch {
      return { success: false };
    }
  },

  async logoutAdmin() {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: this.authHeaders()
      });
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      this.clearToken();
    }
  },

  // Public Exams & Categories
  async getCategories() {
    const res = await fetch('/api/categories');
    return res.json();
  },

  async getExams(category = '', search = '') {
    const params = new URLSearchParams();
    if (category && category !== 'Tất cả') params.append('category', category);
    if (search) params.append('search', search);
    const res = await fetch(`/api/exams?${params.toString()}`);
    return res.json();
  },

  async askAi(payload) {
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  async getExamById(id) {
    const res = await fetch(`/api/exams/${id}`);
    return res.json();
  },

  async submitExam(id, userAnswers, timeSpentSeconds) {
    const res = await fetch(`/api/exams/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAnswers, timeSpentSeconds })
    });
    return res.json();
  },

  // Word (.docx) Upload & Smart Parse
  async uploadWordFile(file) {
    const formData = new FormData();
    formData.append('wordFile', file);

    const res = await fetch('/api/exams/upload-word', {
      method: 'POST',
      headers: this.authHeaders(),
      body: formData
    });
    return res.json();
  },

  // Text Parse
  async parseText(rawText) {
    const res = await fetch('/api/exams/parse-text', {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ rawText })
    });
    return res.json();
  },

  // Admin Exam Management
  async createExam(examData) {
    const res = await fetch('/api/exams', {
      method: 'POST',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(examData)
    });
    return res.json();
  },

  async updateExam(id, examData) {
    const res = await fetch(`/api/exams/${id}`, {
      method: 'PUT',
      headers: this.authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(examData)
    });
    return res.json();
  },

  async deleteExam(id) {
    const res = await fetch(`/api/exams/${id}`, {
      method: 'DELETE',
      headers: this.authHeaders()
    });
    return res.json();
  },

  async getAdminStats() {
    const res = await fetch('/api/admin/stats', {
      headers: this.authHeaders()
    });
    return res.json();
  },

  async getAdminSubmissions() {
    const res = await fetch('/api/admin/submissions', {
      headers: this.authHeaders()
    });
    return res.json();
  }
};

// Global Toast helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-gray-800';
  
  toast.className = `${bg} text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center space-x-2 pointer-events-auto transform transition-all duration-300 translate-y-4 opacity-0 z-50`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
