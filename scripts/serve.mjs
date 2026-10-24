import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const options = { dir: '.', host: '127.0.0.1', port: process.env.PORT ?? '4173' };
const args = process.argv.slice(2);

for (let index = 0; index < args.length; index += 1) {
  const key = args[index];
  if (key === '--help') {
    console.log('Usage: npm run dev -- [--port 4173] [--host 127.0.0.1] [--dir .]');
    process.exit(0);
  }
  if (!['--dir', '--host', '--port'].includes(key) || !args[index + 1] || args[index + 1].startsWith('--')) {
    console.error(`Unknown or incomplete option: ${key}. Use --help for usage.`);
    process.exit(1);
  }
  options[key.slice(2)] = args[++index];
}

const port = Number(options.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Port must be a number between 1 and 65535.');
  process.exit(1);
}

const root = path.resolve(projectRoot, options.dir);
if (root !== path.resolve(projectRoot) && !root.startsWith(`${path.resolve(projectRoot)}${path.sep}`)) {
  console.error('The served directory must be inside this project.');
  process.exit(1);
}

try {
  if (!(await stat(path.join(root, 'index.html'))).isFile()) throw new Error('Missing index.html');
} catch {
  console.error(`No index.html in ${root}. For preview, run npm run build first.`);
  process.exit(1);
}

const rootRealPath = await realpath(root);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const reply = (response, status, message, method) => {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(method === 'HEAD' ? undefined : message);
};

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Cache-Control', 'no-cache');

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    reply(response, 405, 'Method not allowed', request.method);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    reply(response, 400, 'Invalid URL', request.method);
    return;
  }

  // Block hidden files and development internals when serving the source tree.
  const segments = pathname.replaceAll('\\', '/').split('/').filter(Boolean);
  if (pathname.includes('\0') || segments.some((segment) => segment.startsWith('.')) ||
      ['scripts', 'node_modules', 'package.json', 'package-lock.json', 'vercel.json', 'README.md'].includes(segments[0])) {
    reply(response, 404, 'Not found', request.method);
    return;
  }

  let target = path.resolve(root, `.${pathname}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    reply(response, 403, 'Forbidden', request.method);
    return;
  }

  try {
    let info;
    try {
      info = await stat(target);
    } catch (error) {
      if (error.code !== 'ENOENT' || path.extname(target)) throw error;
      target += '.html';
      info = await stat(target);
    }
    if (info.isDirectory()) {
      target = path.join(target, 'index.html');
      info = await stat(target);
    }
    if (!info.isFile()) throw new Error('Not a file');

    const targetRealPath = await realpath(target);
    if (!targetRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
      reply(response, 403, 'Forbidden', request.method);
      return;
    }

    response.writeHead(200, {
      'Content-Type': types[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    const stream = createReadStream(targetRealPath);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  } catch {
    reply(response, 404, 'Not found', request.method);
  }
});

server.on('error', (error) => {
  console.error(`Could not start the static server: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, options.host, () => {
  console.log(`Static portfolio: http://${options.host}:${port}`);
  console.log(`Serving ${path.relative(projectRoot, root) || 'source files'}. Press Ctrl+C to stop.`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
