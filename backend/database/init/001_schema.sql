CREATE TABLE IF NOT EXISTS rooms (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  floor VARCHAR(80) NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL,
  resources JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rooms_name (name),
  CONSTRAINT chk_rooms_capacity CHECK (capacity > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id INT UNSIGNED NOT NULL,
  requested_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  responsible_name VARCHAR(160) NOT NULL,
  purpose VARCHAR(500) NOT NULL,
  status ENUM('pendente', 'aprovada', 'cancelada') NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_reservations_room_schedule (room_id, requested_date, start_time, end_time),
  KEY ix_reservations_status_date (status, requested_date),
  CONSTRAINT fk_reservations_room
    FOREIGN KEY (room_id) REFERENCES rooms (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_reservations_time CHECK (end_time > start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
