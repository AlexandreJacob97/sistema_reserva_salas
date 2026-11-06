import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";
import { createApp } from "./app.js";

const servers = [];
const seedSql = new URL("../database/init/002_seed.sql", import.meta.url);

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

async function startServer(options) {
  const server = createApp(options).listen(0, "127.0.0.1");
  servers.push(server);

  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  return `http://127.0.0.1:${server.address().port}`;
}

test("reports healthy only when MySQL responds", async () => {
  let query;
  const baseUrl = await startServer({
    pool: {
      async query(statement) {
        query = statement;
      },
    },
    logger: { error() {} },
  });

  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "ok",
    database: "connected",
  });
  assert.equal(query, "SELECT 1");
});

test("returns service unavailable and logs when MySQL fails", async () => {
  const databaseError = new Error("database down");
  let loggedError;
  const baseUrl = await startServer({
    pool: {
      async query() {
        throw databaseError;
      },
    },
    logger: {
      error(message, error) {
        loggedError = { message, error };
      },
    },
  });

  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "error",
    database: "unavailable",
  });
  assert.deepEqual(loggedError, {
    message: "Health check failed",
    error: databaseError,
  });
});

test("lists rooms and reservations from the database", async () => {
  const expectedRooms = [{ id: 1, name: "Sala Horizonte" }];
  const expectedReservations = [{ id: 1, roomName: "Sala Horizonte" }];
  const baseUrl = await startServer({
    pool: {
      async query(statement) {
        if (statement.includes("FROM rooms")) {
          return [expectedRooms];
        }

        if (statement.includes("FROM reservations")) {
          return [expectedReservations];
        }

        throw new Error("Unexpected query");
      },
    },
    logger: { error() {} },
  });

  const [roomsResponse, reservationsResponse] = await Promise.all([
    fetch(`${baseUrl}/api/rooms`),
    fetch(`${baseUrl}/api/reservations`),
  ]);

  assert.deepEqual(await roomsResponse.json(), expectedRooms);
  assert.deepEqual(await reservationsResponse.json(), expectedReservations);
});

test("rejects invalid reservation fields before opening a database connection", async () => {
  let connectionRequested = false;
  const baseUrl = await startServer({
    pool: {
      async getConnection() {
        connectionRequested = true;
        throw new Error("Should not request a connection");
      },
    },
    logger: { error() {} },
  });

  const response = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: 1,
      studentCount: 20,
      date: "2026-02-31",
      startTime: "14:00",
      endTime: "13:00",
      responsibleName: "",
      purpose: "",
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(connectionRequested, false);
});

test("requires a positive whole number of students before opening a database connection", async () => {
  let connectionRequested = false;
  const baseUrl = await startServer({
    pool: {
      async getConnection() {
        connectionRequested = true;
        throw new Error("Should not request a connection");
      },
    },
    logger: { error() {} },
  });

  const response = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: 1,
      studentCount: 0,
      date: "2026-11-06",
      startTime: "10:00",
      endTime: "11:00",
      responsibleName: "Ana Souza",
      purpose: "Reunião de equipe",
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(connectionRequested, false);
});

test("rejects a reservation when the room cannot fit the student group", async () => {
  let conflictChecked = false;
  let insertedReservation = false;
  let rolledBack = false;
  let released = false;
  const baseUrl = await startServer({
    pool: {
      async getConnection() {
        return {
          async beginTransaction() {},
          async rollback() {
            rolledBack = true;
          },
          async commit() {},
          release() {
            released = true;
          },
          async execute(statement) {
            if (statement.includes("FROM rooms WHERE id = ? FOR UPDATE")) {
              return [[{ id: 1, capacity: 20 }]];
            }

            if (statement.includes("FROM reservations")) {
              conflictChecked = true;
              return [[]];
            }

            if (statement.includes("INSERT INTO reservations")) {
              insertedReservation = true;
              return [{ insertId: 7 }];
            }

            throw new Error("Unexpected query");
          },
        };
      },
    },
    logger: { error() {} },
  });

  const response = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: 1,
      studentCount: 21,
      date: "2026-11-06",
      startTime: "10:00",
      endTime: "11:00",
      responsibleName: "Ana Souza",
      purpose: "Aula com a turma",
    }),
  });

  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), {
    error:
      "A sala selecionada comporta até 20 alunos. Escolha uma sala com capacidade suficiente.",
  });
  assert.equal(rolledBack, true);
  assert.equal(conflictChecked, false);
  assert.equal(insertedReservation, false);
  assert.equal(released, true);
});

test("creates pending reservations and rejects overlapping schedules", async () => {
  const conflictingRoomIds = new Set();
  let insertedReservation;
  let committed = false;
  let released = 0;
  const lockedRoomIds = [];
  const conflictQueries = [];
  const connection = {
    async beginTransaction() {},
    async rollback() {},
    async commit() {
      committed = true;
    },
    release() {
      released += 1;
    },
    async execute(statement, parameters) {
      if (statement.includes("FROM rooms WHERE id = ? FOR UPDATE")) {
        lockedRoomIds.push(parameters[0]);
        return [[{ id: parameters[0], capacity: 30 }]];
      }

      if (statement.includes("FROM reservations") && statement.includes("LIMIT 1")) {
        conflictQueries.push(statement);
        return [conflictingRoomIds.has(parameters[0]) ? [{ id: 9 }] : []];
      }

      if (statement.includes("INSERT INTO reservations")) {
        insertedReservation = parameters;
        return [{ insertId: 7 }];
      }

      if (statement.includes("WHERE reservations.id = ?")) {
        return [[{
          id: 7,
          roomId: insertedReservation[0],
          roomName: "Sala Horizonte",
          date: "2026-11-06",
          startTime: "10:00",
          endTime: "11:00",
          responsibleName: "Ana Souza",
          purpose: "Reunião de equipe",
          status: "pendente",
        }]];
      }

      throw new Error("Unexpected query");
    },
  };
  const baseUrl = await startServer({
    pool: {
      async getConnection() {
        return connection;
      },
    },
    logger: { error() {} },
  });
  const reservation = {
    roomId: 1,
    studentCount: 25,
    date: "2026-11-06",
    startTime: "10:00",
    endTime: "11:00",
    responsibleName: "  Ana Souza  ",
    purpose: " Reunião de equipe ",
  };

  const createdResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservation),
  });

  assert.equal(createdResponse.status, 201);
  assert.equal((await createdResponse.json()).status, "pendente");
  assert.deepEqual(insertedReservation, [
    1,
    "2026-11-06",
    "10:00",
    "11:00",
    "Ana Souza",
    "Reunião de equipe",
  ]);
  assert.equal(committed, true);

  conflictingRoomIds.add(1);
  committed = false;
  const conflictResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reservation),
  });

  assert.equal(conflictResponse.status, 409);
  assert.deepEqual(await conflictResponse.json(), {
    error:
      "Conflito de horário: esta sala já tem uma reserva ou solicitação nesse período. Escolha outro horário.",
  });
  assert.equal(committed, false);

  const differentRoomResponse = await fetch(`${baseUrl}/api/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...reservation, roomId: 2 }),
  });

  assert.equal(differentRoomResponse.status, 201);
  assert.equal((await differentRoomResponse.json()).roomId, 2);
  assert.equal(committed, true);
  assert.deepEqual(lockedRoomIds, [1, 1, 2]);
  assert.equal(conflictQueries.length, 3);
  assert.ok(conflictQueries.every((statement) => statement.includes("room_id = ?")));
  assert.ok(conflictQueries.every((statement) => statement.includes("requested_date = ?")));
  assert.equal(released, 3);
});

test("seeds seven rooms and ten reservations including simultaneous bookings in different rooms", async () => {
  const sql = await readFile(seedSql, "utf8");
  const roomsSection = sql.split("INSERT INTO rooms")[1].split("ON DUPLICATE KEY UPDATE")[0];
  const reservationsSection = sql
    .split("INSERT INTO reservations")[1]
    .split("ON DUPLICATE KEY UPDATE")[0];

  assert.equal((roomsSection.match(/^\s*\(\d+,/gm) ?? []).length, 7);
  assert.equal((reservationsSection.match(/^\s*\(\d+,/gm) ?? []).length, 10);
  assert.match(sql, /^SET NAMES utf8mb4;/);
  assert.match(sql, /name = VALUES\(name\)/);
  assert.match(reservationsSection, /\(6, 5, '2026-11-09', '09:00:00', '10:00:00'/);
  assert.match(reservationsSection, /\(7, 6, '2026-11-09', '09:00:00', '10:00:00'/);
});
