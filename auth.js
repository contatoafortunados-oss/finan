(() => {
  const screen = document.getElementById('auth-screen');
  const form = document.getElementById('login-form');
  const error = document.getElementById('login-error');
  const toggle = document.getElementById('toggle-password');
  const sessionKey = 'clareza_private_session';
  if (sessionStorage.getItem(sessionKey) === 'active' || localStorage.getItem(sessionKey) === 'active') screen.remove();
  toggle?.addEventListener('click', () => {
    const input = form.elements.password;
    input.type = input.type === 'password' ? 'text' : 'password';
    toggle.textContent = input.type === 'password' ? 'Mostrar' : 'Ocultar';
  });
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (!data.get('email') || String(data.get('password')).length < 6) {
      error.textContent = 'Informe um email válido e uma senha com pelo menos 6 caracteres.';
      error.classList.add('show');
      return;
    }
    error.classList.remove('show');
    (data.get('remember') ? localStorage : sessionStorage).setItem(sessionKey, 'active');
    screen.remove();
  });
})();
