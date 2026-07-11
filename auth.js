(() => {
  const screen = document.getElementById('auth-screen');
  const form = document.getElementById('login-form');
  const error = document.getElementById('login-error');
  const toggle = document.getElementById('toggle-password');
  const forgot = document.getElementById('forgot-password');
  const sessionKey = 'clareza_supabase_session';
  const config = window.CLAREZA_SUPABASE || {};
  let recoverySession = null;
  const showError = (message) => { error.textContent = message; error.style.color = 'var(--red)'; error.classList.add('show'); };
  const saveSession = (session) => sessionStorage.setItem(sessionKey, JSON.stringify(session));
  const getSession = () => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; } };
  const authRequest = async (path, options = {}) => {
    if (!config.publishableKey || config.publishableKey.startsWith('REPLACE_')) throw new Error('A chave pública do Supabase ainda não foi configurada.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(`${config.url}${path}`, { ...options, signal: controller.signal, headers: { apikey: config.publishableKey, 'Content-Type': 'application/json', ...(options.headers || {}) } });
    } catch (caught) {
      clearTimeout(timeout);
      if (caught?.name === 'AbortError') throw new Error('O Supabase demorou para responder. Tente novamente.');
      throw caught;
    }
    clearTimeout(timeout);
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
  if (getSession()?.access_token && !recoverySession) { screen.remove(); window.dispatchEvent(new Event('clareza:authenticated')); }
  toggle?.setAttribute('aria-label', 'Mostrar ou ocultar senha');
  toggle?.addEventListener('click', () => { const input = form.elements.password; input.type = input.type === 'password' ? 'text' : 'password'; toggle.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar'; });
  forgot?.addEventListener('click', async () => {
    error.classList.remove('show');
    const email = String(form.elements.email.value || '').trim();
    if (!email) return showError('Informe seu email antes de solicitar a recuperação.');
    forgot.disabled = true;
    try {
      await authRequest('/auth/v1/recover', { method: 'POST', body: JSON.stringify({ email }) });
      error.textContent = 'Se o email estiver cadastrado, enviaremos um link de recuperação.';
      error.classList.add('show');
      error.style.color = 'var(--green)';
    } catch (caught) {
      showError(caught.message);
    } finally {
      forgot.disabled = false;
    }
  });
  form?.addEventListener('submit', async (event) => {
    event.preventDefault(); error.classList.remove('show');
    const submit = form.querySelector('button[type="submit"]');
    const data = new FormData(form); const password = String(data.get('password') || '');
    if (password.length < 8) return showError('Use uma senha com pelo menos 8 caracteres.');
    if (submit) { submit.disabled = true; submit.dataset.originalText = submit.textContent; submit.textContent = recoverySession ? 'Salvando...' : 'Entrando...'; }
    try {
      if (recoverySession) {
        await authRequest('/auth/v1/user', { method: 'PUT', headers: { Authorization: `Bearer ${recoverySession.access_token}` }, body: JSON.stringify({ password }) });
        recoverySession = null; form.reset(); form.elements.email.closest('label').style.display = ''; form.querySelector('button[type="submit"]').textContent = 'Entrar com segurança';
        document.querySelector('.auth-copy h1').textContent = 'Senha atualizada'; document.querySelector('.auth-copy>p:last-child').textContent = 'Agora entre com sua nova senha.'; return;
      }
      const email = String(data.get('email') || '').trim(); if (!email) return showError('Informe seu email.');
      saveSession(await authRequest('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) })); screen.remove(); window.dispatchEvent(new Event('clareza:authenticated'));
    } catch (caught) { showError(caught.message); }
    finally { if (submit && document.body.contains(submit)) { submit.disabled = false; submit.textContent = submit.dataset.originalText || 'Entrar'; } }
  });
  const logout = document.getElementById('logout') || (() => { const button = document.createElement('button'); button.id = 'logout'; button.className = 'nav-item'; button.textContent = '↪ Sair'; document.querySelector('.sidebar-bottom')?.prepend(button); return button; })();
  logout?.addEventListener('click', async () => { sessionStorage.removeItem(sessionKey); location.reload(); });
})();
