// ==========================================
// 1. SISTEMA DE LOGIN BLINDADO (UX PRO)
// ==========================================
const loginOverlay = document.getElementById('loginOverlay');
const loginForm = document.getElementById('loginForm');

// Verificar sesión al cargar la página
if (localStorage.getItem('adminSession')) {
    loginOverlay.style.display = 'none';
    cargarTodo();
}

loginForm.onsubmit = async (e) => {
    e.preventDefault();
    
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPass');
    const submitBtn = e.target.querySelector('button');

    // Feedback visual inmediato: deshabilitar para evitar doble clic
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Comprobando...';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: emailInput.value, 
                password: passInput.value 
            })
        });

        // Capturar errores de servidor o base de datos
        if (!res.ok && res.status !== 401) throw new Error('Error en el servidor');

        const data = await res.json();

        if (data.success) {
            // LOGIN EXITOSO: Guardar sesión y mostrar éxito
            localStorage.setItem('adminSession', JSON.stringify(data.user));
            
            await Swal.fire({
                title: '¡Acceso Correcto!',
                text: `Bienvenido, ${data.user.nombre}`,
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                allowOutsideClick: false
            });

            // Transición suave de salida
            loginOverlay.style.transition = "opacity 0.8s ease";
            loginOverlay.style.opacity = "0";
            
            setTimeout(() => {
                loginOverlay.style.display = 'none';
                cargarTodo();
            }, 800);

        } else {
            // CREDENCIALES INCORRECTAS
            await Swal.fire({
                title: 'Acceso Denegado',
                text: data.message || 'El email o la contraseña son incorrectos.',
                icon: 'error',
                confirmButtonColor: '#4361ee'
            });
            passInput.value = ''; // Solo borramos la clave
            passInput.focus();
        }
    } catch (err) {
        // ERROR DE CONEXIÓN O RED
        await Swal.fire({
            title: 'Sin conexión',
            text: 'No se pudo contactar con el servidor. Reintenta en unos instantes.',
            icon: 'warning'
        });
    } finally {
        // RESTAURAR BOTÓN: Pase lo que pase, el botón vuelve a ser usable
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Entrar al Panel';
    }
};

function logout() {
    localStorage.removeItem('adminSession');
    location.reload();
}

// ==========================================
// 2. UTILIDADES Y CARGA DE DATOS (READ)
// ==========================================
function mostrarToast(titulo, icono = 'success') {
    Swal.fire({
        title: titulo,
        icon: icono,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
    });
}

async function cargarTodo() {
    cargarProtectoras();
    cargarUsuarios();
    cargarAnimales();
}

async function cargarProtectoras() {
    const res = await fetch('/api/protectoras');
    const data = await res.json();
    document.getElementById('listaProtectoras').innerHTML = data.map(p => `
        <li class="item-lista">
            <span>${p.nombre_protectora}</span>
            <div class="actions">
                <button onclick="editarNombre('protectoras', ${p.id_protectora}, '${p.nombre_protectora}')" class="btn-action btn-edit"><i class="fa-solid fa-pen"></i></button>
                <button onclick="eliminar('protectoras', ${p.id_protectora})" class="btn-action btn-del"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>
    `).join('');
    document.getElementById('selectProtectora').innerHTML = data.map(p => `<option value="${p.id_protectora}">${p.nombre_protectora}</option>`).join('');
}

async function cargarUsuarios() {
    const res = await fetch('/api/usuarios');
    const data = await res.json();
    document.getElementById('listaUsuarios').innerHTML = data.map(u => `
        <li class="item-lista">
            <span>${u.nombre_usuario} (<b>${u.tipo_usuario}</b>)</span>
            <div class="actions">
                <button onclick="editarNombre('usuarios', ${u.id_usuario}, '${u.nombre_usuario}')" class="btn-action btn-edit"><i class="fa-solid fa-pen"></i></button>
                <button onclick="eliminar('usuarios', ${u.id_usuario})" class="btn-action btn-del"><i class="fa-solid fa-user-xmark"></i></button>
            </div>
        </li>
    `).join('');
}

async function cargarAnimales() {
    const res = await fetch('/api/animales');
    const data = await res.json();
    document.getElementById('listaAnimales').innerHTML = data.map(a => `
        <li class="item-lista">
            <span><b>${a.nombre_animal}</b> - <i>${a.estado}</i></span>
            <div class="actions">
                <button onclick="editarNombre('animales', ${a.id_animal}, '${a.nombre_animal}')" class="btn-action btn-edit" style="background:#e0f2fe; color:#0369a1"><i class="fa-solid fa-pen"></i></button>
                <button onclick="toggleEstado(${a.id_animal}, '${a.estado}')" class="btn-action btn-edit"><i class="fa-solid fa-rotate"></i></button>
                <button onclick="eliminar('animales', ${a.id_animal})" class="btn-action btn-del"><i class="fa-solid fa-trash-can"></i></button>
            </div>
        </li>
    `).join('');
}

// ==========================================
// 3. ACCIONES DE ACTUALIZAR Y ELIMINAR (UPDATE / DELETE)
// ==========================================
async function editarNombre(entidad, id, nombreActual) {
    const { value: nuevoNombre } = await Swal.fire({
        title: 'Editar nombre',
        input: 'text',
        inputValue: nombreActual,
        showCancelButton: true,
        confirmButtonColor: '#4361ee',
        inputValidator: (value) => !value && 'El nombre es obligatorio'
    });

    if (nuevoNombre && nuevoNombre !== nombreActual) {
        await fetch(`/api/${entidad}?id=${id}`, { 
            method: 'PATCH', 
            body: JSON.stringify({ nombre: nuevoNombre }) 
        });
        mostrarToast('Nombre actualizado');
        cargarTodo();
    }
}

async function eliminar(entidad, id) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción eliminará el registro permanentemente",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef233c',
        confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
        await fetch(`/api/${entidad}?id=${id}`, { method: 'DELETE' });
        mostrarToast('Registro eliminado');
        cargarTodo();
    }
}

async function toggleEstado(id, actual) {
    const nuevo = actual === 'Disponible' ? 'Adoptado' : 'Disponible';
    await fetch(`/api/animales?id=${id}`, { 
        method: 'PATCH', 
        body: JSON.stringify({ estado: nuevo }) 
    });
    mostrarToast('Estado actualizado');
    cargarAnimales();
}

// ==========================================
// 4. REGISTRO DE DATOS (CREATE)
// ==========================================
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
                edad: document.getElementById('edad').value, 
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
        }

        const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) });
        if (res.ok) {
            e.target.reset();
            mostrarToast('Registrado correctamente');
            cargarTodo();
        }
    };
});