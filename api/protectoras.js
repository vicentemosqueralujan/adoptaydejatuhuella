const { sql } = require('@vercel/postgres');
const { identificarSolicitante, puede } = require('./_auth.js');
const { ROLES } = require('./_roles.js');
const { tieneEmailProtectora, normalizarEmailProtectora } = require('./_protectora-email.js');

const PERMISO_GESTION = 'protectoras:gestionar';

/** Convierte un identificador recibido a entero positivo, o `null`. */
function parsearId(valor) {
    const n = Number.parseInt(valor, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Puede editar los datos de la protectora `id`: el Admin (permiso de gestión)
 * sobre cualquiera, y una cuenta Protectora sólo sobre la suya.
 */
function puedeEditar(solicitante, id) {
    if (puede(solicitante, PERMISO_GESTION)) return true;
    return solicitante?.tipo_usuario === ROLES.PROTECTORA
        && Number(solicitante.id_protectora) === id;
}

/** Texto recortado, o `null` si viene vacío. */
function textoONulo(valor) {
    const t = typeof valor === 'string' ? valor.trim() : '';
    return t === '' ? null : t;
}

/** Valida `email` del cuerpo; `valor: undefined` = no se envió (no se toca). */
async function emailDelCuerpo(body) {
    if (body?.email === undefined) return { valor: undefined };
    if (!(await tieneEmailProtectora()))
        return { error: 'Falta aplicar la migración db/003-protectora-email.sql', estado: 409 };
    const r = normalizarEmailProtectora(body.email);
    return r.error ? { error: r.error, estado: 400 } : r;
}

async function crear(body) {
    const nombre = textoONulo(body?.nombre);
    if (!nombre) return { estado: 400, cuerpo: { error: 'El nombre de la protectora es obligatorio' } };

    const email = await emailDelCuerpo(body);
    if (email.error) return { estado: email.estado, cuerpo: { error: email.error } };

    const ubicacion = textoONulo(body?.ubicacion);
    if (email.valor === undefined) {
        await sql`INSERT INTO protectora (nombre_protectora, ubicacion) VALUES (${nombre}, ${ubicacion})`;
    } else {
        await sql`INSERT INTO protectora (nombre_protectora, ubicacion, email_protectora)
                  VALUES (${nombre}, ${ubicacion}, ${email.valor})`;
    }
    return { estado: 201, cuerpo: { ok: true } };
}

async function actualizar(id, body) {
    const nombre = body?.nombre === undefined ? undefined : textoONulo(body.nombre);
    if (nombre === null) return { estado: 400, cuerpo: { error: 'El nombre no puede estar vacío' } };

    const email = await emailDelCuerpo(body);
    if (email.error) return { estado: email.estado, cuerpo: { error: email.error } };

    if (nombre === undefined && email.valor === undefined)
        return { estado: 400, cuerpo: { error: 'No se ha indicado ningún campo que actualizar' } };

    const { rowCount } = await sql`
        UPDATE protectora SET nombre_protectora = COALESCE(${nombre ?? null}, nombre_protectora)
        WHERE id_protectora = ${id}
    `;
    if (!rowCount) return { estado: 404, cuerpo: { error: 'Protectora no encontrada' } };

    // `null` es un valor válido (borrar el contacto): por eso no va en el COALESCE.
    if (email.valor !== undefined)
        await sql`UPDATE protectora SET email_protectora = ${email.valor} WHERE id_protectora = ${id}`;

    return { estado: 200, cuerpo: { ok: true } };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Usuario-Id');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { method } = req;

    try {
        // Lectura pública: alimenta el filtro del catálogo y el registro.
        if (method === 'GET') {
            const { rows } = await sql`SELECT * FROM protectora ORDER BY id_protectora DESC`;
            return res.status(200).json(rows);
        }

        const solicitante = await identificarSolicitante(req);
        if (!solicitante) return res.status(401).json({ error: 'Necesitas iniciar sesión' });

        if (method === 'POST') {
            if (!puede(solicitante, PERMISO_GESTION))
                return res.status(403).json({ error: 'No tienes permiso para registrar protectoras' });
            const { estado, cuerpo } = await crear(req.body);
            return res.status(estado).json(cuerpo);
        }

        const id = parsearId(req.query?.id);
        if (id === null) return res.status(400).json({ error: 'Identificador de protectora no válido' });

        if (method === 'PATCH') {
            if (!puedeEditar(solicitante, id))
                return res.status(403).json({ error: 'Sólo puedes editar los datos de tu protectora' });
            const { estado, cuerpo } = await actualizar(id, req.body);
            return res.status(estado).json(cuerpo);
        }

        if (method === 'DELETE') {
            if (!puede(solicitante, PERMISO_GESTION))
                return res.status(403).json({ error: 'No tienes permiso para eliminar protectoras' });
            await sql`DELETE FROM protectora WHERE id_protectora = ${id}`;
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        console.error('[PROTECTORAS ERROR]', e.message);
        // 23503 = la protectora aún tiene usuarios o animales vinculados.
        if (e.code === '23503')
            return res.status(409).json({ error: 'La protectora tiene usuarios o animales vinculados' });
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
