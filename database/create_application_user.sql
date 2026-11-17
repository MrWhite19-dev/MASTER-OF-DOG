CREATE USER IF NOT EXISTS 'master_of_dog_app'@'localhost'
  IDENTIFIED BY 'REPLACE_WITH_A_UNIQUE_RANDOM_PASSWORD_BEFORE_RUNNING';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON master_of_dog.*
  TO 'master_of_dog_app'@'localhost';

FLUSH PRIVILEGES;