const express = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const mongoose = require("mongoose");
const jsonParser = bodyParser.json();
const cors = require("cors");

const Notepad = require("./Notepad");
const db =
  "mongodb+srv://notepad123:31allah69@cluster1.skax4.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

const app = express();
app.use(cors());

mongoose
  .connect(db, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB connection successful!"));

const port = process.env.PORT || 2500;

app.use(morgan("default"));
app.use(jsonParser);

app.get("/", async (req, res) => {
  const newNotePad = await Notepad.create({});
  res.status(201).json({ status: "Updated", data: newNotePad });
});

app.patch("/:id", async (req, res) => {
  const notepadsName = req.params.id;
  const textToUpdate = req.body.noteText;
  const password = req.body.password;

  try {
    /* if (password) {
    } */
    const notePadToUpdate = await Notepad.findOneAndUpdate(
      {
        notePadsName: notepadsName,
      },
      { noteText: textToUpdate, password: password },
      { new: true }
    );
    if (notePadToUpdate) {
      res.status(200).json({ status: "Updated", data: notePadToUpdate });
    } else {
      res.status(404).json({ status: "Couldn Update" });
    }
  } catch (error) {
    res.status(404).json({ status: "error found" });
  }
});

app.get("/:id", async (req, res) => {
  const notepadsName = req.params.id;
  try {
    const thisPagesNotePad = await Notepad.findOne({
      notePadsName: notepadsName,
    });
    if (thisPagesNotePad) {
      res.status(200).json({ status: "Found", data: thisPagesNotePad });
    } else {
      const newCreatedNotepad = await Notepad.create({
        notePadsName: notepadsName,
      });
      res.status(201).json({ status: "created", data: newCreatedNotepad });
    }
  } catch (error) {
    res.status(404).json({ status: "Error Happened" });
  }
});

app.all("*", (req, res) => {
  res.send("Not Found");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
