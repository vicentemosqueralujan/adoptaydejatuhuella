// ==========================================================================
// Registro público, catálogo de adopción y edición de animales.
//
// Se carga después de scripts.js y comparte su ámbito global: usa `estado`,
// `esc`, `peticion`, `tienePermiso`, `toast` e `iniciarPanel` de ese fichero.
// ==========================================================================

// ==========================================
// PESTAÑAS ACCEDER / CREAR CUENTA
// ==========================================
const TABS = [
    { boton: 'tabAcceder',  panel: 'panelAcceder'  },
    { boton: 'tabRegistro', panel: 'panelRegistro' },
];

function activarPestana(idBoton) {
    TABS.forEach(({ boton, panel }) => {
        const activo = boton === idBoton;
        const elBoton = document.getElementById(boton);
        const elPanel = document.getElementById(panel);
        if (!elBoton || !elPanel) return;

        elBoton.classList.toggle('is-active', activo);
        elBoton.setAttribute('aria-selected', String(activo));
        elPanel.hidden = !activo;
    });

    const error = document.getElementById('loginError');
    if (error) error.style.opacity = '0';
}

TABS.forEach(({ boton }) => {
    document.getElementById(boton)?.addEventListener('click', () => activarPestana(boton));
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

    const nombre     = document.getElementById('regNombre').value.trim();
    const email      = document.getElementById('regEmail').value.trim();
    const password   = document.getElementById('regPass').value;
    const tipo       = document.getElementById('regTipo').value;
    const protectora = document.getElementById('regProtectora').value;

    if (!nombre || !email || !password) return mostrarErrorLogin('Rellena todos los campos');
    if (password.length < 8) return mostrarErrorLogin('La contraseña debe tener al menos 8 caracteres');

    const definicion = estado.roles.find(r => r.valor === tipo);
    if (definicion?.requiereProtectora && !protectora)
        return mostrarErrorLogin('Selecciona la protectora a la que perteneces');

    const boton = document.getElementById('btnRegistrar');
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';

    try {
        const { ok, data } = await peticion('/api/usuarios', {
            method: 'POST',
            body: JSON.stringify({ nombre, email, password, tipo, id_protectora: protectora || null }),
        });

        if (!ok) throw new Error(data?.error || 'No se pudo crear la cuenta');

        await Swal.fire({
            title: '¡Cuenta creada!',
            text: 'Ya puedes acceder con tu correo y contraseña.',
            icon: 'success', timer: 1800, showConfirmButton: false, timerProgressBar: true,
        });

        // Se precarga el acceso con los datos recién registrados.
        e.target.reset();
        sincronizarCampoProtectoraRegistro();
        activarPestana('tabAcceder');
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginPass').focus();

    } catch (error) {
        mostrarErrorLogin(error.message);
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
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
    const select = document.getElementById('selectProtectora');
    const titulo = document.getElementById('tituloAnimales');
    if (!select) return;

    const esProtectora = estado.sesion?.tipo === 'Protectora';
    select.hidden = esProtectora;
    select.required = !esProtectora;

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
        const { q, especie } = estado.filtroCatalogo;
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (especie) params.set('especie', especie);

        // El backend devuelve sólo los disponibles a quien no gestiona animales.
        const sufijo = params.toString() ? `?${params}` : '';
        const { ok, data } = await peticion(`/api/animales${sufijo}`);
        if (!ok) return;

        actualizarEstado({ catalogo: Array.isArray(data) ? data : [] });
        poblarFiltroEspecies();
        renderCatalogo();
    } catch (e) {
        console.error('[cargarCatalogo]', e.message);
    }
}

/** Las especies del desplegable salen de los propios datos, sin lista fija. */
function poblarFiltroEspecies() {
    const select = document.getElementById('filtroEspecie');
    if (!select) return;

    const especies = [...new Set((estado.catalogo ?? []).map(a => a.especie_animal).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es'));

    const previo = select.value;
    select.innerHTML = '<option value="">Todas las especies</option>' +
        especies.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('');
    select.value = especies.includes(previo) ? previo : '';
}

/** Filtro por protectora aplicado en cliente: los datos ya están cargados. */
function catalogoFiltrado() {
    const { protectora } = estado.filtroCatalogo;
    const animales = estado.catalogo ?? [];
    if (!protectora) return animales;
    return animales.filter(a => String(a.id_protectora) === String(protectora));
}

const ICONOS_ESPECIE = {
    perro: 'fa-dog', perra: 'fa-dog',
    gato: 'fa-cat', gata: 'fa-cat',
    conejo: 'fa-carrot',
    ave: 'fa-dove', pajaro: 'fa-dove', 'pájaro': 'fa-dove',
    pez: 'fa-fish',
};

function iconoDeEspecie(especie) {
    const clave = String(especie ?? '').trim().toLowerCase();
    return ICONOS_ESPECIE[clave] ?? 'fa-paw';
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

    if (!animales.length) {
        grid.innerHTML = `
            <p class="catalogo-vacio">
                <i class="fa-solid fa-paw"></i>
                No hay animales que coincidan con tu búsqueda.
            </p>`;
        return;
    }

    grid.innerHTML = animales.map(a => `
        <article class="animal-card">
            <div class="animal-figura" aria-hidden="true">
                <i class="fa-solid ${iconoDeEspecie(a.especie_animal)}"></i>
            </div>
            <div class="animal-cuerpo">
                <h3>${esc(a.nombre_animal)}</h3>
                <div class="animal-meta">
                    <span>${esc(a.especie_animal)}</span>
                    ${a.edad !== null && a.edad !== undefined
                        ? `<span class="sep">·</span><span>${esc(a.edad)} ${a.edad === 1 ? 'año' : 'años'}</span>`
                        : ''}
                    <span class="badge badge-${esc(String(a.estado).toLowerCase())}">${esc(a.estado)}</span>
                </div>
                <p class="animal-protectora">
                    <i class="fa-solid fa-house-chimney"></i>
                    ${a.nombre_protectora ? esc(a.nombre_protectora) : 'Protectora sin asignar'}
                </p>
            </div>
        </article>`).join('');
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

document.getElementById('filtroEspecie')?.addEventListener('change', e => {
    actualizarEstado({ filtroCatalogo: { ...estado.filtroCatalogo, especie: e.target.value } });
    cargarCatalogo();
});

document.getElementById('filtroProtectoraCat')?.addEventListener('change', e => {
    actualizarEstado({ filtroCatalogo: { ...estado.filtroCatalogo, protectora: e.target.value } });
    renderCatalogo();
});

// ==========================================
// MODAL DE EDICIÓN DE ANIMAL
// ==========================================
const modalAnimal = document.getElementById('modalAnimal');

function abrirModalAnimal(animal) {
    if (!modalAnimal) return;

    document.getElementById('a_id').value      = animal.id_animal;
    document.getElementById('a_nombre').value  = animal.nombre_animal ?? '';
    document.getElementById('a_especie').value = animal.especie_animal ?? '';
    document.getElementById('a_edad').value    = animal.edad ?? '';
    document.getElementById('a_estado').value  = animal.estado ?? 'Disponible';

    const error = document.getElementById('modalAnimalError');
    if (error) { error.hidden = true; error.textContent = ''; }

    modalAnimal.showModal();
    document.getElementById('a_nombre').focus();
}

function cerrarModalAnimal() {
    modalAnimal?.close();
}

document.getElementById('btnCerrarModalAnimal')?.addEventListener('click', cerrarModalAnimal);
document.getElementById('btnCancelarModalAnimal')?.addEventListener('click', cerrarModalAnimal);

document.getElementById('formAnimalEditar')?.addEventListener('submit', async e => {
    e.preventDefault();

    const error = document.getElementById('modalAnimalError');
    const fallar = mensaje => { if (error) { error.textContent = mensaje; error.hidden = false; } };
    if (error) error.hidden = true;

    const id      = document.getElementById('a_id').value;
    const nombre  = document.getElementById('a_nombre').value.trim();
    const especie = document.getElementById('a_especie').value.trim();
    const edad    = document.getElementById('a_edad').value;
    const estadoAnimal = document.getElementById('a_estado').value;

    if (!nombre || !especie) return fallar('Nombre y especie son obligatorios');

    const boton = document.getElementById('btnGuardarAnimal');
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const { ok, data } = await peticion(`/api/animales?id=${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ nombre, especie, edad: edad === '' ? null : edad, estado: estadoAnimal }),
        });

        if (!ok) return fallar(data?.error || 'No se pudo actualizar el animal');

        cerrarModalAnimal();
        await recargarEntidad('animales');
        toast('¡Animal actualizado!');
    } catch (err) {
        fallar('Error de red: ' + err.message);
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
});

// ==========================================
// ARRANQUE
// ==========================================
const sesionGuardada = leerSesion();
if (sesionGuardada) {
    actualizarEstado({ sesion: sesionGuardada });
    if (loginOverlay) loginOverlay.style.display = 'none';
    iniciarPanel();
}
