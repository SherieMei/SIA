/* ATLAS Login — page-specific controller */
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

  const button = document.getElementById('loginButton');
  if (button) button.addEventListener('click', () => Studio.manualLogin());

  const nameInput = document.getElementById('loginName');
  if (nameInput) {
    nameInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') Studio.manualLogin();
    });
    nameInput.focus();
  }
});
