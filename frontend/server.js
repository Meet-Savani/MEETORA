import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT, 10) || 5174;
const HOST = '0.0.0.0';
const DIST_DIR = path.resolve(__dirname, 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
    // Only handle GET and HEAD requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        return res.end('Method Not Allowed');
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // Normalize path to prevent directory traversal
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(DIST_DIR, safePath);

    // Check if the requested file exists
    fs.stat(filePath, (err, stats) => {
        if (!err && stats.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            const headers = { 'Content-Type': contentType };

            // Cache static assets aggressively, but not index.html
            if (pathname.startsWith('/assets/')) {
                headers['Cache-Control'] = 'public, max-age=31536000, immutable';
            } else {
                headers['Cache-Control'] = 'no-cache';
            }

            res.writeHead(200, headers);
            if (req.method === 'HEAD') {
                return res.end();
            }
            return fs.createReadStream(filePath).pipe(res);
        }

        // SPA Fallback: For any browser navigation or missing non-file path, serve index.html
        fs.readFile(INDEX_HTML, (readErr, content) => {
            if (readErr) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                return res.end('Application build not found. Please run "npm run build" first.');
            }
            res.writeHead(200, {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
            });
            if (req.method === 'HEAD') {
                return res.end();
            }
            res.end(content);
        });
    });
});

server.listen(PORT, HOST, () => {
    console.log(`MEETORA Frontend Production SPA Server running on http://${HOST}:${PORT}`);
    console.log(`Serving static files and SPA fallback from ${DIST_DIR}`);
});
