import { APODQueryArgs, NEOQueryArgs, APOD, NEO } from '../types';
import { NASAService } from '../services/NASAService';
import { APODModel } from '../models/APODModel';
import { NEOModel } from '../models/NEOModel';

const nasaService = new NASAService();
const apodModel = new APODModel();
const neoModel = new NEOModel();

export const resolvers = {
    Query: {
        /**
         * Get APOD data for a date range
         */
        getAPODs: async (
            _: any,
            { startDate, endDate, count }: APODQueryArgs
        ): Promise<APOD[]> => {
            try {
                // If no parameters provided, get today's APOD
                if (!startDate && !endDate && !count) {
                    const today = new Date().toISOString().split('T')[0];
                    return resolvers.Query.getAPODs(_, { startDate: today, endDate: today });
                }

                // Check cache first for date range queries
                if (startDate && endDate && !count) {
                    const cachedData = await apodModel.getCachedAPODs(startDate, endDate);

                    // Check if we have fresh data for the entire range
                    const dates = getDateRange(startDate, endDate);
                    const cachedDates = cachedData.map(apod => apod.date);
                    const allDatesCached = dates.every(date => cachedDates.includes(date));

                    if (allDatesCached && cachedData.length > 0) {
                        // Check if any cached data is stale
                        const freshDataChecks = await Promise.all(
                            dates.map(date => apodModel.isCacheFresh(date))
                        );

                        if (freshDataChecks.every(Boolean)) {
                            console.log('Serving APOD data from cache');
                            return cachedData;
                        }
                    }
                }

                // Fetch fresh data from NASA API
                console.log('Fetching fresh APOD data from NASA API');
                const apods = await nasaService.fetchAPODs(startDate, endDate, count);

                // Cache the results
                if (apods.length > 0) {
                    await Promise.all(apods.map(apod => apodModel.cacheAPOD(apod)));
                }

                return apods.map(transformRawAPOD);
            } catch (error) {
                console.error('Error in getAPODs resolver:', error);
                throw new Error(`Failed to fetch APOD data: ${error.message}`);
            }
        },

        /**
         * Get a single APOD for a specific date
         */
        getAPOD: async (_: any, { date }: { date: string }): Promise<APOD | null> => {
            try {
                // Validate date format
                if (!isValidDate(date)) {
                    throw new Error('Invalid date format. Use YYYY-MM-DD');
                }

                // Check cache first
                const cached = await apodModel.getCachedAPOD(date);
                if (cached && await apodModel.isCacheFresh(date)) {
                    console.log(`Serving APOD for ${date} from cache`);
                    return cached;
                }

                // Fetch from NASA API
                console.log(`Fetching APOD for ${date} from NASA API`);
                const apod = await nasaService.fetchAPOD(date);

                if (!apod) {
                    return null;
                }

                // Cache the result
                await apodModel.cacheAPOD(apod);

                return transformRawAPOD(apod);
            } catch (error) {
                console.error('Error in getAPOD resolver:', error);
                throw new Error(`Failed to fetch APOD for ${date}: ${error.message}`);
            }
        },

        /**
         * Get NEO data for a date range
         */
        getNEOs: async (_: any, { startDate, endDate }: NEOQueryArgs): Promise<NEO[]> => {
            try {
                // Validate date formats
                if (!isValidDate(startDate) || !isValidDate(endDate)) {
                    throw new Error('Invalid date format. Use YYYY-MM-DD');
                }

                // Validate date range
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (start > end) {
                    throw new Error('Start date must be before or equal to end date');
                }

                // Check cache first
                if (await neoModel.isCacheFresh(startDate, endDate)) {
                    console.log('Serving NEO data from cache');
                    const cached = await neoModel.getCachedNEOs(startDate, endDate);
                    if (cached.length > 0) {
                        return cached;
                    }
                }

                // Fetch fresh data from NASA API
                console.log('Fetching fresh NEO data from NASA API');
                const neos = await nasaService.fetchNEOs(startDate, endDate);

                // Cache the results
                if (neos.length > 0) {
                    await Promise.all(
                        neos.map(neo => {
                            // We need to transform back to raw format for caching
                            const rawNeo = {
                                id: neo.id,
                                neo_reference_id: neo.id,
                                name: neo.name,
                                absolute_magnitude_h: neo.absoluteMagnitude,
                                estimated_diameter: {
                                    kilometers: {
                                        estimated_diameter_min: neo.estimatedDiameter.min,
                                        estimated_diameter_max: neo.estimatedDiameter.max
                                    }
                                },
                                is_potentially_hazardous_asteroid: neo.isPotentiallyHazardous,
                                close_approach_data: [{
                                    close_approach_date: neo.closeApproachDate,
                                    miss_distance: {
                                        kilometers: neo.missDistance.kilometers.toString()
                                    },
                                    relative_velocity: {
                                        kilometers_per_hour: neo.relativeVelocity.kmPerHour.toString()
                                    }
                                }]
                            };
                            return neoModel.cacheNEO(rawNeo, neo.closeApproachDate);
                        })
                    );
                }

                return neos;
            } catch (error) {
                console.error('Error in getNEOs resolver:', error);
                throw new Error(`Failed to fetch NEO data: ${error.message}`);
            }
        },

        /**
         * Health check endpoint
         */
        health: (): string => {
            return 'NASA GraphQL API is running!';
        }
    }
};

/**
 * Transform raw APOD data to GraphQL format
 */
function transformRawAPOD(raw: any): APOD {
    return {
        date: raw.date,
        title: raw.title,
        url: raw.url,
        hdurl: raw.hdurl,
        explanation: raw.explanation,
        media_type: raw.media_type, // Keep this as media_type to match your APOD interface
        service_version: raw.service_version,
        copyright: raw.copyright
    };
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function isValidDate(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Get array of dates between start and end date
 */
function getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}