import { createSupplier, listSuppliers, updateSupplier } from '../api/catalog';
import { makeTierPage } from '../components/TierPage';

const SuppliersPage = makeTierPage({
  title: 'Fournisseurs',
  subtitle: 'Tiers de votre entreprise',
  createLabel: '+ Nouveau fournisseur',
  api: { list: listSuppliers, create: createSupplier, update: updateSupplier },
  managePerm: 'suppliers.manage',
});

export default SuppliersPage;
