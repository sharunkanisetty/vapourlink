const WebSocket = require('ws');
const robot = require('robotjs');

const wss = new WebSocket.Server({ port: 8081 });

wss.on('connection', (ws) => {
  console.log('🔌 Native control connected');

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      switch (data.type) {
        case 'mouse-move': {
          const screen = robot.getScreenSize();
          const x = Math.floor(data.x * screen.width);
          const y = Math.floor(data.y * screen.height);
          robot.moveMouse(x, y);
          break;
        }

        case 'mouse-click': {
          const button = data.button === 2 ? 'right' : 'left';
          robot.mouseClick(button);
          break;
        }

        case 'key-press': {
          // Optional: Hold modifiers before key press
          if (data.ctrl) robot.keyToggle('control', 'down');
          if (data.alt) robot.keyToggle('alt', 'down');
          if (data.shift) robot.keyToggle('shift', 'down');

          robot.keyTap(data.key.toLowerCase());

          if (data.ctrl) robot.keyToggle('control', 'up');
          if (data.alt) robot.keyToggle('alt', 'up');
          if (data.shift) robot.keyToggle('shift', 'up');
          break;
        }

        default:
          console.warn('⚠️ Unknown command type:', data.type);
      }
    } catch (err) {
      console.error('❌ Error in message:', err);
    }
  });

  ws.on('close', () => {
    console.log('❌ Native control disconnected');
  });
});

console.log('✅ Native WS server running on ws://<your-ip>:8081');
