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
