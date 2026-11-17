CREATE DATABASE IF NOT EXISTS master_of_dog
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE master_of_dog;

CREATE TABLE IF NOT EXISTS roles (
  id SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_key VARCHAR(32) NOT NULL,
  label VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_key (role_key)
) ENGINE=InnoDB;

INSERT INTO roles (role_key, label) VALUES
  ('client', 'Client / propriétaire'),
  ('trainer', 'Dresseur canin'),
  ('veterinarian', 'Vétérinaire'),
  ('shop', 'Boutique canine'),
  ('super_admin', 'Super administrateur')
ON DUPLICATE KEY UPDATE label = VALUES(label);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id SMALLINT UNSIGNED NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(32) NULL,
  password_hash VARCHAR(255) NOT NULL,
  account_status ENUM('active', 'suspended', 'banned', 'locked') NOT NULL DEFAULT 'active',
  verification_status ENUM('new', 'incomplete', 'pending', 'review', 'more_info', 'verified', 'rejected') NOT NULL DEFAULT 'new',
  email_verified_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role_status_created (role_id, account_status, created_at),
  KEY ix_users_verification (verification_status, created_at),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS client_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  country VARCHAR(100) NULL,
  city VARCHAR(120) NULL,
  dog_name VARCHAR(120) NULL,
  dog_breed VARCHAR(120) NULL,
  dog_age VARCHAR(40) NULL,
  profile_data JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_client_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trainer_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  country VARCHAR(100) NULL,
  city VARCHAR(120) NULL,
  birth_date DATE NULL,
  experience_years TINYINT UNSIGNED NULL,
  specialties JSON NULL,
  qualifications TEXT NULL,
  description TEXT NULL,
  service_area VARCHAR(255) NULL,
  pricing JSON NULL,
  availability JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_trainer_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS veterinarian_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  country VARCHAR(100) NULL,
  city VARCHAR(120) NULL,
  birth_date DATE NULL,
  clinic_name VARCHAR(180) NULL,
  clinic_address VARCHAR(255) NULL,
  clinic_phone VARCHAR(32) NULL,
  specialty VARCHAR(160) NULL,
  registration_number VARCHAR(120) NULL,
  qualifications TEXT NULL,
  experience_years TINYINT UNSIGNED NULL,
  career_description TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_veterinarian_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS shop_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  country VARCHAR(100) NULL,
  city VARCHAR(120) NULL,
  district VARCHAR(120) NULL,
  shop_name VARCHAR(180) NULL,
  category VARCHAR(120) NULL,
  description TEXT NULL,
  business_email VARCHAR(254) NULL,
  business_phone VARCHAR(32) NULL,
  address VARCHAR(255) NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  maps_url VARCHAR(1000) NULL,
  opening_hours JSON NULL,
  products JSON NULL,
  services JSON NULL,
  delivery_terms TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_shop_profiles_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_sessions (
  session_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (session_hash),
  KEY ix_user_sessions_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  identifier_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NOT NULL,
  attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_login_attempt_identifier (identifier_hash, attempted_at),
  KEY ix_login_attempt_ip (ip_hash, attempted_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS professional_documents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  document_type VARCHAR(60) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  review_status ENUM('pending', 'accepted', 'rejected', 'deleted') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_documents_user_status (user_id, review_status),
  CONSTRAINT fk_documents_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_documents_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS verification_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  previous_status VARCHAR(24) NOT NULL,
  new_status VARCHAR(24) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_verification_history_user_date (user_id, created_at),
  CONSTRAINT fk_verification_history_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_verification_history_admin FOREIGN KEY (admin_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_actions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  action_type ENUM('suspend', 'ban', 'lock', 'restore', 'unban', 'unlock') NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  starts_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at DATETIME NULL,
  reversed_at DATETIME NULL,
  reversed_by BIGINT UNSIGNED NULL,
  reversal_reason VARCHAR(1000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_account_actions_user_date (user_id, created_at),
  KEY ix_account_actions_expiry (action_type, ends_at, reversed_at),
  CONSTRAINT fk_account_actions_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_account_actions_admin FOREIGN KEY (admin_id) REFERENCES users (id),
  CONSTRAINT fk_account_actions_reverser FOREIGN KEY (reversed_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS account_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_code VARCHAR(32) NOT NULL,
  reporter_id BIGINT UNSIGNED NOT NULL,
  reported_user_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('new', 'pending', 'reviewing', 'more_info', 'resolved', 'rejected', 'closed') NOT NULL DEFAULT 'new',
  assigned_admin_id BIGINT UNSIGNED NULL,
  resolution_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reports_reference (reference_code),
  KEY ix_reports_status_created (status, created_at),
  KEY ix_reports_target (reported_user_id, created_at),
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users (id),
  CONSTRAINT fk_reports_target FOREIGN KEY (reported_user_id) REFERENCES users (id),
  CONSTRAINT fk_reports_admin FOREIGN KEY (assigned_admin_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaints (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_code VARCHAR(32) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('new', 'pending', 'reviewing', 'more_info', 'resolved', 'rejected', 'closed') NOT NULL DEFAULT 'new',
  assigned_admin_id BIGINT UNSIGNED NULL,
  resolution_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_complaints_reference (reference_code),
  KEY ix_complaints_status_created (status, created_at),
  CONSTRAINT fk_complaints_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_complaints_admin FOREIGN KEY (assigned_admin_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS complaint_evidence (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  report_id BIGINT UNSIGNED NULL,
  complaint_id BIGINT UNSIGNED NULL,
  uploaded_by BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_evidence_report (report_id),
  KEY ix_evidence_complaint (complaint_id),
  CONSTRAINT ck_evidence_parent CHECK ((report_id IS NOT NULL) <> (complaint_id IS NOT NULL)),
  CONSTRAINT fk_evidence_report FOREIGN KEY (report_id) REFERENCES account_reports (id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_complaint FOREIGN KEY (complaint_id) REFERENCES complaints (id) ON DELETE CASCADE,
  CONSTRAINT fk_evidence_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS platform_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  status ENUM('new', 'reviewing', 'answered', 'hidden', 'resolved') NOT NULL DEFAULT 'new',
  admin_reply TEXT NULL,
  replied_by BIGINT UNSIGNED NULL,
  replied_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_platform_reviews_rating_date (rating, created_at),
  KEY ix_platform_reviews_status (status, created_at),
  CONSTRAINT ck_platform_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_platform_reviews_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_platform_reviews_admin FOREIGN KEY (replied_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_type VARCHAR(60) NOT NULL,
  reference_type VARCHAR(40) NOT NULL,
  reference_id BIGINT UNSIGNED NULL,
  title VARCHAR(200) NOT NULL,
  summary VARCHAR(1000) NOT NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_admin_notifications_unread (read_at, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  recipient VARCHAR(254) NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  reference_code VARCHAR(32) NULL,
  encrypted_payload MEDIUMBLOB NOT NULL,
  status ENUM('queued', 'sending', 'sent', 'failed') NOT NULL DEFAULT 'queued',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_error VARCHAR(1000) NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_email_queue (status, next_attempt_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS visitor_analytics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  visitor_hash CHAR(64) NOT NULL,
  visit_date DATE NOT NULL,
  route_hash CHAR(64) NOT NULL,
  authenticated_user_id BIGINT UNSIGNED NULL,
  visit_count SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_visitor_route_day (visitor_hash, visit_date, route_hash),
  KEY ix_analytics_date (visit_date),
  CONSTRAINT fk_analytics_user FOREIGN KEY (authenticated_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  target_type VARCHAR(50) NULL,
  target_id BIGINT UNSIGNED NULL,
  details JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_admin_activity_admin_date (admin_id, created_at),
  KEY ix_admin_activity_target (target_type, target_id, created_at),
  CONSTRAINT fk_admin_activity_user FOREIGN KEY (admin_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key VARCHAR(100) NOT NULL,
  setting_value JSON NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_platform_settings_admin FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;