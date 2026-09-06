-- ============================================================
-- Animation Studio Project Tracking and Asset Approval System
-- Database Schema (MySQL / MariaDB)
-- ============================================================

CREATE DATABASE IF NOT EXISTS atlas
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE atlas;

-- 1. USER MANAGEMENT ------------------------------------------------
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','artist','animator','editor','reviewer','project_manager','client','viewer') NOT NULL DEFAULT 'viewer',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. PROJECT / PRODUCTION MODULE -------------------------------------
CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  client_id INT NULL,
  project_manager_id INT NULL,
  status ENUM('planning','in_production','review','completed','on_hold') DEFAULT 'planning',
  deadline DATE NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (project_manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Scenes / tasks that belong to a project (storyboard, animatic, scene, etc.)
CREATE TABLE scenes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  scene_name VARCHAR(150) NOT NULL,
  scene_type ENUM('storyboard','animatic','background','animation_scene','character_sheet','final_render') NOT NULL,
  assigned_to INT NULL,
  status ENUM('not_started','in_progress','for_review','revision','approved') DEFAULT 'not_started',
  due_date DATE NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- 3. ASSET / FILE SUBMISSION MODULE -----------------------------------
CREATE TABLE assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  scene_id INT NOT NULL,
  asset_title VARCHAR(150) NOT NULL,
  asset_type ENUM('storyboard','animatic','character_sheet','background','animation_scene','render','other') NOT NULL,
  uploaded_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. VERSION TRACKING ---------------------------------------------------
CREATE TABLE asset_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  version_no INT NOT NULL DEFAULT 1,
  file_path VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  status ENUM('pending','for_review','approved','rejected','revision_requested','final') DEFAULT 'pending',
  uploaded_by INT NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. REVIEW AND APPROVAL WORKFLOW ---------------------------------------
CREATE TABLE approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  decision ENUM('approved','rejected','revision_requested') NOT NULL,
  remarks TEXT,
  decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES asset_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. COMMENT / FEEDBACK MODULE -------------------------------------------
CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version_id INT NOT NULL,
  user_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (version_id) REFERENCES asset_versions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. NOTIFICATION LOG (also used as Messaging Simulation integration) ----
CREATE TABLE notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- e.g. asset_uploaded, revision_requested, final_output_approved
  is_read TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. AUDIT LOG -------------------------------------------------------------
CREATE TABLE audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(50) NOT NULL, -- upload, edit, approval, rejection, revision, status_update, deletion, login
  target_type VARCHAR(50),
  target_id INT,
  details VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 9. INTEGRATION LOG (records simulated external-system / webhook events) --
CREATE TABLE integration_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  integration_type VARCHAR(50) NOT NULL, -- API, Webhook Simulation, Messaging Simulation
  event_name VARCHAR(100) NOT NULL,
  payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- SEED DATA (demo accounts - password for all is: password123)
-- ---------------------------------------------------------------
INSERT INTO users (full_name, email, password, role) VALUES
('Ana Dela Cruz', 'admin@studio.com', '$2y$10$92IXUNpkjO0rOQ5byMi.YeIlYVsjXjr/qXkLYK7pQnQ7hzZWK/D9K', 'admin'),
('Marco Reyes', 'pm@studio.com', '$2y$10$92IXUNpkjO0rOQ5byMi.YeIlYVsjXjr/qXkLYK7pQnQ7hzZWK/D9K', 'project_manager'),
('Liza Santos', 'artist@studio.com', '$2y$10$92IXUNpkjO0rOQ5byMi.YeIlYVsjXjr/qXkLYK7pQnQ7hzZWK/D9K', 'artist'),
('Jomari Cruz', 'animator@studio.com', '$2y$10$92IXUNpkjO0rOQ5byMi.YeIlYVsjXjr/qXkLYK7pQnQ7hzZWK/D9K', 'animator'),
('Rica Fernandez', 'reviewer@studio.com', '$2y$10$92IXUNpkjO0rOQ5byMi.YeIlYVsjXjr/qXkLYK7pQnQ7hzZWK/D9K', 'reviewer'),
('Toon Studios Inc.', 'client@studio.com', '$2y$10$92IXUNpkjO0rOQ5byMi.YeIlYVsjXjr/qXkLYK7pQnQ7hzZWK/D9K', 'client');
-- NOTE: the hash above is a PLACEHOLDER. Run generate_hash.php (included) once
-- and update these rows, OR simply register fresh accounts through register.php.

INSERT INTO projects (title, description, client_id, project_manager_id, status, deadline) VALUES
('Barangay Bida Season 2', 'A 12-episode animated series for local kids TV.', 6, 2, 'in_production', '2026-12-01'),
('Isla Fantasia Short Film', 'A 5-minute fantasy short film for the film festival.', 6, 2, 'planning', '2026-11-15');

INSERT INTO scenes (project_id, scene_name, scene_type, assigned_to, status, due_date) VALUES
(1, 'Ep1 Opening Storyboard', 'storyboard', 3, 'for_review', '2026-09-05'),
(1, 'Ep1 Animatic Cut', 'animatic', 4, 'in_progress', '2026-09-10'),
(2, 'Main Character Sheet - Alira', 'character_sheet', 3, 'approved', '2026-09-01');
