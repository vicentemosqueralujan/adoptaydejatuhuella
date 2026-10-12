const { sql } = require('@vercel/postgres');
const bcrypt  = require('bcryptjs');

const BCRYPT_PREFIX = '$2';
const CREDENCIALES_INVALIDAS = 'Credenciales incorrectas';
// Hash descartable: se compara contra él cuando el usuario no existe o su hash no es
// válido, para que todas las rutas de fallo tarden lo mismo y no filtren qué emails
// están dados de alta.
const DUMMY_HASH = bcrypt.hashSync('__usuario_inexistente__', 10);

/** Un hash utilizable es una cadena bcrypt completa ($2a/$2b/$2y, 60 caracteres). */
function esHashBcrypt(valor) {
    return typeof valor === 'string' && valor.startsWith(BCRYPT_PREFIX) && valor.length === 60;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método no permitido' });

    try {
        const { email, password } = req.body ?? {};

        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email y contraseña son obligatorios' });

        const { rows } = await sql`
            SELECT id_usuario, nombre_usuario, tipo_usuario, password
            FROM usuario WHERE email = ${String(email).trim().toLowerCase()} LIMIT 1
        `;
        const usuario = rows[0];

        // Sólo se aceptan hashes bcrypt. Una contraseña almacenada en texto plano es
        // un registro corrupto: se rechaza el acceso y se deja constancia en el log.
        const hashAlmacenado = usuario?.password;
        const hashUtilizable = esHashBcrypt(hashAlmacenado);

        if (usuario && !hashUtilizable)
            console.error('[LOGIN] Hash no bcrypt para el usuario', usuario.id_usuario, '— acceso denegado');

        const matches = await bcrypt.compare(
            String(password),
            hashUtilizable ? hashAlmacenado : DUMMY_HASH
        );

        if (!usuario || !hashUtilizable || !matches)
            return res.status(401).json({ success: false, message: CREDENCIALES_INVALIDAS });

        return res.status(200).json({
            success: true,
            user: { id: usuario.id_usuario, nombre: usuario.nombre_usuario, tipo: usuario.tipo_usuario }
        });

    } catch (e) {
        console.error('[LOGIN ERROR]', e.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};
