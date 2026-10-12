#!/usr/bin/env python3
"""Genera los iconos PWA (favicon.ico y PNG) a partir de la huella de marca.

Uso:  python3 tools/generate-icons.py
Salida: favicon.ico, icon-192.png, icon-512.png, icon-maskable-512.png,
        apple-touch-icon.png
El equivalente vectorial se mantiene a mano en favicon.svg.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent

BRAND_BG = (67, 97, 238, 255)      # #4361ee
BRAND_FG = (255, 255, 255, 255)
SUPERSAMPLE = 8                     # renderizado 8x + reducción = bordes suaves
CORNER_RATIO = 0.22                 # radio de esquina relativo al lienzo

# Huella en coordenadas normalizadas (0..1): (cx, cy, rx, ry)
TOES = [
    (0.230, 0.395, 0.088, 0.118),
    (0.415, 0.270, 0.092, 0.125),
    (0.630, 0.270, 0.092, 0.125),
    (0.812, 0.395, 0.088, 0.118),
]
PAD = (0.520, 0.690, 0.215, 0.185)


# Los iconos "maskable" se recortan a un círculo: la huella se reduce a la zona segura.
MASKABLE_SCALE = 0.62


def _ellipse(draw: ImageDraw.ImageDraw, size: int, shape: tuple, scale: float) -> None:
    cx, cy, rx, ry = shape
    cx, cy = 0.5 + (cx - 0.5) * scale, 0.5 + (cy - 0.5) * scale
    rx, ry = rx * scale, ry * scale
    draw.ellipse(
        [(cx - rx) * size, (cy - ry) * size, (cx + rx) * size, (cy + ry) * size],
        fill=BRAND_FG,
    )


def render(size: int, rounded: bool = True, scale: float = 1.0) -> Image.Image:
    """Devuelve una imagen nueva con la huella de marca al tamaño pedido."""
    canvas = size * SUPERSAMPLE
    image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    if rounded:
        draw.rounded_rectangle(
            [0, 0, canvas - 1, canvas - 1],
            radius=int(canvas * CORNER_RATIO),
            fill=BRAND_BG,
        )
    else:
        draw.rectangle([0, 0, canvas - 1, canvas - 1], fill=BRAND_BG)

    for toe in TOES:
        _ellipse(draw, canvas, toe, scale)
    _ellipse(draw, canvas, PAD, scale)

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    # apple-touch-icon se sirve sin transparencia ni esquinas: iOS aplica su propia máscara.
    render(180, rounded=False).convert("RGB").save(ROOT / "apple-touch-icon.png", "PNG")
    render(192).save(ROOT / "icon-192.png", "PNG")
    render(512).save(ROOT / "icon-512.png", "PNG")
    render(512, rounded=False, scale=MASKABLE_SCALE).save(
        ROOT / "icon-maskable-512.png", "PNG"
    )
    render(64).save(
        ROOT / "favicon.ico",
        "ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("Iconos generados en", ROOT)


if __name__ == "__main__":
    main()
