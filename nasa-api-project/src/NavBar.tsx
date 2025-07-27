import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "./firebaseConfig";
import './index.css'; // Ensure global styles are applied
import { Link } from 'react-router-dom';

const NavBar: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  return (
    <nav
      style={{
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 10,
        background: 'rgba(255,255,255,0.7)',
        color: '#111',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        backdropFilter: 'blur(4px)'
      }}
    >
      <div style={{ overflow: 'hidden', height: '100px', width: '120px', display: 'flex', alignItems: 'center' }}>
        <img
          src="https://cdn.arstechnica.net/wp-content/uploads/2020/04/nasa-logo-web-rgb.png"
          alt="NASA Logo"
          style={{ height: '100px', width: 'auto', marginLeft: '-35px' }}
        />
      </div>
      <Link to="/" className="nav-link">APOD</Link>
      <Link to="/mars-rover" className="nav-link">Mars Rover</Link>
      <Link to="/asteroid-watch" className="nav-link">Asteroid Watch</Link>
      {/* <Link to="/iss-globe" className="nav-link">ISS Globe</Link> */}
      {user && (
        <button className="nav-btn" onClick={() => window.location.href = '/favourites'}>
          My Favourites
        </button>
      )}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, paddingRight: 16 }}>
        {user ? (
          <>
            <span style={{ fontWeight: 500, color: "#222" }}>{user.email}</span>
            <button
              className="nav-btn"
              onClick={() => signOut(auth)}
              style={{ background: "#e74c3c", color: "#fff", borderRadius: 6, padding: "6px 14px" }}
            >
              Logout
            </button>
          </>
        ) : (
          <button className="nav-btn" onClick={() => window.location.href = '/login'}>
            Login
          </button>
        )}
      </div>
    </nav>
  );
};

export default NavBar;