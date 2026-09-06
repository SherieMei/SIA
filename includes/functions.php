<?php
require_once __DIR__ . '/../config/db.php';

/* =====================================================================
   AUDIT LOG
   Records every important action: upload, edit, approval, rejection,
   revision, status update, deletion, login.
   ===================================================================== */
function log_audit($action, $target_type, $target_id, $details = '') {
    global $pdo;
    $user = current_user();
    $stmt = $pdo->prepare(
        "INSERT INTO audit_log (user_id, action, target_type, target_id, details)
         VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->execute([$user['id'] ?? null, $action, $target_type, $target_id, $details]);
}

/* =====================================================================
   NOTIFICATION LOG
   Sends/records an alert for a user. This doubles as the project's
   "Messaging Simulation" integration: the system generates events such
   as "Asset Uploaded", "Revision Requested", or "Final Output Approved".
   ===================================================================== */
function notify($user_id, $message, $event_type) {
    global $pdo;
    $stmt = $pdo->prepare(
        "INSERT INTO notifications (user_id, message, event_type) VALUES (?, ?, ?)"
    );
    $stmt->execute([$user_id, $message, $event_type]);

    // Also record it in the integration log (Webhook / Messaging Simulation)
    log_integration_event('Messaging Simulation', $event_type, json_encode([
        'user_id' => $user_id,
        'message' => $message,
    ]));
}

/* =====================================================================
   INTEGRATION LOG
   Central record of every simulated integration / automated event.
   Used by the API Integration, Workflow Automation and Webhook
   Simulation requirements (see README.md, section 6).
   ===================================================================== */
function log_integration_event($type, $event_name, $payload = '') {
    global $pdo;
    $stmt = $pdo->prepare(
        "INSERT INTO integration_log (integration_type, event_name, payload) VALUES (?, ?, ?)"
    );
    $stmt->execute([$type, $event_name, $payload]);
}

/* =====================================================================
   WORKFLOW AUTOMATION
   When an asset version is uploaded, the system automatically moves the
   parent scene to "for_review" and notifies the project's reviewer(s).
   This is the "Workflow Automation" integration requirement.
   ===================================================================== */
function trigger_asset_uploaded_workflow($scene_id, $asset_title, $version_no) {
    global $pdo;

    // Auto-update scene status -> for_review
    $pdo->prepare("UPDATE scenes SET status = 'for_review' WHERE id = ?")->execute([$scene_id]);
    log_integration_event('Workflow Automation', 'scene_status_auto_updated', json_encode([
        'scene_id' => $scene_id, 'new_status' => 'for_review'
    ]));

    // Notify every reviewer and admin in the system (Event-Driven behaviour)
    $reviewers = $pdo->query(
        "SELECT id FROM users WHERE role IN ('reviewer','admin')"
    )->fetchAll();

    foreach ($reviewers as $r) {
        notify(
            $r['id'],
            "New asset \"{$asset_title}\" (v{$version_no}) was submitted and is ready for review.",
            'asset_uploaded'
        );
    }
}

/** Triggered whenever a reviewer makes a decision on an asset version. */
function trigger_approval_workflow($version_id, $decision, $uploader_id, $asset_title) {
    $messages = [
        'approved'            => "Your asset \"{$asset_title}\" was approved.",
        'rejected'            => "Your asset \"{$asset_title}\" was rejected. Please check the reviewer's remarks.",
        'revision_requested'  => "Revision requested for \"{$asset_title}\". Please upload a new version.",
    ];
    $event = $decision === 'approved' ? 'final_output_approved' : $decision;
    notify($uploader_id, $messages[$decision], $event);

    log_integration_event('Webhook Simulation', 'approval_decision_' . $decision, json_encode([
        'version_id' => $version_id, 'decision' => $decision
    ]));
}

/* =====================================================================
   HELPERS
   ===================================================================== */
function h($str) { return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8'); }

function status_badge($status) {
    $map = [
        'not_started'         => 'badge grey',
        'in_progress'         => 'badge blue',
        'for_review'          => 'badge amber',
        'revision'            => 'badge orange',
        'revision_requested'  => 'badge orange',
        'approved'            => 'badge green',
        'final'               => 'badge green',
        'rejected'            => 'badge red',
        'pending'             => 'badge grey',
        'planning'            => 'badge blue',
        'in_production'       => 'badge amber',
        'review'              => 'badge amber',
        'completed'           => 'badge green',
        'on_hold'             => 'badge red',
    ];
    $class = $map[$status] ?? 'badge grey';
    $label = ucwords(str_replace('_', ' ', $status));
    return "<span class=\"{$class}\">{$label}</span>";
}

function role_label($role) {
    return ucwords(str_replace('_', ' ', $role));
}

function unread_notification_count($user_id) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0");
    $stmt->execute([$user_id]);
    return (int) $stmt->fetch()['c'];
}
