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
| `/api/animales` | `api/animales.js` | `GET`, `POST`, `PATCH`, `DELETE`, `OPTIONS` | Catálogo y gestión de animales, acotados por rol. |
| `/api/roles` | `api/roles.js` | `GET`, `OPTIONS` | Catálogo de roles que alimenta el panel. |

Los módulos `api/_roles.js` y `api/_auth.js` empiezan por `_`, por lo que Vercel no los
publica como rutas: son internos.

**Autorización:** salvo el alta inicial, `/api/usuarios` exige el permiso
`usuarios:gestionar`, identificado por la cabecera `X-Usuario-Id` (`401` sin identidad,
`403` sin permisos). Consulta la limitación anotada en `api/_auth.js`.

`GET /api/animales` admite filtros opcionales combinables:

| Parámetro | Ejemplo | Efecto |
| :--- | :--- | :--- |
| `q` | `?q=nal` | Busca en nombre y especie (sin distinguir mayúsculas). |
| `especie` | `?especie=Perro` | Coincidencia exacta de especie, sin distinguir mayúsculas. |
| `estado` | `?estado=Adoptado` | Sólo lo aplican los roles con `animales:gestionar`. |
| `id_protectora` | `?id_protectora=2` | Ignorado para el rol `Protectora`, que siempre ve la suya. |

`PATCH` y `DELETE` identifican el registro por query string: `/api/animales?id=7`.
Todos los handlers responden `405` ante métodos no contemplados y `500` con mensaje
controlado ante errores de base de datos.

---

## 🗄️ Modelo de datos

Tres entidades normalizadas (los nombres de columna son los que usan los handlers):

| Tabla | Clave primaria | Columnas |
| :--- | :--- | :--- |
| `usuario` | `id_usuario` | `nombre_usuario`, `email`, `password`, `tipo_usuario`, `id_protectora` → `protectora` |
| `protectora` | `id_protectora` | `nombre_protectora`, `ubicacion` |
| `animal` | `id_animal` | `nombre_animal`, `especie_animal`, `edad`, `estado`, `id_protectora` → `protectora` |

`animal.estado` admite `'Disponible'`, `'Reservado'` y `'Adoptado'`, y se inicializa a
`'Disponible'` en el alta. La edad debe estar entre 0 y 40 años.

```sql
-- Recomendado: restringir los estados y acelerar el catálogo.
ALTER TABLE animal
    ADD CONSTRAINT chk_animal_estado
    CHECK (estado IN ('Disponible', 'Reservado', 'Adoptado'));

CREATE INDEX IF NOT EXISTS idx_animal_protectora ON animal (id_protectora);
CREATE INDEX IF NOT EXISTS idx_animal_estado     ON animal (estado);
```

### Roles y migración

`usuario.tipo_usuario` admite tres roles, definidos en `api/_roles.js` como única
fuente de verdad (el desplegable del panel se construye desde `GET /api/roles`):

| Rol | Protectora | Registro público | Permisos |
| :--- | :--- | :--- | :--- |
| `Admin` | — | **no** | `usuarios:gestionar`, `protectoras:gestionar`, `animales:gestionar` |
| `Protectora` | **obligatoria** | sí | `animales:gestionar` |
| `Adoptante` | — | sí | `animales:consultar` |

Migración necesaria en Neon para la asignación de protectora y el índice de login:

```sql
-- Vínculo opcional de un usuario con su protectora.
ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS id_protectora INTEGER
    REFERENCES protectora (id_protectora) ON DELETE SET NULL;

-- El login busca por email en cada intento: índice único para resolverlo en O(log n)
-- y, de paso, impedir correos duplicados.
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email ON usuario (email);

-- Acelera el LEFT JOIN del listado de usuarios.
CREATE INDEX IF NOT EXISTS idx_usuario_protectora ON usuario (id_protectora);
```

> Añadir un rol nuevo sólo requiere registrarlo en `api/_roles.js`: la validación del
> backend, los permisos del login y el desplegable del panel se alimentan de esa lista.

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

## 🔐 Acceso y registro inicial

El acceso al panel se valida contra la tabla `usuario` mediante `POST /api/login`.
La sesión se guarda en `localStorage` bajo la clave `adminSession`.

### Lista blanca de registro

`POST /api/usuarios` tiene tres modos, resueltos en este orden:

| Modo | Cuándo se aplica | Qué permite |
| :--- | :--- | :--- |
| **Gestionado** | El solicitante tiene `usuarios:gestionar` | Cualquier correo y cualquier rol, incluido `Admin`. |
| **Arranque** | No hay ningún `Admin` en la base de datos | Sólo los correos de la **lista blanca**; otros reciben `403`. |
| **Auto-registro** | Ya hay `Admin` y nadie autenticado | Registro público: sólo `Adoptante` y `Protectora`, con contraseña obligatoria. |

En auto-registro, pedir el rol `Admin` devuelve `403 Forbidden`: nadie puede concederse
privilegios de gestión a sí mismo.

```js
// api/usuarios.js
const EMAILS_PERMITIDOS = (process.env.REGISTRO_EMAILS_PERMITIDOS || 'vicentemoslujan@gmail.com')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
```

La lista se amplía sin tocar código mediante la variable de entorno
`REGISTRO_EMAILS_PERMITIDOS` (valores separados por comas), tanto en `.env` como en
*Settings → Environment Variables* de Vercel:

```env
REGISTRO_EMAILS_PERMITIDOS="vicentemoslujan@gmail.com,otro.admin@ejemplo.com"
```

> La lista blanca sólo protege el arranque: una vez creado el administrador inicial, el
> panel puede dar de alta cualquier correo sin tocar `REGISTRO_EMAILS_PERMITIDOS`.

### Paso 1 — Vaciar la tabla de usuarios en Neon

Ejecuta esto en el **SQL Editor de Neon** (o con `psql $POSTGRES_URL`) para partir de una
tabla completamente limpia antes del primer registro:

```sql
-- Elimina todos los usuarios existentes.
DELETE FROM usuario;

-- Reinicia el contador de id_usuario para que el primer alta sea el id 1.
ALTER SEQUENCE usuario_id_usuario_seq RESTART WITH 1;

-- Comprobación: debe devolver 0.
SELECT COUNT(*) FROM usuario;
```

> `TRUNCATE TABLE usuario RESTART IDENTITY CASCADE;` hace lo mismo en un solo paso, pero
> `CASCADE` arrastraría las filas de las tablas relacionadas. Si sólo quieres limpiar
> usuarios, usa la versión anterior.
>
> **Esta operación es irreversible.** Verifica que estás conectado a la base de datos de
> desarrollo antes de lanzarla.

### Paso 2 — Registrar el administrador inicial

Con la tabla vacía, el alta se hace contra el endpoint. La contraseña viaja en texto
plano por HTTPS y se almacena **siempre** hasheada con bcrypt (coste 10):

```bash
curl -i -X POST http://localhost:3000/api/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Vicente Mosquera","email":"vicentemoslujan@gmail.com","password":"TuPasswordSegura","tipo":"Admin"}'
# → HTTP/1.1 201 Created   {"ok":true}
```

### Paso 3 — Comprobar el login

```bash
curl -i -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"vicentemoslujan@gmail.com","password":"TuPasswordSegura"}'
# → HTTP/1.1 200 OK   {"success":true,"user":{...}}
```

Como alternativa, el registro puede insertarse directamente en SQL con el hash ya
generado:

```bash
node -e "console.log(require('bcryptjs').hashSync('TuPasswordSegura', 10))"
```

```sql
INSERT INTO usuario (nombre_usuario, email, password, tipo_usuario)
VALUES ('Vicente Mosquera', 'vicentemoslujan@gmail.com', '<hash_generado>', 'Admin');
```

> **Política de contraseñas:** `/api/login` sólo acepta hashes bcrypt válidos
> (prefijo `$2`, 60 caracteres). Cualquier registro con la contraseña en texto plano es
> rechazado con `401` y queda registrado en el log del servidor. Las contraseñas enviadas
> al alta requieren un mínimo de 8 caracteres, los emails se normalizan a minúsculas y
> `GET /api/usuarios` nunca devuelve la columna `password`.
>
> Nunca uses credenciales reales ni subas el fichero `.env` al repositorio.

## 🖥️ Panel de administración

La interfaz se adapta al rol del usuario autenticado. `POST /api/login` devuelve los
permisos en la respuesta y el frontend muestra u oculta cada bloque marcado con
`data-permiso`:

| Bloque | Permiso exigido | Visible para |
| :--- | :--- | :--- |
| Gestión de usuarios (tabla + modal) | `usuarios:gestionar` | `Admin` |
| Tarjeta de protectoras | `protectoras:gestionar` | `Admin` |
| Gestión de animales (alta, edición, listado) | `animales:gestionar` | `Admin`, `Protectora` |
| Catálogo de adopción (buscador y filtros) | `animales:consultar` | `Adoptante` |

**Pantalla de acceso.** Dos pestañas: *Acceder* y *Crear cuenta*. El formulario de
registro ofrece únicamente los roles marcados con `autoRegistro` en `api/_roles.js`
(`Adoptante` y `Protectora`) y muestra el selector de protectora sólo cuando el rol
elegido lo exige.

**Panel de usuarios (`Admin`).** Tabla con buscador, `<dialog>` modal de alta y edición,
desplegable de rol alimentado por `GET /api/roles` y selector de protectora condicional.
Dejar la contraseña en blanco genera una temporal que se muestra una única vez al crear,
y mantiene la existente al editar.

**Gestión de animales (`Protectora`).** Alta, edición (nombre, especie, edad y estado) y
listado de los animales propios. El selector de protectora desaparece: el backend asigna
siempre la del usuario e ignora cualquier `id_protectora` recibido. Una protectora recibe
`403` si intenta modificar un animal de otra.

**Catálogo de adopción (`Adoptante`).** Rejilla de tarjetas con icono por especie,
buscador con retardo que consulta `?q=`, filtro de especie servido por `?especie=` y
filtro de protectora aplicado en cliente. Sólo se muestran los animales `Disponible`:
un adoptante no puede forzar otro estado por query string.

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
│   ├── _auth.js             # Autorización por permisos (módulo interno)
│   ├── _roles.js            # Catálogo de roles (módulo interno)
│   ├── roles.js             # GET del catálogo de roles
│   ├── animales.js          # CRUD de animales
│   ├── login.js             # Autenticación
│   ├── protectoras.js       # CRUD de protectoras
│   └── usuarios.js          # CRUD de usuarios
├── tools/
│   ├── dev-server.js        # Servidor local equivalente a `vercel dev`
│   └── generate-icons.py    # Generador reproducible de iconos PWA
├── index.html               # SPA: login overlay + dashboard
├── styles.css               # Estilos del panel
├── scripts.js               # Núcleo de cliente (sesión, permisos, login, usuarios)
├── registro-catalogo.js     # Registro público, catálogo y edición de animales
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
- [x] Registro inicial restringido por lista blanca de correos.
- [x] Roles granulares, asignación de protectora y panel de administración por permisos.
- [ ] Sustituir la cabecera `X-Usuario-Id` por un token firmado (JWT/cookie HttpOnly).
- [x] Auto-registro público por roles y catálogo de adopción con buscador y filtros.
- [ ] Subida de fotografías de los animales.
- [ ] Pasarela de donaciones (fase futura).

---

## 👥 Equipo (Grupo 6)
- **Yunyang Hu**
- **Vicente Mosquera Luján**
- **Arnau Oriol Visa**
- **Ander Sa Torre**

---
*Proyecto del Ciclo Formativo de Grado Superior en Desarrollo de Aplicaciones Web (IFP).*
