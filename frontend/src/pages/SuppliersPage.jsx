import { createSupplier, listSuppliers, updateSupplier } from '../api/catalog';
import { makeTierPage } from '../components/TierPage';

const SuppliersPage = makeTierPage({
  title: 'Fournisseurs',
  subtitle: 'Entreprises qui vous approvisionnent en marchandises',
  singular: 'fournisseur',
  createLabel: '+ Nouveau fournisseur',
  emptyTitle: 'Aucun fournisseur',
  emptyMessage: 'Ajoutez votre premier fournisseur pour le retrouver ici.',
  api: { list: listSuppliers, create: createSupplier, update: updateSupplier },
  managePerm: 'suppliers.manage',
});

export default SuppliersPage;
