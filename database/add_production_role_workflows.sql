CREATE TABLE IF NOT EXISTS animation_shot_workflow (
  asset_id INT NOT NULL PRIMARY KEY,
  workflow_status ENUM(
    'Not Started',
    'In Progress',
    'For Review',
    'Revision Required',
    'Completed'
  ) NOT NULL DEFAULT 'Not Started',
  task_notes TEXT NOT NULL,
  updated_by VARCHAR(30) DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_animation_shot_workflow_asset
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_animation_shot_workflow_user
    FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS editor_sequences (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  project_id VARCHAR(30) NOT NULL,
  editor_id VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  notes TEXT NOT NULL,
  cut_asset_id INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_editor_sequences_editor_project (editor_id, project_id),
  CONSTRAINT fk_editor_sequences_project
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_editor_sequences_editor
    FOREIGN KEY (editor_id) REFERENCES app_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_editor_sequences_cut_asset
    FOREIGN KEY (cut_asset_id) REFERENCES assets(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS editor_sequence_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sequence_id BIGINT UNSIGNED NOT NULL,
  asset_id INT NOT NULL,
  item_order INT UNSIGNED NOT NULL,
  KEY idx_editor_sequence_items_order (sequence_id, item_order),
  CONSTRAINT fk_editor_sequence_items_sequence
    FOREIGN KEY (sequence_id) REFERENCES editor_sequences(id) ON DELETE CASCADE,
  CONSTRAINT fk_editor_sequence_items_asset
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
