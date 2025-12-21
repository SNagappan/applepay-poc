import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import config from './config/applepay.js';
import { errorHandler, requestIdMiddleware } from './middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import applePayRouter from './routes/applepay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();

// Middleware
app.use(requestIdMiddleware);
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Apple Pay domain association file with correct content type
// This MUST be before any other routes to ensure it's handled correctly
app.get('/.well-known/apple-developer-merchantid-domain-association', (req, res) => {
  // Try multiple possible paths for Vercel and local development
  const possiblePaths = [
    join(__dirname, '../public/.well-known/apple-developer-merchantid-domain-association'),
    join(process.cwd(), 'public/.well-known/apple-developer-merchantid-domain-association'),
    join(process.cwd(), '.well-known/apple-developer-merchantid-domain-association'),
  ];
  
  let filePath = null;
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      filePath = path;
      break;
    }
  }
  
  console.log(`[Domain Association] Request for: ${req.path}`);
  console.log(`[Domain Association] Trying paths:`, possiblePaths);
  console.log(`[Domain Association] File found: ${filePath}`);
  
  if (filePath && fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error(`[Domain Association] Error sending file: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).send('Error serving domain association file');
        }
      }
    });
  } else {
    console.error(`[Domain Association] File not found in any of these paths:`, possiblePaths);
    res.status(404).send('Domain association file not found');
  }
});

// Also serve with .txt extension for compatibility
app.get('/.well-known/apple-developer-merchantid-domain-association.txt', (req, res) => {
  // Try multiple possible paths for Vercel and local development
  const possibleTxtPaths = [
    join(__dirname, '../public/.well-known/apple-developer-merchantid-domain-association.txt'),
    join(process.cwd(), 'public/.well-known/apple-developer-merchantid-domain-association.txt'),
    join(process.cwd(), '.well-known/apple-developer-merchantid-domain-association.txt'),
  ];
  
  const possiblePaths = [
    join(__dirname, '../public/.well-known/apple-developer-merchantid-domain-association'),
    join(process.cwd(), 'public/.well-known/apple-developer-merchantid-domain-association'),
    join(process.cwd(), '.well-known/apple-developer-merchantid-domain-association'),
  ];
  
  let pathToServe = null;
  
  // Try .txt file first
  for (const path of possibleTxtPaths) {
    if (fs.existsSync(path)) {
      pathToServe = path;
      break;
    }
  }
  
  // Fallback to file without extension
  if (!pathToServe) {
    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        pathToServe = path;
        break;
      }
    }
  }
  
  console.log(`[Domain Association] Request for: ${req.path}`);
  console.log(`[Domain Association] Trying .txt paths:`, possibleTxtPaths);
  console.log(`[Domain Association] Trying fallback paths:`, possiblePaths);
  console.log(`[Domain Association] File found: ${pathToServe}`);
  
  if (pathToServe) {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(pathToServe, (err) => {
      if (err) {
        console.error(`[Domain Association] Error sending file: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).send('Error serving domain association file');
        }
      }
    });
  } else {
    console.error(`[Domain Association] File not found in any of these paths:`, [...possibleTxtPaths, ...possiblePaths]);
    res.status(404).send('Domain association file not found');
  }
});

// In production, serve built Vite assets
if (config.nodeEnv === 'production') {
  app.use(express.static(join(__dirname, '../dist')));
}

// API routes
app.use('/api/health', healthRouter);
app.use('/api/applepay', applePayRouter);

// Serve index.html for all non-API routes (SPA fallback)
if (config.nodeEnv === 'production') {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    // Don't serve index.html for .well-known routes (already handled above)
    if (req.path.startsWith('/.well-known')) {
      return res.status(404).send('Not found');
    }
    // Try multiple possible locations for index.html
    const possiblePaths = [
      join(__dirname, '../dist/index.html'),
      join(__dirname, '../dist/src/index.html'),
    ];
    
    for (const indexPath of possiblePaths) {
      if (fs.existsSync(indexPath)) {
        return res.sendFile(indexPath);
      }
    }
    
    // If no index.html found, return error
    res.status(500).json({ error: 'index.html not found in dist directory' });
  });
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Apple Merchant ID: ${config.appleMerchantId}`);
  console.log(`Authorize.Net Mode: ${config.authorizeNetMode}`);
});

export default app;

