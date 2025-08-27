// File: proxy.js
const http = require('http');
const httpProxy = require('http-proxy');
const net = require('net');
const url = require('url');

// 1. Create a new HTTP proxy server
const proxy = httpProxy.createProxyServer({});

// 2. Create a regular HTTP server that will use the proxy
const server = http.createServer((req, res) => {
  // The 'req.url' will be the full URL the browser is trying to access
  console.log(`Proxying HTTP request for: ${req.url}`);
  proxy.web(req, res, { target: req.url, secure: false });
});

// 3. Listen for the 'connect' event to handle HTTPS traffic
server.on('connect', (req, clientSocket, head) => {
  // The 'req.url' for a CONNECT request is the domain and port (e.g., 'www.youtube.com:443')
  console.log(`Setting up tunnel for: ${req.url}`);
  const { port, hostname } = url.parse(`//${req.url}`, false, true);

  if (hostname && port) {
    // Establish a TCP connection to the target server
    const serverSocket = net.connect(port, hostname, () => {
      // Tell the original client that the tunnel is established
      clientSocket.write(
        'HTTP/1.1 200 Connection Established\r\n' +
        'Proxy-agent: Node.js-Proxy\r\n' +
        '\r\n'
      );
      // Pipe the data between the client and the target server
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });

    serverSocket.on('error', (err) => {
      console.error('Error connecting to target server:', err);
      clientSocket.end();
    });
  } else {
    clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
  }
});

// Handle errors on the proxy
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (res) {
    res.writeHead(500, {
      'Content-Type': 'text/plain'
    });
    res.end('Something went wrong with the proxy.');
  }
});


// 4. Start the server
const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Smart HTTP/HTTPS proxy server listening on port ${PORT}`);
});
