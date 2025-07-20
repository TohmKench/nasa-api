import { database } from '../db';
import { APOD, CachedAPOD, RawAPODResponse } from '../types';
import { promisify } from 'util';

export class APODModel {
    private db = database.getDb();

    /**
     * Cache APOD data in SQLite
     */
    async cacheAPOD(apod: RawAPODResponse): Promise<void> {
        const runAsync = promisify(this.db.run.bind(this.db));

        const query = `
      INSERT OR REPLACE INTO apod_cache 
      (date, title, url, hdurl, explanation, media_type, service_version, copyright)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

        try {
            await runAsync(query, [
                apod.date,
                apod.title,
                apod.url,
                apod.hdurl || null,
                apod.explanation,
                apod.media_type,
                apod.service_version || null,
                apod.copyright || null
            ]);
        } catch (error) {
            console.error('Error caching APOD:', error);
            throw error;
        }
    }

    /**
     * Get cached APOD data from SQLite
     */
    async getCachedAPODs(startDate?: string, endDate?: string): Promise<APOD[]> {
        const allAsync = promisify(this.db.all.bind(this.db));

        let query = 'SELECT * FROM apod_cache';
        const params: string[] = [];

        if (startDate && endDate) {
            query += ' WHERE date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        } else if (startDate) {
            query += ' WHERE date >= ?';
            params.push(startDate);
        } else if (endDate) {
            query += ' WHERE date <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY date DESC';

        try {
            const rows = await allAsync(query, params) as CachedAPOD[];
            return rows.map(this.transformCachedAPOD);
        } catch (error) {
            console.error('Error getting cached APODs:', error);
            return [];
        }
    }

    /**
     * Get a single cached APOD by date
     */
    async getCachedAPOD(date: string): Promise<APOD | null> {
        const getAsync = promisify(this.db.get.bind(this.db));

        try {
            const row = await getAsync(
                'SELECT * FROM apod_cache WHERE date = ?',
                [date]
            ) as CachedAPOD | undefined;

            return row ? this.transformCachedAPOD(row) : null;
        } catch (error) {
            console.error('Error getting cached APOD:', error);
            return null;
        }
    }

    /**
     * Check if APOD data is fresh (cached within the last 6 hours)
     */
    async isCacheFresh(date: string): Promise<boolean> {
        const getAsync = promisify(this.db.get.bind(this.db));
        const cacheHours = parseInt(process.env.CACHE_DURATION_HOURS || '6');

        try {
            const row = await getAsync(
                `SELECT cached_at FROM apod_cache 
         WHERE date = ? 
         AND datetime(cached_at, '+${cacheHours} hours') > datetime('now')`,
                [date]
            );

            return !!row;
        } catch (error) {
            console.error('Error checking cache freshness:', error);
            return false;
        }
    }

    /**
     * Transform cached APOD data to GraphQL format
     */
    private transformCachedAPOD(cached: CachedAPOD): APOD {
        return {
            date: cached.date,
            title: cached.title,
            url: cached.url,
            hdurl: cached.hdurl || undefined,
            explanation: cached.explanation,
            media_type: cached.media_type as 'image' | 'video',
            service_version: cached.service_version || undefined,
            copyright: cached.copyright || undefined
        };
    }
}