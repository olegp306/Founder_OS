-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EnvironmentKind" AS ENUM ('LOCAL', 'STAGING', 'PRODUCTION', 'CLIENT_ISOLATED');

-- CreateEnum
CREATE TYPE "OperationalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IdentityKind" AS ENUM ('TELEGRAM', 'EMAIL', 'PHONE', 'APP_ACCOUNT', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('TELEGRAM', 'EMAIL', 'SMS', 'WEB');

-- CreateEnum
CREATE TYPE "ConsentPurpose" AS ENUM ('PRODUCT_UPDATES', 'MARKETING', 'SUPPORT', 'TOKEN_METERING');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'READY', 'SENDING', 'PAUSED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TokenAlertKind" AS ENUM ('BUDGET', 'BURN_RATE', 'ANOMALY', 'POLICY_BREACH');

-- CreateEnum
CREATE TYPE "TokenEmergencyAction" AS ENUM ('NONE', 'DOWNGRADE_MODEL', 'THROTTLE', 'DISABLE_ASSISTANT');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "category" TEXT,
    "workspace" TEXT,
    "runtime" TEXT NOT NULL,
    "status" "OperationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "localPath" TEXT,
    "url" TEXT,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectControl" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assistantEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tokenTrackingRequired" BOOLEAN NOT NULL DEFAULT false,
    "feedbackCaptureRequired" BOOLEAN NOT NULL DEFAULT false,
    "rawMessageStorage" TEXT NOT NULL DEFAULT 'disabled_by_default',
    "consentRequiredForMarketing" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiKeyReference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "secretRef" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "allowedModels" JSONB NOT NULL DEFAULT '[]',
    "defaultModel" TEXT NOT NULL,
    "monthlyBudgetUsd" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKeyReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "EnvironmentKind" NOT NULL,
    "url" TEXT,
    "isolation" TEXT NOT NULL DEFAULT 'founder-shared',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "OperationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assistant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "OperationalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "language" TEXT,
    "timezone" TEXT,
    "city" TEXT,
    "country" TEXT,
    "summaries" JSONB NOT NULL DEFAULT '[]',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "facts" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "kind" "IdentityKind" NOT NULL,
    "externalId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT,
    "personId" TEXT,
    "personRef" TEXT,
    "summary" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "facts" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenUsageEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assistantId" TEXT,
    "personId" TEXT,
    "environment" "EnvironmentKind" NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(12,6) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPolicy" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assistantId" TEXT,
    "environment" "EnvironmentKind",
    "preferredModel" TEXT NOT NULL,
    "fallbackModel" TEXT NOT NULL,
    "dailyBudgetUsd" DECIMAL(12,2) NOT NULL,
    "monthlyBudgetUsd" DECIMAL(12,2) NOT NULL,
    "maxTokensPerRequest" INTEGER NOT NULL,
    "emergencyMode" BOOLEAN NOT NULL DEFAULT false,
    "emergencyAction" "TokenEmergencyAction" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenAlert" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "kind" "TokenAlertKind" NOT NULL,
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenPolicyChange" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenPolicyChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "personId" TEXT,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentMember" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "segmentId" TEXT,
    "channel" "ConsentChannel" NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "personId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_key_key" ON "Project"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_url_key" ON "Repository"("url");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_projectId_name_key" ON "Repository"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectControl_projectId_key" ON "ProjectControl"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "AiKeyReference_projectId_secretRef_key" ON "AiKeyReference"("projectId", "secretRef");

-- CreateIndex
CREATE UNIQUE INDEX "Assistant_projectId_key_key" ON "Assistant"("projectId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_kind_externalId_key" ON "Identity"("kind", "externalId");

-- CreateIndex
CREATE INDEX "Consent_personId_channel_purpose_idx" ON "Consent"("personId", "channel", "purpose");

-- CreateIndex
CREATE INDEX "Event_name_occurredAt_idx" ON "Event"("name", "occurredAt");

-- CreateIndex
CREATE INDEX "Event_personRef_idx" ON "Event"("personRef");

-- CreateIndex
CREATE UNIQUE INDEX "Event_source_idempotencyKey_key" ON "Event"("source", "idempotencyKey");

-- CreateIndex
CREATE INDEX "TokenUsageEvent_projectId_occurredAt_idx" ON "TokenUsageEvent"("projectId", "occurredAt");

-- CreateIndex
CREATE INDEX "TokenUsageEvent_assistantId_occurredAt_idx" ON "TokenUsageEvent"("assistantId", "occurredAt");

-- CreateIndex
CREATE INDEX "TokenUsageEvent_model_occurredAt_idx" ON "TokenUsageEvent"("model", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Segment_key_key" ON "Segment"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentMember_segmentId_personId_key" ON "SegmentMember"("segmentId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_key_key" ON "Campaign"("key");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_subjectType_subjectId_idx" ON "AuditLog"("subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "Repository" ADD CONSTRAINT "Repository_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectControl" ADD CONSTRAINT "ProjectControl_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiKeyReference" ADD CONSTRAINT "AiKeyReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsageEvent" ADD CONSTRAINT "TokenUsageEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsageEvent" ADD CONSTRAINT "TokenUsageEvent_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenUsageEvent" ADD CONSTRAINT "TokenUsageEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPolicy" ADD CONSTRAINT "TokenPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPolicy" ADD CONSTRAINT "TokenPolicy_assistantId_fkey" FOREIGN KEY ("assistantId") REFERENCES "Assistant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenAlert" ADD CONSTRAINT "TokenAlert_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "TokenPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenPolicyChange" ADD CONSTRAINT "TokenPolicyChange_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "TokenPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentMember" ADD CONSTRAINT "SegmentMember_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentMember" ADD CONSTRAINT "SegmentMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "Segment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

