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

export class InMemoryCampaignStore {
  private readonly audit: CampaignAuditRecord[] = [];

  addAudit(record: CampaignAuditRecord): CampaignAuditRecord {
    this.audit.push(record);
    return record;
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
