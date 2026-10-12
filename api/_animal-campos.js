/**
 * Catálogo de campos de la ficha de animal: validación, normalización y
 * detección de columnas disponibles.
 *
 * Los ficheros de `api/` que empiezan por `_` no se publican como rutas en
 * Vercel, así que este módulo es interno.
 *
 * La detección de columnas permite que el endpoint siga funcionando contra una
 * base de datos a la que todavía no se le ha aplicado `db/002-animal-ficha.sql`:
 * los campos ausentes se ignoran en lugar de reventar la consulta.
 */

const CAMPOS_BASE = ['id_animal', 'nombre_animal', 'especie_animal', 'edad', 'estado', 'id_protectora'];

const SEXOS   = ['Macho', 'Hembra'];
const TAMANOS = ['Pequeño', 'Mediano', 'Grande'];
const CONVIVENCIA = ['si', 'no', 'desconocido'];
const CLAVES_COMPATIBLE = ['perros', 'gatos', 'ninos'];

const MAX_TEXTO_CORTO = 80;
const MAX_TEXTO_LARGO = 2000;
const MAX_FOTOS = 6;
const MAX_BYTES_FOTO = 200 * 1024;   // margen sobre los 100 KB que produce el cliente
const EDAD_MAXIMA_ANOS = 40;

/** Error de validación: el endpoint lo traduce a un 400 con su mensaje. */
class CampoInvalido extends Error {}

const texto = (valor, maximo, etiqueta) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const t = String(valor).trim();
    if (!t) return null;
    if (t.length > maximo) throw new CampoInvalido(`${etiqueta} no puede superar ${maximo} caracteres`);
    return t;
};

const deLista = (valor, lista, etiqueta) => {
    if (valor === null || valor === undefined || valor === '') return null;
    const t = String(valor).trim();
    if (!lista.includes(t)) throw new CampoInvalido(`${etiqueta} debe ser uno de: ${lista.join(', ')}`);
    return t;
};

const fecha = valor => {
    if (valor === null || valor === undefined || valor === '') return null;

    const t = String(valor).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t))
        throw new CampoInvalido('La fecha de nacimiento debe tener el formato AAAA-MM-DD');

    const d = new Date(`${t}T00:00:00Z`);
    if (Number.isNaN(d.getTime()))
        throw new CampoInvalido('La fecha de nacimiento no es una fecha real');

    const hoy = new Date();
    if (d > hoy) throw new CampoInvalido('La fecha de nacimiento no puede ser futura');

    const limite = new Date(hoy);
    limite.setUTCFullYear(limite.getUTCFullYear() - EDAD_MAXIMA_ANOS);
    if (d < limite) throw new CampoInvalido(`La fecha de nacimiento no puede ser anterior a ${EDAD_MAXIMA_ANOS} años`);

    return t;
};

const booleano = (valor, etiqueta) => {
    if (valor === null || valor === undefined || valor === '') return null;
    if (typeof valor === 'boolean') return valor;
    const t = String(valor).trim().toLowerCase();
    if (['true', '1', 'si', 'sí'].includes(t)) return true;
    if (['false', '0', 'no'].includes(t)) return false;
    throw new CampoInvalido(`${etiqueta} debe ser verdadero o falso`);
};

/** `{ perros, gatos, ninos }` con valores de CONVIVENCIA. Se guarda como JSONB. */
const compatibilidad = valor => {
    if (valor === null || valor === undefined || valor === '') return null;

    const origen = typeof valor === 'string' ? parsearJson(valor, 'Compatibilidad') : valor;
    if (typeof origen !== 'object' || Array.isArray(origen))
        throw new CampoInvalido('La compatibilidad debe ser un objeto con perros, gatos y niños');

    const limpio = {};
    for (const clave of CLAVES_COMPATIBLE) {
        const v = origen[clave];
        if (v === undefined || v === null || v === '') continue;
        const t = String(v).trim().toLowerCase();
        if (!CONVIVENCIA.includes(t))
            throw new CampoInvalido(`La compatibilidad con ${clave} debe ser: ${CONVIVENCIA.join(', ')}`);
        limpio[clave] = t;
    }

    return Object.keys(limpio).length ? limpio : null;
};

/** Array de data URL ya comprimidas en el cliente. La primera es la principal. */
const fotos = valor => {
    if (valor === null || valor === undefined || valor === '') return null;

    const origen = typeof valor === 'string' ? parsearJson(valor, 'Fotos') : valor;
    if (!Array.isArray(origen)) throw new CampoInvalido('Las fotos deben enviarse como una lista');
    if (origen.length > MAX_FOTOS) throw new CampoInvalido(`Como máximo ${MAX_FOTOS} fotos por animal`);

    return origen.map((foto, i) => {
        if (typeof foto !== 'string' || !/^data:image\/(jpeg|png|webp|avif);base64,/.test(foto))
            throw new CampoInvalido(`La foto ${i + 1} no tiene un formato admitido`);
        // Peso aproximado del base64; evita que un cliente manipulado llene la tabla.
        if (Math.floor(foto.length * 3 / 4) > MAX_BYTES_FOTO)
            throw new CampoInvalido(`La foto ${i + 1} supera el peso permitido`);
        return foto;
    });
};

function parsearJson(crudo, etiqueta) {
    try { return JSON.parse(crudo); }
    catch { throw new CampoInvalido(`${etiqueta}: JSON no válido`); }
}

/**
 * Campos de la ficha detallada. `columna` es el nombre en la tabla `animal`;
 * `entrada` la clave que llega en el cuerpo de la petición.
 */
const CAMPOS_FICHA = Object.freeze([
    { columna: 'sexo',                entrada: 'sexo',                parsear: v => deLista(v, SEXOS, 'El sexo') },
    { columna: 'tamano',              entrada: 'tamano',              parsear: v => deLista(v, TAMANOS, 'El tamaño') },
    { columna: 'fecha_nacimiento',    entrada: 'fecha_nacimiento',    parsear: fecha },
    { columna: 'raza',                entrada: 'raza',                parsear: v => texto(v, MAX_TEXTO_CORTO, 'La raza') },
    { columna: 'provincia',           entrada: 'provincia',           parsear: v => texto(v, MAX_TEXTO_CORTO, 'La provincia') },
    { columna: 'puede_viajar',        entrada: 'puede_viajar',        parsear: v => booleano(v, 'Puede viajar') },
    { columna: 'entrega_condiciones', entrada: 'entrega_condiciones', parsear: v => texto(v, MAX_TEXTO_LARGO, 'Las condiciones de entrega') },
    { columna: 'info_importante',     entrada: 'info_importante',     parsear: v => texto(v, MAX_TEXTO_LARGO, 'La información importante') },
    { columna: 'compatible',          entrada: 'compatible',          parsear: compatibilidad, json: true },
    { columna: 'fotos',               entrada: 'fotos',               parsear: fotos, json: true },
]);

const COLUMNAS_FICHA = CAMPOS_FICHA.map(c => c.columna);

/**
 * Columnas de `animal` realmente presentes en la base de datos.
 *
 * Se consulta una vez por instancia y se memoriza: en una función serverless
 * reutilizada esto evita una ida y vuelta extra en cada petición.
 */
let cacheColumnas = null;

async function columnasDisponibles(sql) {
    if (cacheColumnas) return cacheColumnas;

    const { rows } = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'animal'
    `;
    cacheColumnas = new Set(rows.map(r => r.column_name));
    return cacheColumnas;
}

/** Invalida la memoria de columnas (tras aplicar una migración, o en tests). */
function olvidarColumnas() {
    cacheColumnas = null;
}

/** Campos de ficha que existen en la base de datos actual. */
function camposPresentes(columnas) {
    return CAMPOS_FICHA.filter(c => columnas.has(c.columna));
}

/** Lista de columnas para el SELECT, saltándose las que aún no existen. */
function columnasSelect(columnas) {
    return [...CAMPOS_BASE, ...COLUMNAS_FICHA.filter(c => columnas.has(c))];
}

/**
 * Normaliza los campos de ficha presentes en el cuerpo de la petición.
 *
 * @returns {{columna: string, valor: any}[]} sólo los campos realmente enviados.
 * @throws {CampoInvalido}
 */
function normalizarFicha(cuerpo, columnas) {
    const recibido = cuerpo ?? {};

    return camposPresentes(columnas)
        .filter(campo => recibido[campo.entrada] !== undefined)
        .map(campo => {
            const valor = campo.parsear(recibido[campo.entrada]);
            // Los JSONB viajan serializados; el resto, tal cual.
            return { columna: campo.columna, valor: campo.json && valor !== null ? JSON.stringify(valor) : valor };
        });
}

module.exports = {
    CampoInvalido,
    CAMPOS_BASE,
    CAMPOS_FICHA,
    COLUMNAS_FICHA,
    SEXOS,
    TAMANOS,
    CONVIVENCIA,
    MAX_FOTOS,
    columnasDisponibles,
    olvidarColumnas,
    columnasSelect,
    normalizarFicha,
};
