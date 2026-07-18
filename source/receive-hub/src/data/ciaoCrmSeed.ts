// Public competition fixture. Personal CRM accounts, contacts, messages and signatures are intentionally omitted.
export interface CiaoCrmSeed {
  exportedAt: string;
  source: string;
  accounts: any[];
  contacts: any[];
  signatures: any[];
  messages: any[];
  stats: { accounts: number; clients: number; mailingContacts: number; sentEmails: number; signatures: number };
}

export const ciaoCrmSeed: CiaoCrmSeed = {
  exportedAt: new Date(0).toISOString(),
  source: "public-competition-fixture",
  accounts: [],
  contacts: [],
  signatures: [],
  messages: [],
  stats: { accounts: 0, clients: 0, mailingContacts: 0, sentEmails: 0, signatures: 0 },
};
