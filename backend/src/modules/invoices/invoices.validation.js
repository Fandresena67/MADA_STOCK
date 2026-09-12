const { z } = require('zod');
const { MONEY_MAX } = require('../../utils/money');

const money = z.coerce.number().int('Montant entier requis').min(0).max(MONEY_MAX);

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const invoiceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['draft', 'issued', 'paid', 'cancelled']).optional(),
  sale_id: z.coerce.number().int().positive().optional(), // facture associée à une vente
  customer_id: z.coerce.number().int().positive().optional(),
  sort: z.enum(['invoice_number', 'created_at', 'total', 'status', 'customer']).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
});

const standaloneLineSchema = z.object({
  product_id: z.coerce.number().int().positive().nullable().optional(),
  product_name: z.string().trim().min(1).max(200).optional(),
  quantity: z.coerce.number().int().min(1).max(1000000000),
  unit_price: money.default(0),
  discount: money.default(0),
  tax: money.default(0),
}).refine((l) => l.product_id || l.product_name, { message: 'Ligne : produit ou désignation requis' });

const invoiceBodySchema = z.object({
  // Depuis une vente confirmée (lignes snapshotées + totaux recalculés)…
  sale_id: z.coerce.number().int().positive().optional(),
  // …ou autonome (client + lignes requis).
  customer_id: z.coerce.number().int().positive().optional(),
  items: z.array(standaloneLineSchema).min(1).max(200).optional(),
  discount: money.default(0),
  tax: money.default(0),
  due_at: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).default(''),
}).refine((d) => d.sale_id || (d.customer_id && d.items), {
  message: 'Fournir sale_id (vente confirmée) ou customer_id + items',
});

const invoiceStatusSchema = z.object({
  status: z.enum(['issued', 'paid', 'cancelled']),
});

module.exports = { idParamSchema, invoiceListQuerySchema, invoiceBodySchema, invoiceStatusSchema };
