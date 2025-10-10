-- CreateTable
CREATE TABLE "FileUpload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "localPath" TEXT NOT NULL,
    "externalPath" TEXT,
    "originalName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
