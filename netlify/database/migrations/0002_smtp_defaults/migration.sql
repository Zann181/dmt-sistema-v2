-- New default SMTP sender; the password is no longer stored as a column default
-- (EmailService falls back to the SMTP_PASSWORD env var when it is empty).
ALTER TABLE "events" ALTER COLUMN "emailUser" SET DEFAULT 'jeffersonpher@gmail.com';
ALTER TABLE "events" ALTER COLUMN "emailPassword" SET DEFAULT '';
ALTER TABLE "events" ALTER COLUMN "emailFrom" SET DEFAULT 'DMT69 <jeffersonpher@gmail.com>';
