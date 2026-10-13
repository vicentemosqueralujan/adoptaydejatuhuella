#!/usr/bin/env node
/**
 * Servidor de desarrollo local equivalente a `vercel dev` sin depender de la CLI.
 *
 * Sirve los ficheros estáticos de la raíz y enruta /api/<recurso> al handler
 * correspondiente de api/<recurso>.js, emulando el contrato de Vercel
 * (req.query, req.body ya parseado, res.status().json()).
 *
 * Uso:  node tools/dev-server.js [puerto]     (por defecto 3000)
 *
 * Si existe `.env` en la raíz se cargan sus variables (p. ej. `POSTGRES_URL` de
 * una rama de Neon para pruebas). Sólo afecta a este proceso local: en Vercel
 * este fichero no se ejecuta y las variables salen de la configuración del proyecto.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

cargarEnvLocal(path.join(ROOT, '.env'));

/**
 * Carga `.env` con el soporte nativo de Node (≥ 20.12), sin dependencias.
 * Las variables ya definidas en el entorno tienen prioridad y no se pisan.
 */
function cargarEnvLocal(ruta) {
    if (!fs.existsSync(ruta)) return;
    if (typeof process.loadEnvFile !== 'function') {
        console.warn('> .env ignorado: requiere Node 20.12 o superior');
        return;
    }
    process.loadEnvFile(ruta);
    // Sólo se informa de QUÉ hay, nunca del valor: la URL lleva la contraseña.
    console.log(`> .env cargado (POSTGRES_URL ${process.env.POSTGRES_URL ? 'definida' : 'ausente'})`);
}
const API_DIR = path.join(ROOT, 'api');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);
// Un alta de animal puede llevar 6 fotos comprimidas en base64 (~800 KB) más
// el resto de la ficha. 8 MB deja margen y sigue por debajo del límite de Vercel.
const MAX_BODY_BYTES = 8_000_000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
};

/** Vercel sirve manifest.json con el tipo de manifiesto, no como JSON genérico. */
function tipoMime(file) {
    if (path.basename(file) === 'manifest.json') return MIME_TYPES['.webmanifest'];
    return MIME_TYPES[path.extname(file)] || 'application/octet-stream';
}

function leerBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('Cuerpo de la petición demasiado grande'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) return resolve({});
            try { resolve(JSON.parse(raw)); }
            catch { reject(new Error('JSON inválido en el cuerpo de la petición')); }
        });
        req.on('error', reject);
    });
}

/** Envuelve la respuesta de Node con la API que esperan los handlers de Vercel. */
function adaptarRespuesta(res) {
    res.status = code => { res.statusCode = code; return res; };
    res.json = payload => {
        const body = JSON.stringify(payload);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Length', Buffer.byteLength(body));
        res.end(body);
        return res;
    };
    return res;
}

async function servirApi(req, res, recurso) {
    const file = path.join(API_DIR, `${recurso}.js`);
    if (!file.startsWith(API_DIR + path.sep) || !fs.existsSync(file)) {
        return adaptarRespuesta(res).status(404).json({ error: 'Endpoint no encontrado' });
    }

    adaptarRespuesta(res);

    try {
        req.body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await leerBody(req) : {};
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }

    try {
        // require sin caché para que los cambios en api/ se recojan sin reiniciar.
        delete require.cache[require.resolve(file)];
        await require(file)(req, res);
    } catch (e) {
        console.error(`[dev-server] ${recurso}:`, e.message);
        if (!res.headersSent) res.status(500).json({ error: 'Error interno del servidor' });
    }
}

// Nunca se sirven como estáticos: secretos (`.env`, `.git`…) ni código de servidor.
const CARPETAS_PRIVADAS = new Set(['api', 'tools', 'db', 'node_modules']);

function esRutaPrivada(relativa) {
    const segmentos = relativa.split(/[\\/]+/).filter(Boolean);
    return segmentos.some(s => s.startsWith('.')) || CARPETAS_PRIVADAS.has(segmentos[0]);
}

function servirEstatico(req, res, rutaUrl) {
    const relativa = rutaUrl === '/' ? '/index.html' : rutaUrl;
    const file = path.join(ROOT, relativa);

    if (esRutaPrivada(relativa) || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Content-Type': MIME_TYPES['.txt'] });
        return res.end('404 Not Found');
    }

    const body = fs.readFileSync(file);
    res.writeHead(200, {
        'Content-Type': tipoMime(file),
        'Content-Length': body.length,
        'X-Content-Type-Options': 'nosniff',
        // Sin esto el navegador reutiliza CSS/JS antiguos de su caché heurística
        // y los cambios (p. ej. la regla que oculta los modales) no se ven al recargar.
        'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer((req, res) => {
    // Una ruta malformada (por ejemplo `//`) hacía caer el proceso entero:
    // se responde 400 y el servidor sigue en pie.
    let url;
    try {
        url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
        res.writeHead(400, { 'Content-Type': MIME_TYPES['.txt'] });
        return res.end('400 Bad Request');
    }

    req.query = Object.fromEntries(url.searchParams);

    const apiMatch = url.pathname.match(/^\/api\/([a-z0-9_-]+)\/?$/i);
    if (apiMatch) return servirApi(req, res, apiMatch[1]);

    return servirEstatico(req, res, decodeURIComponent(url.pathname));
});

server.listen(PORT, () => {
    console.log(`> Servidor de desarrollo listo en http://localhost:${PORT}`);
    console.log(`> Estáticos desde ${ROOT}  |  API desde ${API_DIR}`);
});
