const { sql } = require('@vercel/postgres');
const bcrypt  = require('bcryptjs');
const { identificarSolicitante } = require('./_auth.js');

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Autoservicio de datos personales.
 *
 * Cualquier usuario autenticado puede consultar y editar SUS propios datos
 * básicos. El rol y la protectora asignada quedan deliberadamente fuera: sólo
 * se cambian desde el panel de administración, para que nadie pueda escalar
 * privilegios editando su propia ficha.
 */

/** Normaliza un email para comparar y almacenar siempre en la misma forma. */
function normalizarEmail(valor) {
    return String(valor).trim().toLowerCase();
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Usuario-Id');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const solicitante = await identificarSolicitante(req);
        if (!solicitante) return res.status(401).json({ error: 'Necesitas iniciar sesión' });

        if (req.method === 'GET') {
            return res.status(200).json({
                id: solicitante.id_usuario,
                nombre: solicitante.nombre_usuario,
                tipo: solicitante.tipo_usuario,
                idProtectora: solicitante.id_protectora ?? null,
            });
        }

        if (req.method === 'PATCH') {
            const { nombre, email, password } = req.body ?? {};

            if ([nombre, email, password].every(v => v === undefined))
                return res.status(400).json({ error: 'No se ha indicado ningún campo que actualizar' });

            if (nombre !== undefined && !String(nombre).trim())
                return res.status(400).json({ error: 'El nombre no puede estar vacío' });

            if (email !== undefined && !String(email).trim())
                return res.status(400).json({ error: 'El correo no puede estar vacío' });

            if (password !== undefined && String(password).length < MIN_PASSWORD_LENGTH)
                return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });

            // Toda contraseña entrante se hashea; nunca se almacena en claro.
            const passwordHash = password !== undefined
                ? await bcrypt.hash(String(password), BCRYPT_ROUNDS)
                : null;

            const nombreNuevo = nombre !== undefined ? String(nombre).trim() : null;
            const emailNuevo  = email  !== undefined ? normalizarEmail(email) : null;

            // El WHERE fija el id del propio solicitante: no hay forma de editar
            // la ficha de otra persona por mucho que venga en el cuerpo.
            const { rows } = await sql`
                UPDATE usuario SET
                    nombre_usuario = COALESCE(${nombreNuevo}, nombre_usuario),
                    email          = COALESCE(${emailNuevo}, email),
                    password       = COALESCE(${passwordHash}, password)
                WHERE id_usuario = ${solicitante.id_usuario}
                RETURNING id_usuario, nombre_usuario, email, tipo_usuario, id_protectora
            `;

            const actualizado = rows[0];
            if (!actualizado) return res.status(404).json({ error: 'Usuario no encontrado' });

            return res.status(200).json({
                ok: true,
                usuario: {
                    id: actualizado.id_usuario,
                    nombre: actualizado.nombre_usuario,
                    email: actualizado.email,
                    tipo: actualizado.tipo_usuario,
                    idProtectora: actualizado.id_protectora ?? null,
                },
            });
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        console.error('[PERFIL ERROR]', e.message);
        // 23505 = violación de restricción única (email duplicado).
        if (e.code === '23505')
            return res.status(409).json({ error: 'Ya existe un usuario con ese correo electrónico' });
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
