# CSV Ingestion Pipeline — Validation & Idempotency

Express + TypeScript service that ingests CSV transaction files, validates rows against a schema, and stores the clean ones.

Requirements:
- validate every row with a schema library, no hand-rolled if-chains
- malformed rows get collected and reported, not dropped and not fatal to the batch
- idempotent re-ingestion — re-uploading the same file shouldn't create duplicates
- a way to pull back a batch summary after the fact

## Running it

```bash
npm install
npm run dev    # localhost:3000
npm test
```

A sample file is at `test/testFile.csv` for manual curl testing.

## Layout

```
src/
  schema.ts     zod schema for one transaction row
  csvParser.ts  parses the uploaded buffer, runs each row through the schema
  batch.ts      BatchStore — hashing, dedup, in-memory storage
  server.ts     express app, the two /ingest routes
test/
  server.test.ts  endpoint tests
  testFile.csv    sample CSV for curl
```

## API

### `POST /ingest`

Accepts a CSV file under the multipart field name `file`.

```bash
curl -X POST localhost:3000/ingest -F "file=@test/testFile.csv"
```

Response (`201` for a new batch, `200` if the exact same file was already ingested):

```json
{
  "batchId": "9b183ca1e227bf0d",
  "fileHash": "4389ec...",
  "validatedRows": 4,
  "invalidRows": 5,
  "duplicatedRows": 1,
  "invalidDetails": [
    { "rowNumber": 6, "reasons": ["date: date is not a real calendar date"] },
    { "rowNumber": 7, "reasons": ["amount: amount must be a number"] },
    { "rowNumber": 8, "reasons": ["currency: currency must be USD or EUR"] },
    { "rowNumber": 9, "reasons": ["description: description cannot be empty"] },
    { "rowNumber": 10, "reasons": ["category: invalid category"] }
  ],
  "createdAt": 1788434388420
}
```

### `GET /ingest/:batchId`

Returns the same batch summary shown above. `404` if the batch ID doesn't exist.

```bash
curl localhost:3000/ingest/9b183ca1e227bf0d
```

## CSV schema

| Column | Rules |
|---|---|
| `date` | `YYYY-MM-DD`, must be a real calendar date |
| `amount` | Number, cannot be zero |
| `currency` | One of: `USD`, `EUR` |
| `description` | 1–200 characters |
| `category` | One of: `food`, `groceries`, `entertainment`, `travel`, `other` |

## How it's wired

Idempotency is two separate checks. `hashFile` hashes the raw upload bytes. An exact re-upload matches an existing `fileHash` and returns the same batch without needing to parse again. Within a batch, each validated row also gets hashed on the contents (`hashRow`), so a re-exported CSV that overlaps a previous one gets flagged as `duplicatedRows` instead of stored twice.

Row validation goes through `transactionSchema.safeParse` rather than `parse`, so a bad row returns a result object instead of erroring. `processCSV` checks `result.success` and either pushes to `validated` or `invalid` with the Zod issue messages attached as `reasons`, and keeps going either way.


A couple things I'd work on if I had more time:

- Row-level dedup is content-only (date + amount + currency + description + category), so two genuinely separate transactions that happen to look identical — same coffee shop, same $5, same day — get flagged as a duplicate on the second one. Real dedup would probably need more accuracy, unique IDs.
- Currently, the whole file gets parsed before any row is validated. For a bigger app this would be inefficient with more data 
- Currently, a non-CSV file doesn't get rejected immediately. Should add type checks.