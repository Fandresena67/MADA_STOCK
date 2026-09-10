const { z } = require('zod');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const qtyStrict = z.coerce.number().int('Quantité entière requise').min(1, 'Quantité > 0 requise').max(1000000000);

const baseMovementSchema = z.object({
  product_id: z.coerce.number().int().positive('Produit invalide'),
  reason: z.string().trim().max(200).default(''),
  reference: z.string().trim().max(64).default(''),
  notes: z.string().trim().max(1000).default(''),
  idempotency_key: z.string().uuid('Clé idempotence UUID requise').optional(),
});

const entrySchema = baseMovementSchema.extend({
  quantity: qtyStrict,
});

const exitSchema = baseMovementSchema.extend({
  quantity: qtyStrict,
});

const adjustmentSchema = baseMovementSchema.extend({
  // Ajustement = quantité CIBLE (>= 0, zéro autorisé).
  quantity: z.coerce.number().int('Quantité entière requise').min(0).max(1000000000),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  product_id: z.coerce.number().int().positive().optional(),
  movement_type: z.enum(['initial', 'in', 'out', 'adjustment']).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.enum(['id', 'created_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

module.exports = { idParamSchema, entrySchema, exitSchema, adjustmentSchema, historyQuerySchema };
