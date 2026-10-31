INSERT INTO rooms (id, name, floor, capacity, resources)
VALUES
  (1, 'Sala Horizonte', 'Térreo', 30, JSON_ARRAY('Projetor', 'Quadro branco', 'Ar-condicionado')),
  (2, 'Laboratório Criativo', '1º andar', 24, JSON_ARRAY('Computadores', 'Projetor', 'Ar-condicionado')),
  (3, 'Sala Ipê', '2º andar', 16, JSON_ARRAY('TV', 'Quadro branco')),
  (4, 'Sala Acácia', '3º andar', 20, JSON_ARRAY('Projetor', 'Videoconferência', 'Quadro branco'))
ON DUPLICATE KEY UPDATE
  floor = VALUES(floor),
  capacity = VALUES(capacity),
  resources = VALUES(resources);

INSERT INTO reservations
  (id, room_id, requested_date, start_time, end_time, responsible_name, purpose, status)
VALUES
  (1, 1, '2026-11-02', '08:00:00', '09:30:00', 'Ana Souza', 'Reunião de planejamento pedagógico', 'aprovada'),
  (2, 2, '2026-11-02', '10:00:00', '12:00:00', 'Bruno Lima', 'Aula de introdução à programação', 'pendente'),
  (3, 3, '2026-11-03', '13:30:00', '15:00:00', 'Carla Mendes', 'Atendimento individual de estudantes', 'aprovada'),
  (4, 1, '2026-11-04', '14:00:00', '16:00:00', 'Diego Alves', 'Oficina de formação de professores', 'cancelada'),
  (5, 4, '2026-11-05', '09:00:00', '11:00:00', 'Elisa Rocha', 'Projeto de ciências com a turma 8º A', 'pendente')
ON DUPLICATE KEY UPDATE
  room_id = VALUES(room_id),
  requested_date = VALUES(requested_date),
  start_time = VALUES(start_time),
  end_time = VALUES(end_time),
  responsible_name = VALUES(responsible_name),
  purpose = VALUES(purpose),
  status = VALUES(status);
