const { sql } = require('@vercel/postgres');

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
            const { nombre, email, tipo } = req.body;
            await sql`INSERT INTO usuario (nombre_usuario, email, password, tipo_usuario)
                      VALUES (${nombre}, ${email}, '123', ${tipo ?? 'Adoptante'})`;
            return res.status(200).json({ ok: true });
        }
        if (method === 'DELETE') {
            await sql`DELETE FROM usuario WHERE id_usuario = ${id}`;
            return res.status(200).json({ ok: true });
        }
        if (method === 'PATCH') {
            const { nombre } = req.body;
            await sql`UPDATE usuario SET nombre_usuario = ${nombre} WHERE id_usuario = ${id}`;
            return res.status(200).json({ ok: true });
        }
        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        console.error('[USUARIOS ERROR]', e.message);
        return res.status(500).json({ error: e.message });
    }
};
