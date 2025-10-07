// Express server to serve Angular app and proxy API requests
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
// Default to local backend in development, production backend in production
const API_URL = process.env.API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://realestate-api.onrender.com' 
    : 'http://localhost:3001');

// Proxy API requests to backend
const apiProxy = createProxyMiddleware({
  target: API_URL,
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for SSE
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] ${req.method} ${req.url} -> ${API_URL}${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('[Proxy Error]', err);
    res.status(500).json({ error: 'Proxy error', details: err.message });
  }
});

// Proxy all API routes
app.use('/run', apiProxy);
app.use('/run_sync', apiProxy);
app.use('/events', apiProxy);
app.use('/result', apiProxy);
app.use('/ui/events', apiProxy);
app.use('/ui/test-alert', apiProxy);
app.use('/api', apiProxy);
app.use('/chat', apiProxy);
app.use('/healthz', apiProxy);

// Serve static files from Angular build
const distPath = path.join(__dirname, 'dist/deal-agent-ui/browser');
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
