// Funciones de Carga
async function cargarTodo() {
    await cargarProtectoras();
    await cargarUsuarios();
    await cargarAnimales();
}

async function cargarProtectoras() {
    const res = await fetch('/api/protectoras');
    const data = await res.json();
    const lista = document.getElementById('listaProtectoras');
    const select = document.getElementById('selectProtectora');
    
    lista.innerHTML = '';
    select.innerHTML = '';
    data.forEach(p => {
        lista.innerHTML += `<li>${p.nombre_protectora} (${p.ubicacion || 'Sin ubicación'})</li>`;
        select.innerHTML += `<option value="${p.id_protectora}">${p.nombre_protectora}</option>`;
    });
}

async function cargarUsuarios() {
    const res = await fetch('/api/usuarios');
    const data = await res.json();
    const lista = document.getElementById('listaUsuarios');
    lista.innerHTML = data.map(u => `<li>${u.nombre_usuario} - <b>${u.tipo_usuario}</b></li>`).join('');
}

async function cargarAnimales() {
    const res = await fetch('/api/animales');
    const data = await res.json();
    const lista = document.getElementById('listaAnimales');
    lista.innerHTML = data.map(a => `<li>${a.nombre_animal} (${a.especie_animal}) - ${a.estado}</li>`).join('');
}

// Eventos de Formulario
document.getElementById('animalForm').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        nombre: document.getElementById('nombre').value,
        especie: document.getElementById('especie').value,
        edad: document.getElementById('edad').value,
        id_protectora: document.getElementById('selectProtectora').value
    };
    await fetch('/api/animales', { method: 'POST', body: JSON.stringify(payload) });
    cargarAnimales();
};

document.getElementById('formProtectora').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        nombre: document.getElementById('p_nombre').value,
        ubicacion: document.getElementById('p_ubicacion').value
    };
    await fetch('/api/protectoras', { method: 'POST', body: JSON.stringify(payload) });
    cargarProtectoras();
};

document.getElementById('formUsuario').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
        nombre: document.getElementById('u_nombre').value,
        email: document.getElementById('u_email').value,
        tipo: document.getElementById('u_tipo').value
    };
    await fetch('/api/usuarios', { method: 'POST', body: JSON.stringify(payload) });
    cargarUsuarios();
};

// Inicio
cargarTodo();