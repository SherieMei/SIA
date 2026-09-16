/* BEE PRODUCTION Login — MySQL connected controller */
document.addEventListener('DOMContentLoaded', () => {

  const grid = document.getElementById('demoUsers');

  // --------------------------------------------------
  // LOAD REGISTERED USERS FROM MYSQL
  // --------------------------------------------------
  async function loadUsers() {
    if (!grid) return;

    try {
      const response = await fetch('../api/auth.php?action=users', {
        method: 'GET',
        credentials: 'include'
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to load users.');
      }

      const demoEmails = [
        'jordan.reyes@beeproduction.studio',
        'mika.santos@beeproduction.studio',
        'leo.cruz@beeproduction.studio',
        'ava.domingo@beeproduction.studio',
        'noah.bautista@beeproduction.studio',
        'priya.fernandez@beeproduction.studio',
        'client@skylinemedia.com'
      ];

      const users = (data.users || []).filter(user =>
        !demoEmails.includes(
          String(user.email || '').toLowerCase()
        )
      );

      // Remove all old demo users
      grid.innerHTML = '';

      if (users.length === 0) {
        grid.innerHTML = `
          <div class="demo-empty">
            No registered accounts yet.
          </div>
        `;
        return;
      }

      // Display real MySQL users
      grid.innerHTML = users.map(user => `
        <button
          type="button"
          class="demo-card"
          data-user-id="${esc(String(user.id))}"
          data-user-email="${esc(String(user.email || ''))}"
        >
          <b>${esc(user.full_name)}</b>
          <span>
            ${ROLE_LABELS[user.role] || user.role}
          </span>
        </button>
      `).join('');

    } catch (error) {

      console.error(
        'Unable to load MySQL users:',
        error
      );

      grid.innerHTML = `
        <div class="demo-empty">
          Unable to load registered accounts.
        </div>
      `;
    }
  }


  // Quick Sign-In: select a real MySQL account and require its password.
  if (grid) {
    grid.addEventListener('click', event => {
      const card = event.target.closest('[data-user-id]');
      if (!card) return;

      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');

      const email = card.dataset.userEmail || '';

      if (emailInput) {
        emailInput.value = email;
      }

      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }

      if (mode !== 'signin') {
        setMode('signin');
      }
    });
  }


  // --------------------------------------------------
  // SIGN IN VS CREATE ACCOUNT
  // --------------------------------------------------

  let mode = 'signin';

  const nameField =
    document.getElementById('signupNameField');

  const helpText =
    document.getElementById('loginHelpText');

  const modeToggle =
    document.getElementById('authModeToggle');

  const submitBtn =
    document.getElementById('loginButton');

  const submitLabel =
    submitBtn
      ? submitBtn.querySelector('span')
      : null;


  // --------------------------------------------------
  // LOGIN USING MYSQL
  // --------------------------------------------------

  async function mysqlLogin() {

    const emailInput =
      document.getElementById('loginEmail');

    const passwordInput =
      document.getElementById('loginPassword');

    const email =
      emailInput
        ? emailInput.value.trim()
        : '';

    const password =
      passwordInput
        ? passwordInput.value
        : '';

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {

      if (typeof toast === 'function') {
        toast(
          'Enter a valid email to sign in.',
          'error'
        );
      } else {
        alert('Enter a valid email to sign in.');
      }

      return;
    }

    if (!password) {

      if (typeof toast === 'function') {
        toast(
          'Enter your password to sign in.',
          'error'
        );
      } else {
        alert('Enter your password to sign in.');
      }

      return;
    }


    // Disable button while logging in
    if (submitBtn) {
      submitBtn.disabled = true;

      if (submitLabel) {
        submitLabel.textContent =
          'Signing in...';
      }
    }


    try {

      const response = await fetch(
        '../api/auth.php',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'login',
            email: email,
            password: password
          })
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          'Invalid email or password.'
        );
      }


      // Convert MySQL user to your existing project format
      const user = {
        id: String(data.user.id),
        name: data.user.full_name,
        email: data.user.email,
        role: data.user.role
      };


      // Update the existing DB state
      if (typeof DB !== 'undefined') {

        if (!DB.users) {
          DB.users = [];
        }

        const existing =
          DB.users.find(
            u => String(u.id) === String(user.id)
          );

        if (existing) {
          Object.assign(existing, user);
        } else {
          DB.users.push(user);
        }

        DB.currentUser = user;
      }


      // Use your existing login system
      if (
        typeof Studio !== 'undefined' &&
        typeof Studio.completeLogin === 'function'
      ) {
        Studio.completeLogin(user);
      } else {

        sessionStorage.setItem(
          'beeCurrentUser',
          JSON.stringify(user)
        );

        window.location.assign(
          '../dashboard/dashboard.html'
        );
      }


    } catch (error) {

      console.error(
        'MySQL login error:',
        error
      );

      if (typeof toast === 'function') {
        toast(
          error.message ||
          'Unable to sign in.',
          'error'
        );
      } else {
        alert(
          error.message ||
          'Unable to sign in.'
        );
      }

    } finally {

      if (submitBtn) {

        submitBtn.disabled = false;

        if (submitLabel) {
          submitLabel.textContent =
            mode === 'signup'
              ? 'Create account'
              : 'Enter studio';
        }

      }

    }
  }


  // --------------------------------------------------
  // CREATE ACCOUNT USING MYSQL
  // --------------------------------------------------

  async function mysqlCreateAccount() {

    const nameInput =
      document.getElementById('signupName');

    const emailInput =
      document.getElementById('loginEmail');

    const passwordInput =
      document.getElementById('loginPassword');

    const roleInput =
      document.getElementById('loginRole');

    const name =
      nameInput
        ? nameInput.value.trim()
        : '';

    const email =
      emailInput
        ? emailInput.value.trim()
        : '';

    const password =
      passwordInput
        ? passwordInput.value
        : '';

    const role =
      roleInput
        ? roleInput.value
        : 'viewer';


    if (!name) {
      showError(
        'Enter your full name to create an account.'
      );
      return;
    }

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      showError(
        'Enter a valid email.'
      );
      return;
    }

    if (password.length < 6) {
      showError(
        'Password must be at least 6 characters.'
      );
      return;
    }


    if (submitBtn) {
      submitBtn.disabled = true;

      if (submitLabel) {
        submitLabel.textContent =
          'Creating account...';
      }
    }


    try {

      const response = await fetch(
        '../api/auth.php',
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'register',
            name: name,
            email: email,
            password: password,
            role: role
          })
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          'Account creation failed.'
        );
      }


      const user = {
        id: String(data.user.id),
        name: data.user.full_name,
        email: data.user.email,
        role: data.user.role
      };


      // Add the new account to the existing DB state
      if (typeof DB !== 'undefined') {

        if (!DB.users) {
          DB.users = [];
        }

        const existing =
          DB.users.find(
            u => String(u.id) === String(user.id)
          );

        if (existing) {
          Object.assign(existing, user);
        } else {
          DB.users.push(user);
        }

      }


      // Refresh Quick Sign-In from MySQL,
      // then switch back to Sign In.
      await loadUsers();

      const loginEmail =
        document.getElementById('loginEmail');

      const loginPassword =
        document.getElementById('loginPassword');

      if (loginEmail) {
        loginEmail.value =
          user.email || email;
      }

      if (loginPassword) {
        loginPassword.value = '';
        loginPassword.focus();
      }

      setMode('signin');

      if (typeof toast === 'function') {
        toast(
          'Account created. Please enter your password to sign in.',
          'success'
        );
      }


    } catch (error) {

      console.error(
        'Account creation error:',
        error
      );

      showError(
        error.message ||
        'Unable to create account.'
      );

    } finally {

      if (submitBtn) {

        submitBtn.disabled = false;

        if (submitLabel) {
          submitLabel.textContent =
            mode === 'signup'
              ? 'Create account'
              : 'Enter studio';
        }

      }

    }
  }


  // --------------------------------------------------
  // ERROR MESSAGE
  // --------------------------------------------------

  function showError(message) {

    if (typeof toast === 'function') {
      toast(message, 'error');
    } else {
      alert(message);
    }

  }


  // --------------------------------------------------
  // MODE TOGGLE
  // --------------------------------------------------

  function setMode(next) {

    mode = next;

    const isSignup =
      mode === 'signup';


    if (nameField) {
      nameField.classList.toggle(
        'hidden',
        !isSignup
      );
    }


    if (submitLabel) {
      submitLabel.textContent =
        isSignup
          ? 'Create account'
          : 'Enter studio';
    }


    if (helpText) {

      helpText.textContent =
        isSignup
          ? 'Create an account that will be saved in the MySQL database.'
          : 'Sign in using an account stored in the MySQL database.';
    }


    if (modeToggle) {

      modeToggle.textContent =
        isSignup
          ? 'Already have an account? Sign in'
          : 'New here? Create an account';

    }


    const nameInput =
      document.getElementById('signupName');


    if (isSignup && nameInput) {

      nameInput.focus();

    } else if (!isSignup) {

      const emailInput =
        document.getElementById('loginEmail');

      if (emailInput) {
        emailInput.focus();
      }

    }

  }


  // --------------------------------------------------
  // BUTTON EVENTS
  // --------------------------------------------------

  if (modeToggle) {

    modeToggle.addEventListener(
      'click',
      () => {

        setMode(
          mode === 'signup'
            ? 'signin'
            : 'signup'
        );

      }
    );

  }


  if (submitBtn) {

    submitBtn.addEventListener(
      'click',
      () => {

        if (mode === 'signup') {
          mysqlCreateAccount();
        } else {
          mysqlLogin();
        }

      }
    );

  }


  // --------------------------------------------------
  // ENTER KEY
  // --------------------------------------------------

  const emailInput =
    document.getElementById('loginEmail');

  const passwordInput =
    document.getElementById('loginPassword');

  const signupNameInput =
    document.getElementById('signupName');


  [
    emailInput,
    passwordInput,
    signupNameInput
  ].forEach(input => {

    if (input) {

      input.addEventListener(
        'keydown',
        event => {

          if (event.key === 'Enter') {

            event.preventDefault();

            if (mode === 'signup') {
              mysqlCreateAccount();
            } else {
              mysqlLogin();
            }

          }

        }
      );

    }

  });


  if (emailInput) {
    emailInput.focus();
  }


  // --------------------------------------------------
  // SHOW / HIDE PASSWORD
  // --------------------------------------------------

  const pwToggle =
    document.getElementById('pwToggleBtn');

  const pwInput =
    document.getElementById('loginPassword');


  if (pwToggle && pwInput) {

    pwToggle.addEventListener(
      'click',
      () => {

        const showing =
          pwInput.type === 'text';

        pwInput.type =
          showing
            ? 'password'
            : 'text';

        pwToggle.textContent =
          showing
            ? '👁'
            : '🙈';

        const label =
          showing
            ? 'Show password'
            : 'Hide password';

        pwToggle.title = label;

        pwToggle.setAttribute(
          'aria-label',
          label
        );

      }
    );

  }


  // --------------------------------------------------
  // THEME
  // --------------------------------------------------

  const themeBtn =
    document.getElementById('loginThemeBtn');


  if (themeBtn) {

    themeBtn.addEventListener(
      'click',
      () => Studio.toggleTheme()
    );

  }


  if (
    typeof Studio !== 'undefined' &&
    Studio.applyTheme
  ) {
    Studio.applyTheme();
  }


  // --------------------------------------------------
  // START
  // --------------------------------------------------

  loadUsers();

});