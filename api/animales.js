import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const { rows } = await sql`SELECT * FROM animal ORDER BY id_animal DESC`;
      return res.status(200).json(rows);
    }
    if (req.method === 'POST') {
      const { nombre, especie, edad, id_protectora } = JSON.parse(req.body);
      await sql`INSERT INTO animal (nombre_animal, especie_animal, edad, estado, id_protectora) 
                VALUES (${nombre}, ${especie}, ${edad}, 'Disponible', ${id_protectora})`;
      return res.status(200).json({ success: true });
    }
  } catch (e) { return res.status(500).json({ error: e.message }); }
}