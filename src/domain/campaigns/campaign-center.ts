import {
  type ConsentChannel,
  type ConsentPurpose,
  type InMemoryProfileOperationsStore,
  mayContactPerson
} from "@/domain/profiles/profile-operations";

const sendWindow = {
  startHour: 9,
  endHour: 20
};

export type CampaignEligibility = {
  allowed: boolean;
  reasons: string[];
};

export type CampaignPreview = {
  eligible: string[];
  blocked: Array<{
    personId: string;
    reasons: string[];
  }>;
};

export type CampaignAuditRecord = {
  action: string;
  actor: string;
  subjectId: string;
  createdAt: string;
};

export type CampaignWorkflowStatus = "draft" | "dry_run" | "approved_for_live_send" | "blocked";

export type CampaignWorkflowRecord = {
  campaignKey: string;
  name: string;
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  message: string;
  status: CampaignWorkflowStatus;
  plannedRecipients: number;
  approvedBy?: string;
  botKeyRef?: string;
  blockedReasons: string[];
  updatedAt: string;
};

export type TelegramLiveSendApproval = {
  status: "approved_for_live_send" | "blocked";
  campaignKey: string;
  dryRunId: string;
  botKeyRef: string;
  approvedBy: string;
  plannedRecipients: number;
  blockedReasons: string[];
};

export type TelegramDeliveryHandoff = {
  status: "handoff_ready" | "blocked";
  campaignKey: string;
  botKeyRef: string;
  message: string;
  approvedBy?: string;
  plannedRecipients: number;
  recipients: Array<{
    personId: string;
    telegramId: string;
  }>;
  blockedReasons: string[];
};

export class InMemoryCampaignStore {
  private readonly audit: CampaignAuditRecord[] = [];
  private readonly approvals: TelegramLiveSendApproval[] = [];
  private readonly workflows = new Map<string, CampaignWorkflowRecord>();

  addAudit(record: CampaignAuditRecord): CampaignAuditRecord {
    this.audit.push(record);
    return record;
  }

  addApproval(approval: TelegramLiveSendApproval): TelegramLiveSendApproval {
    this.approvals.push(approval);
    return approval;
  }

  liveSendApprovals(): TelegramLiveSendApproval[] {
    return this.approvals;
  }

  saveWorkflow(workflow: CampaignWorkflowRecord): CampaignWorkflowRecord {
    this.workflows.set(workflow.campaignKey, workflow);
    return workflow;
  }

  workflow(campaignKey: string): CampaignWorkflowRecord | undefined {
    return this.workflows.get(campaignKey);
  }

  auditTrail(): CampaignAuditRecord[] {
    return this.audit;
  }
}

export function createCampaignWorkflow(
  store: InMemoryCampaignStore,
  input: {
    campaignKey: string;
    name: string;
    channel: ConsentChannel;
    purpose: ConsentPurpose;
    message: string;
    actor: string;
  }
): CampaignWorkflowRecord {
  const workflow = store.saveWorkflow({
    campaignKey: input.campaignKey,
    name: input.name,
    channel: input.channel,
    purpose: input.purpose,
    message: input.message,
    status: "draft",
    plannedRecipients: 0,
    blockedReasons: [],
    updatedAt: new Date().toISOString()
  });

  store.addAudit({
    action: "campaign.workflow.created",
    actor: input.actor,
    subjectId: input.campaignKey,
    createdAt: workflow.updatedAt
  });

  return workflow;
}

export function getCampaignWorkflow(
  store: InMemoryCampaignStore,
  campaignKey: string
): CampaignWorkflowRecord | undefined {
  return store.workflow(campaignKey);
}

function updateCampaignWorkflow(
  store: InMemoryCampaignStore,
  campaignKey: string,
  update: Partial<Omit<CampaignWorkflowRecord, "campaignKey" | "name" | "channel" | "purpose" | "message">> & {
    message?: string;
  }
) {
  const existing = store.workflow(campaignKey);
  const workflow = store.saveWorkflow({
    campaignKey,
    name: existing?.name ?? campaignKey,
    channel: existing?.channel ?? "telegram",
    purpose: existing?.purpose ?? "marketing",
    message: update.message ?? existing?.message ?? "",
    status: update.status ?? existing?.status ?? "draft",
    plannedRecipients: update.plannedRecipients ?? existing?.plannedRecipients ?? 0,
    approvedBy: update.approvedBy ?? existing?.approvedBy,
    botKeyRef: update.botKeyRef ?? existing?.botKeyRef,
    blockedReasons: update.blockedReasons ?? existing?.blockedReasons ?? [],
    updatedAt: new Date().toISOString()
  });

  return workflow;
}

export function evaluateCampaignEligibility(input: {
  profiles: InMemoryProfileOperationsStore;
  personId: string;
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  localHour: number;
  sentInLastHour: number;
  hourlyLimit: number;
}): CampaignEligibility {
  const reasons: string[] = [];
  const contact = mayContactPerson(input.profiles, {
    personId: input.personId,
    channel: input.channel,
    purpose: input.purpose
  });

  reasons.push(...contact.reasons);

  if (input.localHour < sendWindow.startHour || input.localHour >= sendWindow.endHour) {
    reasons.push("outside_send_window");
  }

  if (input.sentInLastHour >= input.hourlyLimit) {
    reasons.push("rate_limit_exceeded");
  }

  return {
    allowed: reasons.length === 0,
    reasons
  };
}

export function approveTelegramCampaignForLiveSend(
  store: InMemoryCampaignStore,
  input: {
    campaignKey: string;
    dryRunId: string;
    botKeyRef: string;
    actor: string;
    manualApproval: {
      approvedBy: string;
      approvedAt: string;
      confirmed: boolean;
    };
    expectedRecipients: number;
    dryRunPlannedRecipients: number;
  }
): TelegramLiveSendApproval {
  const blockedReasons: string[] = [];

  if (!input.manualApproval.confirmed) {
    blockedReasons.push("manual_approval_required");
  }

  if (!input.dryRunId.trim()) {
    blockedReasons.push("dry_run_evidence_required");
  }

  if (!input.botKeyRef.trim()) {
    blockedReasons.push("approved_bot_key_ref_required");
  }

  if (input.expectedRecipients !== input.dryRunPlannedRecipients) {
    blockedReasons.push("recipient_count_mismatch");
  }

  const approval = store.addApproval({
    status: blockedReasons.length === 0 ? "approved_for_live_send" : "blocked",
    campaignKey: input.campaignKey,
    dryRunId: input.dryRunId,
    botKeyRef: input.botKeyRef,
    approvedBy: input.manualApproval.approvedBy,
    plannedRecipients: input.dryRunPlannedRecipients,
    blockedReasons
  });

  store.addAudit({
    action: approval.status === "approved_for_live_send"
      ? "campaign.telegram.live_send_approved"
      : "campaign.telegram.live_send_blocked",
    actor: input.actor,
    subjectId: input.campaignKey,
    createdAt: input.manualApproval.approvedAt
  });

  updateCampaignWorkflow(store, input.campaignKey, {
    status: approval.status,
    plannedRecipients: input.dryRunPlannedRecipients,
    approvedBy: approval.approvedBy,
    botKeyRef: approval.botKeyRef,
    blockedReasons: approval.blockedReasons
  });

  return approval;
}

export function createTelegramDeliveryHandoff(
  store: InMemoryCampaignStore,
  input: {
    campaignKey: string;
    botKeyRef: string;
    actor: string;
    recipients: Array<{
      personId: string;
      telegramId: string;
    }>;
  }
): TelegramDeliveryHandoff {
  const workflow = store.workflow(input.campaignKey);
  const blockedReasons: string[] = [];

  if (workflow?.status !== "approved_for_live_send") {
    blockedReasons.push("campaign_not_approved_for_live_send");
  }

  if (workflow?.botKeyRef !== input.botKeyRef) {
    blockedReasons.push("approved_bot_key_ref_mismatch");
  }

  if (workflow?.plannedRecipients !== input.recipients.length) {
    blockedReasons.push("recipient_count_mismatch");
  }

  const handoff: TelegramDeliveryHandoff = {
    status: blockedReasons.length === 0 ? "handoff_ready" : "blocked",
    campaignKey: input.campaignKey,
    botKeyRef: input.botKeyRef,
    message: workflow?.message ?? "",
    approvedBy: workflow?.approvedBy,
    plannedRecipients: workflow?.plannedRecipients ?? 0,
    recipients: input.recipients,
    blockedReasons
  };

  store.addAudit({
    action: handoff.status === "handoff_ready"
      ? "campaign.telegram.delivery_handoff_ready"
      : "campaign.telegram.delivery_handoff_blocked",
    actor: input.actor,
    subjectId: input.campaignKey,
    createdAt: new Date().toISOString()
  });

  return handoff;
}

export function createCampaignPreview(input: {
  profiles: InMemoryProfileOperationsStore;
  segmentMembers: string[];
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  localHour: number;
  hourlyLimit: number;
  alreadySentInLastHourByPerson: Record<string, number>;
}): CampaignPreview {
  const preview: CampaignPreview = {
    eligible: [],
    blocked: []
  };

  for (const personId of input.segmentMembers) {
    const eligibility = evaluateCampaignEligibility({
      profiles: input.profiles,
      personId,
      channel: input.channel,
      purpose: input.purpose,
      localHour: input.localHour,
      sentInLastHour: input.alreadySentInLastHourByPerson[personId] ?? 0,
      hourlyLimit: input.hourlyLimit
    });

    if (eligibility.allowed) {
      preview.eligible.push(personId);
    } else {
      preview.blocked.push({
        personId,
        reasons: eligibility.reasons
      });
    }
  }

  return preview;
}

export function sendTelegramCampaignDryRun(
  store: InMemoryCampaignStore,
  input: {
    campaignKey: string;
    message: string;
    recipients: Array<{
      personId: string;
      telegramId: string;
    }>;
    actor: string;
  }
): {
  status: "dry_run";
  sent: 0;
  planned: number;
  deliveries: Array<{
    personId: string;
    telegramId: string;
    status: "planned";
  }>;
} {
  store.addAudit({
    action: "campaign.telegram.dry_run",
    actor: input.actor,
    subjectId: input.campaignKey,
    createdAt: new Date().toISOString()
  });

  updateCampaignWorkflow(store, input.campaignKey, {
    status: "dry_run",
    message: input.message,
    plannedRecipients: input.recipients.length,
    blockedReasons: []
  });

  return {
    status: "dry_run",
    sent: 0,
    planned: input.recipients.length,
    deliveries: input.recipients.map((recipient) => ({
      ...recipient,
      status: "planned"
    }))
  };
}
