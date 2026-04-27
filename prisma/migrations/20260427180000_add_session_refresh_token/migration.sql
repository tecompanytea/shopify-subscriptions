-- AlterTable: support newer @shopify/shopify-app-session-storage-prisma fields
ALTER TABLE "Session"
  ADD COLUMN "refreshToken" TEXT,
  ADD COLUMN "refreshTokenExpires" TIMESTAMP(3);
