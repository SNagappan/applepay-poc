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
  const filePath = join(__dirname, '../public/.well-known/apple-developer-merchantid-domain-association');
  
  console.log(`[Domain Association] Request for: ${req.path}`);
  console.log(`[Domain Association] File path: ${filePath}`);
  console.log(`[Domain Association] File exists: ${fs.existsSync(filePath)}`);
  
  if (fs.existsSync(filePath)) {
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
    console.error(`[Domain Association] File not found: ${filePath}`);
    res.status(404).send('Domain association file not found');
  }
});

// Also serve with .txt extension for compatibility
app.get('/.well-known/apple-developer-merchantid-domain-association.txt', (req, res) => {
  // Try .txt file first, then fallback to file without extension
  const txtFilePath = join(__dirname, '../public/.well-known/apple-developer-merchantid-domain-association.txt');
  const filePath = join(__dirname, '../public/.well-known/apple-developer-merchantid-domain-association');
  
  console.log(`[Domain Association] Request for: ${req.path}`);
  console.log(`[Domain Association] .txt file path: ${txtFilePath}`);
  console.log(`[Domain Association] .txt file exists: ${fs.existsSync(txtFilePath)}`);
  console.log(`[Domain Association] Fallback file path: ${filePath}`);
  console.log(`[Domain Association] Fallback file exists: ${fs.existsSync(filePath)}`);
  
  let pathToServe = null;
  if (fs.existsSync(txtFilePath)) {
    pathToServe = txtFilePath;
  } else if (fs.existsSync(filePath)) {
    pathToServe = filePath;
  }
  
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
    console.error(`[Domain Association] File not found: ${txtFilePath} or ${filePath}`);
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

