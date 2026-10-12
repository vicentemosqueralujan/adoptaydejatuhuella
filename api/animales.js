const { sql } = require('@vercel/postgres');
const { identificarSolicitante, puede } = require('./_auth.js');
const { ROLES } = require('./_roles.js');

const PERMISO_GESTION   = 'animales:gestionar';
const ESTADO_DISPONIBLE = 'Disponible';
const ESTADOS_VALIDOS   = [ESTADO_DISPONIBLE, 'Reservado', 'Adoptado'];
const EDAD_MAXIMA = 40;

/** Convierte un identificador recibido a entero positivo, o `null` si no es utilizable. */
function parsearId(valor) {
    if (valor === undefined || valor === null || valor === '') return null;
    const n = Number.parseInt(valor, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/** Texto de filtro ya saneado, o `null` si viene vacío. */
function parsearTexto(valor) {
    const t = typeof valor === 'string' ? valor.trim() : '';
    return t === '' ? null : t;
}

/** Edad en años, o `null`. Devuelve `undefined` si el valor es inaceptable. */
function parsearEdad(valor) {
    if (valor === undefined || valor === null || valor === '') return null;
    const n = Number.parseInt(valor, 10);
    if (!Number.isInteger(n) || n < 0 || n > EDAD_MAXIMA) return undefined;
    return n;
}

/**
 * Determina a qué protectora queda acotado el solicitante.
 * El rol Protectora sólo alcanza la suya; un Admin no tiene restricción.
 */
function protectoraDelSolicitante(solicitante) {
    return solicitante?.tipo_usuario === ROLES.PROTECTORA ? (solicitante.id_protectora ?? null) : null;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Usuario-Id');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const { method } = req;
    const id = parsearId(req.query?.id);

    try {
        const solicitante = await identificarSolicitante(req);
        const esGestor = puede(solicitante, PERMISO_GESTION);
        const protectoraPropia = protectoraDelSolicitante(solicitante);

        if (method === 'GET') {
            const q       = parsearTexto(req.query?.q);
            const especie = parsearTexto(req.query?.especie);

            // Quien no gestiona animales sólo ve el catálogo de adopción: los
            // disponibles. Una protectora ve exclusivamente los suyos, en cualquier
            // estado. Un Admin puede filtrar libremente.
            const estadoPedido = parsearTexto(req.query?.estado);
            const estado = esGestor
                ? (ESTADOS_VALIDOS.includes(estadoPedido) ? estadoPedido : null)
                : ESTADO_DISPONIBLE;

            const idProtectora = protectoraPropia ?? parsearId(req.query?.id_protectora);

            // Filtros opcionales resueltos en una sola consulta parametrizada:
            // cada condición se desactiva sola cuando su parámetro es NULL.
            const { rows } = await sql`
                SELECT a.id_animal,
                       a.nombre_animal,
                       a.especie_animal,
                       a.edad,
                       a.estado,
                       a.id_protectora,
                       p.nombre_protectora
                FROM animal a
                LEFT JOIN protectora p ON p.id_protectora = a.id_protectora
                WHERE (${idProtectora}::int IS NULL OR a.id_protectora = ${idProtectora}::int)
                  AND (${estado}::text IS NULL OR a.estado = ${estado}::text)
                  AND (${especie}::text IS NULL OR LOWER(a.especie_animal) = LOWER(${especie}::text))
                  AND (${q}::text IS NULL
                       OR a.nombre_animal ILIKE '%' || ${q}::text || '%'
                       OR a.especie_animal ILIKE '%' || ${q}::text || '%')
                ORDER BY a.id_animal DESC
            `;
            return res.status(200).json(rows);
        }

        // A partir de aquí todo modifica el catálogo.
        if (!esGestor)
            return res.status(solicitante ? 403 : 401)
                      .json({ error: 'Se requieren permisos de gestión de animales' });

        if (method === 'POST') {
            const { nombre, especie, edad, id_protectora } = req.body ?? {};

            if (!nombre?.trim() || !especie?.trim())
                return res.status(400).json({ error: 'Nombre y especie son obligatorios' });

            const edadNormalizada = parsearEdad(edad);
            if (edadNormalizada === undefined)
                return res.status(400).json({ error: `La edad debe ser un número entre 0 y ${EDAD_MAXIMA}` });

            // Una protectora sólo da de alta en la suya, venga lo que venga en el cuerpo.
            const destino = protectoraPropia ?? parsearId(id_protectora);
            if (!destino)
                return res.status(400).json({ error: 'Debes indicar la protectora del animal' });

            const { rows } = await sql`
                INSERT INTO animal (nombre_animal, especie_animal, edad, estado, id_protectora)
                VALUES (${nombre.trim()}, ${especie.trim()}, ${edadNormalizada}, ${ESTADO_DISPONIBLE}, ${destino})
                RETURNING id_animal, nombre_animal, especie_animal, edad, estado, id_protectora
            `;
            return res.status(201).json({ ok: true, animal: rows[0] ?? null });
        }

        if (!id) return res.status(400).json({ error: 'Identificador de animal no válido' });

        // Propiedad: una protectora no puede tocar los animales de otra.
        const { rows: existentes } = await sql`
            SELECT id_animal, id_protectora FROM animal WHERE id_animal = ${id} LIMIT 1
        `;
        const animal = existentes[0];
        if (!animal) return res.status(404).json({ error: 'Animal no encontrado' });

        if (protectoraPropia !== null && animal.id_protectora !== protectoraPropia)
            return res.status(403).json({ error: 'Este animal pertenece a otra protectora' });

        if (method === 'DELETE') {
            await sql`DELETE FROM animal WHERE id_animal = ${id}`;
            return res.status(200).json({ ok: true });
        }

        if (method === 'PATCH') {
            const { nombre, especie, edad, estado } = req.body ?? {};

            if ([nombre, especie, edad, estado].every(v => v === undefined))
                return res.status(400).json({ error: 'No se ha indicado ningún campo que actualizar' });

            if (nombre !== undefined && !String(nombre).trim())
                return res.status(400).json({ error: 'El nombre no puede estar vacío' });

            if (especie !== undefined && !String(especie).trim())
                return res.status(400).json({ error: 'La especie no puede estar vacía' });

            if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado))
                return res.status(400).json({ error: `Estado no válido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}` });

            const edadNormalizada = edad !== undefined ? parsearEdad(edad) : null;
            if (edadNormalizada === undefined)
                return res.status(400).json({ error: `La edad debe ser un número entre 0 y ${EDAD_MAXIMA}` });

            const nombreNuevo  = nombre  !== undefined ? String(nombre).trim()  : null;
            const especieNueva = especie !== undefined ? String(especie).trim() : null;
            const estadoNuevo  = estado  !== undefined ? estado : null;
            const tocaEdad     = edad !== undefined;

            // COALESCE deja intacto cualquier campo no enviado, en una sola consulta.
            await sql`
                UPDATE animal SET
                    nombre_animal  = COALESCE(${nombreNuevo}, nombre_animal),
                    especie_animal = COALESCE(${especieNueva}, especie_animal),
                    estado         = COALESCE(${estadoNuevo}, estado),
                    edad           = CASE WHEN ${tocaEdad} THEN ${edadNormalizada} ELSE edad END
                WHERE id_animal = ${id}
            `;
            return res.status(200).json({ ok: true });
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        console.error('[ANIMALES ERROR]', e.message);
        // 23503 = violación de clave ajena (protectora inexistente).
        if (e.code === '23503')
            return res.status(400).json({ error: 'La protectora indicada no existe' });
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
