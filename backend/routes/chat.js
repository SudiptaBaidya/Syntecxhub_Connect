const express = require('express');
const router = express.Router();
const Room = require('../models/Room');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// GET /api/chat/rooms
// Desc: Get rooms user belongs to (Joined public + joined private)
router.get('/rooms', protect, async (req, res) => {
  try {
    const rooms = await Room.find({ members: req.user._id }).populate('members', 'fullName avatarUrl email status username');
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/chat/rooms/discover
// Desc: Find public rooms user hasn't joined (for search/suggestions)
router.get('/rooms/discover', protect, async (req, res) => {
  try {
    const { searchQuery } = req.query;
    const filter = { type: 'public', members: { $ne: req.user._id } };
    
    if (searchQuery) {
      filter.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { description: { $regex: searchQuery, $options: 'i' } }
      ];
    }

    const rooms = await Room.find(filter)
      .populate('members', 'fullName avatarUrl email status username')
      .limit(10); // Limit to top 10 suggestions if no search
      
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chat/rooms/:id/join
// Desc: Joining a public room
router.post('/rooms/:id/join', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // Only public rooms can be joined freely
    if (room.type !== 'public') {
      return res.status(403).json({ message: 'Cannot join a private room without an invite' });
    }

    if (room.members.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are already a member of this room' });
    }

    room.members.push(req.user._id);
    await room.save();
    
    const populatedRoom = await Room.findById(room._id).populate('members', 'fullName avatarUrl email status username');
    
    const io = req.app.get('socketio');
    io.to(room._id.toString()).emit('roomUpdate', populatedRoom);
    
    res.json(populatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chat/rooms/direct
// Desc: Get or Create 1-on-1 private room
router.post('/rooms/direct', protect, async (req, res) => {
  const { targetUserId } = req.body;
  try {
    // Ensure we don't accidentally match a group chat with these two people
    const existingRoom = await Room.findOne({
      type: 'private',
      members: { $all: [req.user._id, targetUserId] },
      $expr: { $eq: [{ $size: "$members" }, 2] } // Strict 2 members
    }).populate('members', 'fullName avatarUrl email status');

    if (existingRoom) {
      return res.json(existingRoom);
    }

    const newRoom = await Room.create({
      name: `DM-${Date.now()}`,
      type: 'private',
      members: [req.user._id, targetUserId]
    });

    const populatedRoom = await Room.findById(newRoom._id).populate('members', 'fullName avatarUrl email status');
    res.status(201).json(populatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chat/rooms
// Desc: Create a new room
router.post('/rooms', protect, async (req, res) => {
  const { name, description, type, members } = req.body;
  try {
    const initialMembers = [req.user._id];
    if (members && Array.isArray(members)) {
      members.forEach(id => {
         if (id !== req.user._id.toString()) initialMembers.push(id);
      });
    }

    const room = await Room.create({
      name,
      description,
      type: type || 'public',
      owner: req.user._id,
      admins: [req.user._id],
      members: initialMembers,
    });
    
    const populatedRoom = await Room.findById(room._id).populate('members', 'fullName avatarUrl email status');
    res.status(201).json(populatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/chat/rooms/:id
// Desc: Rename or update room details
router.put('/rooms/:id', protect, async (req, res) => {
  try {
    const { name } = req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    const isOwner = room.owner && room.owner.toString() === req.user._id.toString();
    const isAdmin = room.admins && room.admins.some(id => id.toString() === req.user._id.toString());
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Only owners and admins can edit this room' });
    }

    if (name) room.name = name;
    await room.save();
    
    const populatedRoom = await Room.findById(room._id).populate('members', 'fullName avatarUrl email status');
    res.json(populatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/chat/rooms/:id
// Desc: Delete room (Owner only)
router.delete('/rooms/:id', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    const isOwner = room.owner && room.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ message: 'Only the room owner can delete this room' });
    }

    await Message.deleteMany({ room: room._id });
    await Room.findByIdAndDelete(req.params.id);
    res.json({ message: 'Room removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chat/rooms/:id/admins
// Desc: Add or remove an admin
router.post('/rooms/:id/admins', protect, async (req, res) => {
  const { targetUserId, action } = req.body; // action: 'add' or 'remove'
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    const isOwner = room.owner && room.owner.toString() === req.user._id.toString();
    if (!isOwner) return res.status(403).json({ message: 'Only the owner can manage admins' });
    
    if (action === 'add') {
      if (!room.admins.includes(targetUserId)) room.admins.push(targetUserId);
    } else if (action === 'remove') {
      room.admins = room.admins.filter(id => id.toString() !== targetUserId);
    }

    await room.save();
    const populatedRoom = await Room.findById(room._id).populate('members', 'fullName avatarUrl email status');
    res.json(populatedRoom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chat/rooms/:id/leave
// Desc: Leave a room
router.post('/rooms/:id/leave', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    
    // Check if member
    if (!room.members.includes(req.user._id)) {
      return res.status(400).json({ message: 'You are not a member of this room' });
    }

    // Don't let the owner leave without deleting or passing ownership
    if (room.owner && room.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Owner cannot leave room, must delete or transfer ownership' });
    }

    room.members = room.members.filter(id => id.toString() !== req.user._id.toString());
    await room.save();
    
    const populatedRoom = await Room.findById(room._id).populate('members', 'fullName avatarUrl email status username');
    const io = req.app.get('socketio');
    io.to(room._id.toString()).emit('roomUpdate', populatedRoom);
    
    res.json({ message: 'Room left successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/chat/messages/:roomId
// Desc: Get all messages for a specific room (filtering out messages deleted by "me")
router.get('/messages/:roomId', protect, async (req, res) => {
  try {
    const messages = await Message.find({ 
      room: req.params.roomId,
      deletedFor: { $ne: req.user._id }
    })
      .populate('sender', 'fullName avatarUrl email')
      .sort({ createdAt: 1 }); // Oldest first
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT /api/chat/messages/:id
// Desc: Edit message content (Sender only)
router.put('/messages/:id', protect, async (req, res) => {
  try {
    const { content } = req.body;
    const message = await Message.findById(req.params.id).populate('sender', 'fullName avatarUrl email');
    
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.isDeleted) return res.status(400).json({ message: 'Cannot edit a deleted message' });
    
    if (message.sender._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    message.content = content;
    message.isEdited = true;
    await message.save();
    
    res.json(message);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/chat/messages/:id/everyone
// Desc: Delete message for everyone (Soft delete)
router.delete('/messages/:id/everyone', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const room = await Room.findById(message.room);
    const isSender = message.sender.toString() === req.user._id.toString();
    const isRoomOwner = room.owner && room.owner.toString() === req.user._id.toString();
    const isRoomAdmin = room.admins && room.admins.some(id => id.toString() === req.user._id.toString());

    if (!isSender && !isRoomOwner && !isRoomAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }

    // Soft delete: keep the record but mark as deleted and clear sensitive data
    message.isDeleted = true;
    message.content = 'This message was deleted';
    message.fileUrl = null;
    message.fileName = null;
    message.fileSize = null;
    
    const updatedMessage = await message.save();
    const populatedMessage = await Message.findById(updatedMessage._id).populate('sender', 'fullName avatarUrl email');

    res.json({ message: 'Message deleted for everyone', messageId: req.params.id, roomId: message.room, updatedMessage: populatedMessage });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/chat/messages/:id/me
// Desc: Delete message for me (Hide only)
router.delete('/messages/:id/me', protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    if (!message.deletedFor.includes(req.user._id)) {
      message.deletedFor.push(req.user._id);
      await message.save();
    }
    
    res.json({ message: 'Message hidden', messageId: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// POST /api/chat/messages/:roomId/forward
// Desc: Forward a message to another room
router.post('/messages/:roomId/forward', protect, async (req, res) => {
  try {
    const { content, fileUrl, fileName, fileSize } = req.body;
    
    const newMessage = await Message.create({
      sender: req.user._id,
      room: req.params.roomId,
      content: content || '',
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      isForwarded: true
    });

    const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'fullName avatarUrl email');
    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/chat/messages/:roomId/upload
// Desc: Upload a file to a room as a message
router.post('/messages/:roomId/upload', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    // Convert size to nicely formatted string
    let sizeStr = req.file.size + ' B';
    if (req.file.size > 1024 * 1024) sizeStr = (req.file.size / (1024 * 1024)).toFixed(2) + ' MB';
    else if (req.file.size > 1024) sizeStr = (req.file.size / 1024).toFixed(2) + ' KB';

    const newMessage = await Message.create({
      sender: req.user._id,
      room: req.params.roomId,
      content: req.body.content || '',
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: sizeStr
    });

    const populatedMessage = await Message.findById(newMessage._id).populate('sender', 'fullName avatarUrl email');
    res.status(201).json(populatedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET /api/chat/users
// Desc: Get users (Selective/Search-driven)
router.get('/users', protect, async (req, res) => {
  try {
    const { searchQuery } = req.query;
    const filter = { _id: { $ne: req.user._id } };
    
    if (searchQuery) {
      filter.$or = [
        { fullName: { $regex: searchQuery, $options: 'i' } },
        { username: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } }
      ];
    } else {
      // Default view: suggest few active users (or users you have interacted with)
      // For now, limit results to avoid crowding
       return res.json([]); // Force search for discovery
    }

    const users = await User.find(filter).select('-password').limit(20);
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
