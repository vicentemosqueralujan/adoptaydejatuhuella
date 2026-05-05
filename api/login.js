import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const { email, password } = JSON.parse(req.body);

    // Buscamos al usuario por su email
    const { rows } = await sql`SELECT * FROM usuario WHERE email = ${email} LIMIT 1`;
    const usuario = rows[0];

    if (usuario) {
      // Comparamos la contraseña enviada con la de la DB (que debería estar encriptada)
      // Nota: Si aún tienes 'admin123' en texto plano, la primera vez fallará.
      // Puedes usar: const matches = (password === usuario.password); para pruebas rápidas.
      const matches = await bcrypt.compare(password, usuario.password);

      if (matches || password === usuario.password) { // Permitimos ambos para no bloquearte ahora
        return res.status(200).json({ 
          success: true, 
          user: { id: usuario.id_usuario, nombre: usuario.nombre_usuario, tipo: usuario.tipo_usuario } 
        });
      }
    }
    
    return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}