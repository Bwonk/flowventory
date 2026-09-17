'use client';

import { useEffect, useState } from 'react';
import { ApiRequests } from '@/lib/api-requests';
import { logger } from '@/lib/logger';
import type { TargetOption } from '../_components/TargetPicker';

interface TargetOptionsState {
  products: TargetOption[];
  vendors: TargetOption[];
  loading: boolean;
}

/**
 * Kapsam seçicileri için ürün ve tedarikçi listeleri (bir kez yüklenir).
 * "local-" önekli yerel tedarikçilerin ürünü yoktur — kural eşleşmez, listelenmez.
 */
export function useTargetOptions(token: string): TargetOptionsState {
  const [state, setState] = useState<TargetOptionsState>({ products: [], vendors: [], loading: true });

  useEffect(() => {
    let ignore = false;
    Promise.all([
      ApiRequests.products.options(token).then(res => res.data?.data?.products ?? []),
      ApiRequests.vendors.list(token).then(res => res.data?.data?.vendors ?? []),
    ])
      .then(([productRows, vendorRows]) => {
        if (ignore) return;
        setState({
          products: productRows.map(p => ({ id: p.productId, label: p.productName, hint: `${p.totalStock} adet` })),
          vendors: vendorRows.filter(v => !v.vendorId.startsWith('local-')).map(v => ({ id: v.vendorId, label: v.vendorName })),
          loading: false,
        });
      })
      .catch(error => {
        logger.error('Rule target options failed', { error });
        if (!ignore) setState(prev => ({ ...prev, loading: false }));
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  return state;
}
