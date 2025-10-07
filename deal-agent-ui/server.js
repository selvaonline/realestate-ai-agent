// Express server to serve Angular app and proxy API requests
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
// Default to local backend in development, production backend in production
const API_URL = process.env.API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://realestate-ai-agent.onrender.com' 
    : 'http://localhost:3001');

// Proxy configuration
const proxyOptions = {
  target: API_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for SSE
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] ${req.method} ${req.url} -> ${API_URL}${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy Response] ${req.url} -> Status: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('[Proxy Error]', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy error', details: err.message });
    }
  }
};

// Proxy all API routes - MUST come before static files
app.post('/run', createProxyMiddleware(proxyOptions));
app.post('/run_sync', createProxyMiddleware(proxyOptions));
app.get('/events/*', createProxyMiddleware(proxyOptions));
app.get('/result/*', createProxyMiddleware(proxyOptions));
app.get('/ui/events', createProxyMiddleware(proxyOptions));
app.post('/ui/test-alert', createProxyMiddleware(proxyOptions));
app.use('/api', createProxyMiddleware(proxyOptions));
app.use('/chat', createProxyMiddleware(proxyOptions));
app.get('/healthz', createProxyMiddleware(proxyOptions));

// Serve static files from Angular build
const distPath = path.join(__dirname, 'dist/deal-agent-ui/browser');

// Check if dist folder exists
const fs = require('fs');
if (!fs.existsSync(distPath)) {
  console.error(`❌ ERROR: dist folder not found at: ${distPath}`);
  console.error('Available directories:');
  try {
    const distRoot = path.join(__dirname, 'dist');
    if (fs.existsSync(distRoot)) {
      console.error(fs.readdirSync(distRoot));
    } else {
      console.error('dist/ directory does not exist!');
    }
  } catch (e) {
    console.error('Could not read dist directory');
  }
  process.exit(1);
}

app.use(express.static(distPath));

// All other routes return the Angular app (for client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Proxying API requests to: ${API_URL}`);
  console.log(`📂 Serving static files from: ${distPath}`);
});
