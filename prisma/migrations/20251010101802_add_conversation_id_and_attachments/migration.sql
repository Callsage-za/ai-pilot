-- AlterTable
ALTER TABLE "FileUpload" ADD COLUMN "conversationId" TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "attachments" JSONB;
