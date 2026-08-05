import { useState } from "react";

function Auth({ onLogin }) {
  const [isSignup, setIsSignup] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const endpoint = isSignup ? "signup" : "login";

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      onLogin(data.username);
    } catch (err) {
      setError("Server error, try again");
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-paper rounded-2xl shadow-2xl p-8">
        <h1 className="font-display font-extrabold text-2xl text-ink mb-1">
          {isSignup ? "Create account" : "Welcome back"}
        </h1>
        <p className="text-slate text-sm mb-6">
          {isSignup ? "Start chatting in seconds." : "Log in to continue your conversations."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate/30 bg-white focus:outline-none focus:ring-2 focus:ring-coral text-sm"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate/30 bg-white focus:outline-none focus:ring-2 focus:ring-coral text-sm"
            required
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-coral text-white font-semibold text-sm hover:opacity-90 transition"
          >
            {isSignup ? "Sign Up" : "Log In"}
          </button>
        </form>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <p className="text-sm text-slate mt-5 text-center">
          {isSignup ? "Already have an account?" : "New here?"}{" "}
          <span
            onClick={() => setIsSignup(!isSignup)}
            className="text-coral font-semibold cursor-pointer"
          >
            {isSignup ? "Log In" : "Sign Up"}
          </span>
        </p>
      </div>
    </div>
  );
}

export default Auth;