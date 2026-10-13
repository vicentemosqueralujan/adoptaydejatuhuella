// ==========================================================================
// Primitivas de interfaz: avisos, confirmaciones y entradas rápidas.
//
// Sustituyen a SweetAlert2 para que cada superficie salga del sistema de
// diseño propio (DESIGN_SYSTEM.md §5.4) en lugar de los estilos de la librería.
// Depende de `icono()` de js/icons.js.
// ==========================================================================

const DURACION_TOAST = 2600;

/** Escapa texto antes de insertarlo en HTML: los datos vienen de la API. */
function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// ---------------------------------------------------------------- Toasts ---

function contenedorToasts() {
    let cont = document.getElementById('toastContenedor');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'toastContenedor';
        cont.className = 'toast-contenedor';
        cont.setAttribute('role', 'status');
        cont.setAttribute('aria-live', 'polite');
        document.body.appendChild(cont);
    }
    return cont;
}

/**
 * Aviso efímero en la esquina superior derecha.
 * @param {string} mensaje
 * @param {'exito'|'error'|'info'} tipo
 */
function toast(mensaje, tipo = 'exito') {
    const iconos = { exito: 'check', error: 'alerta', info: 'info' };

    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.innerHTML = `${icono(iconos[tipo] ?? 'info', 18)}<span>${esc(mensaje)}</span>`;
    contenedorToasts().appendChild(el);

    // La salida se encadena a la transición para no dejar nodos huérfanos.
    setTimeout(() => {
        el.classList.add('saliendo');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 400);
    }, DURACION_TOAST);
}

// --------------------------------------------------- Gestor de modales ---
//
// Política de exclusividad (DESIGN_SYSTEM.md §5.4): sólo un modal abierto a la
// vez. Toda apertura pasa por `abrirModal()`, que cierra antes cualquier otro
// `<dialog>` abierto; así no se apilan modales ni quedan fondos fantasma.

/** Cierra todos los modales abiertos salvo `excepto`. */
function cerrarModales(excepto = null) {
    document.querySelectorAll('dialog[open], .modal[open]').forEach(dlg => {
        if (dlg === excepto) return;
        if (typeof dlg.close === 'function') dlg.close();
        dlg.removeAttribute('open'); // por si se abrió con el atributo y no con showModal()
    });
}

/** Cierra todos los modales sin excepción (alias público del gestor). */
window.cerrarTodosLosModales = () => cerrarModales();

/** Abre `dlg` como único modal activo. Si ya está abierto, no hace nada más. */
function abrirModal(dlg) {
    if (!dlg) return;
    cerrarModales(dlg);
    if (!dlg.open) dlg.showModal();
}

/** Cierra `dlg` si está abierto; el estado visible es el atributo nativo `open`. */
function cerrarModal(dlg) {
    if (dlg?.open) dlg.close();
}

// ------------------------------------------------------ Diálogo genérico ---

/**
 * Abre un `<dialog>` construido al vuelo y resuelve con el valor devuelto.
 * El diálogo se destruye al cerrarse: no deja marcado residual en el DOM.
 *
 * @param {{titulo: string, cuerpo: string, acciones: Array, ancho?: string}} config
 * @returns {Promise<any>} valor de la acción pulsada, o `null` si se descarta.
 */
function abrirDialogo({ titulo, cuerpo, acciones, ancho = '420px', alCrear }) {
    return new Promise(resolve => {
        const dlg = document.createElement('dialog');
        dlg.className = 'modal modal-dialogo';
        dlg.style.maxWidth = `min(${ancho}, calc(100vw - 2rem))`;

        dlg.innerHTML = `
            <div class="modal-head">
                <h3>${esc(titulo)}</h3>
                <button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">
                    ${icono('cerrar', 20)}
                </button>
            </div>
            <div class="modal-body">${cuerpo}</div>
            <div class="modal-foot">
                ${acciones.map((a, i) => `
                    <button type="button" class="${a.clase ?? 'btn-secundario'}" data-accion-dlg="${i}">
                        ${a.icono ? icono(a.icono, 18) : ''}${esc(a.texto)}
                    </button>`).join('')}
            </div>`;

        let resuelto = false;
        const terminar = valor => {
            if (resuelto) return;
            resuelto = true;
            resolve(valor);
            dlg.close();
        };

        dlg.querySelector('[data-cerrar]').addEventListener('click', () => terminar(null));

        dlg.querySelectorAll('[data-accion-dlg]').forEach(boton => {
            boton.addEventListener('click', () => {
                const accion = acciones[Number(boton.dataset.accionDlg)];
                // `valor` puede ser una función para leer campos del propio diálogo.
                const valor = typeof accion.valor === 'function' ? accion.valor(dlg) : accion.valor;
                if (valor !== undefined) terminar(valor);
            });
        });

        // Clic fuera del contenido: el backdrop es el propio <dialog>.
        dlg.addEventListener('click', e => { if (e.target === dlg) terminar(null); });
        // `Esc` dispara `cancel`; se resuelve igual que descartar.
        dlg.addEventListener('cancel', () => terminar(null));
        dlg.addEventListener('close', () => { terminar(null); dlg.remove(); });

        document.body.appendChild(dlg);
        abrirModal(dlg);
        alCrear?.(dlg);
        dlg.querySelector('[data-foco]')?.focus();
    });
}

/** Mensaje informativo con un único botón de cierre. */
function aviso(titulo, mensaje, tipo = 'info') {
    return abrirDialogo({
        titulo,
        cuerpo: `<p class="dialogo-texto dialogo-${tipo}">${mensaje}</p>`,
        acciones: [{ texto: 'Entendido', clase: 'btn-primario', valor: true }],
    });
}

/** Confirmación de dos opciones. Resuelve `true` sólo si se confirma. */
async function confirmar({ titulo, mensaje, confirmar: textoOk = 'Confirmar',
                           cancelar = 'Cancelar', peligroso = false }) {
    const respuesta = await abrirDialogo({
        titulo,
        cuerpo: `<p class="dialogo-texto">${esc(mensaje)}</p>`,
        acciones: [
            { texto: cancelar, clase: 'btn-secundario', valor: false },
            {
                texto: textoOk,
                clase: peligroso ? 'btn-peligro' : 'btn-primario',
                icono: peligroso ? 'eliminar' : 'check',
                valor: true,
            },
        ],
    });
    return respuesta === true;
}

/** Entrada de texto en un paso. Resuelve con el texto, o `null` si se descarta. */
function pedirTexto({ titulo, etiqueta, valor = '', placeholder = '' }) {
    return abrirDialogo({
        titulo,
        cuerpo: `
            <label class="campo">
                <span>${esc(etiqueta)}</span>
                <input type="text" data-foco data-entrada value="${esc(valor)}"
                       placeholder="${esc(placeholder)}">
            </label>
            <p class="campo-error" data-error hidden role="alert"></p>`,
        acciones: [
            { texto: 'Cancelar', clase: 'btn-secundario', valor: null },
            {
                texto: 'Guardar',
                clase: 'btn-primario',
                icono: 'guardar',
                valor: dlg => {
                    const texto = dlg.querySelector('[data-entrada]').value.trim();
                    if (texto) return texto;
                    // Sin valor no se resuelve: el diálogo sigue abierto con el error.
                    const error = dlg.querySelector('[data-error]');
                    error.textContent = 'Este campo no puede estar vacío';
                    error.hidden = false;
                    return undefined;
                },
            },
        ],
        alCrear: dlg => {
            dlg.querySelector('[data-entrada]').addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    dlg.querySelector('[data-accion-dlg="1"]').click();
                }
            });
        },
    });
}

// ------------------------------------------------- Estado de los botones ---

/**
 * Pone un botón en estado de carga y devuelve la función que lo restaura.
 * Conserva el ancho para que la fila no salte al cambiar el contenido.
 */
function botonCargando(boton, texto = 'Guardando…') {
    if (!boton) return () => {};

    const original = boton.innerHTML;
    const ancho = boton.offsetWidth;

    boton.disabled = true;
    boton.style.minWidth = `${ancho}px`;
    boton.innerHTML = `<span class="girando">${icono('cargando', 18)}</span>${esc(texto)}`;

    return () => {
        boton.disabled = false;
        boton.style.minWidth = '';
        boton.innerHTML = original;
    };
}
