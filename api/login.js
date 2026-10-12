const { sql } = require('@vercel/postgres');
const bcrypt  = require('bcryptjs');

const { permisosDeRol, definicionDeRol } = require('./_roles.js');

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

        // Una sola consulta indexada por email (ver idx_usuario_email en el README):
        // trae en el mismo viaje el rol y la protectora asociada, de modo que el panel
        // se puede renderizar sin una segunda petición. Se seleccionan únicamente las
        // columnas necesarias y LIMIT 1 corta la búsqueda en la primera coincidencia.
        const { rows } = await sql`
            SELECT u.id_usuario,
                   u.nombre_usuario,
                   u.email,
                   u.tipo_usuario,
                   u.password,
                   u.id_protectora,
                   p.nombre_protectora
            FROM usuario u
            LEFT JOIN protectora p ON p.id_protectora = u.id_protectora
            WHERE u.email = ${String(email).trim().toLowerCase()}
            LIMIT 1
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

        // Metadatos de sesión listos para pintar el panel: el frontend no necesita
        // deducir permisos ni volver a consultar la protectora asociada.
        return res.status(200).json({
            success: true,
            user: {
                id: usuario.id_usuario,
                nombre: usuario.nombre_usuario,
                email: usuario.email,
                tipo: usuario.tipo_usuario,
                etiquetaRol: definicionDeRol(usuario.tipo_usuario)?.etiqueta ?? usuario.tipo_usuario,
                idProtectora: usuario.id_protectora ?? null,
                nombreProtectora: usuario.nombre_protectora ?? null,
                permisos: permisosDeRol(usuario.tipo_usuario),
            }
        });

    } catch (e) {
        console.error('[LOGIN ERROR]', e.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};
