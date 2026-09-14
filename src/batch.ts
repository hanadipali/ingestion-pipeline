import { createHash } from "crypto";
import { ValidatedRow, InvalidRow } from "./csvParser";
import { TransactionRow } from "./schema";

export interface Batch {
  batchId: string;
  fileHash: string;
  validatedRows: number; 
  invalidRows: number;
  duplicatedRows: number; 
  invalidDetails: { rowNumber: number; reasons: string[] }[];
  createdAt: number;
}

interface Transaction {
  hash: string;
  batchId: string;
  data: TransactionRow;
}

export class BatchStore {
  private batches = new Map<string, Batch>();
  private seenRowHashes = new Set<string>();

  private fileHashToBatchId = new Map<string, string>();

  private transactions: Transaction[] = [];

  hashFile(fileBuffer: Buffer): string {
    return createHash("sha256").update(fileBuffer).digest("hex");
  }

  findExistingBatch(fileHash: string): Batch | undefined {
    const existingId = this.fileHashToBatchId.get(fileHash);
    return existingId ? this.batches.get(existingId) : undefined;
  }

  createBatch(
    fileHash: string,
    validated: ValidatedRow[],
    rejected: InvalidRow[]
  ): Batch {
    const batchId = createHash("sha256")
      .update(fileHash + Date.now().toString())
      .digest("hex")
      .slice(0, 16);

    let validatedRows = 0;
    let duplicatedRows = 0;

    for (const row of validated) {
      if (this.seenRowHashes.has(row.hash)) {
        duplicatedRows++;
        continue;
      }
      this.seenRowHashes.add(row.hash);
      this.transactions.push({ hash: row.hash, batchId, data: row.data });
      validatedRows++;
    }

    const batch: Batch = {
      batchId,
      fileHash,
      validatedRows,
      invalidRows: rejected.length,
      duplicatedRows,
      invalidDetails: rejected.map((r) => ({
        rowNumber: r.rowNumber,
        reasons: r.reasons,
      })),
      createdAt: Date.now(),
    };

    this.batches.set(batchId, batch);
    this.fileHashToBatchId.set(fileHash, batchId);
    return batch;
  }

  getBatch(batchId: string): Batch | undefined {
    return this.batches.get(batchId);
  }
}
