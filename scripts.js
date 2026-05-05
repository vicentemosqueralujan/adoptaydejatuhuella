// --- UTILIDADES ---
function mostrarToast(titulo, icono = 'success') {
    Swal.fire({
        title: titulo,
        icon: icono,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
}

// --- CARGA DE DATOS ---
async function cargarTodo() {
    cargarProtectoras();
    cargarUsuarios();
    cargarAnimales();
}

async function cargarProtectoras() {
    const res = await fetch('/api/protectoras');
    const data = await res.json();
    const lista = document.getElementById('listaProtectoras');
    const select = document.getElementById('selectProtectora');
    
    lista.innerHTML = data.map(p => `
        <li class="item-lista">
            <span>${p.nombre_protectora}</span>
            <button onclick="eliminar('protectoras', ${p.id_protectora})" class="btn-action btn-del">
                <i class="fa-solid fa-trash"></i>
            </button>
        </li>
    `).join('');
    
    select.innerHTML = data.map(p => `<option value="${p.id_protectora}">${p.nombre_protectora}</option>`).join('');
}

async function cargarUsuarios() {
    const res = await fetch('/api/usuarios');
    const data = await res.json();
    document.getElementById('listaUsuarios').innerHTML = data.map(u => `
        <li class="item-lista">
            <span>${u.nombre_usuario} (<b>${u.tipo_usuario}</b>)</span>
            <button onclick="eliminar('usuarios', ${u.id_usuario})" class="btn-action btn-del">
                <i class="fa-solid fa-user-xmark"></i>
            </button>
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
                <button onclick="toggleEstado(${a.id_animal}, '${a.estado}')" class="btn-action btn-edit">
                    <i class="fa-solid fa-rotate"></i>
                </button>
                <button onclick="eliminar('animales', ${a.id_animal})" class="btn-action btn-del">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </li>
    `).join('');
}

// --- ACCIONES ---
async function eliminar(entidad, id) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "Esta acción no se puede deshacer",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4361ee',
        cancelButtonColor: '#ef233c',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            await fetch(`/api/${entidad}?id=${id}`, { method: 'DELETE' });
            mostrarToast('Registro eliminado');
            cargarTodo();
        } catch (error) {
            mostrarToast('Error al eliminar', 'error');
        }
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

// --- ENVÍO DE FORMULARIOS CON LIMPIEZA ---
document.getElementById('animalForm').onsubmit = async (e) => {
    e.preventDefault();
    const body = {
        nombre: document.getElementById('nombre').value,
        especie: document.getElementById('especie').value,
        edad: document.getElementById('edad').value,
        id_protectora: document.getElementById('selectProtectora').value
    };
    await fetch('/api/animales', { method: 'POST', body: JSON.stringify(body) });
    e.target.reset(); // LIMPIEZA DEL FORMULARIO
    mostrarToast('Animal registrado');
    cargarAnimales();
};

document.getElementById('formProtectora').onsubmit = async (e) => {
    e.preventDefault();
    const body = { 
        nombre: document.getElementById('p_nombre').value, 
        ubicacion: document.getElementById('p_ubicacion').value 
    };
    await fetch('/api/protectoras', { method: 'POST', body: JSON.stringify(body) });
    e.target.reset(); // LIMPIEZA DEL FORMULARIO
    mostrarToast('Protectora guardada');
    cargarProtectoras();
};

document.getElementById('formUsuario').onsubmit = async (e) => {
    e.preventDefault();
    const body = { 
        nombre: document.getElementById('u_nombre').value, 
        email: document.getElementById('u_email').value, 
        tipo: document.getElementById('u_tipo').value 
    };
    await fetch('/api/usuarios', { method: 'POST', body: JSON.stringify(body) });
    e.target.reset(); // LIMPIEZA DEL FORMULARIO
    mostrarToast('Usuario creado');
    cargarUsuarios();
};

cargarTodo();