import app from '../backend/server.js';

// Vercel serverless function handler
// For requests to /api/*, Vercel automatically routes to api/index.js
// The req.url will be like /categories (Vercel removes /api prefix)
export default function handler(req, res) {
  // Log for debugging
  console.log('🔍 API Handler called:', {
    method: req.method,
    url: req.url,
    path: req.path,
    originalUrl: req.originalUrl,
    headers: req.headers
  });
  
  // Ensure we handle the request properly
  if (!req.url || req.url === '/') {
    req.url = '/';
  }
  
  // Call Express app
  return app(req, res);
}
