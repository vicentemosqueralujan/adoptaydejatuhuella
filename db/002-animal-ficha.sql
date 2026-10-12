-- =============================================================================
-- Migración 002 — Ficha detallada del animal (estilo Kiwoko) y fotografías.
--
-- Añade a `animal` los campos que alimentan los cuatro bloques de la ficha
-- pública («Mis datos», «Me entregan», «Tienes que saber que», «Compatible»)
-- y la galería de hasta 6 fotos comprimidas en el navegador.
--
-- Idempotente: se puede ejecutar varias veces sin efecto adicional.
-- Ejecutar en la consola SQL de Neon o con `psql "$POSTGRES_URL" -f db/002-animal-ficha.sql`.
-- =============================================================================

BEGIN;

ALTER TABLE animal
    ADD COLUMN IF NOT EXISTS sexo                VARCHAR(10),
    ADD COLUMN IF NOT EXISTS tamano              VARCHAR(10),
    ADD COLUMN IF NOT EXISTS fecha_nacimiento    DATE,
    ADD COLUMN IF NOT EXISTS raza                VARCHAR(80),
    ADD COLUMN IF NOT EXISTS provincia           VARCHAR(80),
    ADD COLUMN IF NOT EXISTS puede_viajar        BOOLEAN,
    ADD COLUMN IF NOT EXISTS entrega_condiciones TEXT,
    ADD COLUMN IF NOT EXISTS info_importante     TEXT,
    ADD COLUMN IF NOT EXISTS compatible          JSONB,
    ADD COLUMN IF NOT EXISTS fotos               JSONB NOT NULL DEFAULT '[]'::jsonb;

-- --------------------------------------------------------------- Restricciones
-- Los valores admitidos se validan también en api/_animal-campos.js; aquí se
-- fijan en la base para que ningún otro cliente pueda introducir basura.

ALTER TABLE animal DROP CONSTRAINT IF EXISTS chk_animal_sexo;
ALTER TABLE animal ADD  CONSTRAINT chk_animal_sexo
    CHECK (sexo IS NULL OR sexo IN ('Macho', 'Hembra'));

ALTER TABLE animal DROP CONSTRAINT IF EXISTS chk_animal_tamano;
ALTER TABLE animal ADD  CONSTRAINT chk_animal_tamano
    CHECK (tamano IS NULL OR tamano IN ('Pequeño', 'Mediano', 'Grande'));

ALTER TABLE animal DROP CONSTRAINT IF EXISTS chk_animal_fecha_nacimiento;
ALTER TABLE animal ADD  CONSTRAINT chk_animal_fecha_nacimiento
    CHECK (fecha_nacimiento IS NULL
           OR (fecha_nacimiento <= CURRENT_DATE
               AND fecha_nacimiento >= CURRENT_DATE - INTERVAL '40 years'));

-- La galería es una lista JSON y nunca excede las 6 fotografías.
ALTER TABLE animal DROP CONSTRAINT IF EXISTS chk_animal_fotos;
ALTER TABLE animal ADD  CONSTRAINT chk_animal_fotos
    CHECK (jsonb_typeof(fotos) = 'array' AND jsonb_array_length(fotos) <= 6);

-- `compatible` es un objeto {perros, gatos, ninos}; el contenido lo valida la API.
ALTER TABLE animal DROP CONSTRAINT IF EXISTS chk_animal_compatible;
ALTER TABLE animal ADD  CONSTRAINT chk_animal_compatible
    CHECK (compatible IS NULL OR jsonb_typeof(compatible) = 'object');

-- --------------------------------------------------------------------- Índices
-- El catálogo público filtra por provincia y busca por raza.

CREATE INDEX IF NOT EXISTS idx_animal_provincia ON animal (LOWER(provincia));
CREATE INDEX IF NOT EXISTS idx_animal_raza      ON animal (LOWER(raza));

COMMIT;

-- -----------------------------------------------------------------------------
-- Comprobación: debe devolver las diez columnas nuevas.
--
--   SELECT column_name, data_type
--   FROM information_schema.columns
--   WHERE table_name = 'animal'
--     AND column_name IN ('sexo','tamano','fecha_nacimiento','raza','provincia',
--                         'puede_viajar','entrega_condiciones','info_importante',
--                         'compatible','fotos')
--   ORDER BY column_name;
-- -----------------------------------------------------------------------------
