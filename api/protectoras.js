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
            const { rows } = await sql`SELECT * FROM protectora ORDER BY id_protectora DESC`;
            return res.status(200).json(rows);
        }
        if (method === 'POST') {
            const { nombre, ubicacion } = req.body;
            await sql`INSERT INTO protectora (nombre_protectora, ubicacion) VALUES (${nombre}, ${ubicacion ?? null})`;
            return res.status(200).json({ ok: true });
        }
        if (method === 'DELETE') {
            await sql`DELETE FROM protectora WHERE id_protectora = ${id}`;
            return res.status(200).json({ ok: true });
        }
        if (method === 'PATCH') {
            const { nombre } = req.body;
            await sql`UPDATE protectora SET nombre_protectora = ${nombre} WHERE id_protectora = ${id}`;
            return res.status(200).json({ ok: true });
        }
        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        console.error('[PROTECTORAS ERROR]', e.message);
        return res.status(500).json({ error: e.message });
    }
};
