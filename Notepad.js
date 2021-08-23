const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const notepadSchema = new mongoose.Schema({
  createdAt: {
    type: Date,
    default: Date.now(),
  },
  notePadsName: {
    type: String,
    unique: true,
    default: function () {
      return nanoid(6);
    }, //asd
  },
  password: {
    type: String,
    maxlength: 10,
    select: false,
  },
  noteText: {
    type: String,
  },
  lastUpdateDate: {
    type: Date,
    /*       default: */
  },
});

const NotePad = mongoose.model("NotePad", notepadSchema);

module.exports = NotePad;
//asd
