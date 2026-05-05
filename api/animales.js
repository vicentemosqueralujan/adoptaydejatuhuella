import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  const { method, query: { id } } = req;
  try {
    if (method === 'GET') {
      const { rows } = await sql`SELECT * FROM animal ORDER BY id_animal DESC`;
      return res.status(200).json(rows);
    }
    if (method === 'POST') {
      const { nombre, especie, edad, id_protectora } = JSON.parse(req.body);
      await sql`INSERT INTO animal (nombre_animal, especie_animal, edad, estado, id_protectora) VALUES (${nombre}, ${especie}, ${edad}, 'Disponible', ${id_protectora})`;
      return res.status(200).json({ ok: true });
    }
    if (method === 'DELETE') {
      await sql`DELETE FROM animal WHERE id_animal = ${id}`;
      return res.status(200).json({ ok: true });
    }
    if (method === 'PATCH') {
      const { nombre, estado } = JSON.parse(req.body);
      if (nombre) await sql`UPDATE animal SET nombre_animal = ${nombre} WHERE id_animal = ${id}`;
      if (estado) await sql`UPDATE animal SET estado = ${estado} WHERE id_animal = ${id}`;
      return res.status(200).json({ ok: true });
    }
  } catch (e) { return res.status(500).json({ error: e.message }); }
}