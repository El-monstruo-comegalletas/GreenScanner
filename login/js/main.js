/**
 * EcoRecycle - Aplicación Principal
 * Maneja toda la lógica de la aplicación de autenticación
 */

// Resolver NotificationManager global dentro de módulo
const notificationManager = window.notificationManager;

class EcoRecycleApp {
    constructor() {
        this.validator = new FormValidator();
        this.currentUser = null;
        this.appState = {
            currentView: 'login',
            isLoading: false,
            formData: {
                login: { email: '', password: '' },
                register: { name: '', email: '', password: '', confirmPassword: '' }
            }
        };
        
        this.init();
    }

    /**
     * Inicializa la aplicación
     */
    init() {
        this.setupViewManager();
        this.setupEventListeners();
        this.setupPasswordToggles();
        this.setupInputManagement();
        this.loadInitialState();
        
        // Mensaje de bienvenida
        this.showWelcomeMessage();
    }

    /**
     * Configura el manejador de vistas
     */
    setupViewManager() {
        const views = ['loginView', 'registerView', 'successView'];
        views.forEach(viewId => {
            const element = document.getElementById(viewId);
            if (element) {
                viewManager.registerView(viewId, element);
            }
        });
        
        // Establecer vista inicial
        viewManager.showView('loginView', { addToHistory: false });
    }

    /**
     * Configura todos los event listeners
     */
    setupEventListeners() {
        this.setupFormSubmissions();
        this.setupViewSwitching();
        this.setupRealTimeValidation();
        this.setupKeyboardNavigation();
    }

    /**
     * Configura los envíos de formularios
     */
    setupFormSubmissions() {
        // Evitamos listeners duplicados: usamos los handlers al final del archivo
        return;
        // Formulario de login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Formulario de registro
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // Botón de comenzar a reciclar
        const startButton = document.getElementById('startRecycling');
        if (startButton) {
            startButton.addEventListener('click', () => {
                this.handleStartRecycling();
            });
        }
    }

    /**
     * Configura el cambio entre vistas
     */
    setupViewSwitching() {
        // Cambiar a registro
        const switchToRegister = document.getElementById('switchToRegister');
        if (switchToRegister) {
            switchToRegister.addEventListener('click', () => {
                this.switchToView('register');
            });
        }

        // Cambiar a login
        const switchToLogin = document.getElementById('switchToLogin');
        if (switchToLogin) {
            switchToLogin.addEventListener('click', () => {
                this.switchToView('login');
            });
        }
    }

    /**
     * Configura validación en tiempo real
     */
    setupRealTimeValidation() {
        const inputs = [
            { id: 'correo', validation: ['email'] },
            { id: 'contraseña', validation: ['password'] },
            { id: 'nombre', validation: ['name'] },
            { id: 'correo', validation: ['email'] },
            { id: 'contraseña', validation: ['password'] },
            { id: 'confirmar contraseña', validation: ['confirmPassword'] }
        ];

        inputs.forEach(({ id, validation }) => {
            const element = document.getElementById(id);
            if (element) {
                inputManager.registerInput(id, {
                    realTimeValidation: true,
                    validation: validation
                });
            }
        });
    }

    /**
     * Configura navegación por teclado
     */
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Enter para enviar formularios
            if (e.key === 'Enter') {
                const activeElement = document.activeElement;
                const form = activeElement.closest('form');
                if (form) {
                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.click();
                    }
                }
            }

            // Escape para limpiar errores
            if (e.key === 'Escape') {
                this.validator.clearAllErrors();
            }
        });
    }

    /**
     * Configura los toggles de contraseña
     */
    setupPasswordToggles() {
        new PasswordToggle('loginPassword', 'loginPasswordToggle');
        new PasswordToggle('registerPassword', 'registerPasswordToggle');
        new PasswordToggle('registerConfirmPassword', 'registerConfirmPasswordToggle');
    }

    /**
     * Configura manejo de inputs
     */
    setupInputManagement() {
        // Limpiar errores al escribir
        const allInputs = document.querySelectorAll('input');
        allInputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validator.clearFieldError(input.id);
            });
        });
    }

    /**
     * Carga el estado inicial
     */
    loadInitialState() {
        // Verificar compatibilidad del navegador
        const compatibility = ValidationUtils.checkBrowserCompatibility();
        if (!compatibility.isCompatible) {
            this.showBrowserWarning();
        }

        // Aplicar tema si está guardado
        this.applyStoredTheme();
    }

    /**
     * Muestra mensaje de bienvenida
     */
    showWelcomeMessage() {
        setTimeout(() => {
            if (ecoCharacter) {
                ecoCharacter.updateExpression('happy', '¡Hola! 🌱 Bienvenido a GreenScanner');
            }
        }, 500);
    }

    /**
     * Maneja el login
     */
    async handleLogin() {
        if (this.appState.isLoading) return;

        const formData = this.getLoginFormData();
        const errors = this.validator.validateLogin(formData);

        if (!ValidationUtils.isEmpty(errors)) {
            this.validator.showFormErrors(errors);
            if (ecoCharacter) {
                ecoCharacter.showError();
            }
            return;
        }

        this.setLoadingState(true, 'loginForm');
        
        try {
            // Simular llamada a API
            await this.simulateApiCall();
            
            this.currentUser = {
                email: formData.email,
                loginTime: new Date().toISOString()
            };

            this.handleAuthSuccess('login');
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            this.setLoadingState(false, 'loginForm');
        }
    }

    /**
     * Maneja el registro
     */
    async handleRegister() {
        if (this.appState.isLoading) return;

        const formData = this.getRegisterFormData();
        const errors = this.validator.validateRegister(formData);

        // Verificar términos y condiciones
        const termsCheckbox = document.getElementById('termsCheckbox');
        if (!termsCheckbox?.checked) {
            errors.terms = 'Debes aceptar los términos y condiciones';
            if (window.notificationManager) window.notificationManager.show('Debes aceptar los términos y condiciones', 'warning');
        }

        if (!ValidationUtils.isEmpty(errors)) {
            this.validator.showFormErrors(errors);
            if (ecoCharacter) {
                ecoCharacter.showError();
            }
            return;
        }

        this.setLoadingState(true, 'registerForm');

        try {
            // Verificar si el email está disponible
            const emailAvailable = await this.validator.isEmailAvailable(formData.email);
            if (!emailAvailable) {
                this.validator.showFieldError('registerEmail', 'Este correo ya está registrado');
                return;
            }

            // Simular registro
            await this.simulateApiCall();
            
            this.currentUser = {
                name: formData.name,
                email: formData.email,
                registrationTime: new Date().toISOString()
            };

            this.handleAuthSuccess('register');
        } catch (error) {
            this.handleAuthError(error);
        } finally {
            this.setLoadingState(false, 'registerForm');
        }
    }

    /**
     * Maneja éxito en autenticación
     */
    handleAuthSuccess(type) {
        // Limpiar formularios
        inputManager.clearAll();
        this.validator.clearAllErrors();

        // Actualizar UI de éxito
        this.updateSuccessView(type);

        // Celebrar con la mascota
        if (ecoCharacter) {
            ecoCharacter.celebrate();
        }

        // Mostrar vista de éxito
        setTimeout(() => {
            viewManager.showView('successView');
            this.appState.currentView = 'success';
        }, 500);

        // Notificación de éxito
        const message = type === 'login' 
            ? '¡Bienvenido de vuelta! 🎉' 
            : '¡Cuenta creada exitosamente! 🌟';
        if (window.notificationManager) window.notificationManager.show(message, 'success', 10000);
    }

    /**
     * Maneja errores en autenticación
     */
    handleAuthError(error) {
        console.error('Error de autenticación:', error);
        
        const message = error.message || 'Ha ocurrido un error. Intenta nuevamente.';
        if (window.notificationManager) window.notificationManager.show(message, 'error', 10000);
        
        if (ecoCharacter) {
            ecoCharacter.showError();
        }
    }

    /**
     * Actualiza la vista de éxito
     */
    updateSuccessView(type) {
        const title = document.getElementById('successTitle');
        const message = document.getElementById('successMessage');

        if (type === 'register') {
            if (title) title.textContent = '¡Cuenta creada!';
            if (message) message.textContent = 'Tu cuenta ha sido creada exitosamente. ¡Ya puedes empezar a reciclar!';
        } else {
            if (title) title.textContent = '¡Bienvenido!';
            if (message) message.textContent = 'Has iniciado sesión correctamente. ¡Vamos a reciclar!';
        }
    }

    /**
     * Cambia entre vistas
     */
    switchToView(viewType) {
        this.validator.clearAllErrors();
        
        const targetView = viewType === 'register' ? 'registerView' : 'loginView';
        viewManager.showView(targetView);
        this.appState.currentView = viewType;

        // Actualizar mascota
        if (ecoCharacter) {
            const message = viewType === 'register' 
                ? '¡Únete a nuestra comunidad! 🌍 Cada acción cuenta'
                : '¡Hola de nuevo! 🌱 ¿Listo para continuar?';
            
            const expression = viewType === 'register' ? 'welcome' : 'happy';
            ecoCharacter.updateExpression(expression, message);
        }
    }

    /**
     * Obtiene datos del formulario de login
     */
    getLoginFormData() {
        return {
            email: inputManager.getValue('loginEmail'),
            password: inputManager.getValue('loginPassword')
        };
    }

    /**
     * Obtiene datos del formulario de registro
     */
    getRegisterFormData() {
        return {
            name: inputManager.getValue('registerName'),
            email: inputManager.getValue('registerEmail'),
            password: inputManager.getValue('registerPassword'),
            confirmPassword: inputManager.getValue('registerConfirmPassword')
        };
    }

    /**
     * Establece estado de carga
     */
    setLoadingState(isLoading, formId = null) {
        this.appState.isLoading = isLoading;

        if (formId) {
            const submitBtn = document.querySelector(`#${formId} button[type="submit"]`);
            if (submitBtn) {
                if (isLoading) {
                    loadingManager.showButtonLoading(submitBtn.id || 'submitBtn', 'Procesando...');
                } else {
                    loadingManager.hideButtonLoading(submitBtn.id || 'submitBtn');
                }
            }
        }
    }

    /**
     * Simula llamada a API
     */
    simulateApiCall() {
        return new Promise((resolve, reject) => {
            // Simular tiempo de respuesta real
            const delay = Math.random() * 1000 + 1000; // 1-2 segundos
            
            setTimeout(() => {
                // Simular ocasionales errores de red
                if (Math.random() < 0.1) { // 10% de probabilidad de error
                    reject(new Error('Error de conexión. Intenta nuevamente.'));
                } else {
                    resolve({ success: true });
                }
            }, delay);
        });
    }

    /**
     * Maneja el inicio de reciclaje
     */
    handleStartRecycling() {
        // En una aplicación real, esto navegaría a la app principal
        if (window.notificationManager) window.notificationManager.show('¡Redirigiendo a la aplicación principal! 🚀', 'success', 10000);
        
        // Simular carga
        loadingManager.showGlobalLoading();
        
        setTimeout(() => {
            loadingManager.hideGlobalLoading();
            // Aquí iría la navegación real
            window.location.reload(); // Por ahora, recargar para demostración
        }, 2000);
    }

    /**
     * Muestra advertencia de compatibilidad de navegador
     */
    showBrowserWarning() {
        if (window.notificationManager) window.notificationManager.show(
            'Tu navegador podría no ser completamente compatible. Para mejor experiencia, usa una versión reciente.',
            'warning',
            10000
        );
    }

    /**
     * Aplica tema guardado
     */
    applyStoredTheme() {
        // En una implementación real, esto cargaría preferencias del usuario
        const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        if (isDarkMode) {
            document.documentElement.classList.add('dark-mode');
        }
    }

    /**
     * Limpia la aplicación
     */
    cleanup() {
        // Limpiar event listeners
        if (window.notificationManager) window.notificationManager.clearAll();
        inputManager.clearAll();
        this.validator.clearAllErrors();
    }

    /**
     * Reinicia la aplicación
     */
    reset() {
        this.cleanup();
        this.appState = {
            currentView: 'login',
            isLoading: false,
            formData: {
                login: { email: '', password: '' },
                register: { name: '', email: '', password: '', confirmPassword: '' }
            }
        };
        this.currentUser = null;
        viewManager.showView('loginView', { addToHistory: false });
        
        if (ecoCharacter) {
            ecoCharacter.reset();
        }
    }
}

// Utilidades adicionales para la aplicación
const AppUtils = {
    /**
     * Formatea fecha para mostrar
     */
    formatDate(date) {
        return new Intl.DateTimeFormat('es', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    },

    /**
     * Genera estadísticas de usuario falsos para demo
     */
    generateUserStats() {
        return {
            pointsEarned: Math.floor(Math.random() * 500) + 50,
            itemsRecycled: Math.floor(Math.random() * 100) + 10,
            co2Saved: (Math.random() * 50 + 5).toFixed(1),
            level: Math.floor(Math.random() * 10) + 1
        };
    },

    /**
     * Detecta tipo de dispositivo
     */
    getDeviceType() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
        const isTablet = /ipad|android(?=.*mobile)/i.test(userAgent);
        
        if (isMobile && !isTablet) return 'mobile';
        if (isTablet) return 'tablet';
        return 'desktop';
    }
};

// Inicialización de la aplicación
let ecoRecycleApp;

document.addEventListener('DOMContentLoaded', () => {
    try {
        ecoRecycleApp = new EcoRecycleApp();
        
        // Hacer disponible globalmente para debugging
        window.ecoRecycleApp = ecoRecycleApp;
        
        console.log('🌱 GreenScanner App iniciada correctamente');
    } catch (error) {
        console.error('Error al inicializar GreenScanner:', error);
        
        // Mostrar error de fallback si falla la inicialización
        document.body.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-red-50">
                <div class="text-center p-8">
                    <div class="text-red-600 text-6xl mb-4">⚠️</div>
                    <h1 class="text-2xl font-bold text-red-800 mb-4">Error de Inicialización</h1>
                    <p class="text-red-600 mb-6">No se pudo cargar la aplicación correctamente.</p>
                    <button onclick="location.reload()" class="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors">
                        Reintentar
                    </button>
                </div>
            </div>
        `;
    }
});

// Manejo de errores globales
window.addEventListener('error', (event) => {
    console.error('Error global capturado:', event.error);
    
    if (window.notificationManager) {
        window.notificationManager.show('Ha ocurrido un error inesperado', 'error', 10000);
    }
});

// Manejo de promesas rechazadas
window.addEventListener('unhandledrejection', (event) => {
    console.error('Promesa rechazada sin manejo:', event.reason);
    event.preventDefault();
    
    if (notificationManager) {
        if (window.notificationManager) window.notificationManager.show('Error de conexión', 'error', 10000);
    }
});

// Exportar para uso en módulos si es necesario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EcoRecycleApp, AppUtils };
}



// Archivo: main.js

import Api from "./api.js";

// -------------------------
// REGISTRO DE USUARIO
// -------------------------
// Deshabilitado para evitar duplicados (usaremos el handler de más abajo)
document.getElementById("__DISABLED_registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

    const nombre = document.getElementById("registerName").value;
    const correo = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    const confirm  = document.getElementById("registerConfirmPassword").value;

      if (password !== confirm) {
    if (window.notificationManager) window.notificationManager.show("Las contraseñas no coinciden", 'error', 10000);
    return;
  }

 try {
    const res = await Api.register(nombre, correo, password);
    if (res.error) return (window.notificationManager && window.notificationManager.show("❌ " + res.error, 'error', 10000));
    if (window.notificationManager) window.notificationManager.show(res.mensaje || "Registrado con éxito", 'success', 10000);
    document.getElementById("switchToLogin")?.click(); // vuelve a la vista login
  } catch (err) {
    if (window.notificationManager) window.notificationManager.show("Error al registrar: " + err.message, 'error', 10000);
  }
});

// -------------------------
// LOGIN
// -------------------------
// Deshabilitado para evitar duplicados (usaremos el handler de más abajo)
document.getElementById("__DISABLED_loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const correo = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    const res = await Api.login(correo, password);
    if (res.error) {
      if (window.notificationManager) window.notificationManager.show(res.error, 'error', 10000);
    } else {
      if (window.notificationManager) window.notificationManager.show(res.mensaje || 'Operación realizada', 'success', 10000);
    }

    // Guardar usuario en localStorage para usar luego y redirigir a la app principal
    if (res.mensaje === "Login exitoso") {
      localStorage.setItem("userEmail", correo);
      if (window.notificationManager) window.notificationManager.show(res.mensaje || 'Login exitoso', 'success', 10000);
      setTimeout(() => { goToApp(); }, 800);
    }
  } catch (err) {
    if (window.notificationManager) window.notificationManager.show("Error en login: " + err.message, 'error', 10000);
  }
});

// -------------------------
// VER HISTORIAL
// -------------------------
document.getElementById("btnHistorial")?.addEventListener("click", async () => {
  const correo = localStorage.getItem("userEmail");
  if (!correo) {
    if (window.notificationManager) window.notificationManager.show("Debes iniciar sesión primero.", 'warning');
    return;
  }

  try {
    const historial = await Api.historial(correo);

    const container = document.getElementById("historialContainer");
    container.innerHTML = "";

    if (historial.length === 0) {
      container.innerHTML = "<p>No hay historial disponible</p>";
    } else {
      historial.forEach((item) => {
        const div = document.createElement("div");
        div.className = "historial-item";
        div.innerHTML = `
          <p><strong>Acción:</strong> ${item.accion}</p>
          <p><strong>Detalle:</strong> ${item.detalle}</p>
          <p><strong>Fecha:</strong> ${item.fecha}</p>
        `;
        container.appendChild(div);
      });
    }
  } catch (err) {
    if (window.notificationManager) window.notificationManager.show("Error al cargar historial: " + err.message, 'error', 10000);
  }
});

// helper para redirigir de forma segura desde /login/html/ → /index.html
const goToApp = () => {
  // desde Front-end/login/html/index.html, subir dos niveles:
  window.location.href = "../../index.html";
};

// ---------- REGISTRO ----------
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre   = document.getElementById("registerName")?.value.trim() ?? "";
  const correo   = document.getElementById("registerEmail")?.value.trim() ?? "";
  const password = document.getElementById("registerPassword")?.value ?? "";
  const confirm  = document.getElementById("registerConfirmPassword")?.value ?? "";

  if (!nombre || !correo || !password) return (window.notificationManager && window.notificationManager.show("Completa todos los campos", 'warning'));
  if (password !== confirm)             return (window.notificationManager && window.notificationManager.show("Las contraseñas no coinciden", 'error', 10000));

  try {
    const res = await Api.register(nombre, correo, password);
    if (res?.error) return (window.notificationManager && window.notificationManager.show("❌ " + res.error, 'error', 10000));

    // “auto-login” simple para tu app: guarda el correo y redirige
    localStorage.setItem("userEmail", correo);
    if (window.notificationManager) window.notificationManager.show(res.mensaje || "Registrado con éxito", 'success', 10000);
    setTimeout(() => goToApp(), 800);
  } catch (err) {
    console.error(err);
    if (window.notificationManager) window.notificationManager.show("No se pudo conectar con el servidor", 'error', 10000);
  }
});

// ---------- LOGIN ----------
document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const correo   = document.getElementById("loginEmail")?.value.trim() ?? "";
  const password = document.getElementById("loginPassword")?.value ?? "";

  if (!correo || !password) return (window.notificationManager && window.notificationManager.show("Completa correo y contraseña", 'warning'));

  try {
    const res = await Api.login(correo, password);
    if (res?.error) return (window.notificationManager && window.notificationManager.show("❌ " + res.error, 'error', 10000));

    localStorage.setItem("userEmail", correo);
    if (window.notificationManager) window.notificationManager.show(res.mensaje || "Login exitoso", 'success', 10000);
    setTimeout(() => goToApp(), 800);
  } catch (err) {
    console.error(err);
    if (window.notificationManager) window.notificationManager.show("No se pudo conectar con el servidor", 'error', 10000);
  }
});
