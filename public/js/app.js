/* ======== AUTH UI LOGIC ======== */

document.addEventListener('DOMContentLoaded', () => {
    // Check session on load
    checkSession();

    const loginForm = document.getElementById('login-form');
    const changePasswordForm = document.getElementById('change-password-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }
    
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', handleChangePasswordSubmit);
        
        // Listeners for password strength
        const newPassInput = document.getElementById('new-password');
        const confPassInput = document.getElementById('confirm-password');
        
        if (newPassInput) newPassInput.addEventListener('input', validatePasswordStrength);
        if (confPassInput) confPassInput.addEventListener('input', validatePasswordMatch);
    }

    // Initialize Toast Container if not exists
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
});

async function handleLoginSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-submit-btn');

    setLoading(btn, true, 'Entrar');

    try {
        // Obter CSRF Token se necessário (primeira requisição POST exige)
        let csrfToken = window.csrfToken;
        if (!csrfToken) {
            try {
                const csrfRes = await fetch('/api/csrf-token');
                const csrfData = await csrfRes.json();
                csrfToken = csrfData.csrfToken;
                window.csrfToken = csrfToken;
            } catch(e) {}
        }

        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken || ''
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();

        if (response.ok) {
            showToast('Login bem-sucedido. Redirecionando...', 'success');
            setTimeout(() => { window.location.href = data.redirectTo || '/dashboard'; }, 800);
        } else {
            console.log(response.status, data);
            if (response.status === 403 && data.code === 'MUST_CHANGE_PASSWORD') {
                showToast('É necessário trocar a senha temporária', 'warning');
                document.getElementById('reset-user-id').value = data.userId;
                document.getElementById('current-password').value = password;
                switchToChangePassword();
            } else {
                showToast(data.error || 'Credenciais inválidas', 'error');
            }
        }
    } catch (err) {
        showToast('Erro de comunicação com o servidor', 'error');
    } finally {
        setLoading(btn, false, 'Entrar');
    }
}

async function handleChangePasswordSubmit(e) {
    e.preventDefault();

    const btn = document.getElementById('change-submit-btn');
    const userId = document.getElementById('reset-user-id').value;
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    
    // Final check
    if (!areAllRequirementsMet() || newPassword !== document.getElementById('confirm-password').value) {
        showToast('A senha não atende aos requisitos de segurança', 'error');
        return;
    }

    setLoading(btn, true, 'Alterar senha e entrar');

    try {
        let csrfToken = window.csrfToken;
        if (!csrfToken) {
            try {
                const csrfRes = await fetch('/api/csrf-token');
                const csrfData = await csrfRes.json();
                csrfToken = csrfData.csrfToken;
                window.csrfToken = csrfToken;
            } catch(e) {}
        }

        const response = await fetch('/api/auth/force-password-change', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken || ''
            },
            body: JSON.stringify({ userId, currentPassword, newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showToast('Senha alterada com sucesso!', 'success');
            setTimeout(() => { window.location.href = data.redirectTo || '/dashboard'; }, 800);
        } else {
            showToast(data.error || 'Falha ao trocar a senha', 'error');
        }
    } catch (err) {
        showToast('Erro de conexão com o servidor', 'error');
    } finally {
        setLoading(btn, false, 'Alterar senha e entrar');
    }
}

async function checkSession() {
    try {
        const response = await fetch('/api/me', { cache: 'no-store' });
        const isDashboard = window.location.pathname.startsWith('/dashboard');
        
        if (response.ok) {
            // Se estou logado mas não estou no dashboard, redireciono
            if (!isDashboard) {
                window.location.href = '/dashboard';
            }
        } else if (response.status === 401) {
            // Se NÃO estou logado mas estou no dashboard, volto para o login
            if (isDashboard) {
                window.location.href = '/';
            }
        }
    } catch(e) {
        console.error('Sessão indisponível');
    }
}

/* ======== UTILITIES & UI LOGIC ======== */

function switchToChangePassword() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('change-password-form').classList.remove('hidden');
}

function switchToLogin(e) {
    if(e) e.preventDefault();
    document.getElementById('change-password-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
}

window.togglePassword = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    // Busca o botão e o SVG dentro do wrapper comum
    const wrapper = input.closest('.password-wrapper');
    const svg = wrapper ? wrapper.querySelector('.eye-svg') : null;
    
    if (input.type === 'password') {
        input.type = 'text';
        if(svg) svg.setAttribute('stroke', '#4A90D9');
    } else {
        input.type = 'password';
        if(svg) svg.setAttribute('stroke', 'currentColor');
    }
}

/* ======== PASSWORD VALIDATION LOGIC ======== */

const patterns = {
    length: /.{8,}/,
    upper: /[A-Z]/,
    num: /[0-9]/,
    spec: /[@#$%&*!\-_+=?]/
};

function validatePasswordStrength(e) {
    const pass = e.target.value;
    
    checkRequirement('req-length', patterns.length.test(pass));
    checkRequirement('req-upper', patterns.upper.test(pass));
    checkRequirement('req-num',   patterns.num.test(pass));
    checkRequirement('req-spec',  patterns.spec.test(pass));

    const passedCount = Object.values(patterns).filter(regex => regex.test(pass)).length;
    
    // Update Strength Bar
    const barFill = document.getElementById('strength-bar-fill');
    barFill.className = 'strength-bar-fill'; // reset
    barFill.style.width = (passedCount * 25) + '%';
    
    if (passedCount <= 1) barFill.classList.add('bar-red');
    else if (passedCount === 2 || passedCount === 3) barFill.classList.add('bar-yellow');
    else if (passedCount === 4) barFill.classList.add('bar-green');

    validatePasswordMatch();
}

function checkRequirement(elemId, isMet) {
    const el = document.getElementById(elemId);
    if (!el) return;
    
    if (isMet) {
        el.classList.remove('requirement-pending');
        el.classList.add('requirement-met');
        el.querySelector('.icon').textContent = '✓';
    } else {
        el.classList.remove('requirement-met');
        el.classList.add('requirement-pending');
        el.querySelector('.icon').textContent = '○';
    }
}

function areAllRequirementsMet() {
    const pass = document.getElementById('new-password').value;
    return patterns.length.test(pass) && 
           patterns.upper.test(pass) && 
           patterns.num.test(pass) && 
           patterns.spec.test(pass);
}

function validatePasswordMatch() {
    const newPass = document.getElementById('new-password').value;
    const confPass = document.getElementById('confirm-password').value;
    const msg = document.getElementById('confirm-message');
    const btn = document.getElementById('change-submit-btn');
    
    const allMet = areAllRequirementsMet();

    if (confPass.length > 0) {
        if (newPass !== confPass) {
            msg.textContent = 'As senhas não coincidem';
            msg.style.color = 'var(--error)';
            btn.disabled = true;
        } else {
            msg.textContent = 'Senhas coincidem';
            msg.style.color = 'var(--success)';
            btn.disabled = !allMet;
        }
    } else {
        msg.textContent = '';
        btn.disabled = true;
    }
}

/* ======== TOAST & LOADING SYSTEM ======== */

function showToast(message, type = 'error') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button style="background:none;border:none;color:white;cursor:pointer;margin-left:10px" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4000);
}

function setLoading(btn, isLoading, originalText) {
    if (!btn) return;
    
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}
