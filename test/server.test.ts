import request from "supertest";
import app from "../src/server";

// row 3 has an invalid date, row 4 is a repeat of row 1
const validCsv = `date,amount,currency,description,category
2026-01-15,42.50,USD,Grocery run,food
2026-01-16,15.00,EUR,Bus pass,travel
2026-13-40,20.00,USD,Bad date row,food
2026-01-15,42.50,USD,Grocery run,food`;

describe("POST /ingest", () => {
  it("processes a CSV and returns validated/invalid/duplicate counts", async () => {
    const res = await request(app)
      .post("/ingest")
      .attach("file", Buffer.from(validCsv), "sample.csv");

    expect(res.status).toBe(201);
    expect(res.body.validatedRows).toBe(2);
    expect(res.body.invalidRows).toBe(1);
    expect(res.body.duplicatedRows).toBe(1);
    expect(res.body.invalidDetails).toHaveLength(1);
    expect(res.body.invalidDetails[0].rowNumber).toBe(4);
    expect(res.body.batchId).toBeDefined();
  });

  it("returns the same batch when the exact same file is re-uploaded", async () => {
    const first = await request(app)
      .post("/ingest")
      .attach("file", Buffer.from(validCsv), "sample.csv");

    const second = await request(app)
      .post("/ingest")
      .attach("file", Buffer.from(validCsv), "sample.csv");

    expect(second.status).toBe(200);
    expect(second.body.batchId).toBe(first.body.batchId);
  });

  it("returns 400 when no file is attached", async () => {
    const res = await request(app).post("/ingest");
    expect(res.status).toBe(400);
  });
});

describe("GET /ingest/:batchId", () => {
  it("returns the batch summary for a known batchId", async () => {
    const created = await request(app)
      .post("/ingest")
      .attach("file", Buffer.from(validCsv), "sample2.csv");

    const res = await request(app).get(`/ingest/${created.body.batchId}`);

    expect(res.status).toBe(200);
    expect(res.body.batchId).toBe(created.body.batchId);
  });

  it("returns 404 for an unknown batchId", async () => {
    const res = await request(app).get("/ingest/does-not-exist");
    expect(res.status).toBe(404);
  });
});
