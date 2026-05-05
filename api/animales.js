import { sql } from '@vercel/postgres';

export default async function handler(request, response) {
  try {
    // --- MÉTODO GET: Listar los animales ---
    if (request.method === 'GET') {
      // Hacemos un JOIN para traer también el nombre de la protectora si fuera necesario
      const result = await sql`
        SELECT id_animal, nombre_animal, especie_animal, edad, estado 
        FROM animal 
        ORDER BY id_animal DESC;
      `;
      return response.status(200).json(result.rows);
    }

    // --- MÉTODO POST: Guardar un nuevo animal ---
    if (request.method === 'POST') {
      // Parseamos el cuerpo de la petición (JSON)
      const { nombre, especie, edad } = JSON.parse(request.body);

      // Validación básica
      if (!nombre || !especie) {
        return response.status(400).json({ error: 'Nombre y especie son obligatorios' });
      }

      // Inserción en la base de datos
      // IMPORTANTE: Usamos id_protectora = 1 por defecto para esta prueba técnica
      await sql`
        INSERT INTO animal (nombre_animal, especie_animal, edad, estado, id_protectora)
        VALUES (${nombre}, ${especie}, ${edad || 0}, 'Disponible', 1);
      `;

      return response.status(200).json({ message: 'Animal registrado con éxito' });
    }

    // Si se intenta otro método (PUT, DELETE...)
    return response.status(405).json({ error: 'Método no permitido' });

  } catch (error) {
    // Registro de errores para que puedas verlo en los logs de Vercel
    console.error('Error en la base de datos:', error);
    return response.status(500).json({ error: 'Error de servidor', details: error.message });
  }
}