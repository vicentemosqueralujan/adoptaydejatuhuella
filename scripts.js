// ==========================================================================
// Núcleo de la aplicación: sesión, permisos, acceso a la API, protectoras,
// usuarios y perfil.
//
// Se carga después de js/icons.js y js/ui.js, de los que usa `icono()`,
// `esc()`, `toast()`, `confirmar()`, `pedirTexto()` y `botonCargando()`.
// registro-catalogo.js se carga después y completa el catálogo y la ficha.
// ==========================================================================

const CLAVE_SESION = 'adminSession';

/** Estado en memoria. Se reemplaza entero en cada cambio, nunca se muta. */
let estado = {
    sesion: null,
    roles: [],
    rolPorDefecto: 'Adoptante',
    protectoras: [],
    usuarios: [],
    animales: [],
    catalogo: [],
    favoritos: [],
    filtroUsuarios: '',
    filtroCatalogo: { q: '', especie: '', provincia: '', protectora: '' },
};

function actualizarEstado(cambios) {
    estado = { ...estado, ...cambios };
}

function leerSesion() {
    try {
        const crudo = localStorage.getItem(CLAVE_SESION);
        return crudo ? JSON.parse(crudo) : null;
    } catch {
        // Sesión corrupta: se descarta en lugar de romper el arranque.
        localStorage.removeItem(CLAVE_SESION);
        return null;
    }
}

function haySesion() {
    return Boolean(estado.sesion);
}

function tienePermiso(permiso) {
    return Array.isArray(estado.sesion?.permisos) && estado.sesion.permisos.includes(permiso);
}

// ==========================================
// UTILIDADES
// ==========================================

function iniciales(nombre) {
    return String(nombre ?? '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(p => p[0] ?? '')
        .join('')
        .toUpperCase() || '?';
}

/** Envuelve fetch devolviendo siempre `{ ok, status, data }` sin lanzar por HTTP. */
async function peticion(url, opciones = {}) {
    const cabeceras = { ...opciones.headers };
    if (opciones.body) cabeceras['Content-Type'] = 'application/json';
    // Identifica al solicitante ante la API (ver la limitación anotada en api/_auth.js).
    if (estado.sesion?.id) cabeceras['X-Usuario-Id'] = String(estado.sesion.id);

    const res = await fetch(url, { ...opciones, headers: cabeceras });

    let data = null;
    try { data = await res.json(); } catch { /* respuesta sin cuerpo */ }

    return { ok: res.ok, status: res.status, data };
}

/** Muestra u oculta un mensaje de error dentro de un contenedor con `role="alert"`. */
function mostrarError(id, mensaje) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = mensaje ?? '';
    el.hidden = !mensaje;
}

// ==========================================
// VISIBILIDAD SEGÚN ROL
// ==========================================

/**
 * Ajusta la interfaz al rol activo.
 *
 * El catálogo queda siempre visible: es público. Lo que cambia es la cabecera
 * (accesos frente a identidad) y los bloques de gestión, que sólo aparecen
 * para quien tiene el permiso correspondiente.
 */
function aplicarPermisos() {
    document.querySelectorAll('[data-permiso]').forEach(el => {
        el.hidden = !tienePermiso(el.dataset.permiso);
    });

    const sesion = estado.sesion;
    const conSesion = Boolean(sesion);

    // Accesos públicos frente a identidad de la sesión.
    ['btnAccesoProtectoras', 'btnAccesoAdmin', 'btnAcceder'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = conSesion;
    });
    ['btnMiCuenta', 'btnLogout', 'sesionChip'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.hidden = !conSesion;
    });

    // «Mis favoritos» es una pestaña de usuario identificado.
    const tabFavoritos = document.getElementById('tabFavoritos');
    if (tabFavoritos) {
        tabFavoritos.hidden = !conSesion;
        // Al cerrar sesión la pestaña activa podría ser la de favoritos, que
        // acaba de desaparecer: se vuelve al catálogo para no dejar vacío el panel.
        if (!conSesion && tabFavoritos.classList.contains('is-active')) activarVista('tabCatalogo');
    }

    if (!conSesion) return;

    document.getElementById('sesionNombre').textContent = sesion.nombre ?? '';
    document.getElementById('sesionAvatar').textContent = iniciales(sesion.nombre);

    const rol = document.getElementById('sesionRol');
    rol.textContent = sesion.etiquetaRol ?? sesion.tipo ?? '';
    rol.className = `badge badge-${String(sesion.tipo ?? '').toLowerCase()}`;
}

// ==========================================
// MODAL DE ACCESO
// ==========================================
const modalAcceso = document.getElementById('modalAcceso');

const MENSAJES_ACCESO = {
    Admin:      'Acceso reservado a la administración de la plataforma.',
    Protectora: 'Entra con la cuenta de tu protectora para gestionar tus animales.',
    favorito:   'Crea tu cuenta para guardar animales en favoritos.',
    adopcion:   'Necesitas una cuenta de adoptante para solicitar una adopción.',
    general:    'Entra con tu cuenta o crea una nueva.',
};

/**
 * Abre el acceso con un mensaje acorde al motivo.
 * @param {'Admin'|'Protectora'|'favorito'|'adopcion'|'general'} motivo
 */
function abrirAcceso(motivo = 'general') {
    if (!modalAcceso) return;

    document.getElementById('accesoMensaje').textContent =
        MENSAJES_ACCESO[motivo] ?? MENSAJES_ACCESO.general;

    // Quien viene de favoritos o de una solicitud es un adoptante: se le ofrece
    // directamente el registro, que es lo que le falta.
    const pestana = ['favorito', 'adopcion'].includes(motivo) ? 'tabRegistro' : 'tabAcceder';
    activarPestanaAcceso(pestana);
    if (pestana === 'tabRegistro') prepararRegistroPublico();

    mostrarError('loginError', null);
    mostrarError('registroError', null);

    modalAcceso.showModal();
    document.getElementById(pestana === 'tabRegistro' ? 'regNombre' : 'loginEmail').focus();
}

function cerrarAcceso() {
    modalAcceso?.close();
}

document.getElementById('btnAcceder')?.addEventListener('click', () => abrirAcceso('general'));
document.getElementById('btnCerrarAcceso')?.addEventListener('click', cerrarAcceso);

document.querySelectorAll('[data-acceso]').forEach(boton => {
    boton.addEventListener('click', () => abrirAcceso(boton.dataset.acceso));
});

document.getElementById('btnInicio')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ==========================================
// LOGIN
// ==========================================
document.getElementById('togglePass')?.addEventListener('click', () => {
    const input = document.getElementById('loginPass');
    const boton = document.getElementById('togglePass');
    const oculta = input.type === 'password';
    input.type = oculta ? 'text' : 'password';
    boton.innerHTML = icono(oculta ? 'ojo-oculto' : 'ojo', 18);
    boton.setAttribute('aria-pressed', String(oculta));
});

document.getElementById('panelAcceder')?.addEventListener('submit', async e => {
    e.preventDefault();
    mostrarError('loginError', null);

    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value;

    if (!email || !pass) return mostrarError('loginError', 'Rellena todos los campos');

    const restaurar = botonCargando(document.getElementById('btnEntrar'), 'Verificando…');

    try {
        const { ok, data } = await peticion('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password: pass }),
        });

        if (!ok || !data?.success)
            return mostrarError('loginError', data?.message || 'Credenciales incorrectas');

        // La respuesta del login ya trae rol, protectora y permisos: el panel se
        // puede renderizar sin una segunda petición.
        localStorage.setItem(CLAVE_SESION, JSON.stringify(data.user));
        actualizarEstado({ sesion: data.user });

        cerrarAcceso();
        e.target.reset();
        toast(`Hola de nuevo, ${data.user.nombre}`);
        await iniciarPanel();
    } catch (error) {
        mostrarError('loginError', 'Error de red: ' + error.message);
    } finally {
        restaurar();
    }
});

document.getElementById('btnLogout')?.addEventListener('click', async () => {
    const salir = await confirmar({
        titulo: '¿Cerrar sesión?',
        mensaje: 'Volverás al catálogo público. Tus favoritos se conservan en este navegador.',
        confirmar: 'Cerrar sesión',
    });
    if (!salir) return;

    localStorage.removeItem(CLAVE_SESION);
    actualizarEstado({ sesion: null, usuarios: [], animales: [], favoritos: [] });
    aplicarPermisos();
    await iniciarPanel();
    toast('Sesión cerrada', 'info');
});

// ==========================================
// ARRANQUE
// ==========================================

/**
 * Pinta lo que corresponde al estado actual de sesión.
 *
 * Se invoca también sin sesión: el catálogo y las protectoras son públicos y
 * deben cargarse igualmente.
 */
async function iniciarPanel() {
    aplicarPermisos();
    configurarPanelAnimales();

    await Promise.all([cargarCatalogoRoles(), cargarProtectoras()]);

    // Los favoritos son locales: se leen antes de pintar para que los corazones
    // salgan ya marcados en el primer render del catálogo.
    actualizarEstado({ favoritos: leerFavoritos() });
    actualizarContadorFavoritos();

    // Cada rol carga sólo lo que puede ver: el adoptante no pide el listado de
    // gestión y la protectora no pide el de usuarios.
    await Promise.all([
        cargarCatalogo(),
        tienePermiso('usuarios:gestionar') ? cargarUsuarios() : Promise.resolve(),
        tienePermiso('animales:gestionar') ? cargarAnimales() : Promise.resolve(),
    ]);
}

async function cargarCatalogoRoles() {
    try {
        const { ok, data } = await peticion('/api/roles');
        if (!ok) return;

        actualizarEstado({ roles: data.roles ?? [], rolPorDefecto: data.porDefecto ?? 'Adoptante' });

        const select = document.getElementById('u_tipo');
        if (select) {
            // El desplegable se construye desde la API: añadir un rol en el backend
            // lo hace aparecer aquí sin tocar el frontend.
            select.innerHTML = estado.roles
                .map(r => `<option value="${esc(r.valor)}">${esc(r.etiqueta)}</option>`)
                .join('');
            select.value = estado.rolPorDefecto;
            sincronizarCampoProtectora();
        }

        // El registro público sólo ofrece los roles marcados con `autoRegistro`:
        // `Admin` queda excluido en origen, no por una lista repetida en el cliente.
        const selectRegistro = document.getElementById('regTipo');
        if (selectRegistro) {
            const publicos = estado.roles.filter(r => r.autoRegistro);

            selectRegistro.innerHTML = publicos.length
                ? publicos.map(r => `<option value="${esc(r.valor)}">${esc(r.etiqueta)}</option>`).join('')
                : '<option value="" disabled selected>No se pudieron cargar los roles</option>';

            if (publicos.some(r => r.valor === estado.rolPorDefecto))
                selectRegistro.value = estado.rolPorDefecto;

            sincronizarCampoProtectoraRegistro();
        }
    } catch (e) {
        console.error('[cargarCatalogoRoles]', e.message);
    }
}

// ==========================================
// PROTECTORAS
// ==========================================
async function cargarProtectoras() {
    try {
        const { ok, data } = await peticion('/api/protectoras');
        if (!ok) return;

        const protectoras = Array.isArray(data) ? data : [];
        actualizarEstado({ protectoras });

        renderProtectoras();

        const opciones = protectoras
            .map(p => `<option value="${p.id_protectora}">${esc(p.nombre_protectora)}</option>`)
            .join('');

        [['a_protectora', '— Selecciona protectora —'],
         ['u_protectora', '— Selecciona protectora —'],
         ['regProtectora', '— Selecciona tu protectora —'],
         ['filtroProtectoraCat', 'Todas las protectoras']].forEach(([id, vacio]) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const previo = sel.value;
            sel.innerHTML = `<option value="">${vacio}</option>` + opciones;
            sel.value = previo;
        });
    } catch (e) {
        console.error('[cargarProtectoras]', e.message);
    }
}

function renderProtectoras() {
    const lista = document.getElementById('listaProtectoras');
    if (!lista) return;

    if (!estado.protectoras.length) {
        lista.innerHTML = `<li class="estado-vacio">${icono('inbox', 24)}<span>Sin protectoras registradas</span></li>`;
        return;
    }

    lista.innerHTML = estado.protectoras.map(p => `
        <li class="item-lista">
            <span class="item-lista-datos">
                ${icono('casa', 20)}
                <span class="item-lista-texto">
                    <strong>${esc(p.nombre_protectora)}</strong>
                    ${p.ubicacion ? `<small>${esc(p.ubicacion)}</small>` : ''}
                </span>
            </span>
            <span class="acciones-fila">
                <button type="button" class="btn-icono" title="Editar" aria-label="Editar ${esc(p.nombre_protectora)}"
                        data-accion="editar" data-entidad="protectoras"
                        data-id="${p.id_protectora}" data-nombre="${esc(p.nombre_protectora)}">
                    ${icono('editar', 18)}
                </button>
                <button type="button" class="btn-icono es-peligro" title="Eliminar"
                        aria-label="Eliminar ${esc(p.nombre_protectora)}"
                        data-accion="eliminar" data-entidad="protectoras" data-id="${p.id_protectora}">
                    ${icono('eliminar', 18)}
                </button>
            </span>
        </li>`).join('');
}

// ==========================================
// USUARIOS — TABLA DE GESTIÓN
// ==========================================
async function cargarUsuarios() {
    try {
        const { ok, data } = await peticion('/api/usuarios');
        if (!ok) return;

        actualizarEstado({ usuarios: Array.isArray(data) ? data : [] });
        renderUsuarios();
    } catch (e) {
        console.error('[cargarUsuarios]', e.message);
    }
}

function usuariosFiltrados() {
    const q = estado.filtroUsuarios.trim().toLowerCase();
    if (!q) return estado.usuarios;

    return estado.usuarios.filter(u =>
        [u.nombre_usuario, u.email, u.tipo_usuario, u.nombre_protectora]
            .some(campo => String(campo ?? '').toLowerCase().includes(q))
    );
}

function renderUsuarios() {
    const tbody = document.getElementById('tbodyUsuarios');
    if (!tbody) return;

    const filas = usuariosFiltrados();

    if (!filas.length) {
        const mensaje = estado.filtroUsuarios ? 'Ningún usuario coincide con la búsqueda' : 'Sin usuarios registrados';
        tbody.innerHTML = `
            <tr class="fila-vacia">
                <td colspan="5"><div class="estado-vacio">${icono('inbox', 24)}<span>${esc(mensaje)}</span></div></td>
            </tr>`;
        return;
    }

    tbody.innerHTML = filas.map(u => `
        <tr>
            <td>
                <div class="celda-usuario">
                    <span class="avatar" aria-hidden="true">${esc(iniciales(u.nombre_usuario))}</span>
                    <b>${esc(u.nombre_usuario)}</b>
                </div>
            </td>
            <td class="celda-email">${esc(u.email)}</td>
            <td><span class="badge badge-${esc(String(u.tipo_usuario).toLowerCase())}">${esc(u.tipo_usuario)}</span></td>
            <td>${u.nombre_protectora
                ? esc(u.nombre_protectora)
                : '<span class="sin-asignar">Sin asignar</span>'}</td>
            <td class="col-acciones">
                <div class="acciones-fila">
                    <button type="button" class="btn-icono" title="Editar usuario"
                            aria-label="Editar ${esc(u.nombre_usuario)}"
                            data-accion="editar-usuario" data-id="${u.id_usuario}">
                        ${icono('editar', 18)}
                    </button>
                    <button type="button" class="btn-icono es-peligro" title="Eliminar usuario"
                            aria-label="Eliminar ${esc(u.nombre_usuario)}"
                            data-accion="eliminar" data-entidad="usuarios" data-id="${u.id_usuario}">
                        ${icono('eliminar', 18)}
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

document.getElementById('buscarUsuario')?.addEventListener('input', e => {
    actualizarEstado({ filtroUsuarios: e.target.value });
    renderUsuarios();
});

// ==========================================
// MODAL DE ALTA / EDICIÓN DE USUARIO
// ==========================================
const modalUsuario = document.getElementById('modalUsuario');

/** Muestra el selector de protectora solo para los roles que la exigen. */
function sincronizarCampoProtectora() {
    const select = document.getElementById('u_tipo');
    const campo  = document.getElementById('campoProtectora');
    const ayuda  = document.getElementById('u_rolDesc');
    if (!select || !campo) return;

    const definicion = estado.roles.find(r => r.valor === select.value);
    campo.hidden = !definicion?.requiereProtectora;
    document.getElementById('u_protectora').required = Boolean(definicion?.requiereProtectora);
    if (ayuda) ayuda.textContent = definicion?.descripcion ?? '';
}

document.getElementById('u_tipo')?.addEventListener('change', sincronizarCampoProtectora);

function abrirModalUsuario(usuario = null) {
    if (!modalUsuario) return;

    const esEdicion = Boolean(usuario);
    document.getElementById('modalUsuarioTitulo').textContent = esEdicion ? 'Editar usuario' : 'Nuevo usuario';
    document.getElementById('u_id').value       = usuario?.id_usuario ?? '';
    document.getElementById('u_nombre').value   = usuario?.nombre_usuario ?? '';
    document.getElementById('u_email').value    = usuario?.email ?? '';
    document.getElementById('u_password').value = '';
    document.getElementById('u_tipo').value     = usuario?.tipo_usuario ?? estado.rolPorDefecto;
    document.getElementById('u_protectora').value = usuario?.id_protectora ?? '';

    // En alta, sin contraseña se genera una temporal; en edición se deja en blanco
    // para no modificar la existente.
    document.getElementById('u_passHint').textContent = esEdicion
        ? '(déjalo en blanco para mantener la actual)'
        : '(mínimo 8 caracteres; en blanco genera una temporal)';

    mostrarError('modalError', null);
    sincronizarCampoProtectora();
    modalUsuario.showModal();
    document.getElementById('u_nombre').focus();
}

document.getElementById('btnNuevoUsuario')?.addEventListener('click', () => abrirModalUsuario());
document.getElementById('btnCerrarModal')?.addEventListener('click', () => modalUsuario?.close());
document.getElementById('btnCancelarModal')?.addEventListener('click', () => modalUsuario?.close());

document.getElementById('formUsuario')?.addEventListener('submit', async e => {
    e.preventDefault();
    mostrarError('modalError', null);

    const id       = document.getElementById('u_id').value;
    const nombre   = document.getElementById('u_nombre').value.trim();
    const email    = document.getElementById('u_email').value.trim();
    const password = document.getElementById('u_password').value;
    const tipo     = document.getElementById('u_tipo').value;
    const protectora = document.getElementById('u_protectora').value;

    if (!nombre || !email) return mostrarError('modalError', 'Nombre y correo son obligatorios');

    const definicion = estado.roles.find(r => r.valor === tipo);
    if (definicion?.requiereProtectora && !protectora)
        return mostrarError('modalError', `El rol «${definicion.etiqueta}» necesita una protectora asignada`);

    // Solo se envían los campos informados: el backend conserva el resto.
    const cuerpo = { nombre, email, tipo, id_protectora: protectora || null };
    if (password) cuerpo.password = password;

    const restaurar = botonCargando(document.getElementById('btnGuardarUsuario'));

    try {
        const { ok, data } = await peticion(
            id ? `/api/usuarios?id=${encodeURIComponent(id)}` : '/api/usuarios',
            { method: id ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) }
        );

        if (!ok) return mostrarError('modalError', data?.error || 'No se pudo guardar el usuario');

        modalUsuario?.close();
        await cargarUsuarios();

        if (data?.passwordTemporal) {
            await aviso('Usuario creado',
                `Contraseña temporal, se muestra una sola vez:<br><strong>${esc(data.passwordTemporal)}</strong>`);
        } else {
            toast(id ? 'Usuario actualizado' : 'Usuario creado');
        }
    } catch (err) {
        mostrarError('modalError', 'Error de red: ' + err.message);
    } finally {
        restaurar();
    }
});

// ==========================================
// ACCIONES DELEGADAS (editar / eliminar)
// ==========================================
document.addEventListener('click', async e => {
    const boton = e.target.closest('[data-accion]');
    if (!boton) return;

    const { accion, entidad, id, nombre } = boton.dataset;

    if (accion === 'editar-usuario') {
        const usuario = estado.usuarios.find(u => String(u.id_usuario) === String(id));
        if (usuario) abrirModalUsuario(usuario);
        return;
    }
    if (accion === 'editar-animal') {
        const animal = estado.animales.find(a => String(a.id_animal) === String(id));
        if (animal) abrirModalAnimal(animal);
        return;
    }
    if (accion === 'editar')   return editarNombre(entidad, id, nombre);
    if (accion === 'eliminar') return eliminar(entidad, id);
});

async function editarNombre(entidad, id, nombreActual) {
    const etiquetas = { animales: 'animal', protectoras: 'protectora' };

    const nuevoNombre = await pedirTexto({
        titulo: 'Editar ' + (etiquetas[entidad] ?? entidad),
        etiqueta: 'Nuevo nombre',
        valor: nombreActual ?? '',
    });

    if (!nuevoNombre || nuevoNombre === nombreActual) return;

    try {
        const { ok, data } = await peticion(`/api/${entidad}?id=${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ nombre: nuevoNombre }),
        });

        if (!ok) return toast(data?.error || 'No se pudo actualizar', 'error');

        await recargarEntidad(entidad);
        toast('Actualizado');
    } catch (e) {
        toast('Error de red: ' + e.message, 'error');
    }
}

async function eliminar(entidad, id) {
    const confirmado = await confirmar({
        titulo: '¿Eliminar registro?',
        mensaje: 'Esta acción no se puede deshacer.',
        confirmar: 'Eliminar',
        peligroso: true,
    });
    if (!confirmado) return;

    try {
        const { ok, data } = await peticion(`/api/${entidad}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!ok) return toast(data?.error || 'No se pudo eliminar el registro', 'error');

        await recargarEntidad(entidad);
        toast('Eliminado');
    } catch (e) {
        toast('No se pudo eliminar el registro', 'error');
    }
}

/** Recarga solo lo afectado: evita refrescar listas que no han cambiado. */
async function recargarEntidad(entidad) {
    if (entidad === 'usuarios') return cargarUsuarios();

    if (entidad === 'animales') {
        await Promise.all([
            tienePermiso('animales:gestionar') ? cargarAnimales() : Promise.resolve(),
            cargarCatalogo(),
        ]);
        return;
    }

    if (entidad === 'protectoras') {
        // Una protectora afecta además a los desplegables y a la columna de la tabla.
        await cargarProtectoras();
        return tienePermiso('usuarios:gestionar') ? cargarUsuarios() : undefined;
    }
}

// ==========================================
// ALTA DE PROTECTORA
// ==========================================
document.getElementById('formProtectora')?.addEventListener('submit', async e => {
    e.preventDefault();

    const restaurar = botonCargando(e.target.querySelector('button[type="submit"]'), 'Registrando…');

    try {
        const { ok, data } = await peticion('/api/protectoras', {
            method: 'POST',
            body: JSON.stringify({
                nombre:    document.getElementById('p_nombre').value,
                ubicacion: document.getElementById('p_ubicacion').value,
            }),
        });

        if (!ok) return toast(data?.error || 'No se pudo guardar', 'error');

        e.target.reset();
        await recargarEntidad('protectoras');
        toast('Protectora registrada');
    } catch (err) {
        toast('Error de red: ' + err.message, 'error');
    } finally {
        restaurar();
    }
});

// ==========================================
// MIS DATOS (autoservicio de perfil)
// ==========================================
const modalPerfil = document.getElementById('modalPerfil');

document.getElementById('btnMiCuenta')?.addEventListener('click', () => {
    if (!modalPerfil || !estado.sesion) return;

    document.getElementById('pf_nombre').value   = estado.sesion.nombre ?? '';
    document.getElementById('pf_email').value    = estado.sesion.email ?? '';
    document.getElementById('pf_password').value = '';

    // El rol se muestra, pero no se edita: sólo se cambia desde administración.
    const rol = document.getElementById('pf_rol');
    if (rol) {
        const protectora = estado.sesion.nombreProtectora;
        rol.textContent = `Rol: ${estado.sesion.etiquetaRol ?? estado.sesion.tipo}` +
            (protectora ? ` · ${protectora}` : '');
    }

    mostrarError('modalPerfilError', null);
    modalPerfil.showModal();
    document.getElementById('pf_nombre').focus();
});

document.getElementById('btnCerrarModalPerfil')?.addEventListener('click', () => modalPerfil?.close());
document.getElementById('btnCancelarModalPerfil')?.addEventListener('click', () => modalPerfil?.close());

document.getElementById('formPerfil')?.addEventListener('submit', async e => {
    e.preventDefault();
    mostrarError('modalPerfilError', null);

    const nombre   = document.getElementById('pf_nombre').value.trim();
    const email    = document.getElementById('pf_email').value.trim();
    const password = document.getElementById('pf_password').value;

    if (!nombre || !email) return mostrarError('modalPerfilError', 'Nombre y correo son obligatorios');
    if (password && password.length < 8)
        return mostrarError('modalPerfilError', 'La contraseña debe tener al menos 8 caracteres');

    const cuerpo = { nombre, email };
    if (password) cuerpo.password = password;

    const restaurar = botonCargando(document.getElementById('btnGuardarPerfil'));

    try {
        const { ok, data } = await peticion('/api/perfil', {
            method: 'PATCH',
            body: JSON.stringify(cuerpo),
        });

        if (!ok) return mostrarError('modalPerfilError', data?.error || 'No se pudieron guardar los cambios');

        // La sesión guardada se refresca con los datos nuevos, sin tocar rol ni permisos.
        const sesion = { ...estado.sesion, nombre: data.usuario.nombre, email: data.usuario.email };
        localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
        actualizarEstado({ sesion });
        aplicarPermisos();

        modalPerfil?.close();
        toast('Datos actualizados');
    } catch (err) {
        mostrarError('modalPerfilError', 'Error de red: ' + err.message);
    } finally {
        restaurar();
    }
});

// ==========================================
// CIERRE DE MODALES
// ==========================================

// Clic en el backdrop: el objetivo del evento es el propio <dialog>.
document.querySelectorAll('dialog.modal').forEach(dlg => {
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
});

// El arranque vive al final de registro-catalogo.js, que se carga después:
// así todas las funciones del catálogo están definidas cuando se invoca iniciarPanel().
