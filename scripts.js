// ==========================================
// 1. SISTEMA DE ACCESO (LOGIN)
// ==========================================
const loginOverlay = document.getElementById('loginOverlay');
const loginForm = document.getElementById('loginForm');

// Verificar sesión al cargar
if (localStorage.getItem('adminSession')) {
    if (loginOverlay) loginOverlay.style.display = 'none';
    cargarTodo();
}

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const pass = document.getElementById('loginPass').value.trim();
        const btn = e.target.querySelector('button');

        if (!email || !pass) {
            Swal.fire('Atención', 'Rellena todos los campos', 'info');
            return;
        }

        // Bloqueo de botón para evitar re-envíos
        btn.disabled = true;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass })
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('adminSession', JSON.stringify(data.user));
                
                // Éxito: Notificación rápida y entrada
                await Swal.fire({
                    title: '¡Acceso Correcto!',
                    icon: 'success',
                    timer: 1000,
                    showConfirmButton: false
                });

                loginOverlay.style.display = 'none';
                cargarTodo();
            } else {
                // Error de credenciales
                Swal.fire('Error', data.message || 'Usuario o clave incorrectos', 'error');
                document.getElementById('loginPass').value = '';
            }
        } catch (error) {
            console.error("Error en login:", error);
            Swal.fire('Error de red', 'No se pudo conectar con el servidor', 'warning');
        } finally {
            // Siempre restauramos el botón
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

function logout() {
    localStorage.removeItem('adminSession');
    location.reload();
}

// ==========================================
// 2. GESTIÓN DE DATOS (DASHBOARD)
// ==========================================
function cargarTodo() {
    cargarProtectoras();
    cargarUsuarios();
    cargarAnimales();
}

async function cargarProtectoras() {
    try {
        const res = await fetch('/api/protectoras');
        const data = await res.json();
        document.getElementById('listaProtectoras').innerHTML = data.map(p => `
            <li class="item-lista">
                <span>${p.nombre_protectora}</span>
                <div class="actions">
                    <button onclick="eliminar('protectoras', ${p.id_protectora})" class="btn-action btn-del">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </li>
        `).join('');
        document.getElementById('selectProtectora').innerHTML = data.map(p => `<option value="${p.id_protectora}">${p.nombre_protectora}</option>`).join('');
    } catch (e) { console.error("Error cargando protectoras", e); }
}

async function cargarUsuarios() {
    try {
        const res = await fetch('/api/usuarios');
        const data = await res.json();
        document.getElementById('listaUsuarios').innerHTML = data.map(u => `
            <li class="item-lista">
                <span>${u.nombre_usuario} (<b>${u.tipo_usuario}</b>)</span>
                <div class="actions">
                    <button onclick="eliminar('usuarios', ${u.id_usuario})" class="btn-action btn-del">
                        <i class="fa-solid fa-user-xmark"></i>
                    </button>
                </div>
            </li>
        `).join('');
    } catch (e) { console.error("Error cargando usuarios", e); }
}

async function cargarAnimales() {
    try {
        const res = await fetch('/api/animales');
        const data = await res.json();
        document.getElementById('listaAnimales').innerHTML = data.map(a => `
            <li class="item-lista">
                <span><b>${a.nombre_animal}</b> - ${a.estado}</span>
                <div class="actions">
                    <button onclick="eliminar('animales', ${a.id_animal})" class="btn-action btn-del">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </li>
        `).join('');
    } catch (e) { console.error("Error cargando animales", e); }
}

async function eliminar(entidad, id) {
    const { isConfirmed } = await Swal.fire({
        title: '¿Eliminar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef233c'
    });
    
    if (isConfirmed) {
        await fetch(`/api/${entidad}?id=${id}`, { method: 'DELETE' });
        cargarTodo();
    }
}

// Registro general para formularios
document.querySelectorAll('form:not(#loginForm)').forEach(form => {
    form.onsubmit = async (e) => {
        e.preventDefault();
        const id = e.target.id;
        let body = {}, url = '';

        if (id === 'animalForm') {
            url = '/api/animales';
            body = { 
                nombre: document.getElementById('nombre').value, 
                especie: document.getElementById('especie').value, 
                id_protectora: document.getElementById('selectProtectora').value 
            };
        } else if (id === 'formProtectora') {
            url = '/api/protectoras';
            body = { nombre: document.getElementById('p_nombre').value, ubicacion: document.getElementById('p_ubicacion').value };
        }

        await fetch(url, { method: 'POST', body: JSON.stringify(body) });
        e.target.reset();
        cargarTodo();
        Swal.fire({ title: 'Registrado', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
    };
});