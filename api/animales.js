const { sql } = require('@vercel/postgres');
const { identificarSolicitante, puede } = require('./_auth.js');
const { ROLES } = require('./_roles.js');
const {
    CampoInvalido,
    columnasDisponibles,
    columnasSelect,
    normalizarFicha,
    validarEdadFecha,
} = require('./_animal-campos.js');
const { tieneEmailProtectora } = require('./_protectora-email.js');

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

/**
 * Columnas del SELECT, cualificadas con el alias de `animal`.
 * La lista sale de `information_schema`, nunca de datos del cliente.
 */
function proyeccion(columnas) {
    return columnasSelect(columnas).map(c => `a.${c}`).join(', ');
}

/** Búsqueda libre: nombre, especie, raza y provincia, según lo que exista. */
function condicionBusqueda(columnas, posicion) {
    const campos = ['a.nombre_animal', 'a.especie_animal'];
    if (columnas.has('raza'))      campos.push('a.raza');
    if (columnas.has('provincia')) campos.push('a.provincia');
    return `(${campos.map(c => `${c} ILIKE '%' || $${posicion}::text || '%'`).join(' OR ')})`;
}

async function listar(req, columnas, { esGestor, protectoraPropia }) {
    const q         = parsearTexto(req.query?.q);
    const especie   = parsearTexto(req.query?.especie);
    const provincia = parsearTexto(req.query?.provincia);

    // Quien no gestiona animales sólo ve el catálogo de adopción: los
    // disponibles. Una protectora ve exclusivamente los suyos, en cualquier
    // estado. Un Admin puede filtrar libremente.
    const estadoPedido = parsearTexto(req.query?.estado);
    const estado = esGestor
        ? (ESTADOS_VALIDOS.includes(estadoPedido) ? estadoPedido : null)
        : ESTADO_DISPONIBLE;

    const idProtectora = protectoraPropia ?? parsearId(req.query?.id_protectora);

    const condiciones = [];
    const valores = [];
    const marcador = valor => { valores.push(valor); return valores.length; };

    if (idProtectora !== null) condiciones.push(`a.id_protectora = $${marcador(idProtectora)}::int`);
    if (estado !== null)       condiciones.push(`a.estado = $${marcador(estado)}::text`);
    if (especie !== null)      condiciones.push(`LOWER(a.especie_animal) = LOWER($${marcador(especie)}::text)`);

    if (provincia !== null && columnas.has('provincia'))
        condiciones.push(`LOWER(a.provincia) = LOWER($${marcador(provincia)}::text)`);

    if (q !== null) condiciones.push(condicionBusqueda(columnas, marcador(q)));

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

    const emailProtectora = (await tieneEmailProtectora()) ? ', p.email_protectora' : '';

    const { rows } = await sql.query(`
        SELECT ${proyeccion(columnas)}, p.nombre_protectora${emailProtectora}
        FROM animal a
        LEFT JOIN protectora p ON p.id_protectora = a.id_protectora
        ${where}
        ORDER BY a.id_animal DESC
    `, valores);

    return rows;
}

async function crear(req, columnas, { protectoraPropia }) {
    const { nombre, especie, edad, id_protectora } = req.body ?? {};

    if (!nombre?.trim() || !especie?.trim())
        return { estado: 400, cuerpo: { error: 'Nombre y especie son obligatorios' } };

    const edadNormalizada = parsearEdad(edad);
    if (edadNormalizada === undefined)
        return { estado: 400, cuerpo: { error: `La edad debe ser un número entre 0 y ${EDAD_MAXIMA}` } };

    // Una protectora sólo da de alta en la suya, venga lo que venga en el cuerpo.
    const destino = protectoraPropia ?? parsearId(id_protectora);
    if (!destino)
        return { estado: 400, cuerpo: { error: 'Debes indicar la protectora del animal' } };

    const ficha = normalizarFicha(req.body, columnas);

    // La fecha ya pasó su validación de formato en `normalizarFicha`; aquí se
    // comprueba que no contradiga la edad declarada.
    validarEdadFecha(edadNormalizada, req.body?.fecha_nacimiento);

    const nombresColumnas = ['nombre_animal', 'especie_animal', 'edad', 'estado', 'id_protectora',
                             ...ficha.map(f => f.columna)];
    const valores = [nombre.trim(), especie.trim(), edadNormalizada, ESTADO_DISPONIBLE, destino,
                     ...ficha.map(f => f.valor)];
    const marcadores = valores.map((_, i) => `$${i + 1}`);

    const { rows } = await sql.query(`
        INSERT INTO animal (${nombresColumnas.join(', ')})
        VALUES (${marcadores.join(', ')})
        RETURNING ${columnasSelect(columnas).join(', ')}
    `, valores);

    return { estado: 201, cuerpo: { ok: true, animal: rows[0] ?? null } };
}

async function actualizar(req, columnas, id, actual = {}) {
    const { nombre, especie, edad, estado } = req.body ?? {};
    const ficha = normalizarFicha(req.body, columnas);

    if ([nombre, especie, edad, estado].every(v => v === undefined) && !ficha.length)
        return { estado: 400, cuerpo: { error: 'No se ha indicado ningún campo que actualizar' } };

    if (nombre !== undefined && !String(nombre).trim())
        return { estado: 400, cuerpo: { error: 'El nombre no puede estar vacío' } };

    if (especie !== undefined && !String(especie).trim())
        return { estado: 400, cuerpo: { error: 'La especie no puede estar vacía' } };

    if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado))
        return { estado: 400, cuerpo: { error: `Estado no válido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}` } };

    if (edad !== undefined && parsearEdad(edad) === undefined)
        return { estado: 400, cuerpo: { error: `La edad debe ser un número entre 0 y ${EDAD_MAXIMA}` } };

    // Un PATCH puede traer sólo uno de los dos campos: el que no venga se toma
    // del registro guardado, para no dejar pasar una combinación incoherente.
    const edadFinal = edad !== undefined ? parsearEdad(edad) : (actual.edad ?? null);
    const fechaFinal = req.body?.fecha_nacimiento !== undefined
        ? req.body.fecha_nacimiento
        : (actual.fecha_nacimiento ?? null);
    validarEdadFecha(edadFinal, fechaFinal);

    // Sólo se tocan las columnas realmente enviadas: el resto queda intacto.
    const asignaciones = [];
    const valores = [];
    const asignar = (columna, valor) => {
        valores.push(valor);
        asignaciones.push(`${columna} = $${valores.length}`);
    };

    if (nombre  !== undefined) asignar('nombre_animal',  String(nombre).trim());
    if (especie !== undefined) asignar('especie_animal', String(especie).trim());
    if (estado  !== undefined) asignar('estado', estado);
    if (edad    !== undefined) asignar('edad', parsearEdad(edad));
    ficha.forEach(f => asignar(f.columna, f.valor));

    valores.push(id);

    await sql.query(
        `UPDATE animal SET ${asignaciones.join(', ')} WHERE id_animal = $${valores.length}`,
        valores,
    );

    return { estado: 200, cuerpo: { ok: true } };
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

        // La ficha detallada depende de `db/002-animal-ficha.sql`. Si la migración
        // no está aplicada, los campos nuevos se ignoran en lugar de romper.
        const columnas = await columnasDisponibles(sql);

        if (method === 'GET') {
            const filas = await listar(req, columnas, { esGestor, protectoraPropia });
            return res.status(200).json(filas);
        }

        // A partir de aquí todo modifica el catálogo.
        if (!esGestor)
            return res.status(solicitante ? 403 : 401)
                      .json({ error: 'Se requieren permisos de gestión de animales' });

        if (method === 'POST') {
            const { estado, cuerpo } = await crear(req, columnas, { protectoraPropia });
            return res.status(estado).json(cuerpo);
        }

        if (!id) return res.status(400).json({ error: 'Identificador de animal no válido' });

        // Propiedad: una protectora no puede tocar los animales de otra.
        // Se recuperan también edad y fecha para poder validar un PATCH parcial.
        const columnasActuales = ['id_animal', 'id_protectora', 'edad',
                                  ...(columnas.has('fecha_nacimiento') ? ['fecha_nacimiento'] : [])];
        const { rows: existentes } = await sql.query(
            `SELECT ${columnasActuales.join(', ')} FROM animal WHERE id_animal = $1 LIMIT 1`,
            [id],
        );
        const animal = existentes[0];
        if (!animal) return res.status(404).json({ error: 'Animal no encontrado' });

        if (protectoraPropia !== null && animal.id_protectora !== protectoraPropia)
            return res.status(403).json({ error: 'Este animal pertenece a otra protectora' });

        if (method === 'DELETE') {
            await sql`DELETE FROM animal WHERE id_animal = ${id}`;
            return res.status(200).json({ ok: true });
        }

        if (method === 'PATCH') {
            const { estado, cuerpo } = await actualizar(req, columnas, id, animal);
            return res.status(estado).json(cuerpo);
        }

        return res.status(405).json({ error: 'Método no permitido' });
    } catch (e) {
        // Validación de la ficha: es culpa del cliente, no del servidor.
        if (e instanceof CampoInvalido) return res.status(400).json({ error: e.message });

        console.error('[ANIMALES ERROR]', e.message);
        // 23503 = violación de clave ajena (protectora inexistente).
        if (e.code === '23503')
            return res.status(400).json({ error: 'La protectora indicada no existe' });
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};
