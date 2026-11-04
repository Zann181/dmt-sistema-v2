-- Soft delete: un asistente "eliminado" pasa a inactivo (solo el super admin lo ve y puede reactivarlo).
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "inactiveAt" TIMESTAMP(3);
