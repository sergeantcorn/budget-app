// ============================================================
// AUTH — login, logout, init
// ============================================================

async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  if (!username || !password) { errEl.textContent = 'Please enter username and password'; return; }

  const btn = document.querySelector('#login-screen .btn-primary');
  btn.textContent = 'Signing in...'; btn.disabled = true;

  const data = await fetch(API + '/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }).then(r => r.json()).catch(() => null);

  btn.textContent = 'Sign In'; btn.disabled = false;

  if (!data || data.error) {
    errEl.textContent = data?.error || 'Login failed. Check your credentials.';
    return;
  }

  authToken = data.token;
  localStorage.setItem('budget_token', authToken);
  showApp();
}

function doLogout() {
  authToken = null;
  localStorage.removeItem('budget_token');
  appData     = null;
  historyData = null;
  document.getElementById('app').style.display          = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-password').value       = '';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display          = 'block';
  loadAllData();
}

// Press Enter on password field to log in
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

window.addEventListener('load', () => {
  if (authToken) showApp();
});
