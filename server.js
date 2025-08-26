const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());                     // allow cross-origin (Netlify frontend)
app.get("/health", (_, res) => res.send("OK"));

const server = http.createServer(app);

// allow cross-origin Socket.IO (lock down later to your Netlify domain)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;    // set on Render
const CHAT_ID  = process.env.CHAT_ID;       // set on Render

// sessionKey -> sharerSocketId
const sessions = {};

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Sharer requests a session (we'll send key to Telegram)
  socket.on("create-session", async () => {
    const sessionKey = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    sessions[sessionKey] = socket.id;

    if (BOT_TOKEN && CHAT_ID) {
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: CHAT_ID,
          text: `🔐 New consent session key: ${sessionKey}`
        });
      } catch (e) {
        console.error("Telegram error:", e.message);
      }
    }

    socket.emit("session-created", sessionKey);
  });

  // Viewer enters a session key
  socket.on("join-session", (sessionKey) => {
    const sharerId = sessions[sessionKey];
    if (!sharerId) {
      socket.emit("session-joined", { ok: false, reason: "INVALID_KEY" });
      return;
    }
    socket.emit("session-joined", { ok: true });
    io.to(sharerId).emit("viewer-joined", socket.id); // tell sharer who joined
  });

  // generic signaling forwarder
  socket.on("signal", ({ to, data }) => {
    if (to) io.to(to).emit("signal", { from: socket.id, data });
  });

  socket.on("disconnect", () => {
    // clean up any sessions owned by this socket
    for (const [key, id] of Object.entries(sessions)) {
      if (id === socket.id) delete sessions[key];
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
