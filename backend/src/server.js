import { createApp } from "./app.js";
import { createDatabasePool } from "./database.js";

const port = Number(process.env.PORT ?? 3000);
const pool = createDatabasePool();
const app = createApp({ pool });
const server = app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down`);

  server.close(async (error) => {
    if (error) {
      console.error("Failed to close HTTP server", error);
      process.exitCode = 1;
    }

    try {
      await pool.end();
    } catch (poolError) {
      console.error("Failed to close database pool", poolError);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
