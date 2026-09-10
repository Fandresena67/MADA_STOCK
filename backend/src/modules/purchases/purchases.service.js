const { makeDocService } = require('../documents/doc.service');

const purchases = makeDocService({
  table: 'purchases',
  tierTable: 'suppliers',
  tierKey: 'supplier_id',
  tierLabel: 'supplier',
  refSeq: 'purchase_ref_seq',
  refPrefix: 'ACH',
  movementType: 'in',
  movementReason: 'Achat',
  auditPrefix: 'PURCHASE',
});

module.exports = purchases;
