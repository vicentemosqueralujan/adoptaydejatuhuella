// ==========================================================================
// Registro único de iconografía — ver DESIGN_SYSTEM.md §4.
//
// SVG inline, monocromático y vectorial. Ningún componente escribe SVG suelto:
// todo pasa por `icono(nombre, tamaño)`.
// ==========================================================================

/** Trazados de cada icono. Lienzo 24×24, trazo heredado de `currentColor`. */
const TRAZOS = Object.freeze({
    buscar:       '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    corazon:      '<path d="M12 20.3 4.6 13a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13z"/>',
    usuario:      '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    usuarios:     '<circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0"/><path d="M16.5 5.2a3.2 3.2 0 0 1 0 5.9"/><path d="M18 14.2A6 6 0 0 1 21.5 19"/>',
    casa:         '<path d="M4 10.5 12 4l8 6.5"/><path d="M6 9.8V20h12V9.8"/><path d="M10 20v-5h4v5"/>',
    editar:       '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14.5 6.5 17.5 9.5"/>',
    eliminar:     '<path d="M4 7h16"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7 7.4 20h9.2L17.5 7"/><path d="M10.5 11v5M13.5 11v5"/>',
    cerrar:       '<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>',
    mas:          '<path d="M12 5v14M5 12h14"/>',
    guardar:      '<path d="M5 4h11l3 3v13H5z"/><path d="M8.5 4v5h7V4"/><path d="M8 13h8v7H8z"/>',
    salir:        '<path d="M14.5 19H6V5h8.5"/><path d="m16 15.5 3.5-3.5L16 8.5"/><path d="M19.5 12H10"/>',
    camara:       '<path d="M3.5 8.5h3.2l1.4-2.3h7.8l1.4 2.3h3.2V19H3.5z"/><circle cx="12" cy="13.5" r="3.3"/>',
    estrella:     '<path d="m12 4.6 2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z"/>',
    calendario:   '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 10h16"/><path d="M8.5 3.5v4M15.5 3.5v4"/>',
    mapa:         '<path d="M12 21s6.3-5.6 6.3-10.2A6.3 6.3 0 0 0 5.7 10.8C5.7 15.4 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.3"/>',
    regla:        '<path d="M4 15.5 15.5 4l4.5 4.5L8.5 20z"/><path d="m8 11.5 1.8 1.8M11 8.5l1.8 1.8M12.5 15l1.8 1.8"/>',
    avion:        '<path d="M3.5 13.2 21 5l-6 16-3.4-6.4z"/><path d="m11.6 14.6 3.6-3.6"/>',
    escudo:       '<path d="M12 3.5 19 6v6c0 4-3 7.2-7 8.5-4-1.3-7-4.5-7-8.5V6z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
    info:         '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5"/><path d="M12 7.8h.01"/>',
    sexo:         '<circle cx="10.5" cy="13.5" r="4.5"/><path d="M14.2 9.8 20 4"/><path d="M15.5 4H20v4.5"/>',
    perro:        '<path d="M5 9.5 4 5l3.6 2.2h8.8L20 5l-1 4.5"/><path d="M5 9.5V14a7 7 0 0 0 14 0V9.5"/><path d="M9.8 13h.01M14.2 13h.01"/><path d="M12 16.2a1.6 1.6 0 0 1-1.4-.9"/>',
    gato:         '<path d="M4.8 10 4 4.6l4.3 2.8h7.4L20 4.6 19.2 10"/><path d="M4.8 10v3.6a7.2 7.2 0 0 0 14.4 0V10"/><path d="M9.6 13h.01M14.4 13h.01"/><path d="M12 15.6v1.2M9.5 17h5"/>',
    patas:        '<ellipse cx="8.2" cy="8.4" rx="1.7" ry="2.2"/><ellipse cx="15.8" cy="8.4" rx="1.7" ry="2.2"/><ellipse cx="4.9" cy="13" rx="1.5" ry="1.9"/><ellipse cx="19.1" cy="13" rx="1.5" ry="1.9"/><path d="M12 12.2c3 0 4.8 2.3 4.8 4.4S14.9 20 12 20s-4.8-1.3-4.8-3.4S9 12.2 12 12.2z"/>',
    nino:         '<circle cx="12" cy="6.5" r="2.6"/><path d="M12 9.1V16"/><path d="m8.5 12 7 0"/><path d="m9.5 20 2.5-4 2.5 4"/>',
    correo:       '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/>',
    check:        '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    alerta:       '<path d="M12 4.5 21 19.5H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',
    inbox:        '<path d="M4 13.5 6.5 5h11L20 13.5V19H4z"/><path d="M4 13.5h4l1.2 2.2h5.6L16 13.5h4"/>',
    cargando:     '<path d="M12 4.5v3.2"/><path d="M12 16.3v3.2"/><path d="m6.7 6.7 2.3 2.3"/><path d="m15 15 2.3 2.3"/><path d="M4.5 12h3.2"/><path d="M16.3 12h3.2"/><path d="m6.7 17.3 2.3-2.3"/><path d="m15 9 2.3-2.3"/>',
    expandir:     '<path d="M4.5 9V4.5H9"/><path d="M15 4.5h4.5V9"/><path d="M19.5 15v4.5H15"/><path d="M9 19.5H4.5V15"/>',
    'flecha-izq': '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    'flecha-der': '<path d="M9.5 5.5 16 12l-6.5 6.5"/>',
    filtro:       '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M10 18h4"/>',
    menu:         '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    ojo:          '<path d="M2.8 12S6.5 5.8 12 5.8 21.2 12 21.2 12 17.5 18.2 12 18.2 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="2.8"/>',
    'ojo-oculto': '<path d="M9.6 6.2A8.4 8.4 0 0 1 12 5.8c5.5 0 9.2 6.2 9.2 6.2a17 17 0 0 1-3 3.6"/><path d="M6.6 7.9A17 17 0 0 0 2.8 12S6.5 18.2 12 18.2c1.4 0 2.6-.3 3.7-.8"/><path d="M10 10a2.8 2.8 0 0 0 3.9 3.9"/><path d="m4.5 4.5 15 15"/>',
    escudo_admin: '<path d="M12 3.5 19 6v6c0 4-3 7.2-7 8.5-4-1.3-7-4.5-7-8.5V6z"/><path d="M12 9.5v5"/><path d="M9.5 12h5"/>',
});

/** La huella de marca es sólida: es el isotipo, no un icono de interfaz. */
const HUELLA = `
    <ellipse cx="7.6" cy="8" rx="2.1" ry="2.8"/>
    <ellipse cx="16.4" cy="8" rx="2.1" ry="2.8"/>
    <ellipse cx="3.6" cy="13.4" rx="1.9" ry="2.4"/>
    <ellipse cx="20.4" cy="13.4" rx="1.9" ry="2.4"/>
    <path d="M12 12.4c3.2 0 5.2 2.5 5.2 4.8S15 21 12 21s-5.2-1.5-5.2-3.8S8.8 12.4 12 12.4z"/>`;

/**
 * Devuelve el marcado SVG del icono pedido.
 * Un nombre desconocido cae en `info` en lugar de romper el render.
 *
 * @param {string} nombre  Clave del registro.
 * @param {number} tamano  16, 18, 20 o 24 (DESIGN_SYSTEM.md §4).
 */
function icono(nombre, tamano = 20) {
    if (nombre === 'huella' || nombre === 'huella-llena') {
        return `<svg class="icono icono-huella" viewBox="0 0 24 24" fill="currentColor"
                     width="${tamano}" height="${tamano}" aria-hidden="true">${HUELLA}</svg>`;
    }
    if (nombre === 'corazon-lleno') {
        return `<svg class="icono" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor"
                     stroke-width="1.5" stroke-linejoin="round"
                     width="${tamano}" height="${tamano}" aria-hidden="true">${TRAZOS.corazon}</svg>`;
    }

    const trazo = TRAZOS[nombre] ?? TRAZOS.info;
    // Los iconos pequeños necesitan algo más de trazo para no desaparecer.
    const grosor = tamano < 18 ? 1.75 : 1.5;

    return `<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="${grosor}" stroke-linecap="round" stroke-linejoin="round"
                 width="${tamano}" height="${tamano}" aria-hidden="true">${trazo}</svg>`;
}

/** Icono de especie para las tarjetas sin fotografía. */
function iconoEspecie(especie, tamano = 32) {
    const clave = String(especie ?? '').trim().toLowerCase();
    if (clave.startsWith('perr')) return icono('perro', tamano);
    if (clave.startsWith('gat'))  return icono('gato', tamano);
    return icono('patas', tamano);
}

/** Sustituye `<i data-icono="nombre">` por su SVG. Útil para el marcado estático. */
function hidratarIconos(raiz = document) {
    raiz.querySelectorAll('[data-icono]').forEach(el => {
        const tamano = Number(el.dataset.iconoTam) || 20;
        el.innerHTML = icono(el.dataset.icono, tamano);
    });
}
