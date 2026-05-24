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

export type TelegramLiveSendApproval = {
  status: "approved_for_live_send" | "blocked";
  campaignKey: string;
  dryRunId: string;
  botKeyRef: string;
  approvedBy: string;
  plannedRecipients: number;
  blockedReasons: string[];
};

export class InMemoryCampaignStore {
  private readonly audit: CampaignAuditRecord[] = [];
  private readonly approvals: TelegramLiveSendApproval[] = [];

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

  auditTrail(): CampaignAuditRecord[] {
    return this.audit;
  }
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

  return approval;
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
