// ==========================================================================
// Visor de fotografías a pantalla completa (DESIGN_SYSTEM.md §5.3).
//
// Vive DENTRO de `#modalFicha`, no es un segundo <dialog>: así se respeta la
// política de un único modal abierto y la ficha sigue en la *top layer*.
// Se abre pulsando la foto principal; navega con flechas, teclado y deslizando.
// ==========================================================================

/** Desplazamiento horizontal mínimo (px) para que un gesto cuente como swipe. */
const UMBRAL_SWIPE = 50;

const visor = {
    raiz:      document.getElementById('visorFotos'),
    imagen:    document.getElementById('visorImagen'),
    contador:  document.getElementById('visorContador'),
    previo:    document.getElementById('visorPrev'),
    siguiente: document.getElementById('visorNext'),
    cerrar:    document.getElementById('visorCerrar'),
    fotos:     [],
    indice:    0,
    origen:    null,   // elemento que recupera el foco al cerrar
    inicioX:   null,
};

function visorAbierto() {
    return Boolean(visor.raiz && !visor.raiz.hidden);
}

function pintarVisor() {
    const total = visor.fotos.length;
    visor.imagen.src = visor.fotos[visor.indice];
    visor.imagen.alt = `Fotografía ${visor.indice + 1} de ${total}`;
    visor.contador.textContent = `${visor.indice + 1} / ${total}`;
    // Con una sola foto no hay nada que navegar.
    visor.previo.hidden = visor.siguiente.hidden = total < 2;
}

/** Fotos de la ficha abierta: las miniaturas, o la principal si sólo hay una. */
function fotosDeLaFicha() {
    const miniaturas = [...document.querySelectorAll('#fichaCuerpo .ficha-miniatura')];
    if (miniaturas.length) {
        const activa = miniaturas.findIndex(m => m.classList.contains('is-active'));
        return { fotos: miniaturas.map(m => m.dataset.src), indice: Math.max(0, activa) };
    }
    const principal = document.getElementById('fichaFotoPrincipal');
    return { fotos: principal ? [principal.src] : [], indice: 0 };
}

function abrirVisor(origen) {
    const { fotos, indice } = fotosDeLaFicha();
    if (!visor.raiz || !fotos.length) return;

    Object.assign(visor, { fotos, indice, origen });
    pintarVisor();
    visor.raiz.hidden = false;
    visor.cerrar.focus();
}

function cerrarVisor() {
    if (!visorAbierto()) return;
    visor.raiz.hidden = true;
    visor.imagen.removeAttribute('src');

    // La ficha queda mostrando la última foto vista en el visor.
    document.querySelectorAll('#fichaCuerpo .ficha-miniatura')[visor.indice]?.click();
    visor.origen?.focus();
}

function moverVisor(paso) {
    const total = visor.fotos.length;
    if (total < 2) return;
    visor.indice = (visor.indice + paso + total) % total;
    pintarVisor();
}

function inicializarVisor() {
    if (!visor.raiz) return;

    visor.cerrar.innerHTML    = icono('cerrar', 24);
    visor.previo.innerHTML    = icono('flecha-izq', 24);
    visor.siguiente.innerHTML = icono('flecha-der', 24);

    visor.cerrar.addEventListener('click', cerrarVisor);
    visor.previo.addEventListener('click', () => moverVisor(-1));
    visor.siguiente.addEventListener('click', () => moverVisor(1));

    // Clic en el fondo (fuera de la imagen y de los controles) cierra.
    visor.raiz.addEventListener('click', e => {
        if (e.target === visor.raiz || e.target.classList.contains('visor-escena')) cerrarVisor();
    });

    // Gesto de deslizar en móvil.
    visor.raiz.addEventListener('pointerdown', e => { visor.inicioX = e.clientX; });
    visor.raiz.addEventListener('pointerup', e => {
        if (visor.inicioX === null) return;
        const dx = e.clientX - visor.inicioX;
        visor.inicioX = null;
        if (Math.abs(dx) >= UMBRAL_SWIPE) moverVisor(dx < 0 ? 1 : -1);
    });

    // `Esc` cierra sólo el visor: se cancela el cierre nativo de la ficha.
    modalFicha?.addEventListener('cancel', e => {
        if (!visorAbierto()) return;
        e.preventDefault();
        cerrarVisor();
    });
    modalFicha?.addEventListener('keydown', e => {
        if (!visorAbierto()) return;
        if (e.key === 'ArrowLeft')  { e.preventDefault(); moverVisor(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); moverVisor(1); }
    });
    // Si la ficha se cierra por cualquier vía, el visor no queda abierto.
    modalFicha?.addEventListener('close', () => { visor.raiz.hidden = true; });
}

document.addEventListener('click', e => {
    const boton = e.target.closest('[data-accion="ficha-ampliar"]');
    if (boton) abrirVisor(boton);
});

inicializarVisor();
