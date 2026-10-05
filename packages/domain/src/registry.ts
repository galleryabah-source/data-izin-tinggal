import { z } from "zod";
import {
  PASSPORT_MEASURES,
  PASSPORT_SERVICE_MONTHLY,
  PassportRowSchema,
  RESIDENCE_MEASURES,
  RESIDENCE_PERMIT_SERVICE_MONTHLY,
  ResidencePermitRowSchema
} from "./contracts.js";

export type DatasetKey =
  | typeof RESIDENCE_PERMIT_SERVICE_MONTHLY.key
  | typeof PASSPORT_SERVICE_MONTHLY.key;

export type DatasetContractDefinition = {
  key: DatasetKey;
  version: 1;
  businessKey: readonly ["periode", "kantor_imigrasi"];
  columns: readonly string[];
  required: readonly string[];
  optional: readonly string[];
  measures: readonly string[];
  derivedTotal: "total";
  rowSchema: z.ZodType;
};

export const DATASET_CONTRACTS: Readonly<Record<DatasetKey, DatasetContractDefinition>> = {
  RESIDENCE_PERMIT_SERVICE_MONTHLY: {
    ...RESIDENCE_PERMIT_SERVICE_MONTHLY,
    columns: ["periode", "kantor_imigrasi", ...RESIDENCE_MEASURES, "total"],
    required: ["periode", "kantor_imigrasi", ...RESIDENCE_MEASURES],
    optional: ["total"],
    measures: RESIDENCE_MEASURES,
    rowSchema: ResidencePermitRowSchema
  },
  PASSPORT_SERVICE_MONTHLY: {
    ...PASSPORT_SERVICE_MONTHLY,
    columns: ["periode", "kantor_imigrasi", ...PASSPORT_MEASURES, "total"],
    required: ["periode", "kantor_imigrasi", ...PASSPORT_MEASURES],
    optional: ["total"],
    measures: PASSPORT_MEASURES,
    rowSchema: PassportRowSchema
  }
};

export const DATASET_KEYS = Object.freeze(Object.keys(DATASET_CONTRACTS) as DatasetKey[]);

export function getDatasetContract(key: DatasetKey): DatasetContractDefinition {
  return DATASET_CONTRACTS[key];
}

export function assertKnownDataset(key: string): asserts key is DatasetKey {
  if (!(key in DATASET_CONTRACTS)) throw new Error("UNKNOWN_DATASET_CONTRACT: " + key);
}
