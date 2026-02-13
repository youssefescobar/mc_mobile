export interface Pilgrim {
    _id: string;
    full_name: string;
    national_id: string;
    phone_number: string;
    location?: {
        lat: number;
        lng: number;
    };
    last_updated?: string;
    battery_percent?: number;
    email?: string;
}

export interface Group {
    _id: string;
    group_name: string;
    group_code?: string;
    pilgrims: Pilgrim[];
    created_at: string;
    allow_pilgrim_navigation?: boolean;
}

export interface GroupResponse {
    success: boolean;
    data: Group[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
