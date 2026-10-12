// ==========================================================================
// Compresión de imágenes en el navegador y galería de hasta 6 fotos.
//
// Las fotos se guardan como data URL dentro de la columna JSONB `animal.fotos`,
// así que comprimir en cliente no es un lujo: es lo que hace viable almacenar
// las imágenes en Neon sin un bucket aparte.
//
// Depende de `icono()` (js/icons.js) y `toast()` (js/ui.js).
// ==========================================================================

const MAX_FOTOS      = 6;
const MAX_ANCHO      = 1920;   // 1080p en horizontal
const MAX_ALTO       = 1080;
const CALIDAD_BASE   = 0.75;
const PESO_OBJETIVO  = 100 * 1024;           // 100 KB por foto
const CALIDADES      = [0.75, 0.62, 0.5, 0.4];
const REESCALADOS    = [1, 0.8, 0.64];       // pasadas si no se baja de 100 KB
const TIPOS_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const PESO_MAXIMO_ENTRADA = 20 * 1024 * 1024;

/** `image/webp` si el navegador sabe codificarlo; si no, JPEG. */
const FORMATO_SALIDA = (() => {
    try {
        const prueba = document.createElement('canvas');
        prueba.width = prueba.height = 1;
        return prueba.toDataURL('image/webp').startsWith('data:image/webp')
            ? 'image/webp'
            : 'image/jpeg';
    } catch {
        return 'image/jpeg';
    }
})();

/** Peso real en bytes de una data URL base64. */
function pesoDataUrl(dataUrl) {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.floor(base64.length * 3 / 4) - relleno;
}

/** Carga un fichero en un bitmap dibujable, liberando siempre el object URL. */
async function cargarImagen(file) {
    if (typeof createImageBitmap === 'function') {
        try { return await createImageBitmap(file); } catch { /* se prueba con <img> */ }
    }

    const url = URL.createObjectURL(file);
    try {
        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload  = () => resolve(img);
            img.onerror = () => reject(new Error('El archivo no es una imagen válida'));
            img.src = url;
        });
    } finally {
        URL.revokeObjectURL(url);
    }
}

/** Dimensiones destino respetando la proporción y el techo de 1920×1080. */
function dimensionar(ancho, alto, escala) {
    const factor = Math.min(MAX_ANCHO / ancho, MAX_ALTO / alto, 1) * escala;
    return {
        ancho: Math.max(1, Math.round(ancho * factor)),
        alto:  Math.max(1, Math.round(alto * factor)),
    };
}

/**
 * Comprime un fichero de imagen a data URL.
 *
 * Baja primero la calidad y, si aun así no cabe en 100 KB, reduce la resolución.
 * Devuelve el mejor intento aunque ninguna pasada alcance el objetivo: es
 * preferible una foto algo más pesada que perder la imagen.
 *
 * @param {File} file
 * @returns {Promise<{dataUrl: string, peso: number, ancho: number, alto: number}>}
 */
async function comprimirImagen(file) {
    if (!TIPOS_ACEPTADOS.includes(file.type))
        throw new Error(`«${file.name}»: formato no admitido`);
    if (file.size > PESO_MAXIMO_ENTRADA)
        throw new Error(`«${file.name}»: supera los 20 MB`);

    const bitmap = await cargarImagen(file);
    const anchoOriginal = bitmap.width  ?? bitmap.naturalWidth;
    const altoOriginal  = bitmap.height ?? bitmap.naturalHeight;

    const lienzo = document.createElement('canvas');
    const ctx = lienzo.getContext('2d');
    let mejor = null;

    for (const escala of REESCALADOS) {
        const { ancho, alto } = dimensionar(anchoOriginal, altoOriginal, escala);
        lienzo.width  = ancho;
        lienzo.height = alto;

        // Fondo blanco: los PNG con transparencia quedarían negros en JPEG.
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, ancho, alto);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, ancho, alto);

        for (const calidad of CALIDADES) {
            const dataUrl = lienzo.toDataURL(FORMATO_SALIDA, calidad);
            const peso = pesoDataUrl(dataUrl);

            if (!mejor || peso < mejor.peso) mejor = { dataUrl, peso, ancho, alto };
            if (peso <= PESO_OBJETIVO) {
                bitmap.close?.();
                return mejor;
            }
        }
    }

    bitmap.close?.();
    return mejor;
}

// ------------------------------------------------------------- Galería ----

/**
 * Galería de hasta 6 fotos con selector de foto principal.
 *
 * El estado es inmutable: cada cambio reemplaza el array completo y repinta,
 * de modo que no hay forma de que la vista y los datos se desincronicen.
 */
class GaleriaFotos {
    /**
     * @param {HTMLElement} contenedor  Nodo donde se pinta la galería.
     * @param {string[]} fotos          Data URLs iniciales (la primera es la principal).
     */
    constructor(contenedor, fotos = []) {
        this.contenedor = contenedor;
        this.fotos = [];
        this.ocupado = false;
        this.montar();
        this.establecer(fotos);
    }

    montar() {
        this.contenedor.innerHTML = `
            <div class="galeria">
                <div class="galeria-grid" data-grid></div>
                <label class="galeria-soltar" data-soltar>
                    <input type="file" accept="image/*" multiple hidden data-input>
                    <span class="galeria-soltar-icono">${icono('camara', 24)}</span>
                    <span class="galeria-soltar-texto">
                        <strong>Añade fotos</strong>
                        <small>Arrastra o pulsa · hasta ${MAX_FOTOS} · se comprimen solas</small>
                    </span>
                </label>
                <p class="galeria-estado" data-estado aria-live="polite"></p>
            </div>`;

        this.grid   = this.contenedor.querySelector('[data-grid]');
        this.input  = this.contenedor.querySelector('[data-input]');
        this.soltar = this.contenedor.querySelector('[data-soltar]');
        this.estado = this.contenedor.querySelector('[data-estado]');

        this.input.addEventListener('change', () => {
            this.anadir(this.input.files);
            this.input.value = '';   // permite volver a elegir el mismo fichero
        });

        ['dragenter', 'dragover'].forEach(evento =>
            this.soltar.addEventListener(evento, e => {
                e.preventDefault();
                this.soltar.classList.add('arrastrando');
            }));

        ['dragleave', 'drop'].forEach(evento =>
            this.soltar.addEventListener(evento, e => {
                e.preventDefault();
                this.soltar.classList.remove('arrastrando');
            }));

        this.soltar.addEventListener('drop', e => this.anadir(e.dataTransfer?.files));

        this.grid.addEventListener('click', e => {
            const boton = e.target.closest('[data-foto-accion]');
            if (!boton) return;
            e.preventDefault();

            const indice = Number(boton.dataset.indice);
            if (boton.dataset.fotoAccion === 'quitar')     this.quitar(indice);
            if (boton.dataset.fotoAccion === 'principal')  this.hacerPrincipal(indice);
        });
    }

    /** Reemplaza la lista completa (carga inicial o reinicio del formulario). */
    establecer(fotos) {
        this.fotos = (Array.isArray(fotos) ? fotos : [])
            .filter(f => typeof f === 'string' && f.startsWith('data:image'))
            .slice(0, MAX_FOTOS);
        this.render();
    }

    valor() {
        return [...this.fotos];
    }

    async anadir(listaFicheros) {
        const ficheros = Array.from(listaFicheros ?? []);
        if (!ficheros.length || this.ocupado) return;

        const hueco = MAX_FOTOS - this.fotos.length;
        if (hueco <= 0) {
            toast(`Máximo ${MAX_FOTOS} fotos por animal`, 'error');
            return;
        }
        if (ficheros.length > hueco)
            toast(`Sólo caben ${hueco} foto${hueco === 1 ? '' : 's'} más`, 'info');

        this.ocupado = true;
        const aProcesar = ficheros.slice(0, hueco);
        const nuevas = [];

        for (const [i, file] of aProcesar.entries()) {
            this.estado.textContent = `Comprimiendo ${i + 1} de ${aProcesar.length}…`;
            try {
                const { dataUrl, peso } = await comprimirImagen(file);
                nuevas.push(dataUrl);
                // Deja constancia del ahorro: es la prueba de que la compresión actúa.
                console.info(`[fotos] ${file.name}: ${(file.size / 1024).toFixed(0)} KB → ${(peso / 1024).toFixed(0)} KB`);
            } catch (e) {
                toast(e.message, 'error');
            }
        }

        this.ocupado = false;
        this.estado.textContent = '';

        if (nuevas.length) {
            this.fotos = [...this.fotos, ...nuevas];
            this.render();
        }
    }

    quitar(indice) {
        this.fotos = this.fotos.filter((_, i) => i !== indice);
        this.render();
    }

    /** La principal es siempre la primera posición del array. */
    hacerPrincipal(indice) {
        if (indice === 0) return;
        const elegida = this.fotos[indice];
        if (!elegida) return;
        this.fotos = [elegida, ...this.fotos.filter((_, i) => i !== indice)];
        this.render();
    }

    render() {
        this.grid.innerHTML = this.fotos.map((src, i) => `
            <figure class="galeria-item${i === 0 ? ' es-principal' : ''}">
                <img src="${src}" alt="Fotografía ${i + 1} del animal" loading="lazy">
                ${i === 0 ? `<span class="galeria-distintivo">${icono('estrella', 14)} Principal</span>` : ''}
                <div class="galeria-acciones">
                    ${i !== 0 ? `
                        <button type="button" class="galeria-boton" data-foto-accion="principal"
                                data-indice="${i}" title="Marcar como principal"
                                aria-label="Marcar la foto ${i + 1} como principal">
                            ${icono('estrella', 16)}
                        </button>` : ''}
                    <button type="button" class="galeria-boton galeria-boton-quitar"
                            data-foto-accion="quitar" data-indice="${i}" title="Quitar foto"
                            aria-label="Quitar la foto ${i + 1}">
                        ${icono('eliminar', 16)}
                    </button>
                </div>
            </figure>`).join('');

        const restantes = MAX_FOTOS - this.fotos.length;
        this.soltar.hidden = restantes <= 0;
        this.soltar.querySelector('.galeria-soltar-texto small').textContent =
            `Arrastra o pulsa · quedan ${restantes} · se comprimen solas`;
    }
}
