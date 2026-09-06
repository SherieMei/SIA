/**
 * FrameForward Tracker - front-end behaviour
 * Talks to api/*.php (the project's API Integration component) using
 * fetch() so parts of the dashboard can refresh without a full reload.
 */

// Confirm before any destructive action (delete, reject)
document.addEventListener('click', function (e) {
  const el = e.target.closest('[data-confirm]');
  if (el && !confirm(el.dataset.confirm)) {
    e.preventDefault();
  }
});

// Poll the notifications API every 30s and update the bell counter live.
function refreshNotificationBadge() {
  const bell = document.querySelector('.bell');
  if (!bell) return;

  fetch('api/notifications.php?action=unread_count')
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data) => {
      let countEl = bell.querySelector('.bell-count');
      if (data.unread > 0) {
        if (!countEl) {
          countEl = document.createElement('span');
          countEl.className = 'bell-count';
          bell.appendChild(countEl);
        }
        countEl.textContent = data.unread;
      } else if (countEl) {
        countEl.remove();
      }
    })
    .catch(() => {
      /* fail silently - dashboard already shows the server-rendered count */
    });
}

if (document.querySelector('.bell')) {
  setInterval(refreshNotificationBadge, 30000);
}

// Simple client-side validation feedback for file inputs
document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.querySelector('input[name="asset_file"]');
  if (fileInput) {
    fileInput.addEventListener('change', function () {
      const label = document.getElementById('file-chosen');
      if (label) {
        label.textContent = fileInput.files.length
          ? `Selected: ${fileInput.files[0].name}`
          : '';
      }
    });
  }
});
