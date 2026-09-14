import express, { Request, Response } from "express";
import multer from "multer";
import { processCSV } from "./csvParser";
import { BatchStore } from "./batch";

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const store = new BatchStore();

app.post("/ingest", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Expected a 'file' field." });
  }

  const fileHash = store.hashFile(req.file.buffer);
  const existing = store.findExistingBatch(fileHash);
  if (existing) {
    return res.status(200).json(existing);
  }

  const { validated, invalid } = processCSV(req.file.buffer);

  const batch = store.createBatch(fileHash, validated, invalid);

  res.status(201).json(batch);
});

app.get("/ingest/:batchId", (req: Request, res: Response) => {
  const batch = store.getBatch(req.params.batchId);

  if (!batch) {
    return res.status(404).json({ error: "Batch not found." });
  }

  res.status(200).json(batch);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Ingestion pipeline listening on port ${PORT}`);
  });
}

export default app;
