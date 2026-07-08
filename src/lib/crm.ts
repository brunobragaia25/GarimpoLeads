import { getGestaoDevzFirestore } from "./firebase-admin";

const CLIENTS_COLLECTION = "clients";
const DEFAULT_SERVICE_TYPE = "Websites";

function formatPhoneForCRM(phone: string | null): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  const areaCode = withCountryCode.slice(2, 4);
  const number = withCountryCode.slice(4);
  return `+55 ${areaCode} ${number}`;
}

export interface CRMLeadData {
  name: string;
  email: string;
  phone: string | null;
}

export async function sendLeadToCRM(lead: CRMLeadData): Promise<string> {
  const db = getGestaoDevzFirestore();
  const uid = process.env.GESTAODEVZ_USER_UID!;
  // GestãoDevz guarda os dados numa subcoleção por usuário
  // (users/{uid}/clients), não numa coleção "clients" na raiz.
  const docRef = db.collection("users").doc(uid).collection(CLIENTS_COLLECTION).doc();

  await docRef.set({
    name: lead.name,
    email: lead.email,
    phone: formatPhoneForCRM(lead.phone),
    serviceType: DEFAULT_SERVICE_TYPE,
  });

  return docRef.id;
}

export async function deleteLeadFromCRM(docId: string): Promise<void> {
  const db = getGestaoDevzFirestore();
  const uid = process.env.GESTAODEVZ_USER_UID!;
  await db.collection("users").doc(uid).collection(CLIENTS_COLLECTION).doc(docId).delete();
}
