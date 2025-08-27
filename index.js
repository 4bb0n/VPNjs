// File: proxy.js (Updated for Render deployment)
const http = require('http');
const httpProxy = require('http-proxy');
const net = require('net');
const url = require('url');

// --- NEW: Port configuration for hosting platforms ---
// Render sets a PORT environment variable. We must use it.
// Default to 8080 for local development.
const PORT = process.env.PORT || 8080;

const proxy = httpProxy.createProxyServer({});

const server = http.createServer((req, res) => {
  // --- NEW: Health Check Handling ---
  // If Render is checking the health of our service, respond directly.
  if (req.url === '/health') {
    console.log('Health check request received.');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return; // Stop further processing
  }

  // --- Original Proxy Logic for regular HTTP requests ---
  console.log(`Proxying HTTP request for: ${req.headers.host}${req.url}`);
  // We need to construct the full target URL
  const target = `http://${req.headers.host}${req.url}`;
  proxy.web(req, res, { target: target, secure: false });
});

server.on('connect', (req, clientSocket, head) => {
  // Original Proxy Logic for HTTPS requests (no changes needed here)
  console.log(`Setting up tunnel for: ${req.url}`);
  const { port, hostname } = url.parse(`//${req.url}`, false, true);

  if (hostname && port) {
    const serverSocket = net.connect(port, hostname, () => {
      clientSocket.write(
        'HTTP/1.1 200 Connection Established\r\n' +
        'Proxy-agent: Node.js-Proxy\r\n' +
        '\r\n'
      );
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
      console.error(`Tunnel error to ${hostname}:${port}:`, err);
      clientSocket.end();
    });
  } else {
    clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (res && !res.headersSent) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Something went wrong with the proxy.');
  }
});

// Use the PORT variable we defined earlier
server.listen(PORT, () => {
  console.log(`Smart HTTP/HTTPS proxy server listening on port ${PORT}`);
});
