import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, deleteDoc } from 'firebase/firestore';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Database structure:
// Collection: 'marsRovers'
//   Document: 'curiosity' (rover name)
//     - availableSols: [0, 1, 2, ...]
//     - availableCameras: ['FHAZ', 'RHAZ', 'MAST', ...]
//     - lastUpdated: timestamp
//     Subcollection: 'sols'
//       Document: '0' (sol number)
//         - photoCount: 10
//         - cameras: ['FHAZ', 'RHAZ']
//         - photos: [...] (if detailed photos needed)
//         - lastUpdated: timestamp

// Store rover metadata
const storeRoverMetadata = async (rover: string, availableSols: number[], availableCameras: string[]) => {
  try {
    const roverRef = doc(db, 'marsRovers', rover);
    await setDoc(roverRef, {
      availableSols,
      availableCameras,
      lastUpdated: new Date().toISOString()
    });
    console.log(`Stored metadata for rover: ${rover}`);
  } catch (error) {
    console.error(`Error storing metadata for rover ${rover}:`, error);
  }
};

// Store sol data
const storeSolData = async (rover: string, sol: number, data: any) => {
  try {
    const solRef = doc(db, 'marsRovers', rover, 'sols', sol.toString());
    await setDoc(solRef, {
      ...data,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Error storing sol data for rover ${rover}, sol ${sol}:`, error);
  }
};

// Get rover metadata
const getRoverMetadata = async (rover: string) => {
  try {
    const roverRef = doc(db, 'marsRovers', rover);
    const roverDoc = await getDoc(roverRef);
    if (roverDoc.exists()) {
      return roverDoc.data();
    }
    return null;
  } catch (error) {
    console.error(`Error getting metadata for rover ${rover}:`, error);
    return null;
  }
};

// Get sol data
const getSolData = async (rover: string, sol: number) => {
  try {
    const solRef = doc(db, 'marsRovers', rover, 'sols', sol.toString());
    const solDoc = await getDoc(solRef);
    if (solDoc.exists()) {
      return solDoc.data();
    }
    return null;
  } catch (error) {
    console.error(`Error getting sol data for rover ${rover}, sol ${sol}:`, error);
    return null;
  }
};

// Get all sols for a rover
const getAllSolsForRover = async (rover: string) => {
  try {
    const solsRef = collection(db, 'marsRovers', rover, 'sols');
    const solsSnapshot = await getDocs(solsRef);
    const sols: any[] = [];
    solsSnapshot.forEach((doc) => {
      sols.push({ id: doc.id, ...doc.data() });
    });
    return sols.sort((a, b) => parseInt(a.id) - parseInt(b.id));
  } catch (error) {
    console.error(`Error getting all sols for rover ${rover}:`, error);
    return [];
  }
};

// Populate database with Mars Rover data
const populateDatabase = async (rover: string) => {
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    throw new Error('NASA_API_KEY environment variable is required');
  }
  
  try {
    console.log(`Starting database population for rover: ${rover}`);
    
    // 1. Get manifest data
    const manifestUrl = `https://api.nasa.gov/mars-photos/api/v1/manifests/${rover}?api_key=${apiKey}`;
    const manifestResponse = await axios.get(manifestUrl);
    const manifest = manifestResponse.data.photo_manifest;
    
    // 2. Store rover metadata
    const availableSols = manifest.photos.map((p: any) => p.sol);
    const availableCameras = Array.from(new Set(manifest.photos.flatMap((p: any) => p.cameras))) as string[];
    
    await storeRoverMetadata(rover, availableSols, availableCameras);
    
    // 3. Store sol data (limit to first 100 sols to avoid rate limiting)
    const solsToProcess = availableSols.slice(0, 100);
    
    for (const sol of solsToProcess) {
      try {
        // Get photos for this sol
        const photosUrl = `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos?api_key=${apiKey}&sol=${sol}`;
        const photosResponse = await axios.get(photosUrl);
        const photos = photosResponse.data.photos;
        
        if (photos.length > 0) {
          // Group photos by camera
          const cameras = [...new Set(photos.map((p: any) => p.camera.name))];
          
          await storeSolData(rover, sol, {
            photoCount: photos.length,
            cameras,
            summary: {
              totalPhotos: photos.length,
              cameras: cameras.map(camera => ({
                name: camera,
                count: photos.filter((p: any) => p.camera.name === camera).length
              }))
            }
          });
        }
        
        // Small delay to be respectful to API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing sol ${sol}:`, error);
      }
    }
    
    console.log(`Database population completed for rover: ${rover}`);
    
  } catch (error) {
    console.error(`Error populating database for rover ${rover}:`, error);
  }
};

const getTodayString = () => new Date().toISOString().slice(0, 10);

const shouldUpdateRoverData = async (rover: string): Promise<boolean> => {
  const roverRef = doc(db, 'marsRovers', rover);
  const roverDoc = await getDoc(roverRef);
  if (roverDoc.exists()) {
    const lastChecked = roverDoc.data().lastChecked;
    if (lastChecked === getTodayString()) {
      return false; // Already checked today
    }
  }
  return true;
};

const setRoverLastChecked = async (rover: string) => {
  const roverRef = doc(db, 'marsRovers', rover);
  await setDoc(roverRef, { lastChecked: getTodayString() }, { merge: true });
};

const getLatestStoredSol = async (rover: string): Promise<number | null> => {
  const solsRef = collection(db, 'marsRovers', rover, 'sols');
  const q = query(solsRef, orderBy('sol', 'desc'), limit(1));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return snapshot.docs[0].data().sol;
  }
  return null;
};

const updateRoverData = async (rover: string) => {
  if (!(await shouldUpdateRoverData(rover))) {
    console.log(`[${rover}] Already checked today, skipping update.`);
    return;
  }
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    throw new Error('NASA_API_KEY environment variable is required');
  }
  
  // Retry logic with exponential backoff
  const makeRequestWithRetry = async (url: string, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(url);
        return response;
      } catch (error: any) {
        if (error.response?.status === 429 && attempt < maxRetries) {
          const retryAfter = parseInt(error.response.headers['retry-after']) || 60;
          const waitTime = retryAfter * 1000; // Convert to milliseconds
          console.log(`[${rover}] Rate limited, waiting ${retryAfter} seconds (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Failed after ${maxRetries} attempts`);
  };
  
  try {
    // 1. Get manifest data (all sols and their photo counts in one request)
    const manifestUrl = `https://api.nasa.gov/mars-photos/api/v1/manifests/${rover}?api_key=${apiKey}`;
    const response = await makeRequestWithRetry(manifestUrl);
    const manifest = response.data.photo_manifest;
    
    // 2. Get latest stored sol
    const latestStoredSol = await getLatestStoredSol(rover);
    
    // 3. Filter sols that have photos and deduplicate by sol number
    const solsWithPhotos = manifest.photos.filter((p: any) => p.total_photos > 0);
    
    // Deduplicate by sol number - combine all cameras for each sol
    const solMap = new Map();
    solsWithPhotos.forEach((photoInfo: any) => {
      const sol = photoInfo.sol;
      if (!solMap.has(sol)) {
        solMap.set(sol, {
          sol: sol,
          total_photos: photoInfo.total_photos,
          cameras: photoInfo.cameras || []
        });
      } else {
        // If sol already exists, add to total photos and merge cameras
        const existing = solMap.get(sol);
        existing.total_photos += photoInfo.total_photos;
        existing.cameras = [...new Set([...existing.cameras, ...(photoInfo.cameras || [])])];
      }
    });
    
    const deduplicatedSols = Array.from(solMap.values());
    const solsToStore = deduplicatedSols.filter((p: any) => 
      latestStoredSol === null || p.sol > latestStoredSol
    );
    
    console.log(`[${rover}] Found ${solsToStore.length} new sols with photos to store`);
    
    // 4. Clean up old data - remove sols that don't have photos
    const storedSols = await getAllSolsForRover(rover);
    const solsToDelete = storedSols.filter(storedSol => 
      !deduplicatedSols.some((photoInfo: any) => photoInfo.sol === storedSol.sol)
    );
    
    if (solsToDelete.length > 0) {
      console.log(`[${rover}] Cleaning up ${solsToDelete.length} sols without photos`);
      for (const solData of solsToDelete) {
        await deleteDoc(doc(db, 'marsRovers', rover, 'sols', solData.sol.toString()));
      }
      console.log(`[${rover}] Deleted ${solsToDelete.length} sols without photos`);
    }
    
    if (solsToStore.length > 0) {
      // 5. Store all sol data from manifest (no individual API calls needed)
      for (const photoInfo of solsToStore) {
        await setDoc(doc(db, 'marsRovers', rover, 'sols', photoInfo.sol.toString()), {
          sol: photoInfo.sol,
          photoCount: photoInfo.total_photos,
          cameras: photoInfo.cameras || [],
          summary: {
            totalPhotos: photoInfo.total_photos,
            cameras: photoInfo.cameras?.map((camera: string) => ({
              name: camera,
              count: photoInfo.total_photos // Approximate - we don't have exact counts per camera
            })) || []
          },
          lastUpdated: new Date().toISOString()
        });
      }
      
      console.log(`[${rover}] Stored ${solsToStore.length} sols with photos`);
    }
    
    // 6. Update rover metadata
    const allSols = deduplicatedSols.map((p: any) => p.sol);
    const allCameras = Array.from(new Set(deduplicatedSols.flatMap((p: any) => p.cameras || []))) as string[];
    
    await storeRoverMetadata(rover, allSols, allCameras);
    await setRoverLastChecked(rover);
    
    console.log(`[${rover}] Updated metadata: ${allSols.length} sols, ${allCameras.length} cameras`);
  } catch (err) {
    console.error(`Error updating rover data for ${rover}:`, err);
  }
};

// GraphQL resolvers using database
const createDatabaseResolvers = () => ({
  Query: {
    availableSols: async (_: any, { rover }: { rover: string }) => {
      // Get all sols and filter to only include those with photos
      const allSols = await getAllSolsForRover(rover);
      console.log(`[${rover}] availableSols - Total sols in database: ${allSols.length}`);
      
      const solsWithPhotos = allSols
        .filter((solData: any) => solData.photoCount > 0)
        .map((solData: any) => parseInt(solData.id));
      
      console.log(`[${rover}] availableSols - Sols with photos: ${solsWithPhotos.length}`);
      console.log(`[${rover}] availableSols - First 10 sols:`, solsWithPhotos.slice(0, 10));
      
      return solsWithPhotos;
    },
    
    availableCameras: async (_: any, { rover }: { rover: string }) => {
      const metadata = await getRoverMetadata(rover);
      return metadata?.availableCameras || [];
    },
    
    marsRoverPhotos: async (_: any, { rover, camera, solRange, summaryOnly }: any) => {
      // Helper function to fetch actual photos from NASA API
      const fetchPhotosForSol = async (sol: number, cameraFilter?: string) => {
        const apiKey = process.env.NASA_API_KEY;
        if (!apiKey) {
          throw new Error('NASA_API_KEY environment variable is required');
        }
        
        let url = `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos?api_key=${apiKey}&sol=${sol}`;
        if (cameraFilter) {
          // NASA API camera names are case-sensitive, don't convert to lowercase
          url += `&camera=${cameraFilter}`;
        }
        
        try {
          console.log(`[${rover}] Fetching photos for sol ${sol}${cameraFilter ? ` with camera ${cameraFilter}` : ''}`);
          const response = await axios.get(url);
          const photos = response.data.photos.map((photo: any) => ({
            id: photo.id,
            img_src: photo.img_src,
            earth_date: photo.earth_date,
            sol: photo.sol,
            camera: photo.camera.name,
            rover: photo.rover.name
          }));
          console.log(`[${rover}] Found ${photos.length} photos for sol ${sol}`);
          return photos;
        } catch (error) {
          console.error(`Error fetching photos for sol ${sol}:`, error);
          return [];
        }
      };

      if (solRange && solRange.length > 0) {
        // Get specific sols
        const results = [];
        for (const sol of solRange) {
          const solData = await getSolData(rover, sol);
          console.log(`[${rover}] Checking sol ${sol}:`, solData);
          
          if (solData && solData.photoCount > 0) { // Only include sols with photos
            if (camera) {
              // Check if this sol has photos for the specified camera
              const hasCameraPhotos = solData.cameras && solData.cameras.includes(camera);
              if (hasCameraPhotos) {
                const photos = summaryOnly ? [] : await fetchPhotosForSol(sol, camera);
                results.push({
                  sol: parseInt(sol),
                  photoCount: photos.length, // Use actual photo count
                  camera: camera,
                  photos: photos
                });
              }
            } else {
              const photos = summaryOnly ? [] : await fetchPhotosForSol(sol);
              results.push({
                sol: parseInt(sol),
                photoCount: photos.length, // Use actual photo count
                camera: solData.cameras?.[0] || null,
                photos: photos
              });
            }
          }
        }
        console.log(`[${rover}] Returning ${results.length} results for solRange:`, results);
        return results;
      } else {
        // Get all sols with photos only
        const allSols = await getAllSolsForRover(rover);
        console.log(`[${rover}] Total sols in database: ${allSols.length}`);
        
        const solsWithPhotos = allSols.filter((solData: any) => solData.photoCount > 0);
        console.log(`[${rover}] Sols with photos: ${solsWithPhotos.length}`);
        
        // Group by sol to avoid duplicates and aggregate photo counts
        const solMap = new Map();
        solsWithPhotos.forEach((solData: any) => {
          const sol = parseInt(solData.id);
          if (!solMap.has(sol)) {
            // Calculate total photo count across all cameras for this sol
            const totalPhotoCount = solData.photoCount || 0;
            solMap.set(sol, {
              sol: sol,
              photoCount: totalPhotoCount,
              camera: solData.cameras?.[0] || null, // Use first camera as representative
              photos: summaryOnly ? [] : []
            });
          } else {
            // If sol already exists, add to the photo count
            const existing = solMap.get(sol);
            existing.photoCount += (solData.photoCount || 0);
          }
        });
        
        const result = Array.from(solMap.values());
        console.log(`[${rover}] Final result count: ${result.length}`);
        console.log(`[${rover}] First 5 sols:`, result.slice(0, 5).map(r => ({ sol: r.sol, photoCount: r.photoCount })));
        
        return result;
      }
    }
  }
});

// Export functions for use in main GraphQL server
export {
  populateDatabase,
  getRoverMetadata,
  getSolData,
  getAllSolsForRover,
  createDatabaseResolvers,
  updateRoverData,
  shouldUpdateRoverData,
  setRoverLastChecked,
  getLatestStoredSol
};

// Example usage:
// populateDatabase('curiosity'); // Run this once to populate the database
// Then use createDatabaseResolvers() in your GraphQL server 