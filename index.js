import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

const roomData = {};

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on("join", (room, callback) => {
        socket.join(room);
        console.log(`user joined room ${room}`);
        if (!roomData[room]) {
            roomData[room] = {
                id: room,
                players: [],
                messages: [],
                questions: [],
                responsesPlayers:[],
                scorePlayers:[],
            };
        }
        roomData[room].players.push(socket.id); // Utiliser l'ID du socket comme identifiant de  l'utilisateur
        io.to(room).emit('roomData', roomData[room]);

    });
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});