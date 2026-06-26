-- AlterTable
ALTER TABLE "enterprises" ADD COLUMN     "default_module_permissions" JSONB;

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "module_permissions" JSONB;

