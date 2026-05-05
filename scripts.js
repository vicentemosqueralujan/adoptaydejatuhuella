// Función para cargar animales desde el backend
async function cargarAnimales() {
    const lista = document.getElementById('listaAnimales');
    lista.innerHTML = 'Cargando...';

    try {
        const response = await fetch('/api/animales'); // Ruta que crearemos en Vercel
        const animales = await response.json();

        lista.innerHTML = '';
        animales.forEach(a => {
            const li = document.createElement('li');
            li.textContent = `${a.nombre_animal} (${a.especie_animal}) - Estado: ${a.estado}`;
            lista.appendChild(li);
        });
    } catch (error) {
        lista.innerHTML = '❌ Error al conectar con la base de datos.';
    }
}

// Evento para el formulario
document.getElementById('animalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nuevoAnimal = {
        nombre: document.getElementById('nombre').value,
        especie: document.getElementById('especie').value,
        edad: document.getElementById('edad').value
    };

    try {
        await fetch('/api/animales', {
            method: 'POST',
            body: JSON.stringify(nuevoAnimal)
        });
        alert('¡Animal guardado en la nube!');
        cargarAnimales(); // Refrescar lista
    } catch (error) {
        alert('Error al guardar');
    }
});

// Cargar al inicio
cargarAnimales();