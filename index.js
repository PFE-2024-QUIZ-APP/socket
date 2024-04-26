import express from "express";
import "dotenv/config";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Server } from "socket.io";
import { getFirestore, collection, doc, getDoc } from "firebase/firestore/lite";
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: "quizz-app-79583.firebaseapp.com",
  projectId: "quizz-app-79583",
  storageBucket: "quizz-app-79583.appspot.com",
  messagingSenderId: "682570150281",
  appId: "1:682570150281:web:bd4ab96129bfad96ec3158",
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const port = process.env.PORT || 3001;
const appServer = express();
const server = createServer(appServer);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const __dirname = dirname(fileURLToPath(import.meta.url));

appServer.get("/", (req, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

const roomData = [];

function generateCode(length = 5) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

const getQuizz = async (uidQuizz) => {
  try {
    const quizz = doc(db, "Theme", uidQuizz);
    const quizzDoc = await getDoc(quizz);
    return quizzDoc.data();
  } catch (e) {
    console.log(e);
    return null;
  }
};

io.on("connection", (socket) => {
  console.log('a user connected');
  io.to(socket.id).emit('id', socket.id);
  socket.on("disconnect", () => {
    let roomId = socket.data.roomId || null;
    if (roomId) {
      roomData[roomId]["players"] = roomData[roomId]["players"].filter(
        (player) => player.id !== socket.id
      );
      io.to(roomId).emit("roomData", {
        players: roomData[roomId]["players"],
        roomId: roomData[roomId]["id"],
      }); // Return players in the room and ID
    }
  });

  socket.on("createRoom", async ({ userName, avatar }) => {
    let code = generateCode();
    if (!roomData[code]) {
      roomData[code] = {
        id: code,
        players: [],
        uidQuizz: null,
        currentQuestion: 0,
        questions: [],
      };
    }
    socket.join(code);
    socket.data.roomId = code;
    roomData[code].players.push({
      id: socket.id,
      name: userName,
      avatar: avatar,
      score: 0,
      responses: []
    }); // Use socket.id to identify the player
    io.to(code).emit("roomData", {
      players: roomData[code]["players"],
      roomId: roomData[code]["id"],
      questions: roomData[code]["questions"],
    }); // Return players in the room and ID
  });

  socket.on("editRoom", async (uidQuizz) => {
    let roomId = socket.data.roomId || null;
    if (!roomId) {
      return;
    }
    roomData[roomId]["uidQuizz"] = uidQuizz;
    io.to(roomId).emit("editRoom", { uidQuizz: uidQuizz }); // Return players in the room and ID
  });

  socket.on("join", ({ room, userName, avatar }, callback) => {
    if (!roomData[room]) {
      // callback({
      //   status: "error"
      // });
    } else {
      socket.join(room);
      socket.data.roomId = room;
      roomData[room]["players"].push({
        id: socket.id,
        name: userName,
        avatar: avatar,
        score: 0,
        responses: []
      }); // Use socket.id to identify the player
      io.to(room).emit("roomData", {
        players: roomData[room]["players"],
        roomId: roomData[room]["id"],
      }); // Return players in the room and ID
    }
  });

  socket.on("nextQuestion", async () => {
    let roomId = socket.data.roomId || null;
    if (!roomId) {
      return;
    }
    let currentQuestion = roomData[roomId]["currentQuestion"];
    if(currentQuestion === 0) {
      let quizz = await getQuizz(roomData[roomId]["uidQuizz"]);
      roomData[roomId]["questions"] = quizz.questions;
    }
    io.to(roomId).emit("nextQuestion", {
      question: roomData[roomId]["questions"][currentQuestion],
      creator: roomData[roomId]["players"][0],
      currentQuestion: currentQuestion,
    });
    roomData[roomId]["currentQuestion"] = currentQuestion + 1;
  });

  socket.on("responsePlayer", ({ indexQuestion, response }) => {
    // Receive a response from a player
    let roomId = socket.data.roomId || null;
    if (!roomId) {
      return;
    }
    roomData[roomId].players.forEach((player) => {
      if (player.id === socket.id) {
        player.responses.push(response);
        roomData[roomId].questions[indexQuestion]["rightAnswer"] === response ? player.score += 15 : player.score += 0;
      }
    });
    let responsesPlayers = roomData[roomId].players.map(player => player.responses[indexQuestion]);


    io.to(roomId).emit("allResponses", {
      question: roomData[roomId]["questions"][indexQuestion],
      currentQuestion: indexQuestion,
      responsesPlayers: responsesPlayers,
    });

    // Check if it's the last user to answer
    const allAnswered = roomData[roomId].players.every(player => player.responses[indexQuestion] !== undefined);
    if(allAnswered) {
      io.to(roomId).emit("timerEnded", {
        question: roomData[roomId]["questions"][indexQuestion],
        currentQuestion: indexQuestion,
        responsesPlayers: responsesPlayers,
      });

      if (indexQuestion === roomData[roomId].questions.length - 1) {
        io.to(roomId).emit("endGame",{
          question: roomData[roomId]["questions"][indexQuestion],
          currentQuestion: indexQuestion,
          players: roomData[roomId].players,
        });
      }
    }
  });

  socket.on("restart", async () => {
    let roomId = socket.data.roomId || null;
    if (!roomId) {
      return;
    }
    roomData[roomId].players.forEach(player => {
      player.responses = [];
    });
    roomData[roomId].currentQuestion = 0;
    io.to(roomId).emit("roomData", {
      players: roomData[roomId]["players"],
      roomId: roomData[roomId]["id"],
      questions: roomData[roomId]["questions"],
    });
  });
});

server.listen(port, () => {
  console.log("server running at http://localhost:3000");
});
