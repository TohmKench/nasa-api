import React, { useState } from "react";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "./firebaseConfig";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{
      maxWidth: 350,
      margin: "120px auto",
      padding: 32,
      background: "rgba(255,255,255,0.95)",
      borderRadius: 12,
      boxShadow: "0 2px 16px #0002",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      <h2 style={{ marginBottom: 24, color: "#222" }}>Sign In</h2>
      <form onSubmit={handleLogin} style={{ width: "100%" }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            width: "100%",
            marginBottom: 14,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #bbb",
            fontSize: "1rem"
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{
            width: "100%",
            marginBottom: 14,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #bbb",
            fontSize: "1rem"
          }}
        />
        <button
          type="submit"
          style={{
            width: "100%",
            padding: 12,
            fontWeight: 600,
            background: "#222",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: "1rem",
            marginBottom: 10
          }}
        >
          Login
        </button>
      </form>
      <button
        onClick={handleGoogleLogin}
        style={{
          width: "100%",
          padding: 12,
          background: "#4285F4",
          color: "#fff",
          fontWeight: 600,
          border: "none",
          borderRadius: 6,
          fontSize: "1rem",
          marginBottom: 10
        }}
      >
        Sign in with Google
      </button>
      {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
    </div>
  );
};

export default LoginPage;