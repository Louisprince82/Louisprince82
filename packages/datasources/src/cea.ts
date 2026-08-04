/** CEA Public Register lookup via the official data.gov.sg dataset
 *  "CEA Salespersons Information" — keyless, free.
 *  This makes agent verification REAL: name, agency, licence number and
 *  registration validity dates come from the government dataset, not from
 *  a self-declared field. Re-verification should run quarterly (spec §2). */

import { TtlCache } from "./cache.js";

const DATASET = "d_07c63be0f37e6e59c07a4ddc2fd87fcb";
const BASE = `https://data.gov.sg/api/action/datastore_search?resource_id=${DATASET}`;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CeaSalesperson {
  name: string;
  registrationNo: string;
  registrationStart: string; // ISO date
  registrationEnd: string; // ISO date
  agencyName: string;
  agencyLicenseNo: string;
}

export interface CeaVerification {
  status: "verified" | "expired" | "not-found" | "unavailable";
  record?: CeaSalesperson;
  checkedAt: string;
}

/** CEA registration numbers look like R015018I / P015022G. */
export const CEA_REG_FORMAT = /^[A-Z]\d{6}[A-Z]$/;

interface DatastoreResponse {
  success: boolean;
  result?: {
    records: Array<{
      salesperson_name: string;
      registration_no: string;
      registration_start_date: string;
      registration_end_date: string;
      estate_agent_name: string;
      estate_agent_license_no: string;
    }>;
  };
}

export class CeaRegisterClient {
  private readonly cache = new TtlCache<CeaVerification>(DAY_MS);

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /** Look a salesperson up by registration number and check validity. */
  async verify(registrationNo: string, at: Date = new Date()): Promise<CeaVerification> {
    const regNo = registrationNo.trim().toUpperCase();
    const checkedAt = at.toISOString();
    if (!CEA_REG_FORMAT.test(regNo)) return { status: "not-found", checkedAt };

    const cached = this.cache.get(regNo);
    if (cached) return cached;

    let verification: CeaVerification;
    try {
      const url = `${BASE}&filters=${encodeURIComponent(JSON.stringify({ registration_no: regNo }))}&limit=1`;
      const res = await this.fetchImpl(url);
      if (!res.ok) throw new Error(`data.gov.sg ${res.status}`);
      const data = (await res.json()) as DatastoreResponse;
      const raw = data.result?.records?.[0];
      if (!raw) {
        verification = { status: "not-found", checkedAt };
      } else {
        const record: CeaSalesperson = {
          name: raw.salesperson_name,
          registrationNo: raw.registration_no,
          registrationStart: raw.registration_start_date,
          registrationEnd: raw.registration_end_date,
          agencyName: raw.estate_agent_name,
          agencyLicenseNo: raw.estate_agent_license_no,
        };
        const today = checkedAt.slice(0, 10);
        const active = record.registrationStart <= today && today <= record.registrationEnd;
        verification = { status: active ? "verified" : "expired", record, checkedAt };
      }
    } catch {
      // Registry unreachable — never block signup on a network blip; the
      // caller records "unavailable" and the quarterly re-check retries.
      verification = { status: "unavailable", checkedAt };
    }
    if (verification.status !== "unavailable") this.cache.set(regNo, verification);
    return verification;
  }
}
