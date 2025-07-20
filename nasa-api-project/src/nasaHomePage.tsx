import { useEffect, useState, useRef } from 'react'
import NavBar from './NavBar';
import './nasaHomePage.css'
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";

interface ApodItem {
  url: string;
  hdurl?: string;
  media_type: string;
  explanation?: string;
}

interface ApodImage {
  url: string;
  hdurl?: string;
  explanation: string;
}

const db = getFirestore();

function HomePage() {
  const [apodImages, setApodImages] = useState<ApodImage[]>([]);
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);
  const [showExplanation, setShowExplanation] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showThumbnailsDelayed, setShowThumbnailsDelayed] = useState(false);
  const [favorites, setFavorites] = useState<{ url: string; explanation: string; id: number }[]>([]);
  const [user, setUser] = useState<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch images and explanations
  useEffect(() => {
    fetch('/api/apod/last7days')
      .then((res) => res.json())
      .then((data: ApodItem[]) => {
        const images = data
          .filter((item) => item.media_type === 'image')
          .map((item) => ({
            url: item.url,
            hdurl: item.hdurl,
            explanation: item.explanation || '',
          }));
        setApodImages(images);
      });
  }, []);

  // Unified transition, fade, and preload logic
  useEffect(() => {
    if (apodImages.length === 0 || paused) return;

    function nextSlide() {
      setFade(false);
      setTimeout(() => {
        // Preload the next image (use hdurl if available)
        const nextIndex = (current + 1) % apodImages.length;
        const img = new window.Image();
        img.src = apodImages[nextIndex].hdurl || apodImages[nextIndex].url;

        setCurrent(nextIndex);
        setFade(true);
      }, 1500); // Fade out duration
    }

    intervalRef.current = setInterval(nextSlide, 20000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [apodImages, current, paused]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // Load favorites from Firestore when user logs in
  useEffect(() => {
    if (!user) {
      setFavorites([]);
      return;
    }
    const fetchFavorites = async () => {
      const favRef = doc(db, "favorites", user.uid);
      const favSnap = await getDoc(favRef);
      if (favSnap.exists()) {
        setFavorites(favSnap.data().items || []);
      } else {
        setFavorites([]);
      }
    };
    fetchFavorites();
  }, [user]);

  // Update Firestore when favorites change
  const handleFavorite = async (img: ApodImage, idx: number, isFav: boolean) => {
    if (!user) return;
    const favRef = doc(db, "favorites", user.uid);
    if (isFav) {
      // Remove from favorites
      await updateDoc(favRef, {
        items: arrayRemove({ url: img.url, explanation: img.explanation, id: idx })
      });
      setFavorites(favorites.filter(fav => fav.url !== img.url));
    } else {
      // Add to favorites
      await setDoc(favRef, { items: arrayUnion({ url: img.url, explanation: img.explanation, id: idx }) }, { merge: true });
      setFavorites([...favorites, { url: img.url, explanation: img.explanation, id: idx }]);
    }
  };

  const isFavorite = apodImages[current] && favorites.some(fav => fav.url === (apodImages[current].url));

  const toggleFavorite = () => {
    if (!apodImages[current]) return;
    const currentUrl = apodImages[current].url;
    const currentExplanation = apodImages[current].explanation;
    const currentId = current;

    if (isFavorite) {
      setFavorites(favorites.filter(fav => fav.url !== currentUrl));
    } else {
      setFavorites([...favorites, { url: currentUrl, explanation: currentExplanation, id: currentId }]);
    }
  };

  return (
    <div
      className="App"
      style={{
        minHeight: '100vh',
        minWidth: '100vw',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundImage: apodImages.length
          ? `url(${apodImages[current].hdurl || apodImages[current].url})`
          : undefined,
        margin: 0,
        padding: 0,
        transition: 'background-image 0.5s ease-in-out',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <NavBar />

      {/* Overlay for readability */}
      <div className="apod-overlay" />

      {/* Explanation box with images */}
      <div
        className={`apod-explanation-box${(!showExplanation && !showThumbnails) ? ' buttons-only' : ''}`}
        style={{
          opacity: fade ? 1 : 0.7,
          boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
          minHeight: 0,
          padding: '0.3rem 0.7rem 0.3rem 0.7rem',
          pointerEvents: 'auto',
        }}
      >
        <div className="apod-explanation-header">
          {/* Show label when explanation is visible */}
          {showExplanation && (
            <span className="apod-explanation-label" style={{ marginRight: 'auto', fontWeight: 600, fontSize: '1.05rem', color: '#444', paddingLeft: '0.2rem' }}>
              Image Description
            </span>
          )}
          {showThumbnails && !showExplanation && (
            <span className="apod-explanation-label" style={{ marginRight: 'auto', fontWeight: 600, fontSize: '1.05rem', color: '#444', paddingLeft: '0.2rem' }}>
              Recent Gallery
            </span>
          )}
          <button
            onClick={() => {
              setShowExplanation(v => {
                if (!v) setShowThumbnails(false);
                return !v;
              });
            }}
            className="apod-header-btn apod-info-btn"
            title={showExplanation ? 'Hide Info' : 'Show Info'}
          >
            <span className="material-symbols-outlined">
              info
            </span>
          </button>
          <button
            onClick={() => {
              if (!showThumbnails) {
                setShowExplanation(false);
                setShowThumbnails(true);
              } else {
                setShowThumbnails(false);
                setShowExplanation(false);
              }
            }}
            className="apod-header-btn apod-thumb-btn"
            title={showThumbnails ? 'Hide Thumbnails' : 'Show Thumbnails'}
            style={{ marginLeft: '0.5rem' }}
          >
            <span className="material-symbols-outlined">
              photo_library
            </span>
          </button>
          <button
            onClick={() => setPaused((v) => !v)}
            className="apod-header-btn apod-pause-btn"
            title={paused ? 'Resume' : 'Pause'}
            style={{ marginLeft: '0.5rem' }}
          >
            <span className="material-symbols-outlined">
              {paused ? 'play_arrow' : 'pause'}
            </span>
          </button>
        </div>
        {/* Show explanation text if toggled */}
        <div
          className={`apod-explanation-text${showExplanation && apodImages[current]?.explanation ? '' : ' hide'}`}
          style={{ opacity: fade ? 1 : 0 }}
        >
          {showExplanation && apodImages[current]?.explanation}
        </div>
        {/* Show thumbnails if toggled, with animation */}
        <div className={`apod-image-list${showThumbnails ? '' : ' hide'}`}>
          {showThumbnails && apodImages.map((img, idx) => {
            const isFav = favorites.some(fav => fav.url === img.url);
            return (
              <div className="apod-thumb-container" key={img.url}>
                <img
                  src={img.url}
                  alt={`APOD ${idx + 1}`}
                  className={`apod-thumb${idx === current ? ' active' : ''}`}
                  onClick={() => setCurrent(idx)}
                />
                <button
                  className="apod-thumb-fav-btn"
                  title={isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                  onClick={e => {
                    e.stopPropagation();
                    handleFavorite(img, idx, isFav);
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ color: isFav ? '#ffd600' : '#fff', textShadow: '0 0 4px #000' }}
                  >
                    {isFav ? 'star' : 'star_border'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>


    </div>
  );
}

export default HomePage
