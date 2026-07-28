-- CreateEnum
CREATE TYPE "ToneLevel" AS ENUM ('professional', 'knightly', 'hypeMan', 'heckler', 'outlaw');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tone_level" "ToneLevel" NOT NULL DEFAULT 'professional';
