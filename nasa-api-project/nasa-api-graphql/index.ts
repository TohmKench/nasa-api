import { ApolloServer, gql } from 'apollo-server';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { createDatabaseResolvers, updateRoverData } from './database-solution';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Cache duration constant
const CACHE_DURATION = 1000 * 60 * 60 * 6; // 6 hours

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

// Check if Firebase is properly configured
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_ACTUAL_API_KEY";

// Initialize Firebase only if configured
let app, db;
if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('Firebase configured and initialized');
} else {
  console.log('Firebase not configured - using direct API fallback mode');
}

// --- GraphQL Schema ---
const typeDefs = gql`
  type Photo {
    id: ID!
    img_src: String!
    earth_date: String!
    sol: Int!
    camera: String!
    rover: String!
  }

  type PhotoGroupBySol {
    sol: Int!
    photoCount: Int!
    camera: String
    photos: [Photo!]
  }

  type ApodImage {
    date: String!
    title: String!
    explanation: String!
    url: String!
    hdurl: String
    media_type: String!
  }

  type NeoObject {
    id: ID!
    name: String!
    approachDate: String!
    diameter: Float!
    isHazardous: Boolean!
    missDistanceKm: Float!
    velocityKps: Float!
  }

  type Query {
    marsRoverPhotos(
      rover: String
      camera: String
      solRange: [Int]
      earthDate: String
      summaryOnly: Boolean
    ): [PhotoGroupBySol!]!
    apodImages: [ApodImage!]!
    neoFeed(startDate: String, endDate: String): [NeoObject!]!
    availableSols(rover: String!): [Int!]!
    availableCameras(rover: String!): [String!]!
  }
`;

// In-memory cache for APOD data
let apodCache: { data: any[] | null; timestamp: number } = { data: null, timestamp: 0 };

// In-memory cache for Mars Rover data (fallback when Firebase not available)
let marsRoverPhotosCache: { [key: string]: { data: any; timestamp: number } } = {};
let availableSolsCache: { [rover: string]: { data: number[]; timestamp: number } } = {};
let availableCamerasCache: { [rover: string]: { data: string[]; timestamp: number } } = {};

const spaceImageKeywords = [
  'nebula', 'galaxy', 'cluster', 'moon', 'sun', 'planet', 'star', 'comet', 'asteroid', 'aurora'
];

const apodImagesResolver = async () => {
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    throw new Error('NASA_API_KEY environment variable is required');
  } 
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // Serve from cache if not expired
  if (apodCache.data && Date.now() - apodCache.timestamp < CACHE_DURATION) {
    return apodCache.data;
  }

  const response = await axios.get('https://api.nasa.gov/planetary/apod', {
    params: {
      api_key: apiKey,
      start_date: startStr,
      end_date: endStr,
    },
  });

  const rawData = response.data;
  const imagesOnly = rawData.filter((item: any) => item.media_type === 'image' && item.hdurl);

  const spacePhotos = imagesOnly.filter((item: any) =>
    spaceImageKeywords.some(keyword =>
      item.title?.toLowerCase().includes(keyword) ||
      item.explanation?.toLowerCase().includes(keyword)
    )
  );

  apodCache = {
    data: spacePhotos,
    timestamp: Date.now(),
  };

  return spacePhotos;
};

const neoFeedResolver = async (_: any, { startDate, endDate }: { startDate?: string, endDate?: string }) => {
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    throw new Error('NASA_API_KEY environment variable is required');
  }
  const today = new Date();
  const start = startDate || today.toISOString().split('T')[0];
  const end = endDate || new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${start}&end_date=${end}&api_key=${apiKey}`;
  const response = await axios.get(url);
  const neoData = response.data.near_earth_objects;
  // Flatten and map to NeoObject
  const result: any[] = [];
  Object.keys(neoData).forEach(date => {
    neoData[date].forEach((neo: any) => {
      const approach = neo.close_approach_data[0];
      result.push({
        id: neo.id,
        name: neo.name,
        approachDate: approach.close_approach_date,
        diameter: neo.estimated_diameter.kilometers.estimated_diameter_max,
        isHazardous: neo.is_potentially_hazardous_asteroid,
        missDistanceKm: parseFloat(approach.miss_distance.kilometers),
        velocityKps: parseFloat(approach.relative_velocity.kilometers_per_second),
      });
    });
  });
  return result;
};

// Fallback Mars Rover resolvers (when Firebase not available)
const fallbackMarsRoverPhotosResolver = async (_: any, args: any) => {
  try {
    const { rover = 'curiosity', camera, solRange, summaryOnly } = args;
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) {
      throw new Error('NASA_API_KEY environment variable is required');
    }
    
    // Build cache key
    const cacheKey = JSON.stringify({ rover, camera, solRange, summaryOnly });
    if (marsRoverPhotosCache[cacheKey] && Date.now() - marsRoverPhotosCache[cacheKey].timestamp < CACHE_DURATION) {
      return marsRoverPhotosCache[cacheKey].data;
    }

    if (summaryOnly && !solRange) {
      // Get manifest for summary data
      const manifestUrl = `https://api.nasa.gov/mars-photos/api/v1/manifests/${rover}?api_key=${apiKey}`;
      const manifestResponse = await axios.get(manifestUrl);
      const manifestSols = manifestResponse.data.photo_manifest.photos
        .filter((p: any) => p.total_photos > 0)
        .map((p: any) => p.sol);
      
      const summaryResults = manifestSols.map((sol: number) => {
        const photoInfo = manifestResponse.data.photo_manifest.photos.find((p: any) => p.sol === sol);
        return {
          sol,
          photoCount: photoInfo.total_photos,
          camera: photoInfo.cameras?.[0] || null,
          photos: []
        };
      });
      
      marsRoverPhotosCache[cacheKey] = { data: summaryResults, timestamp: Date.now() };
      return summaryResults;
    }
    
    // For specific sols or detailed data
    if (solRange && solRange.length > 0) {
      const results = [];
      for (const sol of solRange) {
        try {
          let url = `https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos?api_key=${apiKey}&sol=${sol}`;
          if (camera) url += `&camera=${camera}`;
          const response = await axios.get(url);
          const photos = response.data.photos.map((photo: any) => ({
            id: photo.id,
            img_src: photo.img_src,
            earth_date: photo.earth_date,
            sol: photo.sol,
            camera: photo.camera.name,
            rover: photo.rover.name,
          }));
          
          if (summaryOnly) {
            results.push({ sol, photoCount: photos.length, camera: photos[0]?.camera || null, photos: [] });
          } else {
            results.push({ sol, photoCount: photos.length, camera: photos[0]?.camera || null, photos });
          }
          
          await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
        } catch (err) {
          results.push({ sol, photoCount: 0, camera: null, photos: [] });
        }
      }
      
      marsRoverPhotosCache[cacheKey] = { data: results, timestamp: Date.now() };
      return results;
    }
    
    return [];
  } catch (e) {
    console.error('Fallback marsRoverPhotosResolver error:', e);
    return [];
  }
};

const fallbackAvailableSolsResolver = async (_: any, { rover }: { rover: string }) => {
  try {
    if (availableSolsCache[rover] && Date.now() - availableSolsCache[rover].timestamp < CACHE_DURATION) {
      return availableSolsCache[rover].data;
    }
    
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) {
      throw new Error('NASA_API_KEY environment variable is required');
    }
    const url = `https://api.nasa.gov/mars-photos/api/v1/manifests/${rover}?api_key=${apiKey}`;
    const response = await axios.get(url);
    // Only return sols that have photos
    const sols = response.data.photo_manifest.photos
      .filter((p: any) => p.total_photos > 0)
      .map((p: any) => p.sol);
    
    availableSolsCache[rover] = { data: sols, timestamp: Date.now() };
    return sols;
  } catch (e) {
    console.error('Fallback availableSolsResolver error:', e);
    return [];
  }
};

const fallbackAvailableCamerasResolver = async (_: any, { rover }: { rover: string }) => {
  try {
    if (availableCamerasCache[rover] && Date.now() - availableCamerasCache[rover].timestamp < CACHE_DURATION) {
      return availableCamerasCache[rover].data;
    }
    
    const apiKey = process.env.NASA_API_KEY;
    if (!apiKey) {
      throw new Error('NASA_API_KEY environment variable is required');
    }
    const url = `https://api.nasa.gov/mars-photos/api/v1/manifests/${rover}?api_key=${apiKey}`;
    const response = await axios.get(url);
    const cameras = Array.from(new Set(response.data.photo_manifest.photos.flatMap((p: any) => p.cameras))) as string[];
    
    availableCamerasCache[rover] = { data: cameras, timestamp: Date.now() };
    return cameras;
  } catch (e) {
    console.error('Fallback availableCamerasResolver error:', e);
    return [];
  }
};

// Get database-driven resolvers or fallback
let databaseResolvers;
if (isFirebaseConfigured) {
  try {
    databaseResolvers = createDatabaseResolvers();
    console.log('Using database-driven resolvers');
  } catch (error) {
    console.log('  Database resolvers failed, using fallback mode');
    databaseResolvers = null;
  }
} else {
  databaseResolvers = null;
}

// Background update function
const triggerBackgroundUpdates = async () => {
  if (!isFirebaseConfigured) {
    console.log('  Skipping background updates - Firebase not configured');
    return;
  }
  
  const rovers = ['curiosity', 'perseverance', 'opportunity', 'spirit'];
  console.log('Starting background updates for all rovers...');
  
  // Process rovers sequentially with delays to avoid rate limiting
  for (const rover of rovers) {
    try {
      console.log(`Processing rover: ${rover}`);
      await updateRoverData(rover);
      
      // Wait 5 seconds between rovers to respect rate limits
      if (rover !== rovers[rovers.length - 1]) {
        console.log(` Waiting 5 seconds before next rover...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (error) {
      console.error(`Background update failed for ${rover}:`, error);
    }
  }
  
  console.log('Background updates completed');
};

// Combined resolvers
const resolvers = {
  Query: {
    marsRoverPhotos: databaseResolvers?.Query?.marsRoverPhotos || fallbackMarsRoverPhotosResolver,
    availableSols: databaseResolvers?.Query?.availableSols || fallbackAvailableSolsResolver,
    availableCameras: databaseResolvers?.Query?.availableCameras || fallbackAvailableCamerasResolver,
    apodImages: apodImagesResolver,
    neoFeed: neoFeedResolver,
  },
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(` Server ready at ${url}`);
  if (isFirebaseConfigured) {
    console.log('Triggering background data updates in 10 seconds...');
    setTimeout(() => {
      triggerBackgroundUpdates().catch(err => {
        console.error('Background updates failed:', err);
      });
    }, 10000); // Wait 10 seconds before starting updates
  } else {
    console.log('To enable database features, configure Firebase in index.ts and database-solution.ts');
  }
}); 