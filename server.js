const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Serve HTML files
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'sender.html')));
app.get('/receive', (req, res) => res.sendFile(path.join(__dirname, 'receiver.html')));

// Track connections
let senderSocket = null;
let receiverSocket = null;

io.on('connection', (socket) => {
  console.log('🔌 New connection:', socket.id);

  // Android joins as sender
  socket.on('join-sender', () => {
    senderSocket = socket;
    socket.role = 'sender';
    console.log('📡 Android sender connected');
    
    // Tell iOS receiver if already waiting
    if (receiverSocket) {
      receiverSocket.emit('sender-ready', { senderId: socket.id });
    }
  });

  // iOS joins as receiver
  socket.on('join-receiver', () => {
    receiverSocket = socket;
    socket.role = 'receiver';
    console.log('🎧 iOS receiver connected');
    
    if (senderSocket) {
      socket.emit('sender-ready', { senderId: senderSocket.id });
    } else {
      socket.emit('waiting', { message: 'Waiting for Android...' });
    }
  });

  // WebRTC Signaling
  socket.on('offer', (data) => {
    socket.to(data.targetId).emit('offer', { offer: data.offer, from: socket.id });
  });
  socket.on('answer', (data) => {
    socket.to(data.senderId).emit('answer', { answer: data.answer });
  });
  socket.on('ice', (data) => {
    socket.to(data.targetId).emit('ice', { candidate: data.candidate });
  });

  socket.on('disconnect', () => {
    if (socket.role === 'sender') {
      senderSocket = null;
      if (receiverSocket) receiverSocket.emit('sender-offline');
    }
    if (socket.role === 'receiver') {
      receiverSocket = null;
      if (senderSocket) senderSocket.emit('receiver-offline');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
