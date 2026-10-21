const path = require("path");
const express = require("express");
const morgan = require("morgan");
const mongoose = require("mongoose");

const Notepad = require("./Notepad");

const db =
  process.env.MONGODB_URI ||
  process.env.MONGO_URL ||
  "mongodb://127.0.0.1:27017/notewithme";

const app = express();

mongoose
  .connect(db, { dbName: "notewithme" })
  .then(() => console.log("DB connection successful!"))
  .catch((error) => {
    console.error("DB connection failed:", error.message);
    process.exit(1);
  });

const port = process.env.PORT || 2500;

app.use(morgan("tiny"));
app.use(express.json({ limit: "1mb" }));

const api = express.Router();

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

app.use("/api", api);

// Serve the built Vue app; every other path falls back to index.html so
// history-mode routes like /abc123 work on reload.
const dist = path.join(__dirname, "dist");
app.use(express.static(dist));
app.get("*", (req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(port, () => {
  console.log(`notewith.me listening at http://localhost:${port}`);
});
