// ==========================================================================
// Ficha detallada del animal: formato de los datos y los cuatro bloques que
// fija DESIGN_SYSTEM.md §5.3 («Mis datos», «Me entregan», «Tienes que saber
// que» y «Compatible»), más la galería y la solicitud de adopción.
//
// Se carga antes que scripts.js y registro-catalogo.js; sus funciones se
// invocan siempre desde manejadores, cuando el resto del código ya existe.
// ==========================================================================
// ==========================================
// FORMATO DE LOS DATOS DE LA FICHA
// ==========================================

const MESES_POR_ANO = 12;

/** Edad legible a partir de la fecha de nacimiento, o de la edad en años. */
function edadLegible(animal) {
    if (animal.fecha_nacimiento) {
        const nacimiento = new Date(animal.fecha_nacimiento);
        if (!Number.isNaN(nacimiento.getTime())) {
            const hoy = new Date();
            let meses = (hoy.getFullYear() - nacimiento.getFullYear()) * MESES_POR_ANO
                      + (hoy.getMonth() - nacimiento.getMonth());
            if (hoy.getDate() < nacimiento.getDate()) meses -= 1;
            meses = Math.max(0, meses);

            if (meses < MESES_POR_ANO) return `${meses} ${meses === 1 ? 'mes' : 'meses'}`;

            const anos = Math.floor(meses / MESES_POR_ANO);
            const resto = meses % MESES_POR_ANO;
            return `${anos} ${anos === 1 ? 'año' : 'años'}` +
                   (resto ? ` y ${resto} ${resto === 1 ? 'mes' : 'meses'}` : '');
        }
    }

    if (animal.edad !== null && animal.edad !== undefined)
        return `${animal.edad} ${Number(animal.edad) === 1 ? 'año' : 'años'}`;

    return null;
}

/** Fecha en formato largo español, o `null` si no la hay. */
function fechaLegible(valor) {
    if (!valor) return null;
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** La API puede devolver JSONB ya convertido o como texto, según el driver. */
function comoObjeto(valor) {
    if (!valor) return null;
    if (typeof valor === 'object') return valor;
    try { return JSON.parse(valor); } catch { return null; }
}

function fotosDe(animal) {
    const fotos = comoObjeto(animal.fotos);
    return Array.isArray(fotos) ? fotos.filter(f => typeof f === 'string' && f.startsWith('data:image')) : [];
}

/** Línea de resumen: raza y provincia son lo que primero busca un adoptante. */
function resumenAnimal(animal) {
    return [animal.raza, animal.provincia, edadLegible(animal)].filter(Boolean).join(' · ')
        || animal.especie_animal;
}

// ==========================================
// FICHA DETALLADA (4 bloques — DESIGN_SYSTEM.md §5.3)
// ==========================================
const modalFicha = document.getElementById('modalFicha');

const ETIQUETAS_COMPATIBLE = { perros: 'Perros', gatos: 'Gatos', ninos: 'Niños' };
const TEXTO_COMPATIBLE = { si: 'Sí', no: 'No', desconocido: 'Sin determinar' };

/** Un bloque sin datos no se pinta: nada de secciones vacías ni guiones. */
function bloqueFicha(titulo, contenido) {
    return contenido ? `<section class="ficha-bloque"><h4>${esc(titulo)}</h4>${contenido}</section>` : '';
}

function dato(iconoNombre, etiqueta, valor) {
    if (!valor) return '';
    return `
        <div class="ficha-dato">
            ${icono(iconoNombre, 18)}
            <dl class="ficha-dato-texto">
                <dt>${esc(etiqueta)}</dt>
                <dd>${esc(valor)}</dd>
            </dl>
        </div>`;
}

/** Bloque 1 — «Mis datos». */
function bloqueMisDatos(a) {
    const viajar = a.puede_viajar === null || a.puede_viajar === undefined
        ? null
        : (a.puede_viajar ? 'Sí, puede viajar' : 'No viaja fuera de su provincia');

    const datos = [
        dato('sexo', 'Sexo', a.sexo),
        dato('regla', 'Tamaño', a.tamano),
        dato('calendario', 'Fecha de nacimiento', fechaLegible(a.fecha_nacimiento)),
        dato('patas', 'Edad', edadLegible(a)),
        dato('escudo', 'Raza', a.raza),
        dato('mapa', 'Provincia', a.provincia),
        dato('avion', 'Viaje', viajar),
    ].join('');

    return datos ? bloqueFicha('Mis datos', `<div class="ficha-datos">${datos}</div>`) : '';
}

/** Bloque 2 — «Me entregan»: una condición por línea. */
function bloqueEntrega(a) {
    const lineas = String(a.entrega_condiciones ?? '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    if (!lineas.length) return '';

    return bloqueFicha('Me entregan', `
        <ul class="ficha-lista">
            ${lineas.map(l => `<li>${icono('check', 16)}<span>${esc(l)}</span></li>`).join('')}
        </ul>`);
}

/** Bloque 3 — «Tienes que saber que». */
function bloqueInfo(a) {
    const texto = String(a.info_importante ?? '').trim();
    return texto ? bloqueFicha('Tienes que saber que', `<p class="ficha-texto">${esc(texto)}</p>`) : '';
}

/** Bloque 4 — «Compatible». */
function bloqueCompatible(a) {
    const compatible = comoObjeto(a.compatible);
    if (!compatible) return '';

    const chips = Object.entries(ETIQUETAS_COMPATIBLE)
        .filter(([clave]) => compatible[clave])
        .map(([clave, etiqueta]) => {
            const valor = compatible[clave];
            const iconoChip = clave === 'ninos' ? 'nino' : clave === 'gatos' ? 'gato' : 'perro';
            return `<span class="chip chip-${esc(valor)}">
                        ${icono(iconoChip, 18)}
                        ${esc(etiqueta)}: ${esc(TEXTO_COMPATIBLE[valor] ?? valor)}
                    </span>`;
        }).join('');

    return chips ? bloqueFicha('Compatible', `<div class="ficha-chips">${chips}</div>`) : '';
}

function galeriaFicha(a) {
    const fotos = fotosDe(a);

    const principal = fotos.length
        ? `<img src="${fotos[0]}" alt="Fotografía de ${esc(a.nombre_animal)}" id="fichaFotoPrincipal">`
        : iconoEspecie(a.especie_animal, 64);

    const miniaturas = fotos.length > 1
        ? `<div class="ficha-miniaturas">
               ${fotos.map((f, i) => `
                   <button type="button" class="ficha-miniatura${i === 0 ? ' is-active' : ''}"
                           data-accion="ficha-foto" data-src="${f}"
                           aria-label="Ver la fotografía ${i + 1}">
                       <img src="${f}" alt="" loading="lazy">
                   </button>`).join('')}
           </div>`
        : '';

    return `
        <div class="ficha-galeria">
            <div class="ficha-principal">${principal}</div>
            ${miniaturas}
        </div>`;
}

function abrirFicha(animal) {
    if (!modalFicha || !animal) return;

    document.getElementById('fichaTitulo').textContent = `Ficha de ${animal.nombre_animal}`;

    const favorito = esFavorito(animal.id_animal);
    const estadoClase = esc(String(animal.estado ?? '').toLowerCase());

    document.getElementById('fichaCuerpo').innerHTML = `
        ${galeriaFicha(animal)}
        <div class="ficha-datos-col">
            <header class="ficha-titular">
                <h3>${esc(animal.nombre_animal)}</h3>
                <p class="ficha-titular-meta">
                    <span class="badge badge-${estadoClase}">${esc(animal.estado)}</span>
                    <span>${esc(animal.especie_animal)}</span>
                    ${animal.nombre_protectora ? `<span>· ${esc(animal.nombre_protectora)}</span>` : ''}
                </p>
            </header>

            ${bloqueMisDatos(animal)}
            ${bloqueEntrega(animal)}
            ${bloqueInfo(animal)}
            ${bloqueCompatible(animal)}

            <div class="ficha-acciones">
                <button type="button" class="btn-primario" data-accion="solicitar" data-id="${animal.id_animal}">
                    Solicitar adopción
                </button>
                <button type="button" class="btn-secundario" data-accion="favorito" data-id="${animal.id_animal}">
                    ${icono(favorito ? 'corazon-lleno' : 'corazon', 18)}
                    ${favorito ? 'En favoritos' : 'Guardar'}
                </button>
            </div>
        </div>`;

    if (!modalFicha.open) modalFicha.showModal();
}

document.getElementById('btnCerrarFicha')?.addEventListener('click', () => modalFicha?.close());

// Cambio de fotografía principal dentro de la ficha.
document.addEventListener('click', e => {
    const boton = e.target.closest('[data-accion="ficha-foto"]');
    if (!boton) return;

    const principal = document.getElementById('fichaFotoPrincipal');
    if (principal) principal.src = boton.dataset.src;

    document.querySelectorAll('.ficha-miniatura').forEach(m => m.classList.remove('is-active'));
    boton.classList.add('is-active');
});

// Apertura de la ficha desde la tarjeta, por ratón y por teclado.
document.addEventListener('click', e => {
    // El corazón vive dentro de la tarjeta: no debe abrir la ficha.
    if (e.target.closest('[data-accion="favorito"]')) return;

    const tarjeta = e.target.closest('[data-accion="ver-animal"]');
    if (!tarjeta) return;

    const animal = (estado.catalogo ?? []).find(a => String(a.id_animal) === String(tarjeta.dataset.id));
    if (animal) abrirFicha(animal);
});

document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;

    const tarjeta = e.target.closest?.('[data-accion="ver-animal"]');
    if (!tarjeta) return;

    e.preventDefault();
    const animal = (estado.catalogo ?? []).find(a => String(a.id_animal) === String(tarjeta.dataset.id));
    if (animal) abrirFicha(animal);
});

// ==========================================
// SOLICITUD DE ADOPCIÓN
// ==========================================
document.addEventListener('click', async e => {
    const boton = e.target.closest('[data-accion="solicitar"]');
    if (!boton) return;

    // Sin sesión, la solicitud abre el acceso en lugar de fallar en silencio.
    if (!haySesion()) {
        modalFicha?.close();
        return abrirAcceso('adopcion');
    }

    const animal = (estado.catalogo ?? []).find(a => String(a.id_animal) === String(boton.dataset.id));

    await aviso('Solicitud registrada',
        `Hemos anotado tu interés por <strong>${esc(animal?.nombre_animal ?? 'este animal')}</strong>. ` +
        'La protectora se pondrá en contacto contigo por correo electrónico.');
});
