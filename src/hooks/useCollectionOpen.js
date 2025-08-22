import { useEffect, useState, useCallback } from 'react';
import { isAnyScheduleOpenNow } from '../utils/collectionUtils';

/**
 * Hook para saber si hay recogida abierta para un banco.
 * Devuelve { isOpen, openSchedules, loading, refresh }
 */
export default function useCollectionOpen(bankId) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSchedules, setOpenSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!bankId) { setIsOpen(false); setOpenSchedules([]); return; }
    setLoading(true);
    const res = await isAnyScheduleOpenNow(bankId);
    setIsOpen(res.open);
    setOpenSchedules(res.openSchedules);
    setLoading(false);
  }, [bankId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { isOpen, openSchedules, loading, refresh };
}
