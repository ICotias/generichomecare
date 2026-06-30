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
import { logAudit } from '../services/auditService';

/**
 * Único e-mail autorizado a simular outras roles (admin → enfermeiro/família).
 * Admins comuns NÃO têm acesso a esse recurso.
 */
export const SIMULATION_ADMIN_EMAIL = 'iago.admin@test.com';

/** Verdadeiro se o usuário pode simular outras roles */
export const canSimulateRoles = (email?: string | null): boolean =>
  (email ?? '').trim().toLowerCase() === SIMULATION_ADMIN_EMAIL;

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
  /** Paciente selecionado durante simulação admin→family */
  simulatedPatientId: string | null;

  setUser: (user: AppUser | null) => void;
  setFirebaseUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void;
  simulateRole: (role: UserRole) => void;
  stopSimulation: () => void;
  setSimulatedPatientId: (id: string | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  isLoading: true,
  isAuthenticated: false,
  role: null,
  originalRole: null,
  isSimulating: false,
  simulatedPatientId: null,

  setUser: (user) => {
    const { isSimulating, role } = get();
    set({
      user,
      isAuthenticated: !!user,
      // Preservar simulação ativa — só atualizar role/originalRole se NÃO estiver simulando
      role: isSimulating ? role : (user?.role ?? null),
      originalRole: user?.role ?? null,
      isSimulating: user ? isSimulating : false,
    });
  },

  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),

  setLoading: (isLoading) => set({ isLoading }),

  signIn: async (email, password) => {
    // NÃO setar isLoading aqui — o RootNavigator desmonta o LoginScreen
    // quando isLoading=true, perdendo o estado de erro local.
    // O loading do botão é controlado pelo estado local do LoginScreen.
    // O isLoading do store é gerenciado apenas pelo onAuthStateChanged.
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // O onAuthStateChanged vai cuidar de atualizar o state
    } catch (error) {
      throw error;
    }
  },

  signOut: async () => {
    const current = get().user;
    if (current) {
      logAudit('logout', current.uid, current.role, current.empresaId);
    }
    await firebaseSignOut(auth);
    set({
      user: null,
      firebaseUser: null,
      isAuthenticated: false,
      role: null,
      originalRole: null,
      isSimulating: false,
      simulatedPatientId: null,
    });
  },

  // Simular role diferente — restrito ao e-mail autorizado (super-admin de testes)
  simulateRole: (role) => {
    const { originalRole, user } = get();
    if (!canSimulateRoles(user?.email)) return; // admin comum não simula
    set({
      role,
      isSimulating: role !== originalRole,
      simulatedPatientId: null, // reset ao trocar de role
    });
  },

  // Voltar ao role original
  stopSimulation: () => {
    const { originalRole } = get();
    set({
      role: originalRole,
      isSimulating: false,
      simulatedPatientId: null,
    });
  },

  setSimulatedPatientId: (id) => set({ simulatedPatientId: id }),

  // Listener de auth — chamar no App.tsx
  initialize: () => {
    let listenerCount = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      listenerCount++;
      const callId = listenerCount;
      console.log(`[Auth #${callId}] onAuthStateChanged disparou. user:`, firebaseUser?.uid ?? 'NULL');

      const { setUser, setFirebaseUser, setLoading } = get();
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
          console.log(`[Auth #${callId}] Doc existe?`, userDoc.exists());

          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              nome: data.nome ?? '',
              role: data.role ?? 'nurse',
              empresaId: data.empresaId ?? '',
              telefone: data.telefone ?? '',
              pacienteId: data.pacienteId ?? undefined,
              parentesco: data.parentesco ?? undefined,
              mustChangePassword: data.mustChangePassword ?? false,
              lgpdConsentAt: data.lgpdConsentAt?.toDate?.() ?? undefined,
              createdAt: data.createdAt?.toDate?.() ?? new Date(),
              updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
            });
            console.log(`[Auth #${callId}] setUser OK — role:`, data.role, 'lgpd:', !!data.lgpdConsentAt);
            logAudit('login', firebaseUser.uid, data.role ?? 'nurse', data.empresaId ?? '');
          } else {
            console.warn(`[Auth #${callId}] Perfil não encontrado, criando...`);
            const role = inferRoleFromEmail(firebaseUser.email ?? '');
            const now = Timestamp.now();
            const safeRole: UserRole = role === 'admin' ? 'admin' : role;

            const newProfile = {
              nome: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
              email: firebaseUser.email ?? '',
              role: safeRole,
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
              console.log(`[Auth #${callId}] Perfil criado — role:`, safeRole);
            } catch (createError) {
              console.error(`[Auth #${callId}] ERRO ao criar perfil:`, createError);
              if (role === 'admin') {
                console.warn(
                  'Admin não pode auto-criar perfil via client. ' +
                  'Crie o documento usuarios/' + firebaseUser.uid + ' no Firebase Console.'
                );
              }
              console.log(`[Auth #${callId}] setUser(null) — motivo: ERRO_CRIAR_PERFIL`);
              setUser(null);
            }
          }
        } catch (error) {
          console.error(`[Auth #${callId}] ERRO ao buscar perfil:`, error);
          console.log(`[Auth #${callId}] setUser(null) — motivo: ERRO_BUSCAR_PERFIL`);
          setUser(null);
        }
      } else {
        console.log(`[Auth #${callId}] setUser(null) — motivo: SEM_USUARIO`);
        setUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  },
}));
