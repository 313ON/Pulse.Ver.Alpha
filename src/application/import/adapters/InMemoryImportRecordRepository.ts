import type { ImportRecord } from "../contracts";
import type { ImportRecordRepository } from "../ports";

export class InMemoryImportRecordRepository implements ImportRecordRepository {
  private readonly records = new Map<string, ImportRecord[]>();

  attach(jobId: string, records: ImportRecord[]): ImportRecord[] {
    const attached = [...records];
    this.records.set(jobId, attached);
    return attached;
  }

  getByJobId(jobId: string): ImportRecord[] {
    return [...(this.records.get(jobId) ?? [])];
  }
}
