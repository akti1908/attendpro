// Экран входа и регистрации.
export function renderAuth(root, ctx) {
  root.innerHTML = `
    <section class="auth-wrap">
      <article class="card auth-card">
        <h2 class="section-title">Вход в AttendPro</h2>
        <p class="muted">Войдите в аккаунт, чтобы загрузить данные из облака.</p>

        <div class="auth-tabs">
          <button id="auth-tab-login" class="btn small-btn btn-active" type="button">Вход</button>
          <button id="auth-tab-register" class="btn small-btn" type="button">Регистрация</button>
        </div>

        <form id="auth-login-form" class="auth-form">
          <div class="form-row">
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Пароль" required />
          </div>
          <button class="btn btn-primary" type="submit">Войти</button>
        </form>

        <form id="auth-register-form" class="auth-form is-hidden">
          <div class="form-row">
            <input name="name" type="text" placeholder="Ваше имя" required />
            <input name="email" type="email" placeholder="Email" required />
            <input name="password" type="password" placeholder="Пароль (минимум 4 символа)" required />
            <input name="confirmPassword" type="password" placeholder="Повторите пароль" required />
          </div>
          <button class="btn btn-primary" type="submit">Создать аккаунт</button>
        </form>

        <p id="auth-message" class="auth-message muted"></p>
      </article>
    </section>
  `;

  const loginTab = root.querySelector("#auth-tab-login");
  const registerTab = root.querySelector("#auth-tab-register");
  const loginForm = root.querySelector("#auth-login-form");
  const registerForm = root.querySelector("#auth-register-form");
  const message = root.querySelector("#auth-message");

  const setMode = (mode) => {
    const isLogin = mode === "login";
    loginForm.classList.toggle("is-hidden", !isLogin);
    registerForm.classList.toggle("is-hidden", isLogin);
    loginTab.classList.toggle("btn-active", isLogin);
    registerTab.classList.toggle("btn-active", !isLogin);
    message.textContent = "";
    message.classList.remove("auth-error", "auth-success");
  };

  loginTab.addEventListener("click", () => setMode("login"));
  registerTab.addEventListener("click", () => setMode("register"));

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await ctx.actions.loginUser({
      email: formData.get("email"),
      password: formData.get("password")
    });

    if (result?.ok) return;
    message.textContent = result?.message || "Ошибка входа.";
    message.classList.add("auth-error");
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await ctx.actions.registerUser({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword")
    });

    if (result?.ok) return;
    message.textContent = result?.message || "Ошибка регистрации.";
    message.classList.add("auth-error");
  });
}
