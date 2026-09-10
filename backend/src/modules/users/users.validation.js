const { z } = require('zod');
const { PERMISSION_CODES } = require('../../rbac/permissions');

const emailSchema = z.string().email('Email invalide').max(255).toLowerCase().trim();
const passwordSchema = z
  .string()
  .min(8, 'Mot de passe : 8 caractères minimum')
  .max(128, 'Mot de passe trop long')
  .regex(/[A-Z]/, 'Mot de passe : au moins une majuscule')
  .regex(/[a-z]/, 'Mot de passe : au moins une minuscule')
  .regex(/[0-9]/, 'Mot de passe : au moins un chiffre');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Nom : 2 caractères minimum').max(255),
  email: emailSchema,
  password: passwordSchema,
  // Rôle ignoré sauf pour super_admin (jamais 'super_admin' via API).
  role: z.enum(['employee', 'company_admin']).optional(),
});

const patchUserSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    is_active: z.boolean().optional(),
    role: z.enum(['employee', 'company_admin']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

const grantPermissionSchema = z.object({
  permission: z.enum(PERMISSION_CODES, { errorMap: () => ({ message: 'Permission inconnue' }) }),
});

module.exports = { idParamSchema, paginationSchema, createUserSchema, patchUserSchema, grantPermissionSchema };
