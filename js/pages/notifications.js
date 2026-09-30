/* ==========================================================================
   PAGE — NOTIFICATIONS
   ========================================================================== */

function pageNotifications() {
  const list = Array.isArray(DB.notifications)
    ? DB.notifications
        .map(n => ({
          ...n,
          text: n.text ?? n.message ?? n.title ?? '',
          date: n.date ?? n.created_at ?? '',
          read: n.read ?? Boolean(n.is_read)
        }))
        .reverse()
    : [];

  return `
    <div class="panel-head">
      <div>
        <div class="section-title">
          Notifications
        </div>

        <div class="section-sub">
          Submissions, approvals, revisions, projects, resources, budgets, and deadlines.
        </div>
      </div>

      <button
        class="btn btn-sm"
        onclick="Studio.markAllRead()"
      >
        Mark all as read
      </button>
    </div>

    <div
      class="card"
      style="margin-top:14px;"
    >
      ${
        list.length
          ? list
              .map(n => {
                const type = String(n.type || '')
                  .trim()
                  .toLowerCase();

                let categoryText = 'Notification';

                if (
                  type.includes('resource') ||
                  type.includes('cost')
                ) {
                  categoryText = 'Resource / Cost Entry';
                } else if (type.includes('budget')) {
                  categoryText = 'Project Budget';
                } else if (type.includes('review')) {
                  categoryText = 'Asset Review';
                } else if (type.includes('revision')) {
                  categoryText = 'Revision Request';
                } else if (
                  type.includes('approved') ||
                  type.includes('approval')
                ) {
                  categoryText = 'Asset Approval';
                } else if (type.includes('asset')) {
                  categoryText = 'Asset';
                } else if (type.includes('project')) {
                  categoryText = 'Project';
                } else if (type.includes('deadline')) {
                  categoryText = 'Deadline';
                } else if (
                  type.includes('integration') ||
                  type.includes('webhook') ||
                  type.includes('api')
                ) {
                  categoryText = 'Integration';
                }

                return `
                  <div
                    class="list-row"
                    style="
                      cursor:pointer;
                      ${n.read ? 'opacity:.55;' : ''}
                    "
                    onclick="Studio.openNotification('${n.id}')"
                  >
                    <div
                      class="type-tag"
                      style="
                        background:var(--panel-3);
                        color:var(--coral);
                        font-size:14px;
                      "
                    >
                      ${NOTIF_ICON[n.type] || '●'}
                    </div>

                    <div style="flex:1;">
                      <div class="row-title">
                        ${esc(n.text)}
                      </div>

                      <div class="row-sub">
                        ${esc(categoryText)}
                        &nbsp;•&nbsp;
                        ${fmtDateTime(n.date)}
                      </div>
                    </div>

                    ${
                      !n.read
                        ? `
                          <span class="badge b-review">
                            New
                          </span>
                        `
                        : ''
                    }
                  </div>
                `;
              })
              .join('')
          : `
            <div class="empty">
              You're all caught up.
            </div>
          `
      }
    </div>
  `;
}


/* ==========================================================================
   OPEN NOTIFICATION
   ========================================================================== */

Studio.openNotification = function(notificationId) {
  const notification = Array.isArray(DB.notifications)
    ? DB.notifications.find(
        n => String(n.id) === String(notificationId)
      )
    : null;

  if (!notification) {
    console.error(
      'Notification not found:',
      notificationId
    );

    return;
  }

  console.log(
    'Notification clicked:',
    notification
  );

  notification.read = true;
  notification.is_read = 1;

  if (typeof Studio.persist === 'function') {
    Studio.persist();
  }

  const type = String(
    notification.type || ''
  )
    .trim()
    .toLowerCase();

  const notificationText = String(
    notification.text ??
    notification.message ??
    notification.title ??
    ''
  )
    .trim()
    .toLowerCase();


  /* --------------------------------------------------------------------------
     RESOURCES / BUDGET
     -------------------------------------------------------------------------- */

  if (
    type.includes('resource') ||
    type.includes('cost') ||
    type.includes('budget')
  ) {
    Studio.goto('resources');
    return;
  }


  /* --------------------------------------------------------------------------
     FIND ASSET FROM TEXT
     -------------------------------------------------------------------------- */

  const matchedAsset = Array.isArray(DB.assets)
    ? DB.assets.find(asset => {
        const title = String(
          asset.title ??
          asset.asset_title ??
          ''
        )
          .trim()
          .toLowerCase();

        return (
          title &&
          notificationText.includes(title)
        );
      })
    : null;

  if (matchedAsset) {
    Studio.goto(
      'assetDetail',
      matchedAsset.id
    );

    return;
  }


  /* --------------------------------------------------------------------------
     REVIEW
     -------------------------------------------------------------------------- */

  if (
    type === 'asset_review' ||
    type.includes('review')
  ) {
    Studio.goto('review');
    return;
  }


  /* --------------------------------------------------------------------------
     ASSET FALLBACK
     -------------------------------------------------------------------------- */

  if (
    type.includes('asset') ||
    type.includes('revision') ||
    type.includes('submission') ||
    type.includes('approval') ||
    type.includes('approved')
  ) {
    Studio.goto('assets');
    return;
  }


  /* --------------------------------------------------------------------------
     FIND PROJECT FROM TEXT
     -------------------------------------------------------------------------- */

  const matchedProject = Array.isArray(DB.projects)
    ? DB.projects.find(project => {
        const name = String(
          project.name || ''
        )
          .trim()
          .toLowerCase();

        return (
          name &&
          notificationText.includes(name)
        );
      })
    : null;

  if (matchedProject) {
    Studio.goto(
      'projectDetail',
      matchedProject.id
    );

    return;
  }


  /* --------------------------------------------------------------------------
     PROJECT FALLBACK
     -------------------------------------------------------------------------- */

  if (
    type.includes('project') ||
    type.includes('deadline')
  ) {
    Studio.goto('projects');
    return;
  }


  /* --------------------------------------------------------------------------
     INTEGRATIONS
     -------------------------------------------------------------------------- */

  if (
    type.includes('integration') ||
    type.includes('webhook') ||
    type.includes('api')
  ) {
    Studio.goto('integrations');
    return;
  }


  /* --------------------------------------------------------------------------
     AUDIT
     -------------------------------------------------------------------------- */

  if (type.includes('audit')) {
    Studio.goto('audit');
    return;
  }


  /* --------------------------------------------------------------------------
     DEFAULT
     -------------------------------------------------------------------------- */

  Studio.goto('dashboard');
};