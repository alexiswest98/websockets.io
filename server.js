// Setup basic express server for drawing chat
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log('Drawing Chat Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

let drawingHistory = []; // Store drawings for new users
let numUsers = 0; // Track number of connected users

io.on('connection', (socket) => {
  let addedUser = false;

  console.log('A user connected');

  // Send existing drawings to new user
  socket.emit('drawing_history', drawingHistory);

  // when the client emits 'new_drawing', this listens and executes
  socket.on('new_drawing', (data) => {
    // Store the drawing
    const drawingData = {
      username: socket.username,
      drawing: data.drawing,
      color: data.color,
      brushSize: data.brushSize,
      timestamp: new Date().toISOString()
    };
    
    drawingHistory.push(drawingData);
    
    // Keep only last 20 drawings to prevent memory issues
    if (drawingHistory.length > 20) {
      drawingHistory.shift();
    }
    
    // Broadcast to all other clients
    socket.broadcast.emit('new_drawing', drawingData);
    
    console.log(`${socket.username} sent a drawing`);
  });

  // when the client emits 'add_user', this listens and executes
  socket.on('add_user', (username) => {
    if (addedUser) return;

    // Store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    
    console.log(`${username} joined (${numUsers} users online)`);
    
    // Echo globally (all clients) that a person has connected
    socket.broadcast.emit('user_joined', {
      username: socket.username,
      numUsers: numUsers
    });
    
    // Send login confirmation to the user
    socket.emit('login', {
      numUsers: numUsers
    });
  });

  // Handle real-time drawing strokes
  socket.on('drawing_stroke', (data) => {
    socket.broadcast.emit('drawing_stroke', {
      username: socket.username,
      ...data
    });
  });

  // Handle canvas clearing
  socket.on('clear_canvas', () => {
    socket.broadcast.emit('clear_canvas', {
      username: socket.username
    });
    console.log(`${socket.username} cleared the canvas`);
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;
      
      console.log(`${socket.username} left (${numUsers} users online)`);

      // Echo globally that this client has left
      socket.broadcast.emit('user_left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});