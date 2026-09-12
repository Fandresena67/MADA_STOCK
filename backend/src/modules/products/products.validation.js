const { z } = require('zod');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const int0 = z.coerce.number().int('Entier requis').min(0, 'Valeur négative interdite');

const SORT_FIELDS = ['id', 'name', 'quantity', 'purchase_price', 'sale_price', 'created_at', 'updated_at'];

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  outOfStock: z.enum(['true', 'false']).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
  sort: z.enum(SORT_FIELDS).default('id'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

const skuSchema = z
  .string()
  .trim()
  .min(1, 'SKU invalide')
  .max(64)
  .regex(/^[A-Za-z0-9\-_./]+$/, 'SKU : lettres, chiffres, tirets, underscore, point, slash');

const productBodySchema = z.object({
  name: z.string().trim().min(2, 'Nom : 2 caractères minimum').max(200),
  sku: skuSchema.optional(), // absent → généré (P-{companyId}-{seq}, unique par entreprise)
  description: z.string().trim().max(1000).default(''),
  category_id: z.number().int().positive('Catégorie invalide').nullable().optional(),
  purchase_price: int0.default(0),
  sale_price: int0.default(0),
  quantity: int0.default(0), // stock initial (mouvements détaillés = Étape 5)
  min_stock: int0.default(0),
  unit: z.string().trim().min(1).max(32).default('unité'),
  barcode: z.string().trim().min(1).max(64).nullable().optional(),
});

const productPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    sku: skuSchema.optional(),
    description: z.string().trim().max(1000).optional(),
    category_id: z.number().int().positive('Catégorie invalide').nullable().optional(),
    purchase_price: int0.optional(),
    sale_price: int0.optional(),
    // Stock verrouillé : toute modification passe par les mouvements (Étape 5).
    quantity: z.any().optional(),
    min_stock: int0.optional(),
    unit: z.string().trim().min(1).max(32).optional(),
    barcode: z.string().trim().min(1).max(64).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' })
  .superRefine((d, ctx) => {
    if (d.quantity !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantity'],
        message: 'Le stock ne peut pas être modifié directement — utilisez les entrées, sorties ou ajustements',
      });
    }
  });

module.exports = { idParamSchema, listQuerySchema, productBodySchema, productPatchSchema, SORT_FIELDS };
