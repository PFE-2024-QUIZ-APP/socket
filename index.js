import express from 'express';
import 'dotenv/config'
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';
import { getFirestore, collection, doc, getDoc } from 'firebase/firestore/lite';
import { initializeApp } from "firebase/app";

const firebaseConfig = {
    apiKey: process.env.API_KEY,
    authDomain: "quizz-app-79583.firebaseapp.com",
    projectId: "quizz-app-79583",
    storageBucket: "quizz-app-79583.appspot.com",
    messagingSenderId: "682570150281",
    appId: "1:682570150281:web:bd4ab96129bfad96ec3158"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);


const appServer = express();
const server = createServer(appServer);
const io = new Server(server);

const __dirname = dirname(fileURLToPath(import.meta.url));

appServer.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});


const roomData = [];

function generateCode(length = 5) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const getQuizz = async (uidQuizz) => {
    try{
        const quizz = doc(db, "Theme", uidQuizz);
        const quizzDoc = await getDoc(quizz);
        return quizzDoc.data();
    }catch (e){
        console.log(e);
        return null;
    }
}

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('disconnect', () => {
        console.log('user disconnected');
        let roomId = socket.data.roomId || null;
        if (roomId) {
            roomData[roomId]["players"] = roomData[roomId]["players"].filter(player => player.id!==socket.id);
            io.to(roomId).emit('roomData', {players:roomData[roomId]["players"], roomId:roomData[roomId]["id"]}); // Return players in the room and ID
        }
    });

    socket.on('createRoom', async (uidQuizz, userName, avatar) => {
        let code = generateCode();
        if (!roomData[code]) {
            roomData[code] = {
                id: code,
                players: [],
            };
        }
        let quizz = await getQuizz(uidQuizz)
        socket.join(code);
        roomData[code].questions = quizz.questions;
        roomData[code].players.push({id: socket.id, name: userName, avatar: avatar}); // Use socket.id to identify the player
        io.to(code).emit('roomData', {players: roomData[code]["players"], roomId: roomData[code]["id"], questions:roomData[code]["questions"]}); // Return players in the room and ID
    })

    socket.on("join", (room, userName, avatar,  callback) => {
        socket.join(room);
        console.log(roomData);
        socket.data.roomId = room;
        roomData[room]["players"].push({id : socket.id, name: userName, avatar:avatar }); // Use socket.id to identify the player
        io.to(room).emit('roomData', {players:roomData[room]["players"], roomId:roomData[room]["id"]}); // Return players in the room and ID
    });


    socket.on("startGame", (room) => {
        console.log("startGame")
        console.log(room)
        // Start the game
        io.to(room).emit('startGame', { question :roomData[room]["questions"][0]} );
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