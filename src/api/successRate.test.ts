import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchSubjectSuccessRates, saveSuccessRates, getStoredSuccessRates } from './successRate';

// Mock dependencies
const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock('../services/storage', () => ({
    STORAGE_KEYS: {
        SUCCESS_RATES_DATA: 'reis_success_rates',
        GLOBAL_STATS_LAST_SYNC: 'reis_global_stats_sync'
    },
    StorageService: {
        get: (...args: any[]) => mockGet(...args),
        set: (...args: any[]) => mockSet(...args)
    }
}));

// Mock global fetch
const globalFetch = vi.fn();
global.fetch = globalFetch;

describe('fetchSubjectSuccessRates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default storage mocks
        mockGet.mockReturnValue(null); 
    });

    it('should fetch data for a new subject from GitHub', async () => {
        // Mock successful fetch
        globalFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ subject: 'TEST', stats: [] })
        });

        const result = await fetchSubjectSuccessRates(['TEST']);

        // Check if fetch was called with correct URL
        expect(globalFetch).toHaveBeenCalledWith(
            'https://raw.githubusercontent.com/darksoothingshadow/reis-data/main/subjects/TEST.json'
        );

        // Check result structure
        expect(result.data['TEST']).toBeDefined();
        expect(result.data['TEST'].subject).toBe('TEST');
    });

    it('should handle 404 gracefully (subject not found)', async () => {
        // Mock 404 response
        globalFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        const result = await fetchSubjectSuccessRates(['UNKNOWN']);

        // Fetch called
        expect(globalFetch).toHaveBeenCalledTimes(1);
        
        // But result should be empty for this key (or existing cache returned)
        expect(result.data['UNKNOWN']).toBeUndefined();
    });

    it('should skip fetching if cache is valid', async () => {
    
        // Mock existing data
        const mockData = { 
            data: { 
                'CACHED': { subject: 'CACHED', stats: [{ sourceUrl: 'http://valid' }] } 
            } 
        };
        // Mock get returning data AND valid sync time
        mockGet.mockImplementation((key) => {
            if (key === 'reis_success_rates') return mockData;
            if (key === 'reis_global_stats_sync') return { 'CACHED': Date.now() };
            return null;
        });

        await fetchSubjectSuccessRates(['CACHED']);

        // Should NOT fetch
        expect(globalFetch).not.toHaveBeenCalled();
    });

    it('should force re-fetch if cached data is legacy (missing sourceUrl)', async () => {
        // Mock legacy data
        const mockLegacyData = { 
            data: { 
                'LEGACY': { 
                    subject: 'LEGACY', 
                    stats: [{ sourceUrl: undefined }] // Missing URL
                } 
            } 
        };
        
        mockGet.mockImplementation((key) => {
            if (key === 'reis_success_rates') return mockLegacyData;
            if (key === 'reis_global_stats_sync') return { 'LEGACY': Date.now() }; // Fresh but legacy
            return null;
        });

        // Mock successful re-fetch
        globalFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ subject: 'LEGACY', stats: [{ sourceUrl: 'http://new' }] })
        });

        await fetchSubjectSuccessRates(['LEGACY']);

        // Should fetch despite valid timestamp
        expect(globalFetch).toHaveBeenCalledTimes(1);
    });
});
