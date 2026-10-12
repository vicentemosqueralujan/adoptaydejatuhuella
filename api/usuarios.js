const { sql } = require('@vercel/postgres');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const TEMP_PASSWORD_BYTES = 9;           // 12 caracteres en base64url
const TIPOS_VALIDOS = ['Adoptante', 'Admin'];

/** Contraseña temporal aleatoria para altas hechas desde el panel sin contraseña. */
function generarPasswordTemporal() {
    return crypto.randomBytes(TEMP_PASSWORD_BYTES).toString('base64url');
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { method } = req;
    const id = req.query?.id;

    try {
        if (method === 'GET') {
            const { rows } = await sql`SELECT id_usuario, nombre_usuario, email, tipo_usuario FROM usuario ORDER BY id_usuario DESC`;
            return res.status(200).json(rows);
        }
        if (method === 'POST') {
            const { nombre, email, tipo, password } = req.body ?? {};

            if (!nombre?.trim() || !email?.trim())
                return res.status(400).json({ error: 'Nombre y email son obligatorios' });

            if (password !== undefined && String(password).length < MIN_PASSWORD_LENGTH)
                return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });

            const tipoUsuario = TIPOS_VALIDOS.includes(tipo) ? tipo : 'Adoptante';

            // Si el panel no envía contraseña se genera una temporal: nunca se guarda
            // una contraseña fija ni en texto plano.
            const esTemporal   = password === undefined;
            const passwordReal = esTemporal ? generarPasswordTemporal() : String(password);
            const passwordHash = await bcrypt.hash(passwordReal, BCRYPT_ROUNDS);

            await sql`INSERT INTO usuario (nombre_usuario, email, password, tipo_usuario)
                      VALUES (${nombre.trim()}, ${email.trim().toLowerCase()}, ${passwordHash}, ${tipoUsuario})`;

            // La contraseña temporal se devuelve una única vez para poder entregarla
            // al usuario; no queda almacenada en claro en ningún sitio.
            return res.status(201).json(
                esTemporal ? { ok: true, passwordTemporal: passwordReal } : { ok: true }
            );
        }
        if (method === 'DELETE') {
            await sql`DELETE FROM usuario WHERE id_usuario = ${id}`;
            return res.status(200).json({ ok: true });
        }
        if (method === 'PATCH') {
            const { nombre } = req.body ?? {};
            if (!nombre?.trim())
                return res.status(400).json({ error: 'El nombre es obligatorio' });
            await sql`UPDATE usuario SET nombre_usuario = ${nombre.trim()} WHERE id_usuario = ${id}`;
            return res.status(200).json({ ok: true });
        }
        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        console.error('[USUARIOS ERROR]', e.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
