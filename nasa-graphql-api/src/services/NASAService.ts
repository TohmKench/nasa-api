import axios from 'axios';
import { RawAPODResponse, RawNEOResponse, APOD, NEO } from '../types';

export class NASAService {
    private apiKey: string;
    private baseUrl = 'https://api.nasa.gov';

    constructor() {
        this.apiKey = process.env.NASA_API_KEY || 'DEMO_KEY';
        if (this.apiKey === 'DEMO_KEY') {
            console.warn('Using NASA API demo key. Consider getting your own API key for production use.');
        }
    }

    /**
     * Fetch APOD data from NASA API
     */
    async fetchAPODs(startDate?: string, endDate?: string, count?: number): Promise<RawAPODResponse[]> {
        try {
            const params: any = { api_key: this.apiKey };

            if (count) {
                params.count = count;
            } else {
                if (startDate) params.start_date = startDate;
                if (endDate) params.end_date = endDate;
            }

            const response = await axios.get(`${this.baseUrl}/planetary/apod`, { params });

            // API returns single object for single date, array for date range
            const data = Array.isArray(response.data) ? response.data : [response.data];

            return data.filter((item: RawAPODResponse) => item.media_type === 'image');
        } catch (error) {
            console.error('Error fetching APOD data:', error);
            throw new Error('Failed to fetch APOD data from NASA API');
        }
    }

    /**
     * Fetch a single APOD for a specific date
     */
    async fetchAPOD(date: string): Promise<RawAPODResponse | null> {
        try {
            const response = await axios.get(`${this.baseUrl}/planetary/apod`, {
                params: { api_key: this.apiKey, date }
            });

            return response.data.media_type === 'image' ? response.data : null;
        } catch (error) {
            console.error('Error fetching APOD data for date:', date, error);
            return null;
        }
    }

    /**
     * Fetch NEO data from NASA API
     */
    async fetchNEOs(startDate: string, endDate: string): Promise<NEO[]> {
        try {
            // Validate date range (NASA API allows max 7 days)
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 7) {
                throw new Error('Date range cannot exceed 7 days for NEO queries');
            }

            const response = await axios.get(`${this.baseUrl}/neo/rest/v1/feed`, {
                params: {
                    start_date: startDate,
                    end_date: endDate,
                    api_key: this.apiKey
                }
            });

            const data: RawNEOResponse = response.data;
            const neos: NEO[] = [];

            // Transform NASA NEO data to our format
            Object.entries(data.near_earth_objects).forEach(([date, dateNeos]) => {
                dateNeos.forEach(neo => {
                    if (neo.close_approach_data.length > 0) {
                        const closeApproach = neo.close_approach_data[0];
                        neos.push({
                            id: neo.id,
                            name: neo.name,
                            absoluteMagnitude: neo.absolute_magnitude_h,
                            estimatedDiameter: {
                                min: neo.estimated_diameter.kilometers.estimated_diameter_min,
                                max: neo.estimated_diameter.kilometers.estimated_diameter_max
                            },
                            isPotentiallyHazardous: neo.is_potentially_hazardous_asteroid,
                            closeApproachDate: closeApproach.close_approach_date,
                            missDistance: {
                                kilometers: parseFloat(closeApproach.miss_distance.kilometers)
                            },
                            relativeVelocity: {
                                kmPerHour: parseFloat(closeApproach.relative_velocity.kilometers_per_hour)
                            }
                        });
                    }
                });
            });

            return neos;
        } catch (error) {
            console.error('Error fetching NEO data:', error);
            if (axios.isAxiosError(error) && error.response?.status === 400) {
                throw new Error('Invalid date range for NEO query');
            }
            throw new Error('Failed to fetch NEO data from NASA API');
        }
    }
}