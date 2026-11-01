const express = require("express");
const morgan = require("morgan");
const mongoose = require("mongoose");

const Notepad = require("./Notepad");

const db =
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  "mongodb://127.0.0.1:27017/notewithme";

// Connect once and reuse the connection; on Netlify a warm function
// container keeps this module (and the connection) between requests.
let connection;
function connect() {
  if (!connection) {
    connection = mongoose
      .connect(db, { dbName: "notewithme", serverSelectionTimeoutMS: 8000 })
      .catch((error) => {
        connection = undefined;
        throw error;
      });
  }
  return connection;
}

const app = express();

app.use(morgan("tiny"));
app.use(express.json({ limit: "1mb" }));

const api = express.Router();

api.use(async (req, res, next) => {
  try {
    await connect();
    next();
  } catch (error) {
    console.error("DB connection failed:", error.message);
    res.status(503).json({ status: "Database unavailable" });
  }
});

api.get("/:id", async (req, res) => {
  try {
    const notepad = await Notepad.findOne({ notePadsName: req.params.id });
    res.status(200).json({
      status: notepad ? "Found" : "New",
      data: notepad || { notePadsName: req.params.id, noteText: "" },
    });
  } catch (error) {
    res.status(500).json({ status: "Error Happened" });
  }
});

// Notes are edited live on the realtime Worker now; this API only serves notes
// written before that, for the Worker to import. A tab still running the old
// app gets an error instead of writing to a copy nobody reads any more.
api.patch("/:id", (req, res) => {
  res.status(410).json({ status: "Moved to the realtime editor. Reload the page." });
});

// /api is the public path; Netlify may hand the function its own path instead.
app.use(["/api", "/.netlify/functions/api"], api);

module.exports = app;
