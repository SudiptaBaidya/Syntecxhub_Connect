const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  content: { type: String },
  fileUrl: { type: String },
  fileName: { type: String },
  fileSize: { type: String },
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  isForwarded: { type: Boolean, default: false },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
