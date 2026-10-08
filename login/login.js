/* BEE PRODUCTION Login — Firestore connected controller */
document.addEventListener('DOMContentLoaded', async () => {
  await window.BEE_SERVER_READY;

const loginScreen = document.getElementById('loginScreen');

if (loginScreen) {
  loginScreen.addEventListener('mousemove', event => {
    const rect = loginScreen.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    loginScreen.style.setProperty('--mouse-x', `${x}%`);
    loginScreen.style.setProperty('--mouse-y', `${y}%`);
  });

  loginScreen.addEventListener('mouseleave', () => {
    loginScreen.style.setProperty('--mouse-x', '50%');
    loginScreen.style.setProperty('--mouse-y', '50%');
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
  // LOGIN USING FIRESTORE
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

      const response = await window.beeFetch(
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


      // Convert Firestore user to your existing project format
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
        'Firestore login error:',
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
  // CREATE ACCOUNT USING FIRESTORE
  // --------------------------------------------------

  async function mysqlCreateAccount() {

    const nameInput =
      document.getElementById('signupName');

    const emailInput =
      document.getElementById('loginEmail');

    const passwordInput =
      document.getElementById('loginPassword');

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

      const response = await window.beeFetch(
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


      // Refresh Quick Sign-In from Firestore,
      // then switch back to Sign In.


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
          ? 'Create an account that will be saved in the Firestore database.'
          : 'Sign in using your registered account to continue.';
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

  // --------------------------------------------------
// SHOW / HIDE PASSWORD
// --------------------------------------------------

const pwToggle =
  document.getElementById('pwToggleBtn');

const pwInput =
  document.getElementById('loginPassword');

if (pwToggle && pwInput) {

  pwToggle.addEventListener('click', () => {

    const isHidden =
      pwInput.type === 'password';

    pwInput.type =
      isHidden ? 'text' : 'password';

    if (isHidden) {

      pwToggle.innerHTML = `
        <svg
          class="pw-icon"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 12C4.5 7.5 8 5 12 5C16 5 19.5 7.5 22 12C19.5 16.5 16 19 12 19C8 19 4.5 16.5 2 12Z"
            stroke="currentColor"
            stroke-width="2"
          />

          <circle
            cx="12"
            cy="12"
            r="3"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
      `;

      pwToggle.title = 'Hide password';

    } else {

      pwToggle.innerHTML = `
        <svg
          class="pw-icon"
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 3L21 21"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />

          <path
            d="M10.6 5.2C11.1 5.1 11.5 5 12 5C16 5 19.5 7.5 22 12C21.2 13.4 20.3 14.6 19.2 15.6"
            stroke="currentColor"
            stroke-width="2"
          />

          <path
            d="M6.6 6.6C4.7 7.8 3.2 9.6 2 12C4.5 16.5 8 19 12 19C13.6 19 15.1 18.6 16.4 17.8"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
      `;

      pwToggle.title = 'Show password';
    }

  });

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



});