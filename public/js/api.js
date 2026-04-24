// public/js/api.js
const api = axios.create({
    baseURL: '',
    withCredentials: true
});

api.interceptors.request.use(async config => {
    if (['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
        if (!window.csrfToken && config.url !== '/api/auth/login') {
            try {
                const res = await axios.get('/api/csrf-token', { withCredentials: true });
                window.csrfToken = res.data.csrfToken;
            } catch(e) {}
        }
        if (window.csrfToken) {
            config.headers['X-CSRF-Token'] = window.csrfToken;
        }
    }
    return config;
});

api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            // Se não estivermos na Home, redireciona para login
            if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);
