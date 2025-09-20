// api.js
const isEmu = location.hostname === "10.0.2.2";
//const API_BASE = isEmu ? "http://10.0.2.2:8000" : "http://192.168.20.23:8000";
//const API_BASE = "http://127.0.0.1:8000";
const API_BASE = "https://gs.kwb.com.co/"

 


export default class Api {
    static async register(nombre, correo, password) {
        return this.request("/register", "POST", { nombre, correo, password });
    }

    static async login(correo, password) {
        return this.request("/login", "POST", { correo, password });
    }

    static async agregarPuntos(correo, puntos) {
        return this.request("/puntos/agregar", "POST", { correo, puntos });
    }

    static async canjearPremio(correo, premio) {
        return this.request("/puntos/canjear", "POST", { correo, premio });
    }

    static async listarPremios() {
        return this.request("/premios", "GET");
    }

    static async historial(correo) {
        return this.request(`/historial/${correo}`, "GET");
    }

    // -------------------------
    // MÉTODO BASE PARA REQUESTS
    // -------------------------
    static async request(endpoint, method, body = null) {
        try {
            const options = {
                method,
                headers: { "Content-Type": "application/json" },
            };
            if (body) options.body = JSON.stringify(body);

            const response = await fetch(`${API_BASE}${endpoint}`, options);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Error en la solicitud");
            }
            return data;
        } catch (error) {
            console.error("API Error:", error.message);
            throw error;
        }
    }
}

// Registro
export async function register(nombre, correo, password) {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, correo, password })
  });
  return res.json();
}

// Login
export async function login(correo, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, password })
  });
  return res.json();
}

// Historial
export async function getHistorial(correo) {
  const res = await fetch(`${API_BASE}/historial/${correo}`);
  return res.json();
}
// Agregar puntos
/*export async function agregarPuntos(correo, puntos) {
  const res = await fetch(`${API_BASE}/puntos/agregar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ correo, puntos })
  });
  return res.json();
}*/


