const express = require('express');

const app = express();
const port = Number(process.env.PORT || 3000);
const server = app.listen(port);

app.use(express.static('public'));

console.log(`Server is listening on port ${port}`);

const socket = require("socket.io");
const io = socket(server);


io.of('/client').on('connection', (socket) => {
  console.log("new client connection: " + socket.id);

  io.of('/sharedView').emit('userJoined', {id: socket.id});

  socket.on('update', (data) => {
    io.of('/sharedView').emit('userUpdate', data);
  })

  socket.on('disconnect', (data) => {
    io.of('/sharedView').emit('userLeft', {id: socket.id});
  });
});

io.of('/sharedView').on('connection', (socket) => {
  console.log("new SHARED VIEW connection: " + socket.id);
});