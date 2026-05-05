// ==========================================
// CONFIGURACIÓN Y SELECTORES
// ==========================================
const loginOverlay = document.getElementById('loginOverlay');
const btnEntrar = document.getElementById('btnEntrar');

// 1. Verificación inmediata de sesión
if (localStorage.getItem('adminSession')) {
    if (loginOverlay) loginOverlay.style.display = 'none';
    cargarTodo();
}

// ==========================================
// SISTEMA DE LOGIN (EVENTO DIRECTO)
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
        const originalText = btnEntrar.innerHTML;
        btnEntrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: pass })
            });

            const data = await response.json();

            if (data.success) {
                // SESIÓN EXITOSA
                localStorage.setItem('adminSession', JSON.stringify(data.user));
                
                btnEntrar.style.background = '#10b981';
                btnEntrar.innerHTML = '¡Bienvenido!';

                setTimeout(() => {
                    loginOverlay.style.opacity = '0';
                    setTimeout(() => {
                        loginOverlay.style.display = 'none';
                        cargarTodo();
                    }, 400);
                }, 600);

            } else {
                // ERROR DE CREDENCIALES (Cae aquí si el backend dice false)
                throw new Error(data.message || 'Clave o usuario incorrectos');
            }
        } catch (error) {
            // ERROR DE RED O SERVIDOR
            console.error("Login Error:", error);
            Swal.fire({
                title: 'Fallo de acceso',
                text: error.message,
                icon: 'error',
                confirmButtonColor: '#4361ee'
            });
            // Reset botón
            btnEntrar.disabled = false;
            btnEntrar.innerHTML = originalText;
        }
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
    console.log("Iniciando carga de datos...");
    await Promise.all([cargarProtectoras(), cargarUsuarios(), cargarAnimales()]);
}

async function cargarProtectoras() {
    const res = await fetch('/api/protectoras');
    const data = await res.json();
    const lista = document.getElementById('listaProtectoras');
    const select = document.getElementById('selectProtectora');
    
    if(lista) lista.innerHTML = data.map(p => `
        <li class="item-lista">
            <span>${p.nombre_protectora}</span>
            <button onclick="eliminar('protectoras', ${p.id_protectora})" class="btn-del"><i class="fa-solid fa-trash"></i></button>
        </li>
    `).join('');
    
    if(select) select.innerHTML = data.map(p => `<option value="${p.id_protectora}">${p.nombre_protectora}</option>`).join('');
}

async function cargarUsuarios() {
    const res = await fetch('/api/usuarios');
    const data = await res.json();
    const lista = document.getElementById('listaUsuarios');
    if(lista) lista.innerHTML = data.map(u => `
        <li class="item-lista">
            <span>${u.nombre_usuario} (<b>${u.tipo_usuario}</b>)</span>
            <button onclick="eliminar('usuarios', ${u.id_usuario})" class="btn-del"><i class="fa-solid fa-user-xmark"></i></button>
        </li>
    `).join('');
}

async function cargarAnimales() {
    const res = await fetch('/api/animales');
    const data = await res.json();
    const lista = document.getElementById('listaAnimales');
    if(lista) lista.innerHTML = data.map(a => `
        <li class="item-lista">
            <span><b>${a.nombre_animal}</b> - ${a.estado}</span>
            <button onclick="eliminar('animales', ${a.id_animal})" class="btn-del"><i class="fa-solid fa-trash-can"></i></button>
        </li>
    `).join('');
}

async function eliminar(entidad, id) {
    const result = await Swal.fire({
        title: '¿Confirmas la eliminación?',
        text: "No podrás deshacer esta acción",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef233c',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        await fetch(`/api/${entidad}?id=${id}`, { method: 'DELETE' });
        cargarTodo();
        Swal.fire('Borrado', 'El registro ha sido eliminado', 'success');
    }
}

// Manejador genérico de formularios (Crear)
document.querySelectorAll('form').forEach(form => {
    if (form.id === 'loginForm') return; // Ignorar el de login
    
    form.addEventListener('submit', async (e) => {
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
            body = { 
                nombre: document.getElementById('p_nombre').value, 
                ubicacion: document.getElementById('p_ubicacion').value 
            };
        }

        const res = await fetch(url, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body) 
        });

        if (res.ok) {
            e.target.reset();
            cargarTodo();
            Swal.fire({ title: 'Éxito', icon: 'success', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        }
    });
});