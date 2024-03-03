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
const exampleQuizz = [
    {
        questionText: "What is the capital of France?",
        responses: ["Paris", "London", "Madrid", "Rome"],
        rightAnswer: ["Paris"],
        types: "multichoise",
    },
    {
        questionText: "What is the capital of Spain?",
        responses: ["Paris", "London", "Madrid", "Rome"],
        rightAnswer: ["Madrid"],
        types: "multichoise",
    },
    {
        questionText: "What is the capital of Italy?",
        responses: ["Paris", "London", "Madrid", "Rome"],
        rightAnswer: ["Rome"],
        types: "multichoise",
    },
    {
        questionText: "What is the capital of England?",
        responses: ["Paris", "London", "Madrid", "Rome"],
        rightAnswer: ["London"],
        types: "multichoise",
    }
]

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });

    socket.on("join", (room, callback) => {
        socket.join(room);
        if (!roomData[room]) {
            roomData[room] = {
                id: room,
                questions: [],
                players: [],
                responsesPlayers:[],
                scorePlayers:[],
                // Need to add also the theme of the room ?
            };
        }
        roomData[room].players.push(socket.id); // Use socket.id to identify the player
        io.to(room).emit('roomData', roomData[room].players, roomData[room].id); // Return players in the room and ID
    });

    socket.on("startGame", (room) => {
        // Start the game
        io.to(room).emit('startGame', roomData[room].questions[0].questionText, roomData[room].questions[0].responses, 0, roomData[room].questions.length); // Return the first question, the possible responses and the number of questions
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