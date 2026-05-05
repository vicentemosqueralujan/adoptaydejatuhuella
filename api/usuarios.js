import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const { method, query: { id } } = req;
  try {
    if (method === 'GET') {
      const { rows } = await sql`SELECT * FROM usuario ORDER BY id_usuario DESC`;
      return res.status(200).json(rows);
    }
    if (method === 'POST') {
      const { nombre, email, tipo } = JSON.parse(req.body);
      await sql`INSERT INTO usuario (nombre_usuario, email, password, tipo_usuario) VALUES (${nombre}, ${email}, '123', ${tipo})`;
      return res.status(200).json({ ok: true });
    }
    if (method === 'DELETE') {
      await sql`DELETE FROM usuario WHERE id_usuario = ${id}`;
      return res.status(200).json({ ok: true });
    }
  } catch (e) { return res.status(500).json({ error: e.message }); }
}