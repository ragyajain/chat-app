const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const Message = require("./models/Message");
const User = require("./models/User");

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "https://chat-app-eight-lovat-97.vercel.app/", 
];

app.use(cors({ origin: allowedOrigins }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.get("/", (req, res) => {
    res.send("Chat server is running");
});

app.get("/api/users/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const users = await User.find({ username: { $ne: username } }).select("username -_id");
    res.json(users.map((u) => u.username));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.get("/api/messages/:user1/:user2", async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const messages = await Message.find({
      $or: [
        { senderId: user1, receiverId: user2 },
        { senderId: user2, receiverId: user1 },
      ],
    }).sort({ createdAt: 1 });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("✅ A user connected:", socket.id);

  socket.on("user_online", (username) => {
    onlineUsers[username] = socket.id;
    socket.username = username; 
    io.emit("online_users", Object.keys(onlineUsers));
  });

  socket.on("join_room", ({ user1, user2 }) => {
    const roomId = [user1, user2].sort().join("-"); 
    socket.join(roomId);
    console.log(`${socket.username} joined room: ${roomId}`);
  });

  socket.on("typing", ({ sender, receiver }) => {
    const roomId = [sender, receiver].sort().join("-");
    socket.to(roomId).emit("user_typing", sender);
  });

  socket.on("stop_typing", ({ sender, receiver }) => {
    const roomId = [sender, receiver].sort().join("-");
    socket.to(roomId).emit("user_stop_typing", sender);
  });

  socket.on("send_message", async (data) => {
    console.log("📩 Message received:", data);

    const roomId = [data.senderId, data.receiverId].sort().join("-");

    try {
      const newMessage = new Message(data);
      await newMessage.save();
    } catch (err) {
      console.error("❌ Error saving message:", err);
    }

    io.to(roomId).emit("receive_message", data);
  });

  socket.on("mark_seen", async ({ sender, receiver }) => {
    try {
      await Message.updateMany(
        { senderId: sender, receiverId: receiver, seen: false },
        { $set: { seen: true } }
      );

      const roomId = [sender, receiver].sort().join("-");
      io.to(roomId).emit("messages_seen", { by: receiver });
    } catch (err) {
      console.error("❌ Error marking messages as seen:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ A user disconnected:", socket.id);

    if (socket.username) {
      delete onlineUsers[socket.username];
      io.emit("online_users", Object.keys(onlineUsers));
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});