// ==========================================
// CONFIGURACIÓN Y SELECTORES
// ==========================================
const loginOverlay = document.getElementById('loginOverlay');
const btnEntrar = document.getElementById('btnEntrar');

// 1. Verificación inmediata de sesión al cargar
if (localStorage.getItem('adminSession')) {
    if (loginOverlay) loginOverlay.style.display = 'none';
    cargarTodo();
}

// ==========================================
// SISTEMA DE LOGIN
// ==========================================
if (btnEntrar) {
    btnEntrar.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value.trim();

        if (!email || !pass) {
            Swal.fire('Atención', 'Rellena todos los campos', 'info');
            return;
        }

        // Bloqueo visual del botón
        btnEntrar.disabled = true;
        const originalHTML = btnEntrar.innerHTML;
        btnEntrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass })
            });

            // ✅ FIX #4: Parsear siempre el JSON antes de evaluar, sea 200 o 4xx
            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error('El servidor no devolvió una respuesta válida. Comprueba los logs de Vercel.');
            }

            if (!response.ok || !data.success) {
                throw new Error(data.message || `Error ${response.status}: Credenciales incorrectas`);
            }

            // SESIÓN EXITOSA
            localStorage.setItem('adminSession', JSON.stringify(data.user));

            btnEntrar.style.background = '#10b981';
            btnEntrar.innerHTML = '✓ ¡Bienvenido!';

            setTimeout(() => {
                loginOverlay.style.opacity = '0';
                loginOverlay.style.transition = 'opacity 0.4s ease';
                setTimeout(() => {
                    loginOverlay.style.display = 'none';
                    cargarTodo();
                }, 400);
            }, 600);

        } catch (error) {
            console.error('[Login Error]', error.message);
            Swal.fire({
                title: 'Fallo de acceso',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#4361ee'
            });
            btnEntrar.disabled = false;
            btnEntrar.innerHTML = originalHTML;
        }
    });

    // Permitir login con Enter desde los inputs
    ['loginEmail', 'loginPass'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') btnEntrar.click();
        });
    });
}

function logout() {
    localStorage.removeItem('adminSession');
    location.reload();
}

// ==========================================
// GESTIÓN DE DATOS (CRUD)
// ==========================================
async function cargarTodo() {
    await Promise.all([cargarProtectoras(), cargarUsuarios(), cargarAnimales()]);
}

async function cargarProtectoras() {
    try {
        const res = await fetch('/api/protectoras');
        const data = await res.json();
        const lista = document.getElementById('listaProtectoras');
        const select = document.getElementById('selectProtectora');

        if (lista) lista.innerHTML = data.map(p => `
            <li class="item-lista">
                <span>${p.nombre_protectora}</span>
                <button onclick="eliminar('protectoras', ${p.id_protectora})" class="btn-del">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </li>
        `).join('');

        if (select) select.innerHTML = data.map(p =>
            `<option value="${p.id_protectora}">${p.nombre_protectora}</option>`
        ).join('');
    } catch (e) {
        console.error('[cargarProtectoras]', e.message);
    }
}

async function cargarUsuarios() {
    try {
        const res = await fetch('/api/usuarios');
        const data = await res.json();
        const lista = document.getElementById('listaUsuarios');
        if (lista) lista.innerHTML = data.map(u => `
            <li class="item-lista">
                <span>${u.nombre_usuario} (<b>${u.tipo_usuario}</b>)</span>
                <button onclick="eliminar('usuarios', ${u.id_usuario})" class="btn-del">
                    <i class="fa-solid fa-user-xmark"></i>
                </button>
            </li>
        `).join('');
    } catch (e) {
        console.error('[cargarUsuarios]', e.message);
    }
}

async function cargarAnimales() {
    try {
        const res = await fetch('/api/animales');
        const data = await res.json();
        const lista = document.getElementById('listaAnimales');
        if (lista) lista.innerHTML = data.map(a => `
            <li class="item-lista">
                <span><b>${a.nombre_animal}</b> — ${a.estado}</span>
                <button onclick="eliminar('animales', ${a.id_animal})" class="btn-del">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </li>
        `).join('');
    } catch (e) {
        console.error('[cargarAnimales]', e.message);
    }
}

async function eliminar(entidad, id) {
    const result = await Swal.fire({
        title: '¿Confirmas la eliminación?',
        text: 'No podrás deshacer esta acción',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef233c',
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        await fetch(`/api/${entidad}?id=${id}`, { method: 'DELETE' });
        cargarTodo();
        Swal.fire('Borrado', 'El registro ha sido eliminado', 'success');
    }
}

// Manejador genérico de formularios (Crear)
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = e.target.id;
        let body = {}, url = '';

        if (id === 'animalForm') {
            url = '/api/animales';
            body = {
                nombre: document.getElementById('nombre').value,
                especie: document.getElementById('especie').value,
                edad: document.getElementById('edad').value || null,
                id_protectora: document.getElementById('selectProtectora').value
            };
        } else if (id === 'formProtectora') {
            url = '/api/protectoras';
            body = {
                nombre: document.getElementById('p_nombre').value,
                ubicacion: document.getElementById('p_ubicacion').value
            };
        } else if (id === 'formUsuario') {
            url = '/api/usuarios';
            body = {
                nombre: document.getElementById('u_nombre').value,
                email: document.getElementById('u_email').value,
                tipo: document.getElementById('u_tipo').value
            };
        } else {
            return; // Ignorar formularios no reconocidos
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                e.target.reset();
                cargarTodo();
                Swal.fire({
                    title: 'Guardado',
                    icon: 'success',
                    toast: true,
                    position: 'top-end',
                    timer: 2000,
                    showConfirmButton: false
                });
            } else {
                const err = await res.json();
                Swal.fire('Error', err.error || 'No se pudo guardar', 'error');
            }
        } catch (e) {
            Swal.fire('Error de red', e.message, 'error');
        }
    });
});
