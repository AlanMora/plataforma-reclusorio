-- Crea una base de datos por servicio (patrón database-per-service).
-- Se ejecuta sólo en el primary al inicializar; se replican al slave por streaming.
SELECT 'CREATE DATABASE icms_auth'          WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'icms_auth')\gexec
SELECT 'CREATE DATABASE icms_configuration' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'icms_configuration')\gexec
SELECT 'CREATE DATABASE icms_core'          WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'icms_core')\gexec
SELECT 'CREATE DATABASE icms_notification'  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'icms_notification')\gexec
SELECT 'CREATE DATABASE icms_integration'   WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'icms_integration')\gexec
SELECT 'CREATE DATABASE icms_files'         WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'icms_files')\gexec
SELECT 'CREATE DATABASE icms_scheduler'     WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'icms_scheduler')\gexec
