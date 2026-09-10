const { z } = require('zod');

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const patchCompanySchema = z.object({
  is_active: z.boolean(),
});

const companiesQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
});

const usersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  company_id: z.coerce.number().int().positive().optional(),
  role: z.enum(['super_admin', 'company_admin', 'employee']).optional(),
  is_active: z.enum(['true', 'false']).optional(),
});

const auditQuerySchema = paginationSchema.extend({
  action: z.string().trim().max(64).optional(),
  company_id: z.coerce.number().int().positive().optional(),
  user_id: z.coerce.number().int().positive().optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

module.exports = { paginationSchema, idParamSchema, patchCompanySchema, companiesQuerySchema, usersQuerySchema, auditQuerySchema };
