-- Columna que existía en la base de Netlify (agregada sin migración) y faltaba en el historial.
-- IF NOT EXISTS: es un no-op en bases que ya la tienen.
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "qrDeliveredManuallyAt" TIMESTAMP(3);
