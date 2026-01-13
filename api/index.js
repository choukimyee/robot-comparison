import app from '../backend/server.js';

// Vercel automatically routes /api/* to this file
// The req.url already includes /api prefix, so we can use Express app directly
export default app;
