import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Running direct schema migration via Drizzle...");
  
  try {
    await db.execute(sql`
      ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "mcq_score" text;
    `);
    console.log("✓ Added/Verified mcq_score column");
  } catch (error) {
    console.error("Failed to add mcq_score column:", error);
  }

  try {
    await db.execute(sql`
      ALTER TABLE "candidates" ADD COLUMN IF NOT EXISTS "psychometric_score" text;
    `);
    console.log("✓ Added/Verified psychometric_score column");
  } catch (error) {
    console.error("Failed to add psychometric_score column:", error);
  }

  console.log("\nChecking columns of 'candidates' table...");
  const cols = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'candidates'
  `);
  console.log("Columns:", cols.rows);
}

main().catch(console.error);
