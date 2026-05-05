// api/login.js
// FIXES APLICADOS:
//   1. Eliminado JSON.parse(req.body) — Vercel ya parsea el body automáticamente
//   2. Cambiado import ES Module a require() para compatibilidad con Vercel Node runtime
//   3. Añadidas cabeceras CORS para evitar bloqueos en desarrollo local
//   4. Mejorado manejo de errores con mensajes descriptivos

const { sql } = require('@vercel/postgres');
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  // Cabeceras CORS (útiles en desarrollo local con live-server, etc.)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight OPTIONS
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método no permitido' });
  }

  try {
    // ✅ FIX #3: req.body ya es un objeto en Vercel — NO usar JSON.parse()
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y contraseña son obligatorios' });
    }

    const { rows } = await sql`
      SELECT id_usuario, nombre_usuario, tipo_usuario, password 
      FROM usuario 
      WHERE email = ${email} 
      LIMIT 1
    `;

    const usuario = rows[0];

    if (!usuario) {
      // No revelar si el email existe o no (seguridad)
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    // Soporte para contraseñas en texto plano (desarrollo) y hash bcrypt (producción)
    let matches = false;
    if (usuario.password.startsWith('$2')) {
      // La contraseña está encriptada con bcrypt
      matches = await bcrypt.compare(password, usuario.password);
    } else {
      // Texto plano — solo para desarrollo/pruebas
      matches = (password === usuario.password);
    }

    if (!matches) {
      return res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: usuario.id_usuario,
        nombre: usuario.nombre_usuario,
        tipo: usuario.tipo_usuario
      }
    });

  } catch (e) {
    console.error('[LOGIN ERROR]', e.message);
    return res.status(500).json({ success: false, message: 'Error interno del servidor', detail: e.message });
  }
};
