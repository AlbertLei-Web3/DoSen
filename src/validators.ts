/**
 * zod validators for API inputs / API 入参校验
 */
import { z } from 'zod';

export const platformSchema = z.enum(['Discord', 'X', 'Telegram']);

export const createUserSchema = z.object({
  username: z.string().min(1, 'username is required'),
  platform: platformSchema,
});

export const createEventSchema = z.object({
  domainName: z.string().min(1, 'domainName is required'),
  eventType: z.enum(['Expired', 'Sale', 'Trend']),
  price: z.number().optional(),
  timestamp: z.string().datetime().optional(),
  source: z.string().optional(),
  apiRequestPayload: z.unknown().optional(),
  apiResponsePayload: z.unknown().optional(),
});

export const createTransactionSchema = z.object({
  userId: z.string().uuid('userId must be UUID'),
  domainName: z.string().min(1),
  transactionType: z.enum(['Purchase', 'List', 'Trade']),
  amount: z.number().optional(),
});

export const customSubscriptionSchema = z.object({
  filters: z.record(z.any()).default({}),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CustomSubscriptionInput = z.infer<typeof customSubscriptionSchema>;


