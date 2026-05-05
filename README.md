# Dashboard — Adopta y Deja tu Huella

Sistema de administración interna para la gestión de protectoras, usuarios y animales en adopción.

## 🛠️ Últimas Mejoras y Correcciones
- **Fix (Botones de Acción):** Se ha corregido un bug crítico donde el botón de "Editar" no respondía. El error se debía a un conflicto de comillas (dobles vs simples) en la generación dinámica del HTML dentro de `scripts.js`.
- **Escapado de Caracteres:** Se añadió soporte para nombres que contengan apóstrofes (ej. "L'Arca"), evitando que rompan la ejecución del JavaScript.
- **UI/UX:** Optimización de los cierres de sesión y avisos de SweetAlert2.

## 🚀 Tecnologías utilizadas
- **Frontend:** HTML5, CSS3 (Variables), JavaScript Vanilla.
- **Componentes:** FontAwesome 6, SweetAlert2.
- **Backend/DB:** Integrado con la API del proyecto y Base de Datos en Vercel/Postgres.