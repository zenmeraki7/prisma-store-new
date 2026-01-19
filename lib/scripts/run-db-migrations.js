import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";

const migrationsDir = path.join(process.cwd(), "db/migrations");

async function run() {
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log("Running", file);
    await prisma.$executeRawUnsafe(sql);
  }

  console.log("✅ DB migrations complete");
  process.exit(0);
}

run();
