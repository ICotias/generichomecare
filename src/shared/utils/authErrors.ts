/**
 * Traduz erros do Firebase Auth para mensagens amigáveis em português.
 * Aceita tanto o objeto de erro quanto o código como string.
 * O `fallback` cobre códigos não mapeados e varia por contexto (criar conta,
 * criar convite, vincular família, etc).
 */
export const mapAuthError = (
  error: unknown,
  fallback = 'Não foi possível concluir. Tente novamente',
): string => {
  const code =
    (error as { code?: string })?.code ?? (typeof error === 'string' ? error : '');

  switch (code) {
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com este e-mail';
    case 'auth/invalid-email':
      return 'E-mail inválido';
    case 'auth/weak-password':
      return 'Senha muito fraca';
    case 'auth/network-request-failed':
      return 'Falha de rede. Verifique sua conexão';
    default:
      return fallback;
  }
};
