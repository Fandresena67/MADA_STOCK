import { getPurchase, updatePurchase, confirmPurchase } from '../api/catalog';
import { makeDocDetail } from '../components/DocDetail';

const PurchaseDetail = makeDocDetail({
  singular: 'Achat',
  tierLabel: 'Fournisseur',
  basePath: '/app/purchases',
  confirmText: 'Confirmer cet achat ? Cette action ajoutera les quantités au stock.',
  perms: { confirm: 'purchases.confirm', update: 'purchases.update' },
  api: { get: getPurchase, update: updatePurchase, confirm: confirmPurchase },
});

export default PurchaseDetail;
