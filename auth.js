(() => {
  const screen = document.getElementById('auth-screen');
  const form = document.getElementById('login-form');
  const error = document.getElementById('login-error');
  const toggle = document.getElementById('toggle-password');
  const sessionKey = 'clareza_supabase_session';
  const config = window.CLAREZA_SUPABASE || {};
  let recoverySession = null;
  const showError = (message) => { error.textContent = message; error.classList.add('show'); };
  const saveSession = (session) => sessionStorage.setItem(sessionKey, JSON.stringify(session));
  const getSession = () => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; } };
  const authRequest = async (path, options = {}) => {
    if (!config.publishableKey || config.publishableKey.startsWith('REPLACE_')) throw new Error('A chave pública do Supabase ainda não foi configurada.');
    const response = await fetch(`${config.url}${path}`, { ...options, headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error_description || body.msg || body.message || 'Não foi possível autenticar.');
    return body;
  };
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (hash.get('type') === 'recovery' && hash.get('access_token')) {
    recoverySession = { access_token: hash.get('access_token') };
    history.replaceState(null, '', location.pathname + location.search);
    document.querySelector('.auth-copy h1').textContent = 'Defina uma nova senha';
    document.querySelector('.auth-copy>p:last-child').textContent = 'O link de recuperação foi validado pelo Supabase.';
    form.elements.email.closest('label').style.display = 'none';
    form.elements.password.placeholder = 'Nova senha';
    form.querySelector('button[type="submit"]').textContent = 'Salvar nova senha';
  }
  if (getSession()?.access_token && !recoverySession) screen.remove();
  toggle?.addEventListener('click', () => { const input = form.elements.password; input.type = input.type === 'password' ? 'text' : 'password'; toggle.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar'; });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault(); error.classList.remove('show');
    const data = new FormData(form); const password = String(data.get('password') || '');
    if (password.length < 8) return showError('Use uma senha com pelo menos 8 caracteres.');
    try {
      if (recoverySession) {
        await authRequest('/auth/v1/user', { method: 'PUT', headers: { Authorization: `Bearer ${recoverySession.access_token}` }, body: JSON.stringify({ password }) });
        recoverySession = null; form.reset(); form.elements.email.closest('label').style.display = ''; form.querySelector('button[type="submit"]').textContent = 'Entrar com segurança';
        document.querySelector('.auth-copy h1').textContent = 'Senha atualizada'; document.querySelector('.auth-copy>p:last-child').textContent = 'Agora entre com sua nova senha.'; return;
      }
      const email = String(data.get('email') || '').trim(); if (!email) return showError('Informe seu email.');
      saveSession(await authRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) })); screen.remove();
    } catch (caught) { showError(caught.message); }
  });
  const logout = document.getElementById('logout') || (() => { const button = document.createElement('button'); button.id = 'logout'; button.className = 'nav-item'; button.textContent = '↪ Sair'; document.querySelector('.sidebar-bottom')?.prepend(button); return button; })();
  logout?.addEventListener('click', async () => { sessionStorage.removeItem(sessionKey); location.reload(); });
})();
