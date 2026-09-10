const { idParamSchema, docListQuerySchema, makeDocBodySchema, makeDocPatchSchema } = require('../documents/doc.validation');
const { z } = require('zod');

const purchaseBodySchema = makeDocBodySchema('supplier_id');
const purchasePatchSchema = makeDocPatchSchema('supplier_id');

const purchaseListQuerySchema = docListQuerySchema.extend({
  supplier_id: z.coerce.number().int().positive().optional(),
});

module.exports = { idParamSchema, purchaseListQuerySchema, purchaseBodySchema, purchasePatchSchema };
