import { useEffect, useState, useRef } from "react";
import socket from "./socket";
import Auth from "./Auth";

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [username, setUsername] = useState(
    localStorage.getItem("username") || "",
  );
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const typingTimeout = useRef(null);

  useEffect(() => {
    if (!username) return;

    socket.emit("user_online", username);

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("online_users", (users) => {
      setOnlineUsers(users.filter((u) => u !== username));
    });

    socket.on("receive_message", (data) => {
      setChat((prevChat) => [...prevChat, data]);
      if (data.senderId === selectedUser) {
        socket.emit("mark_seen", { sender: selectedUser, receiver: username });
      }
    });

    socket.on("user_typing", (sender) => {
      if (sender === selectedUser) setIsTyping(true);
    });

    socket.on("user_stop_typing", (sender) => {
      if (sender === selectedUser) setIsTyping(false);
    });

    socket.on("messages_seen", ({ by }) => {
      if (by === selectedUser) {
        setChat((prevChat) =>
          prevChat.map((msg) =>
            msg.senderId === username ? { ...msg, seen: true } : msg,
          ),
        );
      }
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("online_users");
      socket.off("receive_message");
      socket.off("user_typing");
      socket.off("user_stop_typing");
      socket.off("messages_seen");
    };
  }, [username, selectedUser]);

  useEffect(() => {
    if (!selectedUser || !username) return;

    setIsTyping(false);
    socket.emit("join_room", { user1: username, user2: selectedUser });

    fetch(
      `${import.meta.env.VITE_BACKEND_URL}/api/messages/${username}/${selectedUser}`,
    )
      .then((res) => res.json())
      .then((data) => {
        setChat(data);
        socket.emit("mark_seen", { sender: selectedUser, receiver: username });
      })
      .catch((err) => console.error("Error fetching messages:", err));
  }, [selectedUser, username]);

  const handleTyping = (e) => {
    setMessage(e.target.value);
    socket.emit("typing", { sender: username, receiver: selectedUser });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stop_typing", { sender: username, receiver: selectedUser });
    }, 1500);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "chat_uploads");

    try {
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/hdkhxhez/auto/upload",
        { method: "POST", body: formData },
      );
      const data = await res.json();

      const messageData = {
        text: data.secure_url,
        senderId: username,
        receiverId: selectedUser,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        seen: false,
        isFile: true,
        fileType: file.type,
      };

      socket.emit("send_message", messageData);
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const sendMessage = () => {
    if (message.trim() === "" || !selectedUser) return;

    const messageData = {
      text: message,
      senderId: username,
      receiverId: selectedUser,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      seen: false,
      isFile: false,
      fileType: null,
    };

    socket.emit("send_message", messageData);
    setMessage("");
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUsername("");
  };

  if (!username) {
    return <Auth onLogin={(name) => setUsername(name)} />;
  }

  return (
    <div className="flex h-screen bg-paper font-body">
      {/* SIDEBAR */}
      <div className="w-72 bg-ink text-paper flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <h2 className="font-display font-bold text-lg">{username}</h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-mint" : "bg-red-500"}`}
            />
            <span className="text-xs text-slate">
              {isConnected ? "Online" : "Offline"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs uppercase tracking-wider text-slate px-2 mb-2">
            Contacts
          </p>
          {onlineUsers.length === 0 && (
            <p className="text-sm text-slate px-2">
              No one else is online right now.
            </p>
          )}
          {onlineUsers.map((user) => (
            <div
              key={user}
              onClick={() => setSelectedUser(user)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition mb-1 ${
                selectedUser === user
                  ? "bg-coral text-white"
                  : "hover:bg-white/5"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-mint"></span>
              </span>
              <span className="text-sm font-medium">{user}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleLogout}
          className="m-3 py-2.5 rounded-xl border border-white/15 text-sm text-slate hover:text-paper hover:border-white/30 transition"
        >
          Log Out
        </button>
      </div>

      {/* CHAT WINDOW */}
      <div className="flex-1 flex flex-col">
        {!selectedUser ? (
          <div className="m-auto text-center text-slate">
            <p className="font-display font-semibold text-lg text-ink/60">
              Select a contact to start chatting
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-slate/15 bg-white">
              <h3 className="font-display font-bold text-ink">
                {selectedUser}
              </h3>
              <p className="text-xs text-coral h-4">
                {isTyping ? "typing..." : ""}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {chat.map((msg, index) => {
                const isOwn = msg.senderId === username;
                return (
                  <div
                    key={index}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[60%] px-4 py-2.5 shadow-sm ${
                        isOwn
                          ? "bg-coral text-white rounded-2xl rounded-br-sm"
                          : "bg-white text-ink rounded-2xl rounded-bl-sm"
                      }`}
                    >
                      {msg.isFile ? (
                        msg.fileType?.startsWith("image") ? (
                          <img
                            src={msg.text}
                            alt="shared file"
                            className="rounded-lg max-w-full mb-1"
                          />
                        ) : (
                          <a
                            href={msg.text}
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-sm"
                          >
                            📄 View File
                          </a>
                        )
                      ) : (
                        <p className="text-sm">{msg.text}</p>
                      )}
                      <span
                        className={`text-[10px] block text-right mt-1 ${
                          isOwn ? "text-white/70" : "text-slate"
                        }`}
                      >
                        {msg.time} {isOwn && (msg.seen ? "✓✓" : "✓")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t border-slate/15 bg-white">
              <div className="flex gap-3 items-center">
                <label className="cursor-pointer text-slate hover:text-coral transition text-xl">
                  📎
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    className="hidden"
                    accept="image/*,application/pdf"
                  />
                </label>

                <input
                  type="text"
                  value={message}
                  onChange={handleTyping}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message"
                  className="flex-1 px-4 py-2.5 rounded-full border border-slate/25 focus:outline-none focus:ring-2 focus:ring-coral text-sm"
                />
                <button
                  onClick={sendMessage}
                  className="px-6 py-2.5 rounded-full bg-coral text-white text-sm font-semibold hover:opacity-90 transition"
                >
                  Send
                </button>
              </div>
              {uploading && (
                <p className="text-xs text-slate pt-2">Uploading...</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
