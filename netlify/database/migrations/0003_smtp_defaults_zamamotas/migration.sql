-- Back to the original SMTP sender as column default (password stays out of the schema).
ALTER TABLE "events" ALTER COLUMN "emailUser" SET DEFAULT 'zamamotas@gmail.com';
ALTER TABLE "events" ALTER COLUMN "emailFrom" SET DEFAULT 'EVENT <zamamotas@gmail.com>';
