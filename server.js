const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const sessions = {}; // Track sessions and participants

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  // Host creates session
  socket.on('create-session', ({ sessionId }) => {
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.role = 'host';

    sessions[sessionId] = {
      host: socket.id,
      controllers: []
    };

    console.log(`Session created: ${sessionId}`);
  });

  // Controller requests access
  socket.on('request-access', ({ sessionId }) => {
    const session = sessions[sessionId];
    if (!session) {
      socket.emit('session-error', { message: 'Session not found' });
      return;
    }

    session.controllers.push(socket.id);
    socket.emit('access-granted', { sessionId });

    io.to(session.host).emit('incoming-request', {
      requesterId: socket.id
    });
  });

  // WebRTC signaling
  socket.on('signal', ({ to, data }) => {
    io.to(to).emit('signal', { from: socket.id, data });
  });

  // Disconnection handling
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    const { sessionId } = socket;

    if (sessionId && sessions[sessionId]) {
      const session = sessions[sessionId];
      if (socket.id === session.host) {
        delete sessions[sessionId];
        io.to(sessionId).emit('session-ended');
      } else {
        session.controllers = session.controllers.filter(id => id !== socket.id);
      }
    }
  });
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.onAny((event, ...args) => {
    console.log(`Received event: ${event}`, args);
  });
});


app.get('/ping', (req, res) => {
  res.json({ message: 'Server is running' });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
