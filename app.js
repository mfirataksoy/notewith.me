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
      .connect(db, { dbName: "notewithme" })
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

api.patch("/:id", async (req, res) => {
  const textToUpdate = req.body.noteText;
  if (typeof textToUpdate !== "string") {
    return res.status(400).json({ status: "noteText is required" });
  }

  try {
    const notepad = await Notepad.findOneAndUpdate(
      { notePadsName: req.params.id },
      { noteText: textToUpdate, lastUpdateDate: Date.now() },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(200).json({ status: "Updated", data: notepad });
  } catch (error) {
    res.status(400).json({ status: "Couldn't Update" });
  }
});

// /api is the public path; Netlify may hand the function its own path instead.
app.use(["/api", "/.netlify/functions/api"], api);

module.exports = app;
