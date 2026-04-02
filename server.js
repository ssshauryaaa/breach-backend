require("dotenv").config();

const express = require("express");
const http = require("http");
const socketio = require("socket.io"); // keep this
const cors = require("cors");
const cookieParser = require("cookie-parser");
const db = require("./config/db");

const attackRoutes = require("./routes/attackRoutes");
const defenceRoutes = require("./routes/defenceRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const authRoutes = require("./routes/authRoutes");
const teamRoutes = require("./routes/teamRoutes");
const adminRoutes = require("./routes/adminRoutes");
const competitionRoutes = require("./routes/competitionRoutes");


const app = express();
const server = http.createServer(app);

// ✅ FIX: Add CORS config directly to Socket.IO
const io = socketio(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://breachatrix.vercel.app"
    ],
    credentials: true,
  },
});

app.set("io", io); // ✅ THIS is the key

app.use(
  cors({
     origin: [
      "http://localhost:3000",
      "http://breachatrix.vercel.app"
    ],
    credentials: true,
  })
);



app.use(express.json());
app.use(cookieParser());

app.use("/attack", attackRoutes);
app.use("/defense", defenceRoutes);
app.use("/auth", authRoutes);
app.use("/team", teamRoutes);
app.use("/vuln", attackRoutes);
app.use("/api/admin", adminRoutes);
app.use("/announcement", announcementRoutes);
app.use("/competition", competitionRoutes);

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
});



server.listen(5000, () => {
  console.log("Server running on port 5000");
});
