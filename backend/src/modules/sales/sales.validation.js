const { idParamSchema, docListQuerySchema, makeDocBodySchema, makeDocPatchSchema } = require('../documents/doc.validation');
const { z } = require('zod');

const saleBodySchema = makeDocBodySchema('customer_id');
const salePatchSchema = makeDocPatchSchema('customer_id');

const saleListQuerySchema = docListQuerySchema.extend({
  customer_id: z.coerce.number().int().positive().optional(),
});

module.exports = { idParamSchema, saleListQuerySchema, saleBodySchema, salePatchSchema };
