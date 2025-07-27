# NASA Space Explorer

A full-stack React + GraphQL app for exploring NASA data: APOD, Mars Rover photos, Asteroid Watch, and more.

## App Pages Overview
- **APOD**: View NASA's Astronomy Picture of the Day, read explanations, and save favorites.
- **Mars Rover**: Explore Mars rover photos by sol, camera, and timeline with interactive charts.
- **Asteroid Watch**: Visualize near-Earth asteroids for any week in a radial orbit layout.
- **My Favourites**: See and manage your saved APOD images.
- **Login**: Sign in with email/password or Google to sync favorites.

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/TohmKench/nasa-graphql-api.git
   cd nasa-graphql-api
   ```

2. **Install dependencies**
   - For the backend (GraphQL server):
     ```bash
     cd nasa-api-project/nasa-api-graphql
     npm install
     ```
   - For the frontend (React app):
     ```bash
     cd ../../nasa-api-project
     npm install
     ```

3. **Set up environment variables**
   - See the next section for .env examples for both backend and frontend.

4. **Start the backend (GraphQL server)**
   ```bash
   cd nasa-api-project/nasa-api-graphql
   npm start
   # or
   npm run dev
   ```
   - Runs on [http://localhost:4000](http://localhost:4000)

5. **Start the frontend (React app)**
   ```bash
   cd ../../nasa-api-project
   npm run dev
   ```
   - Runs on [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal)

## Environment Variables

> **Note:** The required `.env` files are not included in this public repository for security reasons. If you need them to run the project, please contact me (e.g., by email) and I will provide the necessary `.env` files for both backend and frontend.

### Backend (`nasa-api-project/nasa-api-graphql/.env`)
```env
NASA_API_KEY=your_nasa_api_key_here  # Get one at https://api.nasa.gov/

# For Firebase authentication (see src/firebaseConfig.ts for details) (Used to update the database)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

### Frontend (`nasa-api-project/.env`)
```env
# For Firebase authentication (see src/firebaseConfig.ts for details)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```
- The NASA API key is required for backend data fetching. Firebase keys are needed for authentication and favorites sync if you use those features.

## Data Connect SDK (Pre-Configured)

This project includes a pre-generated Firebase Data Connect SDK in `nasa-api-project/dataconnect-generated/`. It is already set up to work with the included Firebase project configuration—**you do not need to generate or configure your own Data Connect instance to run or test this app**.

If you want to use your own Firebase project, you can update the environment variables in `nasa-api-project/.env` and `src/firebaseConfig.ts` with your own public Firebase config values. For most reviewers, the included setup will work out-of-the-box.

## Features
- GraphQL API (Apollo Server v4, TypeScript)
- Modern React frontend (Vite + React + TS)
- Firebase authentication and favorites sync
- NASA APOD and NEO data
- Interactive data visualizations (charts, radial layouts)
- Responsive, space-themed UI

## Support & Contributing
- For help, [open an issue](https://github.com/TohmKench/nasa-graphql-api/issues).
