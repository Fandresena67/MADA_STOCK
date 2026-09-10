const { z } = require('zod');
const { MONEY_MAX } = require('../../utils/money');

const money = z.coerce.number().int('Montant entier requis').min(0, 'Montant négatif interdit').max(MONEY_MAX);

const docLineSchema = z.object({
  product_id: z.coerce.number().int().positive('Produit invalide'),
  quantity: z.coerce.number().int('Quantité entière requise').min(1, 'Quantité > 0 requise').max(1000000000),
  unit_price: money.default(0),
  discount: money.default(0),
  tax: money.default(0),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const docListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['draft', 'confirmed', 'cancelled']).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

function makeDocBodySchema(tierKey) {
  return z.object({
    [tierKey]: z.coerce.number().int().positive('Tiers invalide'),
    items: z.array(docLineSchema).min(1, 'Au moins une ligne requise').max(200),
    discount: money.default(0),
    tax: money.default(0),
    notes: z.string().trim().max(1000).default(''),
  });
}

function makeDocPatchSchema(tierKey) {
  return z
    .object({
      [tierKey]: z.coerce.number().int().positive().optional(),
      items: z.array(docLineSchema).min(1).max(200).optional(),
      discount: money.optional(),
      tax: money.optional(),
      notes: z.string().trim().max(1000).optional(),
      status: z.enum(['cancelled']).optional(), // draft → cancelled uniquement
    })
    .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });
}

module.exports = { idParamSchema, docListQuerySchema, makeDocBodySchema, makeDocPatchSchema, docLineSchema };
