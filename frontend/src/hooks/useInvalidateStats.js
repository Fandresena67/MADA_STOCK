import { useQueryClient } from '@tanstack/react-query';

/** Invalide les stats après mutation métier (vente/achat/mouvement/produit confirmé). */
export function useInvalidateStats() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  };
}
