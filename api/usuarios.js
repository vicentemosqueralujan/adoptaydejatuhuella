const { sql } = require('@vercel/postgres');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');

const {
    ROL_POR_DEFECTO, esRolValido, requiereProtectora, permiteAutoRegistro,
    VALORES_VALIDOS, ROLES_AUTOREGISTRO,
} = require('./_roles.js');
const { identificarSolicitante, existeAdministrador, puede } = require('./_auth.js');

const PERMISO_GESTION = 'usuarios:gestionar';

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const TEMP_PASSWORD_BYTES = 9;           // 12 caracteres en base64url

// Registro inicial restringido: hasta que exista un administrador en la base de datos,
// el alta pública queda limitada a esta lista blanca. Se puede ampliar con la variable
// de entorno REGISTRO_EMAILS_PERMITIDOS (lista separada por comas).
const EMAILS_PERMITIDOS = (process.env.REGISTRO_EMAILS_PERMITIDOS || 'vicentemoslujan@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

/** Normaliza un email para comparar y almacenar siempre en la misma forma. */
function normalizarEmail(valor) {
    return String(valor).trim().toLowerCase();
}

/** Contraseña temporal aleatoria para altas hechas desde el panel sin contraseña. */
function generarPasswordTemporal() {
    return crypto.randomBytes(TEMP_PASSWORD_BYTES).toString('base64url');
}

/** Convierte un identificador recibido a entero positivo, o `null` si no es utilizable. */
function parsearId(valor) {
    if (valor === undefined || valor === null || valor === '') return null;
    const n = Number.parseInt(valor, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Resuelve el par (rol, protectora) aplicando las reglas del catálogo de roles.
 * Devuelve `{ error }` si la combinación no es coherente.
 */
function resolverRolYProtectora(tipo, idProtectoraCrudo, { rolPorDefecto = ROL_POR_DEFECTO } = {}) {
    const rol = tipo === undefined || tipo === null || tipo === '' ? rolPorDefecto : String(tipo);

    if (!esRolValido(rol))
        return { error: `Rol no válido. Valores permitidos: ${VALORES_VALIDOS.join(', ')}` };

    const idProtectora = parsearId(idProtectoraCrudo);

    if (requiereProtectora(rol) && idProtectora === null)
        return { error: `El rol "${rol}" requiere una protectora asignada` };

    // Los roles que no se vinculan a una protectora nunca arrastran el id:
    // así no quedan asignaciones huérfanas al cambiar de rol.
    return { rol, idProtectora: requiereProtectora(rol) ? idProtectora : null };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Usuario-Id');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { method } = req;
    const id = req.query?.id;

    try {
        const solicitante = await identificarSolicitante(req);
        const esGestor = puede(solicitante, PERMISO_GESTION);

        // Todo salvo el alta inicial exige permisos de gestión: el listado expone
        // correos y el resto de métodos modifica cuentas ajenas.
        if (method !== 'POST' && !esGestor)
            return res.status(solicitante ? 403 : 401)
                      .json({ error: 'Se requieren permisos de gestión de usuarios' });

        if (method === 'GET') {
            // LEFT JOIN: un usuario sin protectora sigue apareciendo en el listado.
            const { rows } = await sql`
                SELECT u.id_usuario,
                       u.nombre_usuario,
                       u.email,
                       u.tipo_usuario,
                       u.id_protectora,
                       p.nombre_protectora
                FROM usuario u
                LEFT JOIN protectora p ON p.id_protectora = u.id_protectora
                ORDER BY u.id_usuario DESC
            `;
            return res.status(200).json(rows);
        }

        if (method === 'POST') {
            const { nombre, email, tipo, password, id_protectora } = req.body ?? {};

            if (!nombre?.trim() || !email?.trim())
                return res.status(400).json({ error: 'Nombre y email son obligatorios' });

            const emailNormalizado = normalizarEmail(email);

            // Tres modos de alta:
            //  · Gestionado   — un gestor autenticado: cualquier correo y cualquier rol.
            //  · Arranque     — aún no hay ningún Admin: sólo entra la lista blanca.
            //  · Auto-registro— ya hay Admin y nadie autenticado: registro público,
            //    limitado a los roles marcados con `autoRegistro` (nunca Admin).
            let esAutoRegistro = false;

            if (!esGestor) {
                if (await existeAdministrador()) {
                    esAutoRegistro = true;
                } else if (!EMAILS_PERMITIDOS.includes(emailNormalizado)) {
                    console.warn('[USUARIOS] Alta rechazada para email no autorizado:', emailNormalizado);
                    return res.status(403).json({
                        error: 'El registro público está restringido. Este correo no está autorizado para darse de alta.'
                    });
                }
            }

            if (password !== undefined && String(password).length < MIN_PASSWORD_LENGTH)
                return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });

            const { rol, idProtectora, error } = resolverRolYProtectora(tipo, id_protectora);
            if (error) return res.status(400).json({ error });

            if (esAutoRegistro) {
                // Escalada de privilegios: nadie se concede a sí mismo un rol de gestión.
                if (!permiteAutoRegistro(rol)) {
                    console.warn('[USUARIOS] Auto-registro rechazado para el rol', rol, '-', emailNormalizado);
                    return res.status(403).json({
                        error: `El rol "${rol}" no está disponible en el registro público. Roles permitidos: ${ROLES_AUTOREGISTRO.join(', ')}`
                    });
                }
                // En el registro público la contraseña la elige la persona: no se
                // generan temporales que nadie podría recibir.
                if (password === undefined)
                    return res.status(400).json({ error: 'La contraseña es obligatoria para registrarse' });
            }

            // Si el panel no envía contraseña se genera una temporal: nunca se guarda
            // una contraseña fija ni en texto plano.
            const esTemporal   = password === undefined;
            const passwordReal = esTemporal ? generarPasswordTemporal() : String(password);
            const passwordHash = await bcrypt.hash(passwordReal, BCRYPT_ROUNDS);

            const { rows } = await sql`
                INSERT INTO usuario (nombre_usuario, email, password, tipo_usuario, id_protectora)
                VALUES (${nombre.trim()}, ${emailNormalizado}, ${passwordHash}, ${rol}, ${idProtectora})
                RETURNING id_usuario, nombre_usuario, email, tipo_usuario, id_protectora
            `;

            // La contraseña temporal se devuelve una única vez para poder entregarla
            // al usuario; no queda almacenada en claro en ningún sitio.
            return res.status(201).json({
                ok: true,
                usuario: rows[0] ?? null,
                ...(esTemporal ? { passwordTemporal: passwordReal } : {}),
            });
        }

        if (method === 'DELETE') {
            if (!parsearId(id))
                return res.status(400).json({ error: 'Identificador de usuario no válido' });

            const { rowCount } = await sql`DELETE FROM usuario WHERE id_usuario = ${id}`;
            if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
            return res.status(200).json({ ok: true });
        }

        if (method === 'PATCH') {
            if (!parsearId(id))
                return res.status(400).json({ error: 'Identificador de usuario no válido' });

            const { nombre, email, tipo, password, id_protectora } = req.body ?? {};

            if ([nombre, email, tipo, password, id_protectora].every(v => v === undefined))
                return res.status(400).json({ error: 'No se ha indicado ningún campo que actualizar' });

            if (nombre !== undefined && !String(nombre).trim())
                return res.status(400).json({ error: 'El nombre no puede estar vacío' });

            if (password !== undefined && String(password).length < MIN_PASSWORD_LENGTH)
                return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });

            // El rol sólo se recalcula si se envía: así un PATCH de nombre no toca
            // la asignación de protectora existente.
            let rol = null;
            let idProtectora = null;
            const cambiaRol = tipo !== undefined;

            if (cambiaRol) {
                const resuelto = resolverRolYProtectora(tipo, id_protectora, { rolPorDefecto: null });
                if (resuelto.error) return res.status(400).json({ error: resuelto.error });
                ({ rol, idProtectora } = resuelto);
            } else if (id_protectora !== undefined) {
                idProtectora = parsearId(id_protectora);
            }

            // Toda contraseña entrante se hashea; nunca se almacena en claro.
            const passwordHash = password !== undefined
                ? await bcrypt.hash(String(password), BCRYPT_ROUNDS)
                : null;

            const nombreNuevo = nombre !== undefined ? String(nombre).trim() : null;
            const emailNuevo  = email  !== undefined ? normalizarEmail(email) : null;
            const tocaProtectora = cambiaRol || id_protectora !== undefined;

            // COALESCE deja intacto cualquier campo no enviado, en una sola consulta.
            const { rowCount } = await sql`
                UPDATE usuario SET
                    nombre_usuario = COALESCE(${nombreNuevo}, nombre_usuario),
                    email          = COALESCE(${emailNuevo}, email),
                    tipo_usuario   = COALESCE(${rol}, tipo_usuario),
                    password       = COALESCE(${passwordHash}, password),
                    id_protectora  = CASE WHEN ${tocaProtectora} THEN ${idProtectora} ELSE id_protectora END
                WHERE id_usuario = ${id}
            `;

            if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        console.error('[USUARIOS ERROR]', e.message);
        // 23505 = violación de restricción única (email duplicado).
        if (e.code === '23505')
            return res.status(409).json({ error: 'Ya existe un usuario con ese correo electrónico' });
        // 23503 = violación de clave ajena (protectora inexistente).
        if (e.code === '23503')
            return res.status(400).json({ error: 'La protectora indicada no existe' });
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
