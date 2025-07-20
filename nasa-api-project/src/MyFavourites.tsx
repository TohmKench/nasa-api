import React, { useEffect, useState } from "react";
import { getFirestore, doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";
import NavBar from "./NavBar";
import "./MyFavourites.css";

interface Favourite {
  url: string;
  explanation: string;
  id: number;
}

const db = getFirestore();

const MyFavourites: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalFav, setModalFav] = useState<Favourite | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setFavourites([]);
      setLoading(false);
      return;
    }
    const fetchFavourites = async () => {
      setLoading(true);
      const favRef = doc(db, "favorites", user.uid);
      const favSnap = await getDoc(favRef);
      if (favSnap.exists()) {
        setFavourites(favSnap.data().items || []);
      } else {
        setFavourites([]);
      }
      setLoading(false);
    };
    fetchFavourites();
  }, [user]);

  const handleDownload = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "nasa-favourite.jpg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Unfavourite handler
  const handleUnfavourite = async (fav: Favourite) => {
    if (!user) return;
    const favRef = doc(db, "favorites", user.uid);
    await updateDoc(favRef, {
      items: arrayRemove(fav)
    });
    setFavourites(favourites.filter(f => f.url !== fav.url));
    setModalFav(null);
  };

  function Stars({ count = 80 }) {
    const stars = Array.from({ length: count }).map((_, i) => {
      const size = Math.random() * 2 + 1;
      // Random drift between -30px and 30px
      const driftX = `${(Math.random() * 60 - 30).toFixed(2)}px`;
      const driftY = `${(Math.random() * 60 - 30).toFixed(2)}px`;
      const style: React.CSSProperties = {
        left: `${Math.random() * 100}vw`,
        top: `${Math.random() * 100}vh`,
        width: size,
        height: size,
        animationDelay: `${Math.random() * 2}s`,
        // Custom properties for drift
        ["--drift-x" as any]: driftX,
        ["--drift-y" as any]: driftY,
      };
      return <div className="star" style={style} key={i} />;
    });
    return <div className="stars">{stars}</div>;
  }

  return (
    <div className="myfavs-root">
      <Stars count={130} />
      <NavBar />
      <div className="myfavs-container" style={{ position: "relative", zIndex: 1 }}>
        <h2 className="myfavs-title">My Favourites</h2>
        {loading ? (
          <div>Loading...</div>
        ) : !user ? (
          <div>Please log in to view your favourites.</div>
        ) : favourites.length === 0 ? (
          <div>You have no favourite images yet.</div>
        ) : (
          <div className="myfavs-list-scroll">
            <div className="myfavs-list">
              {favourites.map((fav) => (
                <div
                  key={fav.url}
                  className="myfavs-card"
                  onClick={() => setModalFav(fav)}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === "Enter") setModalFav(fav); }}
                >
                  <img
                    src={fav.url}
                    alt="Favourite"
                    className="myfavs-card-img"
                  />
                  <div className="myfavs-card-desc">
                    {fav.explanation.slice(0, 90)}{fav.explanation.length > 90 ? "..." : ""}
                  </div>
                  <button
                    className="myfavs-download-btn"
                    onClick={e => { e.stopPropagation(); handleDownload(fav.url); }}
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Modal */}
      {modalFav && (
        <div
          className={`myfavs-modal-backdrop${fullscreen ? " fullscreen" : ""}`}
          onClick={() => {
            if (fullscreen) {
              setFullscreen(false);
            } else {
              setModalFav(null);
            }
          }}
        >
          <div
            className={`myfavs-modal-content${fullscreen ? " fullscreen" : ""}`}
            onClick={e => e.stopPropagation()}
          >
            <button
              className={`myfavs-modal-close${fullscreen ? " fullscreen" : ""}`}
              onClick={() => {
                if (fullscreen) {
                  setFullscreen(false);
                } else {
                  setModalFav(null);
                }
              }}
              title="Close"
            >
              &times;
            </button>
            <img
              src={modalFav.url}
              alt="Favourite Full"
              className={`myfavs-modal-img${fullscreen ? " fullscreen" : ""}`}
            />
            {!fullscreen && (
              <>
                <div className="myfavs-modal-desc">
                  {modalFav.explanation}
                </div>
                <div className="myfavs-modal-actions">
                  <button
                    className="myfavs-modal-btn"
                    onClick={() => setFullscreen(true)}
                  >
                    View Fullscreen
                  </button>
                  <button
                    className="myfavs-modal-btn download"
                    onClick={() => handleDownload(modalFav.url)}
                  >
                    Download
                  </button>
                  <button
                    className="myfavs-modal-btn"
                    style={{ background: "#e74c3c" }}
                    onClick={() => handleUnfavourite(modalFav)}
                  >
                    Unfavourite
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyFavourites;