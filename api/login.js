const { sql } = require('@vercel/postgres');
const bcrypt  = require('bcryptjs');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Método no permitido' });

    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Email y contraseña son obligatorios' });

        const { rows } = await sql`
            SELECT id_usuario, nombre_usuario, tipo_usuario, password
            FROM usuario WHERE email = ${email} LIMIT 1
        `;
        const usuario = rows[0];
        if (!usuario)
            return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });

        const matches = usuario.password.startsWith('$2')
            ? await bcrypt.compare(password, usuario.password)
            : password === usuario.password;

        if (!matches)
            return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });

        return res.status(200).json({
            success: true,
            user: { id: usuario.id_usuario, nombre: usuario.nombre_usuario, tipo: usuario.tipo_usuario }
        });

    } catch (e) {
        console.error('[LOGIN ERROR]', e.message);
        return res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
};
