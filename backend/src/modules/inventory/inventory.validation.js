const { z } = require('zod');

const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(['all', 'NORMAL', 'FAIBLE', 'RUPTURE']).default('all'),
});

const alertsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

module.exports = { inventoryQuerySchema, alertsQuerySchema };
