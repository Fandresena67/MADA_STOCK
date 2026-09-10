const { z } = require('zod');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  is_active: z.enum(['true', 'false']).optional(),
});

const emailOpt = z.string().trim().max(255).optional().default('')
  .refine((v) => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Email invalide' });

const tierBodySchema = z.object({
  name: z.string().trim().min(2, 'Nom : 2 caractères minimum').max(200),
  email: emailOpt,
  phone: z.string().trim().max(64).default(''),
  address: z.string().trim().max(500).default(''),
  notes: z.string().trim().max(1000).default(''),
});

const tierPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    email: emailOpt.optional(),
    phone: z.string().trim().max(64).optional(),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { idParamSchema, listQuerySchema, tierBodySchema, tierPatchSchema };
