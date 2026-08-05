const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const Message = require("./models/Message");

const app = express();
app.use(cors());
app.use(express.json());

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// MongoDB connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const server = http.createServer(app);

const allowedOrigins = [
  "http://localhost:5173",
  "https://chat-app-8fzx.onrender.com", 
];

app.use(cors({ origin: allowedOrigins }));

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

// Basic test route
app.get("/", (req, res) => {
    res.send("Chat server is running");
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

// Online users track karne ke liye: { username: socketId }
const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("✅ A user connected:", socket.id);

  // Jab user login karke apna username bataye
  socket.on("user_online", (username) => {
    onlineUsers[username] = socket.id;
    socket.username = username; // socket ke saath username attach kar do future use ke liye
    console.log("Current online users:", onlineUsers); //temp
    // Sabko updated online users list bhejo
    io.emit("online_users", Object.keys(onlineUsers));
  });

  // NAYA — jab user kisi specific user se chat kholta hai
  socket.on("join_room", ({ user1, user2 }) => {
    const roomId = [user1, user2].sort().join("-"); // dono naam sort karke jodo
    socket.join(roomId);
    console.log(`${socket.username} joined room: ${roomId}`);
  });

  //emit.to - sbko bhejta h including sender and socket.to - sbko bhejta h except sender ko
  socket.on("typing", ({ sender, receiver }) => {
    // console.log("Typing event received:", sender, "->", receiver);
    const roomId = [sender, receiver].sort().join("-");
    socket.to(roomId).emit("user_typing", sender);
  });

  socket.on("stop_typing", ({ sender, receiver }) => {
    const roomId = [sender, receiver].sort().join("-");
    socket.to(roomId).emit("user_stop_typing", sender);
  });

  // Messaging ke liye (ye already tha, isko hataya nahi)
  socket.on("send_message", async (data) => {
    console.log("📩 Message received:", data);

    const roomId = [data.senderId, data.receiverId].sort().join("-");

    try {
      const newMessage = new Message(data);
      await newMessage.save();
    } catch (err) {
      console.error("❌ Error saving message:", err);
    }

    // Sirf is room ke andar bhejo, sabko nahi
    io.to(roomId).emit("receive_message", data);
  });

  socket.on("mark_seen", async ({ sender, receiver }) => {
    try {
      // Sender ke jitne bhi messages receiver ne abhi tak nahi dekhe, unhe "seen" kar do
      await Message.updateMany(
        { senderId: sender, receiverId: receiver, seen: false },
        { $set: { seen: true } }
      );

      const roomId = [sender, receiver].sort().join("-");
      // Sender ko batao ki uske messages dekh liye gaye
      io.to(roomId).emit("messages_seen", { by: receiver });
    } catch (err) {
      console.error("❌ Error marking messages as seen:", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ A user disconnected:", socket.id);

    // Disconnect hone waale user ko list se hata do
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