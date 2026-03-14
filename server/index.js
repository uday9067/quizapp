const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// rooms: { roomCode: { hostId, questions, settings, players, started, currentQ, timer } }
const rooms = {};

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomSummary(room) {
  return {
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      finishedAt: p.finishedAt,
    })),
    started: room.started,
    currentQ: room.currentQ,
    totalQuestions: room.questions.length,
    settings: room.settings,
  };
}

io.on("connection", (socket) => {
  // HOST: create room
  socket.on("create_room", ({ questions, settings }) => {
    const code = generateCode();
    rooms[code] = {
      hostId: socket.id,
      questions,
      settings,
      players: {},
      started: false,
      currentQ: 0,
      timers: {},
    };
    socket.join(code);
    socket.emit("room_created", { code });
    console.log(`Room ${code} created`);
  });

  // HOST: update questions/settings before start
  socket.on("update_room", ({ code, questions, settings }) => {
    if (!rooms[code] || rooms[code].hostId !== socket.id) return;
    rooms[code].questions = questions;
    rooms[code].settings = settings;
    socket.emit("room_updated");
  });

  // USER: join room
  socket.on("join_room", ({ code, name }) => {
    const room = rooms[code];
    if (!room) return socket.emit("error", { msg: "Room not found" });
    if (room.started) return socket.emit("error", { msg: "Quiz already started" });

    room.players[socket.id] = {
      id: socket.id,
      name,
      score: 0,
      answers: [],
      currentQ: 0,
      finishedAt: null,
    };

    socket.join(code);
    socket.data.roomCode = code;
    socket.data.isHost = false;

    socket.emit("joined_room", { code, totalQuestions: room.questions.length });
    // Notify host
    io.to(room.hostId).emit("player_joined", getRoomSummary(room));
    console.log(`${name} joined room ${code}`);
  });

  // HOST: start quiz
  socket.on("start_quiz", ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    if (room.questions.length === 0) return socket.emit("error", { msg: "No questions added" });

    room.started = true;
    room.currentQ = 0;

    // Send first question to all players
    io.to(code).emit("quiz_started", {
      totalQuestions: room.questions.length,
      timerSeconds: room.settings.timerSeconds,
    });

    sendQuestion(code, 0);
  });

  function sendQuestion(code, qIndex) {
    const room = rooms[code];
    if (!room) return;

    const q = room.questions[qIndex];
    if (!q) return;

    const questionData = {
      index: qIndex,
      total: room.questions.length,
      question: q.question,
      options: q.options,
      timerSeconds: room.settings.timerSeconds,
    };

    // Send to all players individually (not host)
    Object.keys(room.players).forEach((pid) => {
      const player = room.players[pid];
      if (player.currentQ === qIndex) {
        io.to(pid).emit("question", questionData);
      }
    });
  }

  // USER: submit answer
  socket.on("submit_answer", ({ code, qIndex, answer, timeTaken }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;

    const player = room.players[socket.id];
    if (player.currentQ !== qIndex) return; // already answered

    const q = room.questions[qIndex];
    const isCorrect = q.correct === answer;
    const timeBonus = isCorrect ? Math.max(0, room.settings.timerSeconds - timeTaken) : 0;
    const points = isCorrect ? 100 + Math.floor(timeBonus * 2) : 0;

    player.score += points;
    player.answers.push({ qIndex, answer, correct: isCorrect, points });
    player.currentQ += 1;

    socket.emit("answer_result", { correct: isCorrect, points, totalScore: player.score });

    // Notify host of score update
    io.to(room.hostId).emit("score_update", getRoomSummary(room));

    // Move player to next question or finish
    if (player.currentQ < room.questions.length) {
      const nextQ = room.questions[player.currentQ];
      socket.emit("question", {
        index: player.currentQ,
        total: room.questions.length,
        question: nextQ.question,
        options: nextQ.options,
        timerSeconds: room.settings.timerSeconds,
      });
    } else {
      // Player finished
      player.finishedAt = Date.now();
      socket.emit("quiz_complete", {
        score: player.score,
        total: room.questions.length * 100,
      });
      io.to(room.hostId).emit("score_update", getRoomSummary(room));
      checkAllDone(code);
    }
  });

  // USER: timer expired - auto submit null
  socket.on("time_up", ({ code, qIndex }) => {
    const room = rooms[code];
    if (!room || !room.players[socket.id]) return;
    const player = room.players[socket.id];
    if (player.currentQ !== qIndex) return;

    player.answers.push({ qIndex, answer: null, correct: false, points: 0 });
    player.currentQ += 1;

    socket.emit("answer_result", { correct: false, points: 0, totalScore: player.score });
    io.to(room.hostId).emit("score_update", getRoomSummary(room));

    if (player.currentQ < room.questions.length) {
      const nextQ = room.questions[player.currentQ];
      socket.emit("question", {
        index: player.currentQ,
        total: room.questions.length,
        question: nextQ.question,
        options: nextQ.options,
        timerSeconds: room.settings.timerSeconds,
      });
    } else {
      player.finishedAt = Date.now();
      socket.emit("quiz_complete", { score: player.score });
      io.to(room.hostId).emit("score_update", getRoomSummary(room));
      checkAllDone(code);
    }
  });

  function checkAllDone(code) {
    const room = rooms[code];
    if (!room) return;
    const allDone = Object.values(room.players).every((p) => p.finishedAt !== null);
    if (allDone) {
      const results = getResults(room);
      io.to(code).emit("final_results", { results });
    }
  }

  function getResults(room) {
    const topN = room.settings.topN || 10;
    return Object.values(room.players)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.finishedAt || Infinity) - (b.finishedAt || Infinity);
      })
      .slice(0, topN)
      .map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));
  }

  // HOST: get results manually
  socket.on("get_results", ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    const results = getResults(room);
    socket.emit("final_results", { results });
  });

  // HOST: end quiz early
  socket.on("end_quiz", ({ code }) => {
    const room = rooms[code];
    if (!room || room.hostId !== socket.id) return;
    const results = getResults(room);
    io.to(code).emit("final_results", { results });
  });

  socket.on("disconnect", () => {
    // If host disconnects, notify players
    for (const [code, room] of Object.entries(rooms)) {
      if (room.hostId === socket.id) {
        io.to(code).emit("error", { msg: "Host disconnected" });
        delete rooms[code];
      } else if (room.players[socket.id]) {
        delete room.players[socket.id];
        io.to(room.hostId).emit("score_update", getRoomSummary(room));
      }
    }
  });
});

app.get("/", (req, res) => res.send("QuizApp server running"));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server on port ${PORT}`));
