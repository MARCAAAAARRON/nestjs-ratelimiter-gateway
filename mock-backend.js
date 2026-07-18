// mock-backend.js (put this at your project root, NOT inside src/)
const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    message: 'Hello from backend',
    path: req.url,
    method: req.method,
  }));
});

server.listen(4000, () => {
  console.log('Mock backend listening on port 4000');
});