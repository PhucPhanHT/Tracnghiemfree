const serverless = require('serverless-http');
const app = require('../../server');
const { initDb } = require('../../db');

let isInitialized = false;
const handler = serverless(app);

module.exports.handler = async (event, context) => {
  // Fix path prefix if needed for Netlify function redirects
  if (!isInitialized) {
    try {
      await initDb();
      isInitialized = true;
    } catch (err) {
      console.warn('DB initialization error in serverless:', err.message);
    }
  }

  return await handler(event, context);
};

