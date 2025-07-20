/**
 * NASA APOD (Astronomy Picture of the Day) Types
 */
export interface APOD {
    date: string;
    title: string;
    url: string;
    hdurl?: string;
    explanation: string;
    media_type: 'image' | 'video';
    service_version?: string;
    copyright?: string;
}

/**
 * NASA NEO (Near Earth Object) Types
 */
export interface NEO {
    id: string;
    name: string;
    absoluteMagnitude?: number;
    estimatedDiameter: {
        min: number;
        max: number;
    };
    isPotentiallyHazardous: boolean;
    closeApproachDate: string;
    missDistance: {
        kilometers: number;
    };
    relativeVelocity: {
        kmPerHour: number;
    };
}

/**
 * Raw NASA API Response Types
 */
export interface RawAPODResponse {
    date: string;
    title: string;
    url: string;
    hdurl?: string;
    explanation: string;
    media_type: string;
    service_version?: string;
    copyright?: string;
}

export interface RawNEOResponse {
    links: any;
    element_count: number;
    near_earth_objects: {
        [date: string]: RawNEOObject[];
    };
}

export interface RawNEOObject {
    id: string;
    neo_reference_id: string;
    name: string;
    absolute_magnitude_h?: number;
    estimated_diameter: {
        kilometers: {
            estimated_diameter_min: number;
            estimated_diameter_max: number;
        };
    };
    is_potentially_hazardous_asteroid: boolean;
    close_approach_data: Array<{
        close_approach_date: string;
        miss_distance: {
            kilometers: string;
        };
        relative_velocity: {
            kilometers_per_hour: string;
        };
    }>;
}

/**
 * GraphQL Query Arguments
 */
export interface APODQueryArgs {
    startDate?: string;
    endDate?: string;
    count?: number;
}

export interface NEOQueryArgs {
    startDate: string;
    endDate: string;
}

/**
 * Database Cache Types
 */
export interface CachedAPOD {
    id: number;
    date: string;
    title: string;
    url: string;
    hdurl?: string;
    explanation: string;
    media_type: string;
    service_version?: string;
    copyright?: string;
    cached_at: string;
}

export interface CachedNEO {
    id: number;
    neo_id: string;
    name: string;
    absolute_magnitude?: number;
    estimated_diameter_min: number;
    estimated_diameter_max: number;
    is_potentially_hazardous: boolean;
    close_approach_date: string;
    miss_distance_km: number;
    relative_velocity_kmh: number;
    cached_at: string;
}