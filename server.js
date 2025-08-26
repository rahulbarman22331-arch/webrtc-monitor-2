const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // When sharer starts screen sharing
  socket.on("share", (sessionCode) => {
    socket.join(sessionCode);
    console.log(`Sharer joined room: ${sessionCode}`);

    // Send code to Telegram
    if (BOT_TOKEN && CHAT_ID) {
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: `🎥 New screen share started!\nSession Code: ${sessionCode}`,
        }),
      }).catch((err) => console.error("Telegram error:", err));
    }
  });

  // When viewer joins with session code
  socket.on("view", (sessionCode) => {
    socket.join(sessionCode);
    console.log(`Viewer joined room: ${sessionCode}`);
  });

  // Forward WebRTC signals
  socket.on("signal", ({ sessionCode, data }) => {
    socket.to(sessionCode).emit("signal", data);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
