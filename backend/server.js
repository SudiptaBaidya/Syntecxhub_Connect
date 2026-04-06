const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const admin = require('firebase-admin');
const path = require('path');

// Load env vars
dotenv.config();

// Connect Database
connectDB();

// Initialize Firebase Admin (mock initialization or properly later if service account is provided)
// For now, we will verify using firebase-admin logic in auth routes.

const app = express();
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(cors());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files from the frontend/dist directory
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Define Routes
app.set('socketio', io);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/users', require('./routes/user'));

// Catch-all route to serve the frontend index.html for any non-API routes
app.get('(.*)', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

// Store socket connections by User ID
const userSockets = new Map();

// Helper to update user status and broadcast
const updateUserStatus = async (userId, status) => {
  try {
    const User = require('./models/User');
    await User.findByIdAndUpdate(userId, { status });
    io.emit('userStatusUpdate', { userId, status });
  } catch (err) {
    console.error(`Error updating status for user ${userId}:`, err);
  }
};

// Socket.io connection instance
io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  socket.on('userOnline', async (userId) => {
    if (!userId) return;
    
    // Store user ID for this socket
    socket.userId = userId;
    userSockets.set(userId, socket.id);
    
    // Update status to online and broadcast
    await updateUserStatus(userId, 'online');
    console.log(`User ${userId} is now online`);
  });

  socket.on('joinRoom', ({ roomId }) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room: ${roomId}`);
  });

  socket.on('chatMessage', async ({ senderId, roomId, content }) => {
    try {
      const Message = require('./models/Message');
      const message = await Message.create({
        sender: senderId,
        room: roomId,
        content
      });

      const populatedMessage = await Message.findById(message._id).populate('sender', 'fullName avatarUrl email username');
      io.to(roomId).emit('message', populatedMessage);
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });

  socket.on('broadcastMessage', (messageData) => {
    if (messageData.room) {
      io.to(messageData.room).emit('message', messageData);
    } else if (messageData.roomId) {
      io.to(messageData.roomId).emit('message', messageData);
    }
  });

  socket.on('messageUpdate', (messageData) => {
    io.to(messageData.room).emit('messageUpdate', messageData);
  });

  socket.on('messageDelete', ({ messageId, roomId }) => {
    io.to(roomId).emit('messageDelete', messageId);
  });
  
  socket.on('disconnect', async () => {
    const userId = socket.userId;
    if (userId) {
      // Check if user has other active sockets (in case of multiple tabs)
      // For simplicity, we assume one socket per user for now or just remove the current one
      userSockets.delete(userId);
      
      // Update status to offline and broadcast
      await updateUserStatus(userId, 'offline');
      console.log(`User ${userId} went offline`);
    }
    console.log(`Socket ${socket.id} disconnected`);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
