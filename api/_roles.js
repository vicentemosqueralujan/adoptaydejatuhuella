/**
 * Catálogo de roles del sistema, compartido por los endpoints de la API.
 *
 * Los ficheros de `api/` que empiezan por `_` no se publican como rutas en Vercel,
 * por lo que este módulo es interno y no es accesible desde el exterior.
 *
 * Para añadir un rol nuevo basta con registrarlo aquí: tanto la validación del
 * backend como el desplegable del panel se alimentan de esta misma lista.
 */

const ROLES = Object.freeze({
    ADMIN: 'Admin',
    PROTECTORA: 'Protectora',
    ADOPTANTE: 'Adoptante',
});

/**
 * Definición de cada rol.
 * - `requiereProtectora`: el rol sólo tiene sentido vinculado a una protectora.
 * - `autoRegistro`: el rol puede elegirse en el registro público. `Admin` queda
 *   excluido a propósito: sólo se crea en el arranque o desde el panel.
 */
const DEFINICION_ROLES = Object.freeze([
    {
        valor: ROLES.ADMIN,
        etiqueta: 'Administrador',
        descripcion: 'Acceso total al panel y a la gestión de usuarios.',
        requiereProtectora: false,
        autoRegistro: false,                 // nunca por registro público
        permisos: ['usuarios:gestionar', 'protectoras:gestionar', 'animales:gestionar'],
    },
    {
        valor: ROLES.PROTECTORA,
        etiqueta: 'Protectora',
        descripcion: 'Gestiona los animales de la protectora que tiene asignada.',
        requiereProtectora: true,
        autoRegistro: true,
        permisos: ['animales:gestionar'],
    },
    {
        valor: ROLES.ADOPTANTE,
        etiqueta: 'Adoptante',
        descripcion: 'Consulta el catálogo de animales en adopción.',
        requiereProtectora: false,
        autoRegistro: true,
        permisos: ['animales:consultar'],
    },
]);

const ROL_POR_DEFECTO = ROLES.ADOPTANTE;
const VALORES_VALIDOS = DEFINICION_ROLES.map(r => r.valor);
const ROLES_AUTOREGISTRO = DEFINICION_ROLES.filter(r => r.autoRegistro).map(r => r.valor);

/** Devuelve la definición de un rol, o `undefined` si el valor no está registrado. */
function definicionDeRol(valor) {
    return DEFINICION_ROLES.find(r => r.valor === valor);
}

/** `true` si el valor recibido es uno de los roles registrados. */
function esRolValido(valor) {
    return VALORES_VALIDOS.includes(valor);
}

/** `true` si el rol exige tener una protectora asignada. */
function requiereProtectora(valor) {
    return definicionDeRol(valor)?.requiereProtectora === true;
}

/** `true` si el rol puede elegirse en el formulario de registro público. */
function permiteAutoRegistro(valor) {
    return definicionDeRol(valor)?.autoRegistro === true;
}

/** Lista de permisos del rol; vacía si el rol no existe. */
function permisosDeRol(valor) {
    return definicionDeRol(valor)?.permisos ?? [];
}

module.exports = {
    ROLES,
    DEFINICION_ROLES,
    ROL_POR_DEFECTO,
    VALORES_VALIDOS,
    ROLES_AUTOREGISTRO,
    definicionDeRol,
    esRolValido,
    requiereProtectora,
    permiteAutoRegistro,
    permisosDeRol,
};
