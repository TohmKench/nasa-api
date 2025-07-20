import { database } from '../db';
import { NEO, CachedNEO, RawNEOObject } from '../types';
import { promisify } from 'util';

export class NEOModel {
    private db = database.getDb();

    /**
     * Cache NEO data in SQLite
     */
    async cacheNEO(neo: RawNEOObject, closeApproachDate: string): Promise<void> {
        const runAsync = promisify(this.db.run.bind(this.db));

        const query = `
      INSERT OR REPLACE INTO neo_cache 
      (neo_id, name, absolute_magnitude, estimated_diameter_min, estimated_diameter_max,
       is_potentially_hazardous, close_approach_date, miss_distance_km, relative_velocity_kmh)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

        const closeApproach = neo.close_approach_data[0];

        try {
            await runAsync(query, [
                neo.id,
                neo.name,
                neo.absolute_magnitude_h || null,
                neo.estimated_diameter.kilometers.estimated_diameter_min,
                neo.estimated_diameter.kilometers.estimated_diameter_max,
                neo.is_potentially_hazardous_asteroid,
                closeApproachDate,
                parseFloat(closeApproach.miss_distance.kilometers),
                parseFloat(closeApproach.relative_velocity.kilometers_per_hour)
            ]);
        } catch (error) {
            console.error('Error caching NEO:', error);
            throw error;
        }
    }

    /**
     * Get cached NEO data from SQLite
     */
    async getCachedNEOs(startDate: string, endDate: string): Promise<NEO[]> {
        const allAsync = promisify(this.db.all.bind(this.db));

        const query = `
      SELECT * FROM neo_cache 
      WHERE close_approach_date BETWEEN ? AND ?
      ORDER BY close_approach_date ASC
    `;

        try {
            const rows = await allAsync(query, [startDate, endDate]) as CachedNEO[];
            return rows.map(this.transformCachedNEO);
        } catch (error) {
            console.error('Error getting cached NEOs:', error);
            return [];
        }
    }

    /**
     * Check if NEO data is fresh for a date range
     */
    async isCacheFresh(startDate: string, endDate: string): Promise<boolean> {
        const getAsync = promisify(this.db.get.bind(this.db));
        const cacheHours = parseInt(process.env.CACHE_DURATION_HOURS || '6');

        try {
            const row = await getAsync(
                `SELECT COUNT(*) as count FROM neo_cache 
         WHERE close_approach_date BETWEEN ? AND ?
         AND datetime(cached_at, '+${cacheHours} hours') > datetime('now')`,
                [startDate, endDate]
            );

            return (row as any)?.count > 0;
        } catch (error) {
            console.error('Error checking NEO cache freshness:', error);
            return false;
        }
    }

    /**
     * Transform cached NEO data to GraphQL format
     */
    private transformCachedNEO(cached: CachedNEO): NEO {
        return {
            id: cached.neo_id,
            name: cached.name,
            absoluteMagnitude: cached.absolute_magnitude || undefined,
            estimatedDiameter: {
                min: cached.estimated_diameter_min,
                max: cached.estimated_diameter_max
            },
            isPotentiallyHazardous: cached.is_potentially_hazardous,
            closeApproachDate: cached.close_approach_date,
            missDistance: {
                kilometers: cached.miss_distance_km
            },
            relativeVelocity: {
                kmPerHour: cached.relative_velocity_kmh
            }
        };
    }
}