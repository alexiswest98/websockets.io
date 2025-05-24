const socket = io();

// UI Elements
const loginPage = document.getElementById('loginPage');
const mainInterface = document.getElementById('mainInterface');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');
const sizeValue = document.getElementById('sizeValue');
const clearBtn = document.getElementById('clearBtn');
const sendBtn = document.getElementById('sendBtn');
const drawingsFeed = document.getElementById('drawingsFeed');
const participants = document.getElementById('participants');

// Drawing state
let currentUser = '';
let connected = false;
let p5Canvas;

// p5.js sketch
let sketch = function(p) {
  let isDrawing = false;
  
  p.setup = function() {
    p5Canvas = p.createCanvas(360, 300);
    p5Canvas.parent('canvasContainer');
    p.background(255);
    p.strokeCap(p.ROUND);
    p.strokeJoin(p.ROUND);
  };
  
  p.draw = function() {
    // Drawing happens in mouse events, not in draw loop
  };
  
  p.mousePressed = function() {
    // Only draw if mouse is within canvas bounds
    if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      isDrawing = true;
      p.stroke(colorPicker.value);
      p.strokeWeight(brushSize.value);
      // Start the drawing path
      p.beginShape();
      p.vertex(p.mouseX, p.mouseY);
    }
  };
  
  p.mouseDragged = function() {
    if (isDrawing && p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
      p.stroke(colorPicker.value);
      p.strokeWeight(brushSize.value);
      p.line(p.pmouseX, p.pmouseY, p.mouseX, p.mouseY);
      
      // Emit real-time drawing data to other users
      if (connected) {
        socket.emit('drawing_stroke', {
          x1: p.pmouseX,
          y1: p.pmouseY,
          x2: p.mouseX,
          y2: p.mouseY,
          color: colorPicker.value,
          size: brushSize.value
        });
      }
    }
  };
  
  p.mouseReleased = function() {
    isDrawing = false;
  };
  
  // Function to clear canvas
  p.clearCanvas = function() {
    p.background(255);
  };
  
  // Function to get canvas as image data
  p.getCanvasData = function() {
    return p5Canvas.canvas.toDataURL();
  };
};

// Initialize p5 sketch
let myp5 = new p5(sketch);

// Event Listeners
brushSize.addEventListener('input', () => {
  sizeValue.textContent = brushSize.value;
});

joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinChat();
});

clearBtn.addEventListener('click', clearCanvas);
sendBtn.addEventListener('click', sendDrawing);

// Functions
function joinChat() {
  //.trim() removes white space from name
  const username = usernameInput.value.trim();
  if (username) {
    currentUser = username;
    socket.emit('add_user', username);
    loginPage.classList.add('hidden');
    mainInterface.classList.remove('hidden');
    connected = true;
  }
}

function clearCanvas() {
  myp5.clearCanvas();
  // Emit clear event to other users
  if (connected) {
    socket.emit('clear_canvas');
  }
}

function sendDrawing() {
  if (!connected) {
    addSystemMessage('Not connected to server');
    return;
  }
  
  const drawingData = myp5.getCanvasData();
  
  // Check if canvas is not empty (not just white background)
  const canvas = p5Canvas.canvas;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  
  let hasDrawing = false;
  for (let i = 0; i < pixels.length; i += 4) {
    // Check if any pixel is not white (255, 255, 255)
    if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
      hasDrawing = true;
      break;
    }
  }
  
  if (!hasDrawing) {
    addSystemMessage('Canvas is empty! Draw something first.');
    return;
  }
  
  socket.emit('new_drawing', {
    drawing: drawingData,
    color: colorPicker.value,
    brushSize: brushSize.value
  });
  
  // Add to local feed
  addDrawingToFeed({
    username: currentUser,
    drawing: drawingData,
    timestamp: new Date().toISOString()
  }, true);
  
  // Clear canvas after sending
  clearCanvas();
  addSystemMessage('Drawing sent!');
}

function addDrawingToFeed(data) {
  const messageDiv = document.createElement('div');
  
  const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  
  messageDiv.innerHTML = `
    <div class="message-header">
      <span class="username">${data.username}</span>
      <span class="timestamp">${timestamp}</span>
    </div>
    <img src="${data.drawing}" alt="Drawing by ${data.username}" class="drawing-preview">
  `;
  
  drawingsFeed.appendChild(messageDiv);
  drawingsFeed.scrollTop = drawingsFeed.scrollHeight;
}

function addSystemMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'system-message';
  messageDiv.textContent = message;
  drawingsFeed.appendChild(messageDiv);
  drawingsFeed.scrollTop = drawingsFeed.scrollHeight;
}

function updateParticipants(numUsers) {
  const text = numUsers === 1 ? '1 artist online' : `${numUsers} artists online`;
  participants.textContent = text;
}

// Socket Events
socket.on('connect', () => {
  connected = true;
  addSystemMessage('Connected to Drawing Chat!');
});

socket.on('new_drawing', (data) => {
  addDrawingToFeed(data);
  addSystemMessage(`${data.username} shared a new drawing!`);
});

socket.on('drawing_history', (drawings) => {
  drawings.forEach(drawing => {
    addDrawingToFeed(drawing);
  });
});

socket.on('user_joined', (data) => {
  addSystemMessage(`${data.username} joined the drawing session`);
  updateParticipants(data.numUsers);
});

socket.on('user_left', (data) => {
  addSystemMessage(`${data.username} left the drawing session`);
  updateParticipants(data.numUsers);
});

socket.on('drawing_stroke', (data) => {
  // Draw other users' strokes in real-time
  myp5.stroke(data.color);
  myp5.strokeWeight(data.size);
  myp5.line(data.x1, data.y1, data.x2, data.y2);
});

socket.on('clear_canvas', (data) => {
  myp5.clearCanvas();
  addSystemMessage(`${data.username} cleared the canvas`);
});

socket.on('disconnect', () => {
  connected = false;
  addSystemMessage('Connection lost. Trying to reconnect...');
});

socket.on('reconnect', () => {
  connected = true;
  addSystemMessage('Reconnected!');
  if (currentUser) {
    socket.emit('add_user', currentUser);
  }
});

// Focus on username input when page loads
usernameInput.focus();