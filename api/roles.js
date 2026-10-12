const { DEFINICION_ROLES, ROL_POR_DEFECTO } = require('./_roles.js');

/**
 * Expone el catálogo de roles para que el desplegable del panel se construya
 * desde la misma fuente que valida el backend. Añadir un rol en `_roles.js`
 * lo hace aparecer en la interfaz sin tocar el frontend.
 */
module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    // Catálogo estático: se puede cachear con seguridad en el navegador y en el CDN.
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');

    return res.status(200).json({
        porDefecto: ROL_POR_DEFECTO,
        roles: DEFINICION_ROLES.map(({ valor, etiqueta, descripcion, requiereProtectora, autoRegistro }) =>
            ({ valor, etiqueta, descripcion, requiereProtectora, autoRegistro })),
    });
};
