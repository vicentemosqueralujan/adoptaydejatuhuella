// api/animales.js
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
      const { rows } = await sql`SELECT * FROM animal ORDER BY id_animal DESC`;
      return res.status(200).json(rows);
    }

    if (method === 'POST') {
      // ✅ FIX: req.body ya es objeto — sin JSON.parse
      const { nombre, especie, edad, id_protectora } = req.body;
      await sql`
        INSERT INTO animal (nombre_animal, especie_animal, edad, estado, id_protectora)
        VALUES (${nombre}, ${especie}, ${edad ?? null}, 'Disponible', ${id_protectora})
      `;
      return res.status(200).json({ ok: true });
    }

    if (method === 'DELETE') {
      await sql`DELETE FROM animal WHERE id_animal = ${id}`;
      return res.status(200).json({ ok: true });
    }

    if (method === 'PATCH') {
      const { nombre, estado } = req.body;
      if (nombre) await sql`UPDATE animal SET nombre_animal = ${nombre} WHERE id_animal = ${id}`;
      if (estado) await sql`UPDATE animal SET estado = ${estado} WHERE id_animal = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método no permitido' });

  } catch (e) {
    console.error('[ANIMALES ERROR]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
