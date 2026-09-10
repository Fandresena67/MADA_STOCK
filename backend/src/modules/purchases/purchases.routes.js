const { buildDocRouter } = require('../documents/doc.routes');
const service = require('./purchases.service');
const { idParamSchema, purchaseListQuerySchema, purchaseBodySchema, purchasePatchSchema } = require('./purchases.validation');

module.exports = buildDocRouter({
  service,
  validation: { idParam: idParamSchema, listQuery: purchaseListQuerySchema, body: purchaseBodySchema, patch: purchasePatchSchema },
  perms: { view: 'purchases.view', create: 'purchases.create', update: 'purchases.update', confirm: 'purchases.confirm' },
  tierFilterKey: 'supplier_id',
});
