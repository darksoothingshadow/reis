/**
 * Success Rates API
 * 
 * GET /api/success-rates?codes=EBC-ALG,EBC-MAT
 * Returns filtered success rate data for requested course codes
 */

import { Request, Response, Router } from 'express';
import * as db from '../../db/index.js';
import { SubjectSuccessRate } from '../types.js';

const router = Router();

/**
 * GET /api/success-rates?codes=EBC-ALG,EBC-MAT
 */
router.get('/', (req: Request, res: Response) => {
    const codesParam = req.query.codes as string;
    
    if (!codesParam) {
        return res.status(400).json({ 
            error: 'Missing required parameter: codes',
            example: '/api/success-rates?codes=EBC-ALG,EBC-MAT'
        });
    }
    
    const codes = codesParam.split(',').map(c => c.trim().toUpperCase());
    
    // Filter to requested codes
    const result: Record<string, SubjectSuccessRate> = {};
    let latestUpdate = '';

    for (const code of codes) {
        const data = db.getSuccessRatesByCourse(code);
        if (data) {
            result[code] = data;
            if (!latestUpdate || data.lastUpdated > latestUpdate) {
                latestUpdate = data.lastUpdated;
            }
        }
    }
    
    res.json({
        lastUpdated: latestUpdate || new Date().toISOString(),
        data: result
    });
});

export default router;
