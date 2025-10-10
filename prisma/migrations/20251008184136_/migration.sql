-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "conversationState" JSONB
);

-- CreateTable
CREATE TABLE "InfoSource" (
    "messageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "score" INTEGER,
    "confidence" INTEGER,
    "key" TEXT,
    CONSTRAINT "InfoSource_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT,
    "path" TEXT,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioEntities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "orderId" TEXT,
    "product" TEXT,
    "audioId" TEXT NOT NULL,
    CONSTRAINT "AudioEntities_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "AudioFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT,
    "startMs" TEXT,
    "endMs" TEXT,
    "audioId" TEXT NOT NULL,
    CONSTRAINT "AudioEvidence_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "AudioFile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AudioFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "summary" TEXT,
    "classification" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "MemoryFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "MemoryFact_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "durationSec" INTEGER,
    "agentId" TEXT,
    "customerId" TEXT,
    "transcriptText" TEXT,
    "transcriptUri" TEXT,
    "transcriptSha256" TEXT,
    "language" TEXT,
    "summary" TEXT,
    "classification" TEXT,
    "sentiment" TEXT,
    "severity" TEXT,
    "intentsJson" JSONB,
    "entities" JSONB,
    "evidence" JSONB,
    "classifierConf" REAL,
    "policyAudit" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "subsection" TEXT,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "headers" JSONB,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PolicyDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "headers" JSONB,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT,
    "effectiveDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Message_conversationId_ts_idx" ON "Message"("conversationId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "AudioEntities_audioId_key" ON "AudioEntities"("audioId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryFact_conversationId_key_key" ON "MemoryFact"("conversationId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Policy_documentId_key" ON "Policy"("documentId");

-- CreateIndex
CREATE INDEX "PolicySection_policyId_parentId_idx" ON "PolicySection"("policyId", "parentId");

-- CreateIndex
CREATE INDEX "PolicySection_policyId_level_sectionId_idx" ON "PolicySection"("policyId", "level", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "PolicySection_policyId_sectionId_key" ON "PolicySection"("policyId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Call_callId_key" ON "Call"("callId");

-- CreateIndex
CREATE INDEX "Call_startedAt_idx" ON "Call"("startedAt");

-- CreateIndex
CREATE INDEX "Call_agentId_idx" ON "Call"("agentId");

-- CreateIndex
CREATE INDEX "Call_customerId_idx" ON "Call"("customerId");

-- CreateIndex
CREATE INDEX "Call_classification_severity_idx" ON "Call"("classification", "severity");

-- CreateIndex
CREATE INDEX "Document_category_subsection_idx" ON "Document"("category", "subsection");

-- CreateIndex
CREATE INDEX "Document_uploadedBy_idx" ON "Document"("uploadedBy");

-- CreateIndex
CREATE INDEX "Document_isProcessed_idx" ON "Document"("isProcessed");

-- CreateIndex
CREATE INDEX "PolicyDocument_type_idx" ON "PolicyDocument"("type");

-- CreateIndex
CREATE INDEX "PolicyDocument_uploadedBy_idx" ON "PolicyDocument"("uploadedBy");

-- CreateIndex
CREATE INDEX "PolicyDocument_isProcessed_idx" ON "PolicyDocument"("isProcessed");

-- CreateIndex
CREATE INDEX "PolicyDocument_effectiveDate_idx" ON "PolicyDocument"("effectiveDate");
