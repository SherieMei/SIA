-- Schema for teammates using local MySQL. Production uses Firebase app_trash.
CREATE TABLE IF NOT EXISTS app_trash (
  id int(11) NOT NULL AUTO_INCREMENT,
  item_type varchar(30) NOT NULL,
  item_id varchar(100) NOT NULL,
  item_data longtext NOT NULL,
  deleted_at datetime NOT NULL DEFAULT current_timestamp(),
  deleted_by varchar(100) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_trash_type (item_type),
  KEY idx_trash_item (item_type,item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
