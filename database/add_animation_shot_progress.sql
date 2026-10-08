CREATE TABLE IF NOT EXISTS animation_shot_progress (
  asset_id INT NOT NULL PRIMARY KEY,
  stage ENUM('Blocking','Spline','Polish','Ready for Review') NOT NULL DEFAULT 'Blocking',
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  playblast_url VARCHAR(2048) NOT NULL DEFAULT '',
  updated_by VARCHAR(30) DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_animation_shot_progress_asset
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  CONSTRAINT fk_animation_shot_progress_user
    FOREIGN KEY (updated_by) REFERENCES app_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
