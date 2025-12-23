/**
 * reIS Server - Express Entry Point
 * 
 * Serves the spolky notification API
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config();

import './db.js'; // Initialize database
import authRoutes from './routes/auth.js';
import notificationsRoutes from './routes/notifications.js';
import successRatesRoutes from './routes/success-rates.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for now (extension can run from any context)
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/success-rates', successRatesRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 reIS Server running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
});
