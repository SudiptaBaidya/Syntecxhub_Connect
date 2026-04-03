const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, 'uploads/');
  },
  filename(req, file, cb) {
    cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  fileFilter(req, file, cb) {
    const filetypes = /jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Images only!');
    }
  },
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      if (req.body.username && req.body.username !== user.username) {
        const usernameExists = await User.findOne({ username: req.body.username });
        if (usernameExists) {
          return res.status(400).json({ message: 'Username already taken' });
        }
        user.username = req.body.username;
      }

      user.fullName = req.body.fullName || user.fullName;
      user.bio = req.body.bio !== undefined ? req.body.bio : user.bio;
      user.avatarUrl = req.body.avatarUrl || user.avatarUrl;

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        fullName: updatedUser.fullName,
        username: updatedUser.username,
        email: updatedUser.email,
        avatarUrl: updatedUser.avatarUrl,
        bio: updatedUser.bio,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Upload profile picture
// @route   POST /api/users/avatar
// @access  Private
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    const user = await User.findById(req.user._id);
    if (user) {
      user.avatarUrl = `/uploads/${req.file.filename}`;
      await user.save();
      res.json({ avatarUrl: user.avatarUrl });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Toggle follow/add contact
// @route   POST /api/users/contacts/:id
// @access  Private
router.post('/contacts/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const targetId = req.params.id;
    
    if (user.contacts.includes(targetId)) {
      user.contacts = user.contacts.filter(id => id.toString() !== targetId);
      await user.save();
      res.json({ message: 'Removed from contacts', isContact: false });
    } else {
      user.contacts.push(targetId);
      await user.save();
      
      // Create notification for target user
      const Notification = require('../models/Notification');
      const newNotification = await Notification.create({
        recipient: targetId,
        sender: req.user._id,
        type: 'follow',
        content: `${user.fullName} added you to their contacts!`
      });
      
      const populatedNotification = await Notification.findById(newNotification._id).populate('sender', 'fullName avatarUrl username');
      
      const io = req.app.get('socketio');
      io.to(targetId).emit('notification', populatedNotification);
      
      res.json({ message: 'Added to contacts', isContact: true });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get user notifications
// @route   GET /api/users/notifications
// @access  Private
router.get('/notifications', protect, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'fullName avatarUrl username')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark notifications as read
// @route   PUT /api/users/notifications/read
// @access  Private
router.put('/notifications/read', protect, async (req, res) => {
  try {
    const Notification = require('../models/Notification');
    await Notification.updateMany({ recipient: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update last read message for a room
// @route   PUT /api/users/read/:roomId
// @access  Private
router.put('/read/:roomId', protect, async (req, res) => {
  try {
    const { messageId } = req.body;
    const user = await User.findById(req.user._id);
    user.lastReadMessages.set(req.params.roomId, messageId);
    await user.save();
    res.json({ message: 'Last read message updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
