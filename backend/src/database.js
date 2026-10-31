import mysql from "mysql2/promise";

const requiredEnvironment = [
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_DATABASE",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
];

export function createDatabasePool(environment = process.env) {
  const missing = requiredEnvironment.filter((name) => !environment[name]);

  if (missing.length > 0) {
    throw new Error(`Missing database configuration: ${missing.join(", ")}`);
  }

  return mysql.createPool({
    host: environment.MYSQL_HOST,
    port: Number(environment.MYSQL_PORT),
    database: environment.MYSQL_DATABASE,
    user: environment.MYSQL_USER,
    password: environment.MYSQL_PASSWORD,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4",
    dateStrings: true,
  });
}
