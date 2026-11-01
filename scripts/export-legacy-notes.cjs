// One-time copy of the pre-realtime notes from MongoDB into the Worker's D1.
//
//   MONGODB_URI=... node scripts/export-legacy-notes.cjs
//   npx wrangler d1 execute noteful-legacy --remote --file legacy-notes.sql
//
// Writes upserts, so running it again is safe.
const fs = require("fs");
const mongoose = require("mongoose");
const Notepad = require("../Notepad");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("Set MONGODB_URI");
  await mongoose.connect(process.env.MONGODB_URI, { dbName: "notewithme", serverSelectionTimeoutMS: 8000 });
  const notes = await Notepad.find({ noteText: { $nin: [null, ""] } }, { notePadsName: 1, noteText: 1 }).lean();
  const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const sql = notes
    .filter((n) => n.notePadsName && n.noteText.trim())
    .map((n) => `INSERT INTO notes (name, html) VALUES (${quote(n.notePadsName)}, ${quote(n.noteText)}) ON CONFLICT (name) DO UPDATE SET html = excluded.html;`);
  fs.writeFileSync("legacy-notes.sql", sql.join("\n") + "\n");
  console.log(`${sql.length} notes written to legacy-notes.sql`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
