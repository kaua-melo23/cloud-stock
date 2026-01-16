export const API_URL = '/api';

export async function request(endpoint, method = 'GET', body = null) {
    const options = { method, headers: {} };
    if (body && !(body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
        options.body = body;
    }
    try {
        const res = await fetch(`${API_URL}${endpoint}`, options);
        if (res.status === 401) return null;
        return res;
    } catch (error) {
        console.error("API Error:", error);
        return null;
    }
}