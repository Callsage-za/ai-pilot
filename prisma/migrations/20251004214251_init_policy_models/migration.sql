-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PolicySection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "policyId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "exactText" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PolicySection_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Policy_documentId_key" ON "Policy"("documentId");

-- CreateIndex
CREATE INDEX "PolicySection_policyId_parentId_idx" ON "PolicySection"("policyId", "parentId");

-- CreateIndex
CREATE INDEX "PolicySection_policyId_level_sectionId_idx" ON "PolicySection"("policyId", "level", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicySection_policyId_sectionId_key" ON "PolicySection"("policyId", "sectionId");
