const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve all files in this folder
app.use(express.static(__dirname));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'sender.html'));
});

app.get('/receive', (req, res) => {
  res.sendFile(path.join(__dirname, 'receiver.html'));
});

// Store connected users
let senderSocket = null;
let receiverSocket = null;

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('join-sender', () => {
    senderSocket = socket;
    socket.role = 'sender';

    if (receiverSocket) {
      receiverSocket.emit('sender-ready', {
        senderId: socket.id
      });
    }
  });

  socket.on('join-receiver', () => {
    receiverSocket = socket;
    socket.role = 'receiver';

    if (senderSocket) {
      socket.emit('sender-ready', {
        senderId: senderSocket.id
      });
    } else {
      socket.emit('waiting', {
        message: 'Waiting for Android...'
      });
    }
  });

  socket.on('offer', (data) => {
    if (receiverSocket) {
      receiverSocket.emit('offer', {
        offer: data.offer,
        from: socket.id
      });
    }
  });

  socket.on('answer', (data) => {
    if (senderSocket) {
      senderSocket.emit('answer', {
        answer: data.answer
      });
    }
  });

  socket.on('ice', (data) => {
    if (data.targetId) {
      socket.to(data.targetId).emit('ice', {
        candidate: data.candidate
      });
    }
  });

  socket.on('disconnect', () => {
    if (socket.role === 'sender') {
      senderSocket = null;

      if (receiverSocket) {
        receiverSocket.emit('sender-offline');
      }
    }

    if (socket.role === 'receiver') {
      receiverSocket = null;

      if (senderSocket) {
        senderSocket.emit('receiver-offline');
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});