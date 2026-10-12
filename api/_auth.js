const { sql } = require('@vercel/postgres');
const { permisosDeRol, ROLES } = require('./_roles.js');

/**
 * Autorización mínima basada en la cabecera `X-Usuario-Id`.
 *
 * LIMITACIÓN CONOCIDA — este mecanismo identifica al solicitante por un id sin
 * firmar, de modo que un cliente podría suplantarlo. Es suficiente para el
 * entregable académico, pero antes de producción debe sustituirse por un token
 * firmado (JWT o cookie de sesión HttpOnly) emitido por `/api/login`.
 * El resto del código no cambia: basta con reemplazar `identificarSolicitante`.
 */

const CABECERA_USUARIO = 'x-usuario-id';

/** Devuelve el usuario solicitante, o `null` si la cabecera falta o no es válida. */
async function identificarSolicitante(req) {
    const crudo = req.headers?.[CABECERA_USUARIO];
    const id = Number.parseInt(crudo, 10);
    if (!Number.isInteger(id) || id <= 0) return null;

    const { rows } = await sql`
        SELECT id_usuario, nombre_usuario, tipo_usuario, id_protectora
        FROM usuario WHERE id_usuario = ${id} LIMIT 1
    `;

    const usuario = rows[0];
    if (!usuario) return null;

    return { ...usuario, permisos: permisosDeRol(usuario.tipo_usuario) };
}

/** `true` si ya existe al menos un administrador: el sistema está inicializado. */
async function existeAdministrador() {
    const { rows } = await sql`
        SELECT 1 FROM usuario WHERE tipo_usuario = ${ROLES.ADMIN} LIMIT 1
    `;
    return rows.length > 0;
}

/** `true` si el solicitante tiene el permiso indicado. */
function puede(solicitante, permiso) {
    return Array.isArray(solicitante?.permisos) && solicitante.permisos.includes(permiso);
}

module.exports = { CABECERA_USUARIO, identificarSolicitante, existeAdministrador, puede };
