import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  try {
    // --- MÉTODO GET: Listar animales ---
    if (request.method === 'GET') {
      const result = await sql`
        SELECT id_animal, nombre_animal, especie_animal, edad, estado 
        FROM animal 
        ORDER BY id_animal DESC;
      `;
      return response.status(200).json(result.rows);
    }

    // --- MÉTODO POST: Crear animal ---
    if (request.method === 'POST') {
      // Validamos que el cuerpo de la petición no llegue vacío
      const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
      const { nombre, especie, edad } = body;

      if (!nombre || !especie) {
        return response.status(400).json({ error: 'Faltan campos obligatorios' });
      }

      // IMPORTANTE: id_protectora debe existir en tu tabla protectora (ej. el ID 1)
      await sql`
        INSERT INTO animal (nombre_animal, especie_animal, edad, estado, id_protectora)
        VALUES (${nombre}, ${especie}, ${edad || 0}, 'Disponible', 1);
      `;

      return response.status(200).json({ message: 'Animal creado con éxito' });
    }

    // Si no es GET ni POST
    return response.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    console.error('Error detallado:', error);
    // Devolvemos el error real para que lo veas en el log de Vercel
    return response.status(500).json({ 
      error: 'Error de servidor', 
      message: error.message,
      stack: error.stack 
    });
  }
}