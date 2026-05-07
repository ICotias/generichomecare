import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { AppUser, UserRole } from '../types';

/** Detecta role pelo email (fallback para primeiro login sem doc Firestore) */
const inferRoleFromEmail = (email: string): UserRole => {
  const lower = email.toLowerCase();
  if (lower.includes('admin')) return 'admin';
  if (lower.includes('family') || lower.includes('familia')) return 'family';
  return 'nurse';
};

interface AuthState {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
  originalRole: UserRole | null;
  isSimulating: boolean;

  setUser: (user: AppUser | null) => void;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void;
  simulateRole: (role: UserRole) => void;
  stopSimulation: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  role: null,
  originalRole: null,
  isSimulating: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      role: user?.role ?? null,
      originalRole: user?.role ?? null,
      isSimulating: false,
    }),

  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),

  setLoading: (isLoading) => set({ isLoading }),

  signIn: async (email, password) => {
    set({ isLoading: true });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O onAuthStateChanged vai cuidar de atualizar o state
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      role: null,
      originalRole: null,
      isSimulating: false,
    });
  },

  // Simular role diferente (apenas para admin)
  simulateRole: (role) => {
    const { originalRole } = get();
    set({
      role,
      isSimulating: role !== originalRole,
    });
  },

  // Voltar ao role original
  stopSimulation: () => {
    const { originalRole } = get();
    set({
      role: originalRole,
      isSimulating: false,
    });
  },

  // Listener de auth — chamar no App.tsx
  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const { setUser, setFirebaseUser, setLoading } = get();
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));

          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              nome: data.nome ?? '',
              role: data.role ?? 'nurse',
              empresaId: data.empresaId ?? '',
              telefone: data.telefone ?? '',
              createdAt: data.createdAt?.toDate?.() ?? new Date(),
              updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
            });
          } else {
            // Usuário autenticado mas sem perfil no Firestore — cria automaticamente
            console.warn('Perfil não encontrado no Firestore, criando automaticamente...');
            const role = inferRoleFromEmail(firebaseUser.email ?? '');
            const now = Timestamp.now();
            const newProfile = {
              nome: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
              email: firebaseUser.email ?? '',
              role,
              empresaId: '',
              telefone: '',
              createdAt: now,
              updatedAt: now,
            };

            try {
              await setDoc(doc(db, 'usuarios', firebaseUser.uid), newProfile);
              setUser({
                uid: firebaseUser.uid,
                email: newProfile.email,
                nome: newProfile.nome,
                role: newProfile.role,
                empresaId: '',
                telefone: '',
                createdAt: now.toDate(),
                updatedAt: now.toDate(),
              });
            } catch (createError) {
              console.error('Erro ao criar perfil:', createError);
              setUser(null);
            }
          }
        } catch (error) {
          console.error('Erro ao buscar perfil:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  },
}));
