import { readFileSync } from "fs";
import { Client } from "pg";

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  await client.connect();

  const sql = readFileSync("db/migrations/001_filter_tables.sql", "utf8");
  await client.query(sql);

  await client.end();
  console.log("✅ DB migrations applied");
}

run();
