import { getGestaoDevzFirestore } from "./firebase-admin";

const CLIENTS_COLLECTION = "clients";

function formatPhoneForCRM(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  const areaCode = withCountryCode.slice(2, 4);
  const number = withCountryCode.slice(4);
  return `+55 ${areaCode} ${number}`;
}

function todayAsDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface CRMLeadData {
  name: string;
  email: string;
  phone: string | null;
}

export async function sendLeadToCRM(lead: CRMLeadData): Promise<string> {
  const db = getGestaoDevzFirestore();
  const docRef = db.collection(CLIENTS_COLLECTION).doc();

  await docRef.set({
    id: docRef.id,
    name: lead.name,
    company: lead.name,
    email: lead.email,
    phone: formatPhoneForCRM(lead.phone),
    createdAt: todayAsDateString(),
  });

  return docRef.id;
}
