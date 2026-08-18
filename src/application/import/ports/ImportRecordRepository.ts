import type { ImportRecord } from "../contracts";

export type ImportRecordRepository = {
  attach(jobId: string, records: ImportRecord[]): ImportRecord[];
  getByJobId(jobId: string): ImportRecord[];
};
