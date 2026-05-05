// ==========================================
// CONFIGURACIÓN Y SELECTORES
// ==========================================
const loginOverlay = document.getElementById('loginOverlay');
const btnEntrar = document.getElementById('btnEntrar');

// Verificación inmediata de sesión al cargar
if (localStorage.getItem('adminSession')) {
    if (loginOverlay) loginOverlay.style.display = 'none';
    cargarTodo();
}

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
        Swal.fire({ title: 'Atención', text: 'Rellena todos los campos', icon: 'info', confirmButtonColor: '#4361ee' });
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
        catch { throw new Error('Respuesta inválida del servidor. Revisa los logs de Vercel.'); }

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Credenciales incorrectas');
        }

        // ✅ SESIÓN EXITOSA — guardar y animar entrada
        localStorage.setItem('adminSession', JSON.stringify(data.user));

        btnEntrar.style.background = '#10b981';
        btnEntrar.innerHTML = '<i class="fas fa-check"></i> ¡Bienvenido, ' + data.user.nombre + '!';

        await Swal.fire({
            title: '¡Acceso concedido!',
            text: `Bienvenido de nuevo, ${data.user.nombre}`,
            icon: 'success',
            timer: 1400,
            showConfirmButton: false,
            timerProgressBar: true,
            confirmButtonColor: '#4361ee'
        });

        loginOverlay.style.transition = 'opacity 0.4s ease';
        loginOverlay.style.opacity = '0';
        setTimeout(() => {
            loginOverlay.style.display = 'none';
            cargarTodo();
        }, 400);

    } catch (error) {
        console.error('[Login Error]', error.message);
        Swal.fire({
            title: 'Acceso denegado',
            text: error.message,
            icon: 'error',
            confirmButtonColor: '#4361ee',
            confirmButtonText: 'Intentar de nuevo'
        });
        btnEntrar.disabled = false;
        btnEntrar.innerHTML = originalHTML;

        // Shake animation en el card
        document.querySelector('.login-card')?.classList.add('shake');
        setTimeout(() => document.querySelector('.login-card')?.classList.remove('shake'), 500);
    }
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
// CARGA DE DATOS
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
                        <span><i class="fa-solid fa-house-chimney" style="color:#4361ee;margin-right:8px"></i>${p.nombre_protectora}</span>
                        <button onclick="eliminar('protectoras', ${p.id_protectora})" class="btn-del" title="Eliminar">
                            <i class="fa-solid fa-trash"></i>
                        </button>
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
                        <button onclick="eliminar('usuarios', ${u.id_usuario})" class="btn-del" title="Eliminar">
                            <i class="fa-solid fa-user-xmark"></i>
                        </button>
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
                        <button onclick="eliminar('animales', ${a.id_animal})" class="btn-del" title="Eliminar">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </li>`).join('')
                : '<li class="empty-state"><i class="fa-solid fa-inbox"></i> Sin registros</li>';
        }
    } catch (e) { console.error('[cargarAnimales]', e.message); }
}

// ==========================================
// ELIMINAR
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

// ==========================================
// FORMULARIOS (CREAR)
// ==========================================
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formId = e.target.id;
        let body = {}, url = '';

        if (formId === 'animalForm') {
            url  = '/api/animales';
            body = {
                nombre:       document.getElementById('nombre').value,
                especie:      document.getElementById('especie').value,
                edad:         document.getElementById('edad').value || null,
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
