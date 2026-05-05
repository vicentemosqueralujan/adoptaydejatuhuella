import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const { method, query: { id } } = req;
  try {
    if (method === 'GET') {
      const { rows } = await sql`SELECT * FROM protectora ORDER BY id_protectora DESC`;
      return res.status(200).json(rows);
    }
    if (method === 'POST') {
      const { nombre, ubicacion } = JSON.parse(req.body);
      await sql`INSERT INTO protectora (nombre_protectora, ubicacion) VALUES (${nombre}, ${ubicacion})`;
      return res.status(200).json({ ok: true });
    }
    if (method === 'DELETE') {
      await sql`DELETE FROM protectora WHERE id_protectora = ${id}`;
      return res.status(200).json({ ok: true });
    }
    if (method === 'PATCH') {
      const { nombre } = JSON.parse(req.body);
      await sql`UPDATE protectora SET nombre_protectora = ${nombre} WHERE id_protectora = ${id}`;
      return res.status(200).json({ ok: true });
    }
  } catch (e) { return res.status(500).json({ error: e.message }); }
}