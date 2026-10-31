import express from "express";

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isValidReservation(body) {
  if (
    !body ||
    !Number.isInteger(body.roomId) ||
    body.roomId < 1 ||
    typeof body.date !== "string" ||
    !isValidDate(body.date) ||
    typeof body.startTime !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.startTime) ||
    typeof body.endTime !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.endTime) ||
    body.endTime <= body.startTime ||
    typeof body.responsibleName !== "string" ||
    body.responsibleName.trim().length === 0 ||
    body.responsibleName.trim().length > 160 ||
    typeof body.purpose !== "string" ||
    body.purpose.trim().length === 0 ||
    body.purpose.trim().length > 500
  ) {
    return false;
  }

  return true;
}

export function createApp({ pool, logger = console }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json());

  app.get("/api/health", async (_request, response) => {
    try {
      await pool.query("SELECT 1");
      response.status(200).json({ status: "ok", database: "connected" });
    } catch (error) {
      logger.error("Health check failed", error);
      response.status(503).json({
        status: "error",
        database: "unavailable",
      });
    }
  });

  app.get("/api/rooms", async (_request, response) => {
    try {
      const [rooms] = await pool.query(
        "SELECT id, name, floor, capacity, resources FROM rooms ORDER BY floor, name",
      );
      response.json(rooms);
    } catch (error) {
      logger.error("Failed to load rooms", error);
      response.status(500).json({ error: "Não foi possível carregar as salas." });
    }
  });

  app.get("/api/reservations", async (_request, response) => {
    try {
      const [reservations] = await pool.query(
        `SELECT
          reservations.id,
          reservations.room_id AS roomId,
          rooms.name AS roomName,
          rooms.floor AS roomFloor,
          rooms.capacity AS roomCapacity,
          reservations.requested_date AS date,
          TIME_FORMAT(reservations.start_time, '%H:%i') AS startTime,
          TIME_FORMAT(reservations.end_time, '%H:%i') AS endTime,
          reservations.responsible_name AS responsibleName,
          reservations.purpose,
          reservations.status
        FROM reservations
        INNER JOIN rooms ON rooms.id = reservations.room_id
        ORDER BY reservations.requested_date, reservations.start_time, reservations.id`,
      );
      response.json(reservations);
    } catch (error) {
      logger.error("Failed to load reservations", error);
      response.status(500).json({
        error: "Não foi possível carregar as reservas.",
      });
    }
  });

  app.post("/api/reservations", async (request, response) => {
    if (!isValidReservation(request.body)) {
      response.status(400).json({
        error: "Informe sala, data, horários válidos, responsável e finalidade.",
      });
      return;
    }

    const {
      roomId,
      date,
      startTime,
      endTime,
      responsibleName,
      purpose,
    } = request.body;

    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [rooms] = await connection.execute(
        "SELECT id FROM rooms WHERE id = ? FOR UPDATE",
        [roomId],
      );

      if (rooms.length === 0) {
        await connection.rollback();
        response.status(404).json({ error: "Sala não encontrada." });
        return;
      }

      const [conflicts] = await connection.execute(
        `SELECT id
        FROM reservations
        WHERE room_id = ?
          AND requested_date = ?
          AND status IN ('pendente', 'aprovada')
          AND start_time < ?
          AND end_time > ?
        LIMIT 1`,
        [roomId, date, endTime, startTime],
      );

      if (conflicts.length > 0) {
        await connection.rollback();
        response.status(409).json({
          error: "A sala já possui uma solicitação nesse horário.",
        });
        return;
      }

      const [result] = await connection.execute(
        `INSERT INTO reservations
          (room_id, requested_date, start_time, end_time, responsible_name, purpose, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pendente')`,
        [roomId, date, startTime, endTime, responsibleName.trim(), purpose.trim()],
      );

      const [created] = await connection.execute(
        `SELECT
          reservations.id,
          reservations.room_id AS roomId,
          rooms.name AS roomName,
          rooms.floor AS roomFloor,
          rooms.capacity AS roomCapacity,
          reservations.requested_date AS date,
          TIME_FORMAT(reservations.start_time, '%H:%i') AS startTime,
          TIME_FORMAT(reservations.end_time, '%H:%i') AS endTime,
          reservations.responsible_name AS responsibleName,
          reservations.purpose,
          reservations.status
        FROM reservations
        INNER JOIN rooms ON rooms.id = reservations.room_id
        WHERE reservations.id = ?`,
        [result.insertId],
      );

      await connection.commit();
      response.status(201).json(created[0]);
    } catch (error) {
      if (connection) {
        await connection.rollback();
      }

      logger.error("Failed to create reservation", error);
      response.status(500).json({
        error: "Não foi possível criar a reserva.",
      });
    } finally {
      connection?.release();
    }
  });

  return app;
}
