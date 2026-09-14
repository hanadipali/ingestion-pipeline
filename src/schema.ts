import { z } from "zod";


export const transactionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format")
    .transform((s) => new Date(s))
    .refine((d) => !isNaN(d.getTime()), "date is not a real calendar date"),

  amount: z.coerce
    .number({ invalid_type_error: "amount must be a number" })
    .finite("amount must be finite")
    .refine((n) => n !== 0, "amount cannot be zero"),

  currency: z.enum(["USD", "EUR"], {
    errorMap: () => ({ message: "currency must be USD or EUR" }),
  }),

  description: z
    .string()
    .trim()
    .min(1, "description cannot be empty")
    .max(200, "description cannot exceed 200 characters"),

  category: z.enum(
    ["food", "groceries", "entertainment", "travel", "other"],
    { errorMap: () => ({ message: "invalid category" }) }
  ),
});

export type TransactionRow = z.infer<typeof transactionSchema>;
export type RawCsvRow = Record<string, string>;
