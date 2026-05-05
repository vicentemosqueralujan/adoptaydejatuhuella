 import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM usuario ORDER BY id_usuario DESC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { nombre, email, tipo } = JSON.parse(req.body);
      await sql`INSERT INTO usuario (nombre_usuario, email, password, tipo_usuario) 
                VALUES (${nombre}, ${email}, '123456', ${tipo})`;
      return res.status(200).json({ success: true });
    }
  } catch (e) { return res.status(500).json({ error: e.message }); }
}