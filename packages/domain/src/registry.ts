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
  measures: readonly string[];
  derivedTotal: "total";
  rowSchema: z.ZodType;
};

export const DATASET_CONTRACTS: Readonly<Record<DatasetKey, DatasetContractDefinition>> = {
  RESIDENCE_PERMIT_SERVICE_MONTHLY: {
    ...RESIDENCE_PERMIT_SERVICE_MONTHLY,
    measures: RESIDENCE_MEASURES,
    rowSchema: ResidencePermitRowSchema
  },
  PASSPORT_SERVICE_MONTHLY: {
    ...PASSPORT_SERVICE_MONTHLY,
    measures: PASSPORT_MEASURES,
    rowSchema: PassportRowSchema
  }
};

export function getDatasetContract(key: DatasetKey): DatasetContractDefinition {
  return DATASET_CONTRACTS[key];
}

export function assertKnownDataset(key: string): asserts key is DatasetKey {
  if (!(key in DATASET_CONTRACTS)) throw new Error("UNKNOWN_DATASET_CONTRACT: " + key);
}
