const { z } = require('zod');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
});

const categoryBodySchema = z.object({
  name: z.string().trim().min(2, 'Nom : 2 caractères minimum').max(120),
  description: z.string().trim().max(500).default(''),
  is_active: z.boolean().optional(),
});

const categoryPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { idParamSchema, paginationSchema, categoryBodySchema, categoryPatchSchema };
