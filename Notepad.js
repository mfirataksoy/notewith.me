const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const notepadSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now,
  },
  notePadsName: {
    type: String,
    unique: true,
    maxlength: 64,
    default: function () {
      return nanoid(6);
    },
  },
  noteText: {
    type: String,
    maxlength: 500000,
  },
  lastUpdateDate: {
    type: Date,
  },
});

const NotePad = mongoose.model("NotePad", notepadSchema);

module.exports = NotePad;
