ALTER TABLE "AiKeyReference"
  ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'production',
  ADD COLUMN "rotationDueAt" TIMESTAMP(3),
  ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);
