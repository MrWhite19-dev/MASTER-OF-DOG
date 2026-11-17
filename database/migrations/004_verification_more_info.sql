USE master_of_dog;

ALTER TABLE users
  MODIFY verification_status ENUM('new', 'incomplete', 'pending', 'review', 'more_info', 'verified', 'rejected')
  NOT NULL DEFAULT 'new';