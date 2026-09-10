import { listPurchases, getPurchase, createPurchase, updatePurchase, confirmPurchase, listSuppliers, listProducts } from '../api/catalog';
import { makeDocPage } from '../components/DocPage';

const PurchasesPage = makeDocPage({
  title: 'Achats',
  subtitle: 'Brouillons puis réceptions confirmées (entrées de stock)',
  singular: 'achat',
  createLabel: '+ Nouvel achat',
  createTitle: 'Nouvel achat (brouillon)',
  tierLabel: 'Fournisseur',
  tierKey: 'supplier_id',
  basePath: '/app/purchases',
  priceKey: 'purchase_price',
  stockHint: false,
  perms: { create: 'purchases.create' },
  api: {
    list: listPurchases, get: getPurchase, create: createPurchase, update: updatePurchase, confirm: confirmPurchase,
    listTiers: listSuppliers, listProducts,
  },
});

export default PurchasesPage;
