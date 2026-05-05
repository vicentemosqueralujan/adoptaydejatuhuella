import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM protectora ORDER BY id_protectora DESC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { nombre, ubicacion } = JSON.parse(req.body);
      await sql`INSERT INTO protectora (nombre_protectora, ubicacion) VALUES (${nombre}, ${ubicacion})`;
      return res.status(200).json({ success: true });
    }
  } catch (e) { return res.status(500).json({ error: e.message }); }
}