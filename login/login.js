/* BEE PRODUCTION Login — page-specific controller */
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('demoUsers');

  if (grid) {
    grid.innerHTML = DB.users.slice(0, 8).map(user => `
      <button type="button" class="demo-card" data-user-id="${user.id}">
        <b>${esc(user.name)}</b>
        <span>${ROLE_LABELS[user.role]}</span>
      </button>
    `).join('');

    grid.addEventListener('click', event => {
      const card = event.target.closest('[data-user-id]');
      if (card) Studio.quickLogin(card.dataset.userId);
    });
  }

  // ----- Sign in vs. Create account -----
  let mode = 'signin';
  const nameField = document.getElementById('signupNameField');
  const helpText = document.getElementById('loginHelpText');
  const modeToggle = document.getElementById('authModeToggle');
  const submitBtn = document.getElementById('loginButton');
  const submitLabel = submitBtn ? submitBtn.querySelector('span') : null;

  function runSubmit() {
    if (mode === 'signup') Studio.createAccount();
    else Studio.manualLogin();
  }

  function setMode(next) {
    mode = next;
    const isSignup = mode === 'signup';
    if (nameField) nameField.classList.toggle('hidden', !isSignup);
    if (submitLabel) submitLabel.textContent = isSignup ? 'Create account' : 'Enter studio';
    if (helpText) helpText.textContent = isSignup
      ? 'Working prototype — this just creates a demo account in your browser, no email is sent.'
      : 'Working prototype — any email/password combination signs you in. Pick a role to see the matching permissions.';
    if (modeToggle) modeToggle.textContent = isSignup
      ? 'Already have an account? Sign in'
      : 'New here? Create an account';
    const nameInput = document.getElementById('signupName');
    if (isSignup && nameInput) nameInput.focus();
    else if (!isSignup) { const e = document.getElementById('loginEmail'); if (e) e.focus(); }
  }

  if (modeToggle) modeToggle.addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));
  if (submitBtn) submitBtn.addEventListener('click', runSubmit);

  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const signupNameInput = document.getElementById('signupName');
  [emailInput, passwordInput, signupNameInput].forEach(input => {
    if (input) {
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') runSubmit();
      });
    }
  });
  if (emailInput) emailInput.focus();

  // ----- Show / hide password -----
  const pwToggle = document.getElementById('pwToggleBtn');
  const pwInput = document.getElementById('loginPassword');
  if (pwToggle && pwInput) {
    pwToggle.addEventListener('click', () => {
      const showing = pwInput.type === 'text';
      pwInput.type = showing ? 'password' : 'text';
      pwToggle.textContent = showing ? '👁' : '🙈';
      const label = showing ? 'Show password' : 'Hide password';
      pwToggle.title = label;
      pwToggle.setAttribute('aria-label', label);
    });
  }

  // ----- Theme toggle (login page has no sidebar, so wire it directly) -----
  const themeBtn = document.getElementById('loginThemeBtn');
  if (themeBtn) themeBtn.addEventListener('click', () => Studio.toggleTheme());
  if (typeof Studio !== 'undefined' && Studio.applyTheme) Studio.applyTheme();
});
