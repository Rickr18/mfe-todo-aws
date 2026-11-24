/**
 * Entorno local sin dependencias. Sirve las carpetas dist/ COMPILADAS,
 * cada una en un puerto distinto (= origen distinto, como en CloudFront),
 * más una API simulada que imita la de la Parte 2.
 *
 *   node tools/dev.js
 *
 *   http://localhost:4000  API simulada
 *   http://localhost:4001  mfe-editor/dist
 *   http://localhost:4002  mfe-viewer/dist
 *   http://localhost:4003  shell/dist   <- abre este
 *
 * En el puerto 4003, config.json y registry.json se sirven desde
 * tools/dev-config/ (apuntan a localhost), así las versiones de shell/public
 * pueden quedarse con las URLs reales de CloudFront.
 *
 * Antes: npm run build en las tres carpetas.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..');

// ---------------------------------------------------------------- API simulada

const TODOS = new Map();
const HISTORIAL = new Map();
const ahora = () => new Date().toISOString();

function anotar(todo, tipo) {
  if (!HISTORIAL.has(todo.id)) HISTORIAL.set(todo.id, []);
  HISTORIAL.get(todo.id).push({ eventType: tipo, occurredAt: ahora(), snapshot: { ...todo } });
}

function responder(res, code, data) {
  const cuerpo = data === undefined ? '' : JSON.stringify(data);
  res.writeHead(code, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...(cuerpo ? { 'Content-Type': 'application/json' } : {}),
    'Content-Length': Buffer.byteLength(cuerpo),
  });
  res.end(cuerpo);
}

function leerCuerpo(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve(null); } });
  });
}

const api = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'OPTIONS') return responder(res, 204);
  const mHist = url.match(/^\/todos\/([^/]+)\/history$/);
  const mUno = url.match(/^\/todos\/([^/]+)$/);

  if (req.method === 'GET' && mHist) {
    return responder(res, 200, HISTORIAL.get(decodeURIComponent(mHist[1])) || []);
  }
  if (req.method === 'GET' && mUno) {
    const id = decodeURIComponent(mUno[1]);
    const t = TODOS.get(id);
    return t ? responder(res, 200, t) : responder(res, 404, { message: `TODO ${id} no existe` });
  }
  if (req.method === 'GET' && url === '/todos') {
    return responder(res, 200, [...TODOS.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }
  if (req.method === 'POST' && url === '/todos') {
    const data = await leerCuerpo(req);
    if (!data) return responder(res, 400, { message: 'El body debe ser JSON válido' });
    const title = String(data.title ?? '').trim();
    if (!title) return responder(res, 400, { message: "El campo 'title' es obligatorio" });
    const t = ahora();
    const todo = { id: crypto.randomUUID(), title, completed: false, createdAt: t, updatedAt: t };
    TODOS.set(todo.id, todo);
    anotar(todo, 'todo.created');
    return responder(res, 201, todo);
  }
  if (req.method === 'PUT' && mUno) {
    const id = decodeURIComponent(mUno[1]);
    const data = await leerCuerpo(req);
    if (!data) return responder(res, 400, { message: 'El body debe ser JSON válido' });
    const todo = TODOS.get(id);
    if (!todo) return responder(res, 404, { message: `TODO ${id} no existe` });
    if (!('title' in data) && !('completed' in data)) {
      return responder(res, 400, { message: "Envía 'title' y/o 'completed'" });
    }
    if ('title' in data) {
      const title = String(data.title).trim();
      if (!title) return responder(res, 400, { message: "'title' no puede estar vacío" });
      todo.title = title;
    }
    if ('completed' in data) {
      if (typeof data.completed !== 'boolean') {
        return responder(res, 400, { message: "'completed' debe ser true/false" });
      }
      todo.completed = data.completed;
    }
    todo.updatedAt = ahora();
    anotar(todo, data.completed === true ? 'todo.completed' : 'todo.updated');
    return responder(res, 200, todo);
  }
  if (req.method === 'DELETE' && mUno) {
    const id = decodeURIComponent(mUno[1]);
    const todo = TODOS.get(id);
    if (!todo) return responder(res, 404, { message: `TODO ${id} no existe` });
    TODOS.delete(id);
    anotar(todo, 'todo.deleted');
    return responder(res, 204);
  }
  responder(res, 404, { message: 'ruta no encontrada' });
});

// ------------------------------------------------------------ servidor estático

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
};

function estatico(carpeta, reemplazos = {}) {
  return http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
        'Access-Control-Allow-Headers': '*',
      });
      return res.end();
    }
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel.endsWith('/')) rel += 'index.html';
    const destino = reemplazos[rel] || path.join(carpeta, path.normalize(rel));
    if (!reemplazos[rel] && !destino.startsWith(carpeta)) {
      res.writeHead(403); return res.end('prohibido');
    }
    fs.readFile(destino, (err, buf) => {
      if (err) {
        res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
        return res.end('no encontrado');
      }
      res.writeHead(200, {
        'Content-Type': TIPOS[path.extname(destino).toLowerCase()] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
        'Content-Length': buf.length,
      });
      res.end(buf);
    });
  });
}

// ------------------------------------------------------------------- arranque

const dist = (p) => path.join(RAIZ, p, 'dist');
for (const p of ['shell', 'mfe-editor', 'mfe-viewer']) {
  if (!fs.existsSync(dist(p))) {
    console.error(`Falta ${p}/dist. Ejecuta "npm install && npm run build" en ${p}/ primero.`);
    process.exit(1);
  }
}

const servidores = [
  [4000, api, 'API simulada  http://localhost:4000/todos'],
  [4001, estatico(dist('mfe-editor')), 'mfe-editor    http://localhost:4001/todo-editor.js'],
  [4002, estatico(dist('mfe-viewer')), 'mfe-viewer    http://localhost:4002/todo-viewer.js'],
  [4003, estatico(dist('shell'), {
    '/config.json': path.join(__dirname, 'dev-config', 'config.json'),
    '/registry.json': path.join(__dirname, 'dev-config', 'registry.json'),
  }), 'SHELL         http://localhost:4003/   <- abre este'],
];

for (const [puerto, srv, texto] of servidores) {
  srv.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE'
      ? `El puerto ${puerto} ya está ocupado. Cierra lo que lo use y reintenta.`
      : `Error en el puerto ${puerto}: ${e.message}`);
    process.exit(1);
  });
  srv.listen(puerto, '127.0.0.1', () => console.log(texto));
}
console.log('\nCtrl+C para parar.');
