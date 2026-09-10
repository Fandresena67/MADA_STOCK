const { z } = require('zod');

const formatSchema = z.enum(['json', 'csv']).default('json');

const stockReportQuery = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: z.enum(['all', 'NORMAL', 'FAIBLE', 'RUPTURE']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  format: formatSchema,
});

const docsReportQuery = z.object({
  status: z.enum(['draft', 'confirmed', 'cancelled']).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  format: formatSchema,
});

const profitReportQuery = z.object({
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  format: formatSchema,
});

const movementsReportQuery = z.object({
  product_id: z.coerce.number().int().positive().optional(),
  movement_type: z.enum(['initial', 'in', 'out', 'adjustment']).optional(),
  user_id: z.coerce.number().int().positive().optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  format: formatSchema,
});

module.exports = { stockReportQuery, docsReportQuery, profitReportQuery, movementsReportQuery };
