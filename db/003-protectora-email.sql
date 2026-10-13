-- =============================================================================
-- Migración 003 — Email público de contacto de la protectora.
--
-- Se muestra en la ficha del animal (bloque «Contacto»). Es un dato público
-- distinto del email de inicio de sesión de las cuentas (`usuario.email`).
--
-- Idempotente. Ejecutar con `psql "$POSTGRES_URL" -f db/003-protectora-email.sql`.
-- =============================================================================

BEGIN;

ALTER TABLE protectora
    ADD COLUMN IF NOT EXISTS email_protectora VARCHAR(120);

COMMIT;

-- Ejemplo de carga:
-- UPDATE protectora SET email_protectora = 'adopciones@ejemplo.org' WHERE id_protectora = 1;
