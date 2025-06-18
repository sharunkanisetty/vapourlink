const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const path = require('path');
const robot = require('robotjs');
const os = require('os');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const sessions = {};
let controllingClient = null;

io.on('connection', (socket) => {
  console.log('🔌 Socket connected:', socket.id);

  socket.on('create-session', ({ sessionId }) => {
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.role = 'host';

    sessions[sessionId] = {
      host: socket.id,
      controllers: []
    };

    console.log(`📦 Session created: ${sessionId}`);
  });

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

  socket.on('accept-request', ({ requesterId }) => {
    controllingClient = requesterId;
    io.to(requesterId).emit('access-granted');
  });

  socket.on('signal', ({ to, data }) => {
    io.to(to).emit('signal', { from: socket.id, data });
  });

  socket.on('mouse-move', (data) => {
    if (socket.id === controllingClient) {
      const screen = robot.getScreenSize();
      const x = Math.floor(data.x * screen.width);
      const y = Math.floor(data.y * screen.height);
      robot.moveMouse(x, y);
    }
  });

  socket.on('mouse-click', (data) => {
    if (socket.id === controllingClient) {
      const button = data.button === 2 ? "right" : "left";
      robot.mouseClick(button);
    }
  });

  socket.on('key-press', (data) => {
    if (socket.id === controllingClient) {
      try {
        if (data.ctrl) robot.keyToggle('control', 'down');
        if (data.alt) robot.keyToggle('alt', 'down');
        if (data.shift) robot.keyToggle('shift', 'down');

        robot.keyTap(data.key.toLowerCase());

        if (data.ctrl) robot.keyToggle('control', 'up');
        if (data.alt) robot.keyToggle('alt', 'up');
        if (data.shift) robot.keyToggle('shift', 'up');
      } catch (error) {
        console.error('❌ Key press error:', error);
      }
    }
  });

  socket.on('disconnect', () => {
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
    if (socket.id === controllingClient) {
      controllingClient = null;
    }
    console.log('🔌 Socket disconnected:', socket.id);
  });

  socket.onAny((event, ...args) => {
    console.log(`📥 Received event: ${event}`, args);
  });
});

// Health check route
app.get('/ping', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Get local network IP address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Start the server
const PORT = process.env.PORT || 4000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  const localIP = getLocalIPAddress();
  console.log('\n✅ Server is up and running!\n');
  console.log(`👉 Local access:   http://localhost:${PORT}`);
  console.log(`🌐 Network access: http://${localIP}:${PORT}\n`);
});
