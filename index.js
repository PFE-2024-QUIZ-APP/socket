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


const roomData = [
    {
        questionText: "What is the capital of France?",
        responses: ["Paris", "London", "Madrid", "Rome"],
        rightAnswer: ["Paris"],
        types: "singleResponse",
    },
    {
        questionText: "What is the capital of Spain?",
        responses: ["Paris", "London", "Madrid", "Rome"],
        rightAnswer: ["Madrid"],
        types: "singleResponse",
    },
    {
        questionText: "What is the capital of Italy?",
        responses: ["Paris", "London", "Madrid", "Rome"],
        rightAnswer: ["Rome"],
        types: "singleResponse",
    },
    {
        questionText: "What is the capital of England?",
        responses: ["Paris", "London", "Madrid", "Rome"],
        rightAnswer: ["London"],
        types: "singleResponse",
    }
]

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
        let roomId = socket.data.roomId || null;
        if (roomId) {
            roomData[roomId].players = roomData[roomId].players.filter(player => player.id!==socket.id);
            io.to(roomId).emit('roomData', {players:roomData[roomId].players, roomId:roomData[roomId].id}); // Return players in the room and ID

        }
   });

    socket.on("join", (room, userName, avatar,  callback) => {
        socket.join(room);
        socket.data.roomId = room;
        console.log(room,userName, avatar)
        if (!roomData[room]) {
            roomData[room] = {
                id: room,
                questions: exampleQuizz, // Example data to test the game
                players: [],
                responsesPlayers:[],
                scorePlayers:[],
                // Need to add also the theme of the room ?
            };
        }
        console.log(roomData[room].players);
        roomData[room].players.push({id : socket.id, name: userName, avatar:avatar }); // Use socket.id to identify the player
        io.to(room).emit('roomData', {players:roomData[room].players, roomId:roomData[room].id}); // Return players in the room and ID
    });

    socket.on("startGame", (room) => {
        // Start the game
        io.to(room).emit('startGame', {fisrtQuestion :roomData[room].questions[0], questionLength:roomData[room].questions/length}, roomData[room].questions.length); // Return the first question, the possible responses and the number of questions
    });

    socket.on("responsePlayer", (room, response, indexOfQuestion) => {
        // Receive a response from a player
        roomData[room].responsesPlayers[indexOfQuestion] = response;
        if(indexOfQuestion === roomData[room].questions.length - 1){
            // If it's the last question
            io.to(room).emit('endGame', roomData[room].responsesPlayers, roomData[room].scorePlayers);
            return;
        }
        if(roomData[room].responsesPlayers.length === roomData[room].players.length){
            // If everyPlayer have answered
            io.to(room).emit('endQuestions', roomData[room].responsesPlayers, roomData[room].questions[indexOfQuestion] );
            return;
        }
        io.to(room).emit('responsePlayer', roomData[room].responsesPlayers[indexOfQuestion]);
        // Return the responses of the players to all users in the room
    });

    socket.on("nextQuestions", (room, indexOfQuestion) => {
        // Go to the next question
        io.to(room).emit('nextQuestions', roomData[room].questions[indexOfQuestion + 1].questionText, roomData[room].questions[indexOfQuestion + 1].responses, indexOfQuestion + 1);
        // Return the next question, the possible responses and the index of the question
    });
});

server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});