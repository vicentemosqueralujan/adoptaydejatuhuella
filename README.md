# 🐾 Adopta y Deja tu Huella — Plataforma Centralizada de Adopción

[![Status: Entregable 4](https://img.shields.io/badge/Status-Entregable%204-green)](https://github.com/vicentemosqueralujan/adoptaydejatuhuella)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Frontend: Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-yellow)](https://developer.mozilla.org/es/docs/Web/JavaScript)
[![Backend: Vercel Functions](https://img.shields.io/badge/Backend-Vercel%20Functions-black)](https://vercel.com/docs/functions)
[![DB: Neon Postgres](https://img.shields.io/badge/DB-Neon%20Postgres-00e599)](https://neon.tech)

**Adopta y Deja tu Huella** centraliza el catálogo de varias protectoras de animales en un
único panel seguro. Este repositorio contiene el **panel administrativo (SPA)** y su API
serverless: alta, consulta, edición y baja de protectoras, usuarios y animales.

---

## 📌 Visión general

La información sobre animales en adopción está hoy fragmentada entre protectoras. La
solución unifica esas fuentes en una **Single Page Application** autogestionable:

- **Protectoras:** gestionan sus registros de animales y su propio perfil.
- **Adoptantes:** consultan y filtran animales en tiempo real.
- **Administradores:** supervisan la integridad de los datos desde el panel.

---

## 🏗️ Arquitectura cloud

Arquitectura de 3 capas desplegada íntegramente sobre infraestructura gestionada:

```
Navegador (SPA)                Vercel Functions              Neon Postgres
┌────────────────────┐  fetch  ┌────────────────────┐  SQL   ┌──────────────┐
│ index.html         │ ──────► │ /api/login         │ ─────► │  usuario     │
│ styles.css         │  JSON   │ /api/protectoras   │        │  protectora  │
│ scripts.js         │ ◄────── │ /api/usuarios      │ ◄───── │  animal      │
│ manifest.json + PWA│         │ /api/animales      │        └──────────────┘
└────────────────────┘         └────────────────────┘
                                 POSTGRES_URL (env)
```

| Capa | Tecnología | Justificación |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, JavaScript ES6+ | Sin build step ni framework: carga mínima y despliegue directo. |
| **UI libs** | Font Awesome 6, SweetAlert2 11 (CDN) | Iconografía y diálogos sin dependencias de compilación. |
| **Backend** | Node.js ≥18, Vercel Serverless Functions | Escalado automático; un fichero por recurso en `api/`. |
| **Acceso a datos** | `@vercel/postgres` (plantillas `sql\`\``) | Consultas parametrizadas, sin concatenación de SQL. |
| **Autenticación** | `bcryptjs` | Verificación de contraseñas con hash. |
| **Base de datos** | PostgreSQL gestionado (Neon) | Relacional, con integridad referencial y conexión serverless. |
| **Despliegue** | Vercel (CI/CD desde GitHub) | Cada push a `main` genera un despliegue. |

### Routing

Vercel mapea automáticamente cada fichero de `api/` a una ruta. No hace falta `vercel.json`.

| Endpoint | Fichero | Métodos | Descripción |
| :--- | :--- | :--- | :--- |
| `/api/login` | `api/login.js` | `POST`, `OPTIONS` | Valida credenciales y devuelve `{ success, user }`. |
| `/api/protectoras` | `api/protectoras.js` | `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS` | CRUD de protectoras. |
| `/api/usuarios` | `api/usuarios.js` | `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS` | CRUD de usuarios (nunca devuelve `password`). |
| `/api/animales` | `api/animales.js` | `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS` | CRUD de animales. |

`PATCH` y `DELETE` identifican el registro por query string: `/api/animales?id=7`.
Todos los handlers responden `405` ante métodos no contemplados y `500` con mensaje
controlado ante errores de base de datos.

---

## 🗄️ Modelo de datos

Tres entidades normalizadas (los nombres de columna son los que usan los handlers):

| Tabla | Clave primaria | Columnas |
| :--- | :--- | :--- |
| `usuario` | `id_usuario` | `nombre_usuario`, `email`, `password`, `tipo_usuario` |
| `protectora` | `id_protectora` | `nombre_protectora`, `ubicacion` |
| `animal` | `id_animal` | `nombre_animal`, `especie_animal`, `edad`, `estado`, `id_protectora` → `protectora` |

`animal.estado` se inicializa a `'Disponible'` en el alta.

---

## 📱 Progressive Web App

El panel es instalable. Los iconos se generan de forma reproducible con
`npm run icons` (Pillow) a partir de la huella de marca `#4361ee`:

| Fichero | Tamaño | Uso |
| :--- | :--- | :--- |
| `favicon.svg` | vectorial | Favicon moderno, escala sin pérdida. |
| `favicon.ico` | 16/32/48 | Compatibilidad con navegadores antiguos. |
| `apple-touch-icon.png` | 180×180 | Pantalla de inicio de iOS (sin transparencia). |
| `icon-192.png` | 192×192 | Icono de aplicación Android. |
| `icon-512.png` | 512×512 | Splash screen e instalación. |
| `icon-maskable-512.png` | 512×512 | Variante `maskable` dentro de la zona segura. |

`manifest.json` declara `display: standalone`, `theme_color: #4361ee` y
`background_color: #f8fafc`. El `<head>` de `index.html` incluye las metaetiquetas
de viewport, descripción, `theme-color`, Apple Web App y Open Graph.

---

## 🛠️ Ejecución local

### Prerrequisitos
- Node.js v18 o superior.
- Una base de datos PostgreSQL (se recomienda [Neon](https://neon.tech)).
- Opcional, para regenerar iconos: Python 3 con `Pillow`.

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/vicentemosqueralujan/adoptaydejatuhuella.git
   cd adoptaydejatuhuella
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno** — crea un `.env` en la raíz (está en `.gitignore`):
   ```env
   POSTGRES_URL="postgres://usuario:password@host.neon.tech/neondb?sslmode=require"
   ```

4. **Levantar el entorno completo** (frontend + funciones `api/`):
   ```bash
   npx vercel dev     # equivale a: npm run dev
   ```
   Disponible en `http://localhost:3000`.

   Si no dispones de la CLI de Vercel, el repositorio incluye un servidor Node
   equivalente que sirve los estáticos y enruta `/api/*` a los handlers de `api/`:
   ```bash
   npm run dev:local        # node tools/dev-server.js  →  http://localhost:3000
   ```

### Verificación de assets por terminal

```bash
curl -I http://localhost:3000/manifest.json   # 200 · application/manifest+json
curl -I http://localhost:3000/favicon.svg     # 200 · image/svg+xml
curl -I http://localhost:3000/icon-512.png    # 200 · image/png
curl -I http://localhost:3000/apple-touch-icon.png
```

---

## 🔐 Acceso y credenciales

El acceso al panel se valida contra la tabla `usuario` mediante `POST /api/login`.
La sesión se guarda en `localStorage` bajo la clave `adminSession`.

Para crear el usuario administrador de demostración, inserta un registro con la
contraseña ya hasheada con bcrypt:

```bash
node -e "console.log(require('bcryptjs').hashSync('TuPasswordDemo', 10))"
```

```sql
INSERT INTO usuario (nombre_usuario, email, password, tipo_usuario)
VALUES ('Admin Demo', 'admin@adoptaydejatuhuella.com', '<hash_generado>', 'Admin');
```

Alternativamente, puedes dar de alta usuarios desde el propio panel o vía API: el
endpoint hashea la contraseña con bcrypt (coste 10) antes de guardarla. Si no se envía
`password`, se genera una temporal aleatoria y se devuelve **una sola vez** en la
respuesta:

```bash
curl -X POST http://localhost:3000/api/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Admin Demo","email":"admin@adoptaydejatuhuella.com","tipo":"Admin","password":"TuPasswordDemo"}'
```

> **Política de contraseñas:** `/api/login` sólo acepta hashes bcrypt válidos
> (prefijo `$2`, 60 caracteres). Cualquier registro con la contraseña en texto plano
> es rechazado con `401` y queda registrado en el log del servidor. Las contraseñas
> enviadas al alta requieren un mínimo de 8 caracteres.
>
> Nunca uses credenciales reales ni subas el fichero `.env` al repositorio.

## ☁️ Despliegue en Vercel

1. Importa el repositorio en Vercel (sin framework preset: es un sitio estático + `api/`).
2. Define `POSTGRES_URL` en *Settings → Environment Variables* para los entornos
   Production, Preview y Development.
3. Cada push a `main` publica automáticamente; las ramas generan despliegues *Preview*.

No se requiere comando de build: los ficheros de la raíz se sirven como estáticos y
cada módulo de `api/` se compila como función serverless independiente.

---

## 📁 Estructura del repositorio

```
adoptaydejatuhuella/
├── api/
│   ├── animales.js          # CRUD de animales
│   ├── login.js             # Autenticación
│   ├── protectoras.js       # CRUD de protectoras
│   └── usuarios.js          # CRUD de usuarios
├── tools/
│   ├── dev-server.js        # Servidor local equivalente a `vercel dev`
│   └── generate-icons.py    # Generador reproducible de iconos PWA
├── index.html               # SPA: login overlay + dashboard
├── styles.css               # Estilos del panel
├── scripts.js               # Lógica de cliente (login, fetch, CRUD)
├── manifest.json            # Manifiesto PWA
├── favicon.svg / .ico       # Favicons
├── icon-192 / 512 / maskable-512.png
├── apple-touch-icon.png
└── package.json
```

---

## 🚧 Roadmap

- [x] Diseño de infraestructura y selección de stack.
- [x] Modelado de base de datos y diagramas UML.
- [x] Interfaz de login y dashboard.
- [x] CRUD completo sobre las tres entidades.
- [x] Assets PWA, manifiesto e instalabilidad (Entregable 4).
- [x] Hasheo bcrypt en el alta de usuarios y validación estricta en el login.
- [ ] Sistema de filtros avanzado.
- [ ] Pasarela de donaciones (fase futura).

---

## 👥 Equipo (Grupo 6)
- **Yunyang Hu**
- **Vicente Mosquera Luján**
- **Arnau Oriol Visa**
- **Ander Sa Torre**

---
*Proyecto del Ciclo Formativo de Grado Superior en Desarrollo de Aplicaciones Web (IFP).*
