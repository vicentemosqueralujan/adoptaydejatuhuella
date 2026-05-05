// ==========================================
// CONFIGURACIÓN Y SELECTORES
// ==========================================
const loginOverlay = document.getElementById('loginOverlay');
const btnEntrar    = document.getElementById('btnEntrar');

// Verificación inmediata de sesión al cargar
if (localStorage.getItem('adminSession')) {
    if (loginOverlay) loginOverlay.style.display = 'none';
    cargarTodo();
}

// ==========================================
// TOGGLE OJO CONTRASEÑA
// ==========================================
document.getElementById('togglePass')?.addEventListener('click', () => {
    const input = document.getElementById('loginPass');
    const icon  = document.querySelector('#togglePass i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
});

// ==========================================
// SISTEMA DE LOGIN
// ==========================================
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

    if (!email || !pass) {
        mostrarErrorLogin('Rellena todos los campos');
        return;
    }

    btnEntrar.disabled = true;
    const originalHTML = btnEntrar.innerHTML;
    btnEntrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: pass })
        });

        let data;
        try { data = await response.json(); }
        catch { throw new Error('Respuesta inválida del servidor.'); }

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Credenciales incorrectas');
        }

        // ✅ SESIÓN EXITOSA
        localStorage.setItem('adminSession', JSON.stringify(data.user));
        btnEntrar.style.background = '#10b981';
        btnEntrar.innerHTML = '<i class="fas fa-check"></i> ¡Bienvenido, ' + data.user.nombre + '!';

        await Swal.fire({
            title: '¡Acceso concedido!',
            text: 'Bienvenido de nuevo, ' + data.user.nombre,
            icon: 'success',
            timer: 1400,
            showConfirmButton: false,
            timerProgressBar: true
        });

        loginOverlay.style.transition = 'opacity 0.4s ease';
        loginOverlay.style.opacity = '0';
        setTimeout(() => { loginOverlay.style.display = 'none'; cargarTodo(); }, 400);

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

function logout() {
    Swal.fire({
        title: '¿Cerrar sesión?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef233c',
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Sí, salir'
    }).then(r => { if (r.isConfirmed) { localStorage.removeItem('adminSession'); location.reload(); } });
}

// ==========================================
// CARGA DE DATOS (REPARADO)
// ==========================================
async function cargarTodo() {
    await Promise.all([cargarProtectoras(), cargarUsuarios(), cargarAnimales()]);
}

async function cargarProtectoras() {
    try {
        const res  = await fetch('/api/protectoras');
        const data = await res.json();
        const lista  = document.getElementById('listaProtectoras');
        const select = document.getElementById('selectProtectora');

        if (lista) {
            lista.innerHTML = data.length
                ? data.map(p => `
                    <li class="item-lista">
                        <span>
                            <i class="fa-solid fa-house-chimney" style="color:#4361ee;margin-right:8px"></i>
                            ${p.nombre_protectora}
                        </span>
                        <div class="btn-group">
                            <button onclick="editar('protectoras', ${p.id_protectora}, '${p.nombre_protectora.replace(/'/g, "\\'")}')" class="btn-edit" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="eliminar('protectoras', ${p.id_protectora})" class="btn-del" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </li>`).join('')
                : '<li class="empty-state"><i class="fa-solid fa-inbox"></i> Sin registros</li>';
        }

        if (select) select.innerHTML = data.map(p =>
            `<option value="${p.id_protectora}">${p.nombre_protectora}</option>`
        ).join('');
    } catch (e) { console.error('[cargarProtectoras]', e.message); }
}

async function cargarUsuarios() {
    try {
        const res  = await fetch('/api/usuarios');
        const data = await res.json();
        const lista = document.getElementById('listaUsuarios');
        if (lista) {
            lista.innerHTML = data.length
                ? data.map(u => `
                    <li class="item-lista">
                        <span>
                            <i class="fa-solid fa-user-circle" style="color:#4361ee;margin-right:8px"></i>
                            ${u.nombre_usuario}
                            <span class="badge badge-${u.tipo_usuario.toLowerCase()}">${u.tipo_usuario}</span>
                        </span>
                        <div class="btn-group">
                            <button onclick="editar('usuarios', ${u.id_usuario}, '${u.nombre_usuario.replace(/'/g, "\\'")}')" class="btn-edit" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="eliminar('usuarios', ${u.id_usuario})" class="btn-del" title="Eliminar">
                                <i class="fa-solid fa-user-xmark"></i>
                            </button>
                        </div>
                    </li>`).join('')
                : '<li class="empty-state"><i class="fa-solid fa-inbox"></i> Sin registros</li>';
        }
    } catch (e) { console.error('[cargarUsuarios]', e.message); }
}

async function cargarAnimales() {
    try {
        const res  = await fetch('/api/animales');
        const data = await res.json();
        const lista = document.getElementById('listaAnimales');
        if (lista) {
            lista.innerHTML = data.length
                ? data.map(a => `
                    <li class="item-lista">
                        <span>
                            <i class="fa-solid fa-paw" style="color:#4361ee;margin-right:8px"></i>
                            <b>${a.nombre_animal}</b>
                            <span class="badge badge-${a.estado === 'Disponible' ? 'disponible' : 'adoptado'}">${a.estado}</span>
                        </span>
                        <div class="btn-group">
                            <button onclick="editar('animales', ${a.id_animal}, '${a.nombre_animal.replace(/'/g, "\\'")}')" class="btn-edit" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button onclick="eliminar('animales', ${a.id_animal})" class="btn-del" title="Eliminar">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </li>`).join('')
                : '<li class="empty-state"><i class="fa-solid fa-inbox"></i> Sin registros</li>';
        }
    } catch (e) { console.error('[cargarAnimales]', e.message); }
}

// ==========================================
// EDITAR (PATCH)
// ==========================================
async function editar(entidad, id, nombreActual) {
    const etiquetas = { animales: 'animal', protectoras: 'protectora', usuarios: 'usuario' };

    const { value: nuevoNombre } = await Swal.fire({
        title: 'Editar ' + etiquetas[entidad],
        input: 'text',
        inputLabel: 'Nuevo nombre',
        inputValue: nombreActual,
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Guardar cambios',
        confirmButtonColor: '#4361ee',
        inputValidator: v => !v.trim() ? 'El nombre no puede estar vacío' : null
    });

    if (!nuevoNombre || nuevoNombre.trim() === nombreActual) return;

    try {
        const res = await fetch(`/api/${entidad}?id=${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre: nuevoNombre.trim() })
        });

        if (res.ok) {
            await cargarTodo();
            Swal.fire({ title: '¡Actualizado!', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        } else {
            const err = await res.json();
            Swal.fire('Error', err.error || 'No se pudo actualizar', 'error');
        }
    } catch (e) {
        Swal.fire('Error de red', e.message, 'error');
    }
}

// ==========================================
// ELIMINAR Y FORMULARIOS (RESTO DEL CÓDIGO)
// ==========================================
async function eliminar(entidad, id) {
    const result = await Swal.fire({
        title: '¿Eliminar registro?',
        text: 'Esta acción no se puede deshacer',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef233c',
        cancelButtonColor: '#64748b',
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        try {
            await fetch(`/api/${entidad}?id=${id}`, { method: 'DELETE' });
            await cargarTodo();
            Swal.fire({ title: 'Eliminado', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        } catch (e) {
            Swal.fire('Error', 'No se pudo eliminar el registro', 'error');
        }
    }
}

document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formId = e.target.id;
        let body = {}, url = '';

        if (formId === 'animalForm') {
            url  = '/api/animales';
            body = {
                nombre:        document.getElementById('nombre').value,
                especie:       document.getElementById('especie').value,
                edad:          document.getElementById('edad').value || null,
                id_protectora: document.getElementById('selectProtectora').value
            };
        } else if (formId === 'formProtectora') {
            url  = '/api/protectoras';
            body = {
                nombre:    document.getElementById('p_nombre').value,
                ubicacion: document.getElementById('p_ubicacion').value
            };
        } else if (formId === 'formUsuario') {
            url  = '/api/usuarios';
            body = {
                nombre: document.getElementById('u_nombre').value,
                email:  document.getElementById('u_email').value,
                tipo:   document.getElementById('u_tipo').value
            };
        } else { return; }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const origText  = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                e.target.reset();
                await cargarTodo();
                Swal.fire({ title: '¡Guardado!', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
            } else {
                const err = await res.json();
                Swal.fire('Error', err.error || 'No se pudo guardar', 'error');
            }
        } catch (err) {
            Swal.fire('Error de red', err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origText;
        }
    });
});