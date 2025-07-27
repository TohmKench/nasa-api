import { useEffect, useState, useRef } from 'react'
import NavBar from './NavBar';
import './nasaHomePage.css'
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebaseConfig";
import { useQuery, gql } from '@apollo/client';

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
  date: string;
  title: string;
  media_type?: string;
}

const db = getFirestore();

const GET_APOD_IMAGES = gql`
  query {
    apodImages {
      date
      title
      explanation
      url
      hdurl
      media_type
    }
  }
`;

const ApodGallery = () => {
  const { loading, error, data } = useQuery(GET_APOD_IMAGES);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      {data.apodImages.map((img: ApodImage) => (
        <img key={img.date} src={img.hdurl || img.url} alt={img.title} />
      ))}
    </div>
  );
};

// Utility to get/set local favorites
const LOCAL_FAV_KEY = 'apod_local_favorites';
const getLocalFavorites = (): { url: string; explanation: string; id: number }[] => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_FAV_KEY) || '[]');
  } catch {
    return [];
  }
};
const setLocalFavorites = (favs: { url: string; explanation: string; id: number }[]) => {
  localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(favs));
};

const HomePage = () => {
  const { loading, error, data } = useQuery(GET_APOD_IMAGES);
  const [current, setCurrent] = useState(0);
  const [fade, setFade] = useState(true);
  const [showExplanation, setShowExplanation] = useState(true);
  const [paused, setPaused] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [showThumbnailsDelayed, setShowThumbnailsDelayed] = useState(false);
  const [favorites, setFavorites] = useState<{ url: string; explanation: string; id: number }[]>(getLocalFavorites());
  const [user, setUser] = useState<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const apodImages: ApodImage[] = data?.apodImages || [];

  // On login, merge local favorites into Firestore and clear local cache
  useEffect(() => {
    if (user) {
      const mergeFavorites = async () => {
        const favRef = doc(db, "favorites", user.uid);
        const favSnap = await getDoc(favRef);
        const firestoreFavs = favSnap.exists() ? favSnap.data().items || [] : [];
        const localFavs = getLocalFavorites();
        // Merge, avoiding duplicates
        const merged = [...firestoreFavs];
        localFavs.forEach(localFav => {
          if (!merged.some((f: any) => f.url === localFav.url)) {
            merged.push(localFav);
          }
        });
        await setDoc(favRef, { items: merged }, { merge: true });
        setFavorites(merged);
        setLocalFavorites([]); // Clear local cache
      };
      mergeFavorites();
    } else {
      setFavorites(getLocalFavorites());
    }
  }, [user]);

  // Unified transition, fade, and preload logic (unchanged)
  useEffect(() => {
    if (apodImages.length === 0 || paused) return;
    function nextSlide() {
      setFade(false);
      setTimeout(() => {
        const nextIndex = (current + 1) % apodImages.length;
        const img = new window.Image();
        img.src = apodImages[nextIndex].hdurl || apodImages[nextIndex].url;
        setCurrent(nextIndex);
        setFade(true);
      }, 1500);
    }
    intervalRef.current = setInterval(nextSlide, 20000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [apodImages, current, paused]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  // Update Firestore/localStorage when favorites change
  const handleFavorite = async (img: ApodImage, idx: number, isFav: boolean) => {
    const favObj = { url: img.url, explanation: img.explanation, id: idx };
    try {
      if (!user) {
        // Local cache only
        let localFavs = getLocalFavorites();
        if (isFav) {
          localFavs = localFavs.filter(fav => fav.url !== img.url);
        } else {
          localFavs = [...localFavs, favObj];
        }
        setLocalFavorites(localFavs);
        setFavorites(localFavs);
        return;
      }
      // Firestore logic
      const favRef = doc(db, "favorites", user.uid);
      if (isFav) {
        await updateDoc(favRef, {
          items: arrayRemove(favObj)
        });
        setFavorites(favorites.filter(fav => fav.url !== img.url));
      } else {
        await setDoc(favRef, { items: arrayUnion(favObj) }, { merge: true });
        setFavorites([...favorites, favObj]);
      }
    } catch (err) {
      alert('Error updating favorites: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const isFavorite = apodImages[current] && favorites.some(fav => fav.url === (apodImages[current].url));

  const toggleFavorite = () => {
    if (!apodImages[current]) return;
    const currentUrl = apodImages[current].url;
    const currentExplanation = apodImages[current].explanation;
    const currentId = current;
    const favObj = { url: currentUrl, explanation: currentExplanation, id: currentId };
    if (isFavorite) {
      setFavorites(favorites.filter(fav => fav.url !== currentUrl));
      if (!user) {
        let localFavs = getLocalFavorites().filter(fav => fav.url !== currentUrl);
        setLocalFavorites(localFavs);
      }
    } else {
      setFavorites([...favorites, favObj]);
      if (!user) {
        let localFavs = [...getLocalFavorites(), favObj];
        setLocalFavorites(localFavs);
      }
    }
  };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

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
      <div className="apod-overlay" />
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
        <div
          className={`apod-explanation-text${showExplanation && apodImages[current]?.explanation ? '' : ' hide'}`}
          style={{ opacity: fade ? 1 : 0 }}
        >
          {showExplanation && apodImages[current]?.explanation}
        </div>
        <div className={`apod-image-list${showThumbnails ? '' : ' hide'}`}>
          {showThumbnails && apodImages.map((img: ApodImage, idx) => {
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
                    className={`material-symbols-outlined${isFav ? ' fav-star' : ''}`}
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
};

export default HomePage;
