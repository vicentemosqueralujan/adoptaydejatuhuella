// ==========================================================================
// Registro público, catálogo abierto, ficha detallada del animal y
// alta/edición con galería de fotografías.
//
// Se carga después de scripts.js y comparte su ámbito global: usa `estado`,
// `peticion`, `tienePermiso`, `abrirAcceso`, `recargarEntidad` e `iniciarPanel`,
// además de `icono()`, `esc()`, `toast()`, `botonCargando()` y `GaleriaFotos`.
// ==========================================================================

/**
 * Especies ofrecidas por defecto en el filtro y en el alta.
 *
 * Es una sugerencia, no una lista cerrada: el campo de especie es texto libre
 * con `datalist`, así que una protectora puede dar de alta un conejo o un ave
 * y esa especie aparece sola en el filtro en cuanto existe un animal.
 */
const ESPECIES_HABITUALES = ['Perro', 'Gato'];

// ==========================================
// PESTAÑAS DEL MODAL DE ACCESO
// ==========================================
const TABS_ACCESO = [
    { boton: 'tabAcceder',  panel: 'panelAcceder'  },
    { boton: 'tabRegistro', panel: 'panelRegistro' },
];

function activarPestanaAcceso(idBoton) {
    TABS_ACCESO.forEach(({ boton, panel }) => {
        const activo = boton === idBoton;
        const elBoton = document.getElementById(boton);
        const elPanel = document.getElementById(panel);
        if (!elBoton || !elPanel) return;

        elBoton.classList.toggle('is-active', activo);
        elBoton.setAttribute('aria-selected', String(activo));
        elPanel.hidden = !activo;
    });

    mostrarError('loginError', null);
    mostrarError('registroError', null);
}

/**
 * Rellena los desplegables del registro.
 *
 * Los catálogos de roles y protectoras son públicos, así que pueden pedirse
 * sin sesión. La promesa se memoriza para no repetir la petición al alternar
 * de pestaña.
 */
let promesaCatalogosRegistro = null;

function prepararRegistroPublico() {
    if (!promesaCatalogosRegistro) {
        promesaCatalogosRegistro = Promise.all([cargarCatalogoRoles(), cargarProtectoras()])
            .catch(e => {
                // Si falla, se reintenta en la siguiente apertura de la pestaña.
                promesaCatalogosRegistro = null;
                console.error('[prepararRegistroPublico]', e.message);
            });
    }
    return promesaCatalogosRegistro;
}

TABS_ACCESO.forEach(({ boton }) => {
    document.getElementById(boton)?.addEventListener('click', () => {
        activarPestanaAcceso(boton);
        if (boton === 'tabRegistro') prepararRegistroPublico();
    });
});

// ==========================================
// REGISTRO PÚBLICO
// ==========================================

/** El selector de protectora sólo aparece para los roles que la exigen. */
function sincronizarCampoProtectoraRegistro() {
    const select = document.getElementById('regTipo');
    const campo  = document.getElementById('regCampoProtectora');
    const ayuda  = document.getElementById('regAyuda');
    if (!select || !campo) return;

    const definicion = estado.roles.find(r => r.valor === select.value);
    campo.hidden = !definicion?.requiereProtectora;

    const selProtectora = document.getElementById('regProtectora');
    if (selProtectora) selProtectora.required = Boolean(definicion?.requiereProtectora);
    if (ayuda) ayuda.textContent = definicion?.descripcion ?? '';
}

document.getElementById('regTipo')?.addEventListener('change', sincronizarCampoProtectoraRegistro);

document.getElementById('panelRegistro')?.addEventListener('submit', async e => {
    e.preventDefault();
    mostrarError('registroError', null);

    const nombre     = document.getElementById('regNombre').value.trim();
    const email      = document.getElementById('regEmail').value.trim();
    const password   = document.getElementById('regPass').value;
    const tipo       = document.getElementById('regTipo').value;
    const protectora = document.getElementById('regProtectora').value;

    if (!nombre || !email || !password)
        return mostrarError('registroError', 'Rellena todos los campos');
    if (password.length < 8)
        return mostrarError('registroError', 'La contraseña debe tener al menos 8 caracteres');

    const definicion = estado.roles.find(r => r.valor === tipo);
    if (definicion?.requiereProtectora && !protectora)
        return mostrarError('registroError', 'Selecciona la protectora a la que perteneces');

    const restaurar = botonCargando(document.getElementById('btnRegistrar'), 'Creando cuenta…');

    try {
        const { ok, data } = await peticion('/api/usuarios', {
            method: 'POST',
            body: JSON.stringify({ nombre, email, password, tipo, id_protectora: protectora || null }),
        });

        if (!ok) return mostrarError('registroError', data?.error || 'No se pudo crear la cuenta');

        // Se precarga el acceso con los datos recién registrados.
        e.target.reset();
        sincronizarCampoProtectoraRegistro();
        activarPestanaAcceso('tabAcceder');
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPass').focus();

        toast('Cuenta creada, ya puedes entrar');
    } catch (error) {
        mostrarError('registroError', 'Error de red: ' + error.message);
    } finally {
        restaurar();
    }
});

// ==========================================
// PANEL DE ANIMALES SEGÚN ROL
// ==========================================

/**
 * Una protectora da de alta siempre en la suya: el selector sobra y el backend
 * ignoraría cualquier otro valor. Un Admin sí tiene que elegir destino.
 */
function configurarPanelAnimales() {
    const campo  = document.getElementById('campoProtectoraAnimal');
    const select = document.getElementById('a_protectora');
    const titulo = document.getElementById('tituloAnimales');

    const esProtectora = estado.sesion?.tipo === 'Protectora';

    if (campo)  campo.hidden = esProtectora;
    if (select) select.required = !esProtectora;

    if (titulo) {
        titulo.textContent = esProtectora && estado.sesion?.nombreProtectora
            ? `Animales de ${estado.sesion.nombreProtectora}`
            : 'Animales';
    }
}

// ==========================================
// CATÁLOGO DE ADOPCIÓN
// ==========================================
async function cargarCatalogo() {
    try {
        const { q, especie, provincia } = estado.filtroCatalogo;
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (especie) params.set('especie', especie);
        if (provincia) params.set('provincia', provincia);

        // El backend devuelve sólo los disponibles a quien no gestiona animales.
        const sufijo = params.toString() ? `?${params}` : '';
        const { ok, data } = await peticion(`/api/animales${sufijo}`);
        if (!ok) return;

        actualizarEstado({ catalogo: Array.isArray(data) ? data : [] });
        poblarFiltro('filtroEspecie', 'especie_animal', 'Todas las especies', ESPECIES_HABITUALES);
        poblarFiltro('filtroProvincia', 'provincia', 'Todas las provincias');
        renderCatalogo();
        renderFavoritos();
        actualizarContadorFavoritos();
    } catch (e) {
        console.error('[cargarCatalogo]', e.message);
    }
}

/**
 * Opciones del desplegable tomadas de los propios datos.
 *
 * `siempre` fuerza la presencia de unos valores aunque todavía no haya ningún
 * animal de ese tipo: perro y gato son las dos especies esperadas, pero la lista
 * no es cerrada — cualquier especie que una protectora dé de alta (conejo, ave…)
 * aparece aquí automáticamente.
 */
function poblarFiltro(idSelect, campo, textoVacio, siempre = []) {
    const select = document.getElementById(idSelect);
    if (!select) return;

    const delCatalogo = (estado.catalogo ?? []).map(a => a[campo]).filter(Boolean);

    // Sin distinguir mayúsculas: «perro» y «Perro» no deben duplicar la opción.
    const porClave = new Map();
    [...siempre, ...delCatalogo].forEach(v => {
        const clave = String(v).trim().toLowerCase();
        if (clave && !porClave.has(clave)) porClave.set(clave, String(v).trim());
    });

    const valores = [...porClave.values()].sort((a, b) => a.localeCompare(b, 'es'));

    const previo = select.value;
    select.innerHTML = `<option value="">${textoVacio}</option>` +
        valores.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
    select.value = valores.includes(previo) ? previo : '';
}

/** Filtro por protectora aplicado en cliente: los datos ya están cargados. */
function catalogoFiltrado() {
    const { protectora } = estado.filtroCatalogo;
    const animales = estado.catalogo ?? [];
    if (!protectora) return animales;
    return animales.filter(a => String(a.id_protectora) === String(protectora));
}

/**
 * Dibuja una tarjeta de animal. `noDisponible` marca los favoritos que ya no
 * aparecen en el catálogo (adoptados o retirados).
 */
function tarjetaAnimal(a, { noDisponible = false } = {}) {
    const favorito = esFavorito(a.id_animal);
    const fotos = fotosDe(a);
    const estadoClase = esc(String(a.estado ?? '').toLowerCase());

    const medio = fotos.length
        ? `<img src="${fotos[0]}" alt="Fotografía de ${esc(a.nombre_animal)}" loading="lazy">
           ${fotos.length > 1 ? `<span class="contador-fotos">${icono('camara', 14)}${fotos.length}</span>` : ''}`
        : iconoEspecie(a.especie_animal, 40);

    return `
        <article class="animal-card${noDisponible ? ' no-disponible' : ''}"
                 role="button" tabindex="0"
                 data-accion="ver-animal" data-id="${a.id_animal}"
                 aria-label="Ver la ficha de ${esc(a.nombre_animal)}">
            <div class="animal-figura">
                ${medio}
                <button type="button"
                        class="btn-favorito${favorito ? ' es-favorito' : ''}"
                        data-accion="favorito" data-id="${a.id_animal}"
                        aria-pressed="${favorito}"
                        title="${favorito ? 'Quitar de favoritos' : 'Añadir a favoritos'}"
                        aria-label="${favorito ? 'Quitar' : 'Añadir'} ${esc(a.nombre_animal)} de favoritos">
                    ${icono(favorito ? 'corazon-lleno' : 'corazon', 18)}
                </button>
            </div>
            <div class="animal-cuerpo">
                <h3>${esc(a.nombre_animal)}</h3>
                <p class="animal-meta">${esc(resumenAnimal(a))}</p>
                <div class="animal-pie">
                    <span class="badge badge-${estadoClase}">${esc(a.estado)}</span>
                    <span class="animal-protectora">
                        ${icono('casa', 14)}
                        <span>${a.nombre_protectora ? esc(a.nombre_protectora) : 'Sin protectora'}</span>
                    </span>
                </div>
            </div>
        </article>`;
}

function renderCatalogo() {
    const grid = document.getElementById('catalogoGrid');
    const contador = document.getElementById('catalogoContador');
    if (!grid) return;

    const animales = catalogoFiltrado();

    if (contador) {
        contador.textContent = animales.length === 1
            ? '1 animal esperando una familia'
            : `${animales.length} animales esperando una familia`;
    }

    grid.innerHTML = animales.length
        ? animales.map(a => tarjetaAnimal(a)).join('')
        : `<div class="estado-vacio">${icono('patas', 28)}
               <span>No hay animales que coincidan con tu búsqueda.</span>
           </div>`;
}

/** Pequeño debounce para no lanzar una petición por cada tecla. */
function conRetardo(fn, ms = 300) {
    let temporizador;
    return (...args) => {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => fn(...args), ms);
    };
}

const buscarEnCatalogo = conRetardo(() => cargarCatalogo());

document.getElementById('buscarCatalogo')?.addEventListener('input', e => {
    actualizarEstado({ filtroCatalogo: { ...estado.filtroCatalogo, q: e.target.value } });
    buscarEnCatalogo();
});

[['filtroEspecie', 'especie'], ['filtroProvincia', 'provincia']].forEach(([id, clave]) => {
    document.getElementById(id)?.addEventListener('change', e => {
        actualizarEstado({ filtroCatalogo: { ...estado.filtroCatalogo, [clave]: e.target.value } });
        cargarCatalogo();
    });
});

document.getElementById('filtroProtectoraCat')?.addEventListener('change', e => {
    actualizarEstado({ filtroCatalogo: { ...estado.filtroCatalogo, protectora: e.target.value } });
    renderCatalogo();
});

// ==========================================
// FAVORITOS DEL ADOPTANTE
// ==========================================

/**
 * Los favoritos se guardan en `localStorage`, con una clave por usuario, para
 * que dos cuentas en el mismo navegador no compartan lista. Es almacenamiento
 * local y temporal: no viaja al servidor ni sobrevive a un cambio de navegador.
 */
function claveFavoritos() {
    const id = estado.sesion?.id;
    return id ? `favoritos:${id}` : null;
}

function leerFavoritos() {
    const clave = claveFavoritos();
    if (!clave) return [];
    try {
        const crudo = JSON.parse(localStorage.getItem(clave) ?? '[]');
        return Array.isArray(crudo) ? crudo.map(Number).filter(Number.isInteger) : [];
    } catch {
        // Lista corrupta: se descarta en lugar de romper la vista.
        localStorage.removeItem(clave);
        return [];
    }
}

function guardarFavoritos(ids) {
    const clave = claveFavoritos();
    if (!clave) return;
    try {
        localStorage.setItem(clave, JSON.stringify(ids));
    } catch (e) {
        // Cuota llena o almacenamiento bloqueado (modo privado): se avisa sin romper.
        console.error('[guardarFavoritos]', e.message);
        toast('No se pudieron guardar los favoritos', 'error');
    }
}

function esFavorito(idAnimal) {
    return estado.favoritos?.includes(Number(idAnimal)) ?? false;
}

/** Alterna un animal en la lista y repinta lo que dependa de ella. */
function alternarFavorito(idAnimal) {
    const id = Number(idAnimal);
    const actuales = estado.favoritos ?? [];
    const favoritos = actuales.includes(id)
        ? actuales.filter(x => x !== id)
        : [...actuales, id];

    actualizarEstado({ favoritos });
    guardarFavoritos(favoritos);

    renderCatalogo();
    renderFavoritos();
    actualizarContadorFavoritos();

    // Si la ficha está abierta, su botón debe reflejar el cambio.
    if (modalFicha?.open) {
        const animal = (estado.catalogo ?? []).find(a => Number(a.id_animal) === id);
        if (animal) abrirFicha(animal);
    }
}

function actualizarContadorFavoritos() {
    const pill = document.getElementById('contadorFavoritos');
    if (pill) pill.textContent = String(estado.favoritos?.length ?? 0);
}

function renderFavoritos() {
    const grid = document.getElementById('favoritosGrid');
    const contador = document.getElementById('favoritosContador');
    if (!grid) return;

    const ids = estado.favoritos ?? [];
    const disponibles = estado.catalogo ?? [];

    // Un favorito puede haber sido adoptado o retirado: se indica en vez de
    // desaparecer sin explicación.
    const encontrados = ids
        .map(id => disponibles.find(a => Number(a.id_animal) === id))
        .filter(Boolean);
    const perdidos = ids.length - encontrados.length;

    if (contador) {
        contador.textContent = ids.length
            ? `${ids.length} guardado${ids.length === 1 ? '' : 's'}` +
              (perdidos ? ` · ${perdidos} ya no está${perdidos === 1 ? '' : 'n'} disponible${perdidos === 1 ? '' : 's'}` : '')
            : '';
    }

    grid.innerHTML = encontrados.length
        ? encontrados.map(a => tarjetaAnimal(a)).join('')
        : `<div class="estado-vacio">${icono('corazon', 28)}
               <span>${ids.length
                   ? 'Los animales que guardaste ya no están disponibles.'
                   : 'Todavía no has guardado ningún animal. Pulsa el corazón en el catálogo.'}</span>
           </div>`;
}

// El corazón se gestiona por delegación: las tarjetas se repintan constantemente.
document.addEventListener('click', e => {
    const boton = e.target.closest('[data-accion="favorito"]');
    if (!boton) return;

    e.preventDefault();
    e.stopPropagation();

    // Guardar favoritos exige identificarse: se abre el acceso, no un error.
    if (!haySesion()) {
        modalFicha?.close();
        return abrirAcceso('favorito');
    }

    alternarFavorito(boton.dataset.id);
});

// ==========================================
// PESTAÑAS CATÁLOGO / FAVORITOS
// ==========================================
const TABS_PANEL = [
    { boton: 'tabCatalogo',  panel: 'vistaCatalogo'  },
    { boton: 'tabFavoritos', panel: 'vistaFavoritos' },
];

function activarVista(idBoton) {
    TABS_PANEL.forEach(({ boton, panel }) => {
        const activo = boton === idBoton;
        const elBoton = document.getElementById(boton);
        const elPanel = document.getElementById(panel);
        if (!elBoton || !elPanel) return;

        elBoton.classList.toggle('is-active', activo);
        elBoton.setAttribute('aria-selected', String(activo));
        elPanel.hidden = !activo;
    });

    // Los filtros sólo aplican al catálogo, no a la lista de favoritos.
    const herramientas = document.getElementById('herramientasCatalogo');
    if (herramientas) herramientas.hidden = idBoton !== 'tabCatalogo';

    if (idBoton === 'tabFavoritos') renderFavoritos();
}

TABS_PANEL.forEach(({ boton }) => {
    document.getElementById(boton)?.addEventListener('click', () => activarVista(boton));
});

// ==========================================
// LISTADO DE GESTIÓN DE ANIMALES
// ==========================================
async function cargarAnimales() {
    try {
        // El backend acota por sí solo: una protectora recibe únicamente los suyos.
        const { ok, data } = await peticion('/api/animales');
        if (!ok) return;

        actualizarEstado({ animales: Array.isArray(data) ? data : [] });
        renderAnimales();
    } catch (e) {
        console.error('[cargarAnimales]', e.message);
    }
}

function renderAnimales() {
    const lista = document.getElementById('listaAnimales');
    if (!lista) return;

    if (!estado.animales.length) {
        lista.innerHTML = `<li class="estado-vacio">${icono('inbox', 24)}<span>Sin animales dados de alta</span></li>`;
        return;
    }

    lista.innerHTML = estado.animales.map(a => {
        const fotos = fotosDe(a);
        const detalleFotos = fotos.length
            ? ` · ${fotos.length} foto${fotos.length === 1 ? '' : 's'}`
            : ' · sin fotos';

        return `
        <li class="item-lista">
            <span class="item-lista-datos">
                ${iconoEspecie(a.especie_animal, 20)}
                <span class="item-lista-texto">
                    <strong>${esc(a.nombre_animal)}</strong>
                    <small>${esc(resumenAnimal(a))}${esc(detalleFotos)}</small>
                </span>
                <span class="badge badge-${esc(String(a.estado).toLowerCase())}">${esc(a.estado)}</span>
            </span>
            <span class="acciones-fila">
                <button type="button" class="btn-icono" title="Editar animal"
                        aria-label="Editar ${esc(a.nombre_animal)}"
                        data-accion="editar-animal" data-id="${a.id_animal}">
                    ${icono('editar', 18)}
                </button>
                <button type="button" class="btn-icono es-peligro" title="Eliminar"
                        aria-label="Eliminar ${esc(a.nombre_animal)}"
                        data-accion="eliminar" data-entidad="animales" data-id="${a.id_animal}">
                    ${icono('eliminar', 18)}
                </button>
            </span>
        </li>`;
    }).join('');
}

// ==========================================
// ALTA Y EDICIÓN DE ANIMAL
// ==========================================
const modalAnimal = document.getElementById('modalAnimal');

/** La galería se crea una sola vez y se rellena en cada apertura del modal. */
let galeriaAnimal = null;

function obtenerGaleria() {
    if (!galeriaAnimal) {
        const contenedor = document.getElementById('galeriaAnimal');
        if (contenedor) galeriaAnimal = new GaleriaFotos(contenedor);
    }
    return galeriaAnimal;
}

function valorCompatible(animal, clave) {
    const compatible = comoObjeto(animal?.compatible);
    return compatible?.[clave] ?? 'desconocido';
}

/** `null` cuando no hay animal: el mismo modal sirve para alta y edición. */
function abrirModalAnimal(animal = null) {
    if (!modalAnimal) return;

    const esEdicion = Boolean(animal);
    document.getElementById('modalAnimalTitulo').textContent = esEdicion ? 'Editar animal' : 'Nuevo animal';

    document.getElementById('a_id').value         = animal?.id_animal ?? '';
    document.getElementById('a_nombre').value     = animal?.nombre_animal ?? '';
    document.getElementById('a_especie').value    = animal?.especie_animal ?? '';
    document.getElementById('a_protectora').value = animal?.id_protectora ?? '';
    document.getElementById('a_sexo').value       = animal?.sexo ?? '';
    document.getElementById('a_tamano').value     = animal?.tamano ?? '';
    // El input date exige AAAA-MM-DD; la API puede devolver una marca temporal.
    document.getElementById('a_fechaNacimiento').value =
        String(animal?.fecha_nacimiento ?? '').slice(0, 10);
    document.getElementById('a_edad').value       = animal?.edad ?? '';
    document.getElementById('a_raza').value       = animal?.raza ?? '';
    document.getElementById('a_provincia').value  = animal?.provincia ?? '';
    document.getElementById('a_puedeViajar').checked = Boolean(animal?.puede_viajar);
    document.getElementById('a_estado').value     = animal?.estado ?? 'Disponible';
    document.getElementById('a_entrega').value    = animal?.entrega_condiciones ?? '';
    document.getElementById('a_info').value       = animal?.info_importante ?? '';
    document.getElementById('a_compPerros').value = valorCompatible(animal, 'perros');
    document.getElementById('a_compGatos').value  = valorCompatible(animal, 'gatos');
    document.getElementById('a_compNinos').value  = valorCompatible(animal, 'ninos');

    obtenerGaleria()?.establecer(animal ? fotosDe(animal) : []);

    mostrarError('modalAnimalError', null);
    configurarPanelAnimales();
    modalAnimal.showModal();
    document.getElementById('a_nombre').focus();
}

document.getElementById('btnNuevoAnimal')?.addEventListener('click', () => abrirModalAnimal());
document.getElementById('btnCerrarModalAnimal')?.addEventListener('click', () => modalAnimal?.close());
document.getElementById('btnCancelarModalAnimal')?.addEventListener('click', () => modalAnimal?.close());

/** Reúne el formulario completo: campos base más los cuatro bloques de la ficha. */
function cuerpoAnimal() {
    const valor = id => document.getElementById(id).value.trim();

    return {
        nombre:   valor('a_nombre'),
        especie:  valor('a_especie'),
        edad:     valor('a_edad') === '' ? null : valor('a_edad'),
        estado:   document.getElementById('a_estado').value,
        id_protectora: document.getElementById('a_protectora').value || null,

        sexo:             valor('a_sexo') || null,
        tamano:           valor('a_tamano') || null,
        fecha_nacimiento: valor('a_fechaNacimiento') || null,
        raza:             valor('a_raza') || null,
        provincia:        valor('a_provincia') || null,
        puede_viajar:     document.getElementById('a_puedeViajar').checked,

        entrega_condiciones: valor('a_entrega') || null,
        info_importante:     valor('a_info') || null,

        compatible: {
            perros: document.getElementById('a_compPerros').value,
            gatos:  document.getElementById('a_compGatos').value,
            ninos:  document.getElementById('a_compNinos').value,
        },

        fotos: obtenerGaleria()?.valor() ?? [],
    };
}

document.getElementById('formAnimal')?.addEventListener('submit', async e => {
    e.preventDefault();
    mostrarError('modalAnimalError', null);

    const id = document.getElementById('a_id').value;
    const cuerpo = cuerpoAnimal();

    if (!cuerpo.nombre || !cuerpo.especie)
        return mostrarError('modalAnimalError', 'Nombre y especie son obligatorios');

    // Edad y fecha de nacimiento no pueden contradecirse. La API repite esta
    // comprobación; aquí se detiene el envío antes de gastar una petición.
    const errorEdad = validarEdadYFecha(cuerpo.edad, cuerpo.fecha_nacimiento);
    if (errorEdad) return mostrarError('modalAnimalError', errorEdad);

    // El Admin elige destino; una protectora lo tiene impuesto por el backend.
    const esProtectora = estado.sesion?.tipo === 'Protectora';
    if (!id && !esProtectora && !cuerpo.id_protectora)
        return mostrarError('modalAnimalError', 'Selecciona la protectora del animal');

    const restaurar = botonCargando(document.getElementById('btnGuardarAnimal'));

    try {
        const { ok, data } = await peticion(
            id ? `/api/animales?id=${encodeURIComponent(id)}` : '/api/animales',
            { method: id ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) }
        );

        if (!ok) return mostrarError('modalAnimalError', data?.error || 'No se pudo guardar el animal');

        modalAnimal?.close();
        await recargarEntidad('animales');
        toast(id ? 'Animal actualizado' : 'Animal dado de alta');
    } catch (err) {
        mostrarError('modalAnimalError', 'Error de red: ' + err.message);
    } finally {
        restaurar();
    }
});

// ==========================================
// ARRANQUE
// ==========================================
hidratarIconos();

// Las sugerencias de especie salen de la misma lista que alimenta el filtro,
// para que no haya dos fuentes de verdad entre el HTML y el JavaScript.
const listaEspecies = document.getElementById('especiesSugeridas');
if (listaEspecies) {
    listaEspecies.innerHTML = ESPECIES_HABITUALES
        .map(e => `<option value="${esc(e)}"></option>`)
        .join('');
}

// Los iconos de los botones se inyectan aquí para no repetir marcado SVG en el
// HTML: el registro de DESIGN_SYSTEM.md §4 es la única fuente.
const ICONOS_BOTON = {
    btnMenu: 'menu',
    btnMiCuenta: 'usuario',
    btnLogout: 'salir',
    btnCerrarAcceso: 'cerrar',
    btnCerrarFicha: 'cerrar',
    btnCerrarModal: 'cerrar',
    btnCerrarModalAnimal: 'cerrar',
    btnCerrarModalPerfil: 'cerrar',
    togglePass: 'ojo',
};

Object.entries(ICONOS_BOTON).forEach(([id, nombre]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = icono(nombre, 18);
});

const sesionGuardada = leerSesion();
if (sesionGuardada) actualizarEstado({ sesion: sesionGuardada });

// El catálogo se carga siempre: con sesión o sin ella.
iniciarPanel();
