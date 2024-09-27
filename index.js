const io = require('socket.io')(8000, { cors: { origin: "*" } });
const { v4: uuidv4 } = require('uuid');

let rooms = {}; // Stores room details

io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle room creation
  socket.on('create:room', (userDetails) => {
    const roomId = uuidv4();
    rooms[roomId] = {
      host: userDetails,
      participant: null,
      meetingStarted: false,
    };
    socket.join(roomId);
    socket.emit('room:created', roomId);
    console.log(`${userDetails.username} created a meeting with ID: ${roomId}`);
  });

  // Handle joining a room
  socket.on('join:room', ({ roomId, userDetails }) => {
    if (rooms[roomId]) {
      if (rooms[roomId].participant) {
        socket.emit('room:full', 'The room is full. Only two participants are allowed.');
        console.log(`Room with ID: ${roomId} is full. ${userDetails.username} cannot join.`);
      } else {
        rooms[roomId].participant = userDetails;
        socket.join(roomId);
        socket.emit('room:joined', {
          roomId,
          host: rooms[roomId].host,
          meetingStarted: rooms[roomId].meetingStarted,
        });
        socket.to(roomId).emit('participant:joined', userDetails, { id: socket.id });
        console.log(`${userDetails.username} joined the meeting with ID: ${roomId}`);
      }
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  

  // Handle requesting room info
  socket.on('request:room:info', ({ roomId }) => {
    if (rooms[roomId]) {
      const { host, participant, meetingStarted } = rooms[roomId];
      socket.emit('room:info', {
        roomId,
        host,
        participant,
        meetingStarted
      });
    } else {
      socket.emit('error', 'Room not found');
    }
  });

  // Handle starting the meeting
  socket.on('meeting:start', ({ roomId }) => {
    if (rooms[roomId]) {
      rooms[roomId].meetingStarted = true;
      io.to(roomId).emit('meeting:started');
      console.log(`Meeting with ID: ${roomId} has started`);
    }
  });

  
socket.on('leave:meeting', async ({ roomId, username }) => {
  try {
   if (rooms[roomId]) {
      // Emit meeting ended event to all participants in the room
      io.to(roomId).emit('meeting:ended');
      
      // Remove the room from the rooms object
      delete rooms[roomId];
      
      console.log(`Meeting with ID: ${roomId} has ended`);
    }
    socket.leave(roomId);
  } 
  catch (error) {
    console.error("Error leaving meeting:", error);
    socket.emit('error', 'Failed to leave the meeting');
  }
});

  socket.on("user:call", ({ to, offer }) => {
    console.log('Sending offer for call:', offer);
    io.to(to).emit("incomming:call", { from: socket.id, offer });
  });

  socket.on("call:accepted", ({ to, ans }) => {
    console.log('Sending answer for call:', ans);
    io.to(to).emit("call:accepted", { from: socket.id, ans });
  });

  socket.on("peer:nego:needed", ({ to, offer }) => {
    console.log('Sending offer for negotiation:', offer);
    io.to(to).emit("peer:nego:needed", { from: socket.id, offer });
  });

  socket.on("peer:nego:done",({to,ans})=>{
    console.log('Sending answer for negotiation:', ans);
    io.to(to).emit("peer:nego:final", { from: socket.id, ans});

  })

  socket.on('start:meeting:request', ({ roomId, to }) => {
    if (rooms[roomId]) {
      io.to(to).emit('start:meeting:request');
    }
  });

  socket.on('meeting:accepted', ({ roomId, to }) => {
    if (rooms[roomId]) {
      rooms[roomId].meetingStarted = true;
      io.to(to).emit('meeting:accepted');
      io.to(roomId).emit('meeting:started');
    }
  });

  socket.on('meeting:declined', ({ roomId, to }) => {
    if (rooms[roomId]) {
      io.to(to).emit('meeting:declined');
    }
  });


  socket.on('media:toggle', ({ roomId, type, enabled }) => {
    if (rooms[roomId]) {
      const username = rooms[roomId].host.id === socket.id ? rooms[roomId].host.username : rooms[roomId].participant.username;
      io.to(roomId).emit('media:toggle', { type, enabled, username });
    }
  });

  socket.on('file:send', ({ to, fileName, fileData }) => {
    io.to(to).emit('file:received', { fileName, fileData });
    socket.emit('file:sent');
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    // Optional: Handle any cleanup if necessary, like removing a participant who disconnects.
  });
});

console.log('Socket.IO server running on port 8000');