/**
 * Diz se o usuário é dono do próprio tenant, ou seja, se está no modo familiar
 * (família que se cadastrou sozinha, sem empresa por trás).
 *
 * É o que separa os dois mundos na interface: a família dona do tenant gerencia
 * o próprio enfermeiro; a família atendida por uma empresa não, porque quem
 * decide quem atende é a empresa. As rules aplicam a mesma separação no
 * servidor (isTenantOwner), então isto aqui é só para mostrar ou esconder.
 */
import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';
import { useAuthStore } from './useAuth';

export const useIsTenantOwner = (): { isOwner: boolean; isLoading: boolean } => {
  const { user } = useAuthStore();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.empresaId || !user?.uid) {
      setIsOwner(false);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, Collections.EMPRESAS, user.empresaId))
      .then((snap) => {
        if (cancelled) return;
        setIsOwner(snap.exists() && snap.data().ownerUid === user.uid);
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.empresaId, user?.uid]);

  return { isOwner, isLoading };
};
