const { sql } = require('@vercel/postgres');

/**
 * Email público de contacto de la protectora (`protectora.email_protectora`).
 *
 * La columna llega con `db/003-protectora-email.sql`. Hasta aplicarla la API
 * sigue funcionando sin ella; su existencia se memoriza por instancia.
 */

const LONGITUD_MAXIMA_EMAIL = 120;
const EMAIL_VALIDO = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

let cacheColumna = null;

async function tieneEmailProtectora() {
    if (cacheColumna === null) {
        const { rows } = await sql`
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'protectora'
              AND column_name = 'email_protectora'
        `;
        cacheColumna = rows.length > 0;
    }
    return cacheColumna;
}

/**
 * Normaliza el email recibido.
 * @returns {{valor: string|null}|{error: string}} `null` = borrar el contacto.
 */
function normalizarEmailProtectora(crudo) {
    const email = String(crudo ?? '').trim().toLowerCase();
    if (email === '') return { valor: null };
    if (email.length > LONGITUD_MAXIMA_EMAIL)
        return { error: `El email no puede superar ${LONGITUD_MAXIMA_EMAIL} caracteres` };
    if (!EMAIL_VALIDO.test(email)) return { error: 'El email de contacto no es válido' };
    return { valor: email };
}

module.exports = { tieneEmailProtectora, normalizarEmailProtectora };
