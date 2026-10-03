import { z } from "zod";

const nonNegativeInteger = z.number().int().nonnegative();

export const ResidencePermitRowSchema = z.object({
  periode: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), kantor_imigrasi: z.string().trim().min(1),
  bvk: nonNegativeInteger, voa: nonNegativeInteger, itk: nonNegativeInteger, itk_peralihan: nonNegativeInteger,
  itas: nonNegativeInteger, itap: nonNegativeInteger, itkt: nonNegativeInteger,
  alih_status_itk_ke_itas: nonNegativeInteger, alih_status_itas_ke_itap: nonNegativeInteger,
  abg: nonNegativeInteger, epo: nonNegativeInteger, imk: nonNegativeInteger, skim: nonNegativeInteger, total: nonNegativeInteger
});

export const PassportRowSchema = z.object({
  periode: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), kantor_imigrasi: z.string().trim().min(1),
  biasa_24: nonNegativeInteger, biasa_48: nonNegativeInteger, elektronik_48: nonNegativeInteger,
  e_polikarbonat: nonNegativeInteger, total: nonNegativeInteger
});

export const RESIDENCE_PERMIT_SERVICE_MONTHLY = {key:"RESIDENCE_PERMIT_SERVICE_MONTHLY",version:1,businessKey:["periode","kantor_imigrasi"],derivedTotal:"total"} as const;
export const PASSPORT_SERVICE_MONTHLY = {key:"PASSPORT_SERVICE_MONTHLY",version:1,businessKey:["periode","kantor_imigrasi"],derivedTotal:"total"} as const;
export const RESIDENCE_MEASURES = ["bvk","voa","itk","itk_peralihan","itas","itap","itkt","alih_status_itk_ke_itas","alih_status_itas_ke_itap","abg","epo","imk","skim"] as const;
export const PASSPORT_MEASURES = ["biasa_24","biasa_48","elektronik_48","e_polikarbonat"] as const;

export type ResidencePermitRow = z.infer<typeof ResidencePermitRowSchema>;
export type PassportRow = z.infer<typeof PassportRowSchema>;

export function residenceDerivedTotal(row: Omit<ResidencePermitRow,"total">): number {
  return RESIDENCE_MEASURES.reduce((sum,key)=>sum+row[key],0);
}
export function passportDerivedTotal(row: Omit<PassportPermitRow,"total">): number {
  return PASSPORT_MEASURES.reduce((sum,key)=>sum+row[key],0);
}
export function businessKey(periode:string,kantor_imigrasi:string):string {
  return periode+"::"+kantor_imigrasi.trim();
}
