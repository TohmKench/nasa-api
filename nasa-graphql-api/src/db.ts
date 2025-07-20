import sqlite3 from 'sqlite3';
import { promisify } from 'util';

// Enable verbose mode for debugging
const sqlite = sqlite3.verbose();

export class Database {
    private db: sqlite3.Database;

    constructor(dbPath: string = './nasa_cache.db') {
        this.db = new sqlite(dbPath);
        this.initializeTables();
    }

    /**
     * Initialize database tables for caching NASA data
     */
    private async initializeTables(): Promise<void> {
        const runAsync = promisify(this.db.run.bind(this.db));

        try {
            // APOD cache table
            await runAsync(`
        CREATE TABLE IF NOT EXISTS apod_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          hdurl TEXT,
          explanation TEXT,
          media_type TEXT NOT NULL,
          service_version TEXT,
          copyright TEXT,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

            // NEO cache table
            await runAsync(`
        CREATE TABLE IF NOT EXISTS neo_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          neo_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          absolute_magnitude REAL,
          estimated_diameter_min REAL,
          estimated_diameter_max REAL,
          is_potentially_hazardous BOOLEAN,
          close_approach_date TEXT,
          miss_distance_km REAL,
          relative_velocity_kmh REAL,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

            console.log('Database tables initialized successfully');
        } catch (error) {
            console.error('Error initializing database tables:', error);
            throw error;
        }
    }

    /**
     * Get database instance for raw queries
     */
    getDb(): sqlite3.Database {
        return this.db;
    }

    /**
     * Close database connection
     */
    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

// Export singleton instance
export const database = new Database();