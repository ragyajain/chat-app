const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
  },
  senderId: {
    type: String,
    required: true,
  },
  receiverId: {
    type: String,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  seen: {
    type: Boolean,
    default: false,
  },
  isFile: {
    type: Boolean,
    default: false,
  },
  fileType: {
    type: String,
    default: null,
  },
  deleted: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

module.exports = mongoose.model("Message", messageSchema);