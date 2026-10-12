// ==========================================
// ESTADO DE SESIÓN Y PERMISOS
// ==========================================
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
    filtroUsuarios: '',
    filtroCatalogo: { q: '', especie: '', protectora: '' },
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

function tienePermiso(permiso) {
    return Array.isArray(estado.sesion?.permisos) && estado.sesion.permisos.includes(permiso);
}

/** Muestra u oculta cada bloque según los permisos del usuario autenticado. */
function aplicarPermisos() {
    document.querySelectorAll('[data-permiso]').forEach(el => {
        el.hidden = !tienePermiso(el.dataset.permiso);
    });

    const chip = document.getElementById('sesionChip');
    if (!chip) return;

    const sesion = estado.sesion;
    chip.hidden = !sesion;
    if (!sesion) return;

    document.getElementById('sesionNombre').textContent = sesion.nombre ?? '';
    document.getElementById('sesionAvatar').textContent = iniciales(sesion.nombre);

    const rol = document.getElementById('sesionRol');
    rol.textContent = sesion.etiquetaRol ?? sesion.tipo ?? '';
    rol.className = `badge badge-${String(sesion.tipo ?? '').toLowerCase()}`;
}

// ==========================================
// UTILIDADES
// ==========================================

/** Escapa texto antes de insertarlo en HTML: los datos vienen de la base de datos. */
function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function iniciales(nombre) {
    return String(nombre ?? '?')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(p => p[0] ?? '')
        .join('')
        .toUpperCase() || '?';
}

function toast(titulo, icon = 'success') {
    Swal.fire({ title: titulo, icon, toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
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

// ==========================================
// LOGIN
// ==========================================
const loginOverlay = document.getElementById('loginOverlay');
const btnEntrar    = document.getElementById('btnEntrar');

document.getElementById('togglePass')?.addEventListener('click', () => {
    const input = document.getElementById('loginPass');
    const icon  = document.querySelector('#togglePass i');
    const oculta = input.type === 'password';
    input.type = oculta ? 'text' : 'password';
    icon.classList.replace(oculta ? 'fa-eye' : 'fa-eye-slash', oculta ? 'fa-eye-slash' : 'fa-eye');
});

if (btnEntrar) {
    btnEntrar.addEventListener('click', handleLogin);
    ['loginEmail', 'loginPass'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', e => {
            if (e.key === 'Enter') handleLogin();
        });
    });
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass  = document.getElementById('loginPass').value.trim();

    if (!email || !pass) return mostrarErrorLogin('Rellena todos los campos');

    btnEntrar.disabled = true;
    const originalHTML = btnEntrar.innerHTML;
    btnEntrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

    try {
        const { ok, data } = await peticion('/api/login', {
            method: 'POST',
            body: JSON.stringify({ email, password: pass }),
        });

        if (!ok || !data?.success) throw new Error(data?.message || 'Credenciales incorrectas');

        // La respuesta del login ya trae rol, protectora y permisos: el panel se
        // puede renderizar sin una segunda petición.
        localStorage.setItem(CLAVE_SESION, JSON.stringify(data.user));
        actualizarEstado({ sesion: data.user });

        btnEntrar.style.background = '#10b981';
        btnEntrar.innerHTML = `<i class="fas fa-check"></i> ¡Bienvenido, ${esc(data.user.nombre)}!`;

        await Swal.fire({
            title: '¡Acceso concedido!',
            text: `Bienvenido de nuevo, ${data.user.nombre} (${data.user.etiquetaRol ?? data.user.tipo})`,
            icon: 'success', timer: 1400, showConfirmButton: false, timerProgressBar: true,
        });

        loginOverlay.style.transition = 'opacity 0.4s ease';
        loginOverlay.style.opacity = '0';
        setTimeout(() => { loginOverlay.style.display = 'none'; iniciarPanel(); }, 400);

    } catch (error) {
        mostrarErrorLogin(error.message);
        btnEntrar.disabled = false;
        btnEntrar.innerHTML = originalHTML;
    }
}

function mostrarErrorLogin(mensaje) {
    const card = document.querySelector('.login-card');
    card?.classList.add('shake');
    setTimeout(() => card?.classList.remove('shake'), 500);

    let errorEl = document.getElementById('loginError');
    if (!errorEl) {
        errorEl = document.createElement('p');
        errorEl.id = 'loginError';
        errorEl.className = 'login-error';
        document.querySelector('.login-body')?.appendChild(errorEl);
    }
    errorEl.textContent = '⚠ ' + mensaje;
    errorEl.style.opacity = '1';

    clearTimeout(errorEl._timer);
    errorEl._timer = setTimeout(() => { errorEl.style.opacity = '0'; }, 4000);
}

document.getElementById('btnLogout')?.addEventListener('click', () => {
    Swal.fire({
        title: '¿Cerrar sesión?', icon: 'question', showCancelButton: true,
        confirmButtonColor: '#ef233c', cancelButtonText: 'Cancelar', confirmButtonText: 'Sí, salir',
    }).then(r => {
        if (r.isConfirmed) { localStorage.removeItem(CLAVE_SESION); location.reload(); }
    });
});

// ==========================================
// ARRANQUE DEL PANEL
// ==========================================
async function iniciarPanel() {
    aplicarPermisos();
    configurarPanelAnimales();

    // El catálogo de roles y las protectoras alimentan los desplegables.
    await Promise.all([cargarCatalogoRoles(), cargarProtectoras()]);

    // Cada rol carga sólo lo que puede ver: el adoptante no pide el listado de
    // gestión y la protectora no pide el de usuarios.
    await Promise.all([
        tienePermiso('usuarios:gestionar') ? cargarUsuarios() : Promise.resolve(),
        tienePermiso('animales:gestionar') ? cargarAnimales() : Promise.resolve(),
        tienePermiso('animales:consultar') ? cargarCatalogo() : Promise.resolve(),
    ]);
}

async function cargarCatalogoRoles() {
    try {
        const { ok, data } = await peticion('/api/roles');
        if (!ok) return;

        actualizarEstado({ roles: data.roles ?? [], rolPorDefecto: data.porDefecto ?? 'Adoptante' });

        const select = document.getElementById('u_tipo');
        if (!select) return;

        // El desplegable se construye desde la API: añadir un rol en el backend
        // lo hace aparecer aquí sin tocar el frontend.
        select.innerHTML = estado.roles
            .map(r => `<option value="${esc(r.valor)}">${esc(r.etiqueta)}</option>`)
            .join('');
        select.value = estado.rolPorDefecto;
        sincronizarCampoProtectora();

        // El registro público sólo ofrece los roles marcados con `autoRegistro`:
        // `Admin` queda excluido en origen, no por una lista repetida en el cliente.
        const selectRegistro = document.getElementById('regTipo');
        if (selectRegistro) {
            const publicos = estado.roles.filter(r => r.autoRegistro);

            selectRegistro.innerHTML = publicos.length
                ? publicos.map(r => `<option value="${esc(r.valor)}">${esc(r.etiqueta)}</option>`).join('')
                : '<option value="" disabled selected>No se pudieron cargar los roles</option>';

            // Arranca en el rol por defecto del catálogo si es de registro público.
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

        const lista = document.getElementById('listaProtectoras');
        if (lista) {
            lista.innerHTML = protectoras.length
                ? protectoras.map(p => `
                    <li class="item-lista">
                        <span>
                            <i class="fa-solid fa-house-chimney" style="color:#4361ee;margin-right:8px"></i>
                            ${esc(p.nombre_protectora)}
                        </span>
                        <div class="btn-group">
                            <button type="button" class="btn-edit" title="Editar"
                                    data-accion="editar" data-entidad="protectoras"
                                    data-id="${p.id_protectora}" data-nombre="${esc(p.nombre_protectora)}">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button type="button" class="btn-del" title="Eliminar"
                                    data-accion="eliminar" data-entidad="protectoras" data-id="${p.id_protectora}">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </li>`).join('')
                : '<li class="empty-state"><i class="fa-solid fa-inbox"></i> Sin registros</li>';
        }

        const opciones = protectoras
            .map(p => `<option value="${p.id_protectora}">${esc(p.nombre_protectora)}</option>`)
            .join('');

        const selAnimal = document.getElementById('selectProtectora');
        if (selAnimal) selAnimal.innerHTML = '<option value="">— Selecciona protectora —</option>' + opciones;

        [['u_protectora', '— Selecciona protectora —'],
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
        const mensaje = estado.filtroUsuarios ? 'Ningún usuario coincide con la búsqueda' : 'Sin registros';
        tbody.innerHTML = `<tr class="fila-vacia"><td colspan="5"><i class="fa-solid fa-inbox"></i> ${mensaje}</td></tr>`;
        return;
    }

    tbody.innerHTML = filas.map(u => `
        <tr>
            <td>
                <div class="celda-usuario">
                    <span class="sesion-avatar" aria-hidden="true">${esc(iniciales(u.nombre_usuario))}</span>
                    <b>${esc(u.nombre_usuario)}</b>
                </div>
            </td>
            <td class="celda-email">${esc(u.email)}</td>
            <td><span class="badge badge-${esc(String(u.tipo_usuario).toLowerCase())}">${esc(u.tipo_usuario)}</span></td>
            <td>${u.nombre_protectora
                ? esc(u.nombre_protectora)
                : '<span class="sin-asignar">Sin asignar</span>'}</td>
            <td class="col-acciones">
                <div class="btn-group">
                    <button type="button" class="btn-edit" title="Editar usuario"
                            data-accion="editar-usuario" data-id="${u.id_usuario}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="btn-del" title="Eliminar usuario"
                            data-accion="eliminar" data-entidad="usuarios" data-id="${u.id_usuario}">
                        <i class="fa-solid fa-user-xmark"></i>
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

    ocultarErrorModal();
    sincronizarCampoProtectora();
    modalUsuario.showModal();
    document.getElementById('u_nombre').focus();
}

function cerrarModalUsuario() {
    modalUsuario?.close();
}

function mostrarErrorModal(mensaje) {
    const el = document.getElementById('modalError');
    if (!el) return;
    el.textContent = mensaje;
    el.hidden = false;
}

function ocultarErrorModal() {
    const el = document.getElementById('modalError');
    if (el) { el.hidden = true; el.textContent = ''; }
}

document.getElementById('btnNuevoUsuario')?.addEventListener('click', () => abrirModalUsuario());
document.getElementById('btnCerrarModal')?.addEventListener('click', cerrarModalUsuario);
document.getElementById('btnCancelarModal')?.addEventListener('click', cerrarModalUsuario);

document.getElementById('formUsuario')?.addEventListener('submit', async e => {
    e.preventDefault();
    ocultarErrorModal();

    const id       = document.getElementById('u_id').value;
    const nombre   = document.getElementById('u_nombre').value.trim();
    const email    = document.getElementById('u_email').value.trim();
    const password = document.getElementById('u_password').value;
    const tipo     = document.getElementById('u_tipo').value;
    const protectora = document.getElementById('u_protectora').value;

    if (!nombre || !email) return mostrarErrorModal('Nombre y correo son obligatorios');

    const definicion = estado.roles.find(r => r.valor === tipo);
    if (definicion?.requiereProtectora && !protectora)
        return mostrarErrorModal(`El rol "${definicion.etiqueta}" necesita una protectora asignada`);

    // Solo se envían los campos informados: el backend conserva el resto.
    const cuerpo = { nombre, email, tipo, id_protectora: protectora || null };
    if (password) cuerpo.password = password;

    const boton = document.getElementById('btnGuardarUsuario');
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const { ok, data } = await peticion(
            id ? `/api/usuarios?id=${encodeURIComponent(id)}` : '/api/usuarios',
            { method: id ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) }
        );

        if (!ok) return mostrarErrorModal(data?.error || 'No se pudo guardar el usuario');

        cerrarModalUsuario();
        await cargarUsuarios();

        if (data?.passwordTemporal) {
            await Swal.fire({
                title: 'Usuario creado',
                html: `Contraseña temporal (se muestra una sola vez):<br><code>${esc(data.passwordTemporal)}</code>`,
                icon: 'success',
            });
        } else {
            toast(id ? '¡Usuario actualizado!' : '¡Usuario creado!');
        }
    } catch (err) {
        mostrarErrorModal('Error de red: ' + err.message);
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
});

// ==========================================
// ANIMALES
// ==========================================
async function cargarAnimales() {
    try {
        // El backend acota por sí solo: una protectora recibe únicamente los suyos.
        const { ok, data } = await peticion('/api/animales');
        if (!ok) return;

        const animales = Array.isArray(data) ? data : [];
        actualizarEstado({ animales });

        const lista = document.getElementById('listaAnimales');
        if (!lista) return;

        lista.innerHTML = animales.length
            ? animales.map(a => `
                <li class="item-lista">
                    <span>
                        <i class="fa-solid fa-paw" style="color:#4361ee;margin-right:8px"></i>
                        <b>${esc(a.nombre_animal)}</b>
                        <small style="color:#64748b">${esc(a.especie_animal)}${a.edad !== null && a.edad !== undefined ? ` · ${esc(a.edad)} años` : ''}</small>
                        <span class="badge badge-${esc(String(a.estado).toLowerCase())}">${esc(a.estado)}</span>
                    </span>
                    <div class="btn-group">
                        <button type="button" class="btn-edit" title="Editar animal"
                                data-accion="editar-animal" data-id="${a.id_animal}">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button type="button" class="btn-del" title="Eliminar"
                                data-accion="eliminar" data-entidad="animales" data-id="${a.id_animal}">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </li>`).join('')
            : '<li class="empty-state"><i class="fa-solid fa-inbox"></i> Sin registros</li>';
    } catch (e) {
        console.error('[cargarAnimales]', e.message);
    }
}

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

    const { value: nuevoNombre } = await Swal.fire({
        title: 'Editar ' + (etiquetas[entidad] ?? entidad),
        input: 'text', inputLabel: 'Nuevo nombre', inputValue: nombreActual,
        showCancelButton: true, cancelButtonText: 'Cancelar',
        confirmButtonText: 'Guardar cambios', confirmButtonColor: '#4361ee',
        inputValidator: v => !v.trim() ? 'El nombre no puede estar vacío' : null,
    });

    if (!nuevoNombre || nuevoNombre.trim() === nombreActual) return;

    try {
        const { ok, data } = await peticion(`/api/${entidad}?id=${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ nombre: nuevoNombre.trim() }),
        });

        if (!ok) return Swal.fire('Error', data?.error || 'No se pudo actualizar', 'error');

        await recargarEntidad(entidad);
        toast('¡Actualizado!');
    } catch (e) {
        Swal.fire('Error de red', e.message, 'error');
    }
}

async function eliminar(entidad, id) {
    const confirmado = await Swal.fire({
        title: '¿Eliminar registro?', text: 'Esta acción no se puede deshacer', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef233c', cancelButtonColor: '#64748b',
        cancelButtonText: 'Cancelar', confirmButtonText: 'Sí, eliminar',
    });

    if (!confirmado.isConfirmed) return;

    try {
        const { ok, data } = await peticion(`/api/${entidad}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!ok) return Swal.fire('Error', data?.error || 'No se pudo eliminar el registro', 'error');

        await recargarEntidad(entidad);
        toast('Eliminado');
    } catch (e) {
        Swal.fire('Error', 'No se pudo eliminar el registro', 'error');
    }
}

/** Recarga solo lo afectado: evita refrescar listas que no han cambiado. */
async function recargarEntidad(entidad) {
    if (entidad === 'usuarios') return cargarUsuarios();
    if (entidad === 'animales') {
        await Promise.all([
            tienePermiso('animales:gestionar') ? cargarAnimales() : Promise.resolve(),
            tienePermiso('animales:consultar') ? cargarCatalogo() : Promise.resolve(),
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
// FORMULARIOS DE ALTA (protectoras y animales)
// ==========================================
const ALTAS = {
    formProtectora: {
        url: '/api/protectoras',
        entidad: 'protectoras',
        cuerpo: () => ({
            nombre:    document.getElementById('p_nombre').value,
            ubicacion: document.getElementById('p_ubicacion').value,
        }),
    },
    animalForm: {
        url: '/api/animales',
        entidad: 'animales',
        cuerpo: () => ({
            nombre:        document.getElementById('nombre').value,
            especie:       document.getElementById('especie').value,
            edad:          document.getElementById('edad').value || null,
            id_protectora: document.getElementById('selectProtectora').value,
        }),
    },
};

Object.entries(ALTAS).forEach(([formId, config]) => {
    document.getElementById(formId)?.addEventListener('submit', async e => {
        e.preventDefault();

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origText  = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const { ok, data } = await peticion(config.url, {
                method: 'POST',
                body: JSON.stringify(config.cuerpo()),
            });

            if (!ok) return Swal.fire('Error', data?.error || 'No se pudo guardar', 'error');

            e.target.reset();
            await recargarEntidad(config.entidad);
            toast('¡Guardado!');
        } catch (err) {
            Swal.fire('Error de red', err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
        }
    });
});

// El arranque vive al final de registro-catalogo.js, que se carga después:
// así todas las funciones del panel están definidas cuando se invoca iniciarPanel().
