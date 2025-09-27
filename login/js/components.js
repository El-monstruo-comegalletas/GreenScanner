/**
 * Componentes reutilizables para GreenScanner
 * Maneja elementos de UI como mascota, inputs, botones, etc.
 */

class EcoCharacter {
    constructor(container) {
        this.container = container;
        this.expressions = {
            happy: { emoji: '😊', color: '#f59e0b' },
            welcome: { emoji: '🌟', color: '#22c55e' },
            celebration: { emoji: '🎉', color: '#3b82f6' },
            thinking: { emoji: '🤔', color: '#8b5cf6' },
            excited: { emoji: '🤩', color: '#f97316' },
            success: { emoji: '✅', color: '#10b981' }
        };
        this.currentExpression = 'happy';
        this.currentMessage = '';
    }

    /**
     * Actualiza la expresión de la mascota
     * @param {string} expression - Expresión a mostrar
     * @param {string} message - Mensaje a mostrar
     * @param {number} duration - Duración en ms
     */
    updateExpression(expression, message, duration = 0) {
        const badge = this.container.querySelector('.character-badge');
        const messageContainer = this.container.querySelector('.character-message p');
        
        if (!this.expressions[expression]) {
            console.warn(`Expresión '${expression}' no encontrada`);
            return;
        }

        // Actualizar expresión con animación
        if (badge) {
            badge.style.transform = 'scale(0)';
            badge.style.backgroundColor = this.expressions[expression].color;
            
            setTimeout(() => {
                badge.querySelector('span').textContent = this.expressions[expression].emoji;
                badge.style.transform = 'scale(1)';
                badge.classList.add('badge-celebration');
            }, 150);

            // Limpiar animación
            setTimeout(() => {
                badge.classList.remove('badge-celebration');
            }, 1000);
        }

        // Actualizar mensaje con efecto typewriter
        if (messageContainer && message) {
            this.typeMessage(messageContainer, message);
        }

        this.currentExpression = expression;
        this.currentMessage = message;

        // Auto-revert si se especifica duración
        if (duration > 0) {
            setTimeout(() => {
                this.updateExpression('happy', '¡Hola! 🌱 ¿Listo para reciclar?');
            }, duration);
        }
    }

    /**
     * Efecto typewriter para mensajes
     * @param {Element} element - Elemento donde mostrar el texto
     * @param {string} text - Texto a escribir
     */
    typeMessage(element, text) {
        element.textContent = '';
        element.style.borderRight = '2px solid var(--primary-green)';
        
        let i = 0;
        const typeInterval = setInterval(() => {
            element.textContent += text.charAt(i);
            i++;
            
            if (i > text.length) {
                clearInterval(typeInterval);
                // Quitar cursor después de un tiempo
                setTimeout(() => {
                    element.style.borderRight = 'none';
                }, 500);
            }
        }, 50);
    }

    /**
     * Hace que la mascota "celebre"
     */
    celebrate() {
        const characterBody = this.container.querySelector('.character-body');
        const messages = [
            '¡Excelente! 🎉',
            '¡Eres increíble! ⭐',
            '¡Sigue así! 💪',
            '¡Genial trabajo! 🚀'
        ];
        
        const randomMessage = messages[Math.floor(Math.random() * messages.length)];
        
        if (characterBody) {
            characterBody.classList.add('animate-bounce-in');
            setTimeout(() => {
                characterBody.classList.remove('animate-bounce-in');
            }, 600);
        }
        
        this.updateExpression('celebration', randomMessage, 3000);
    }

    /**
     * Muestra error con la mascota
     */
    showError() {
        const characterBody = this.container.querySelector('.character-body');
        
        if (characterBody) {
            characterBody.classList.add('animate-shake');
            setTimeout(() => {
                characterBody.classList.remove('animate-shake');
            }, 500);
        }
        
        this.updateExpression('thinking', 'Oops, revisa los datos 🔍', 3000);
    }

    /**
     * Resetea la mascota a su estado inicial
     */
    reset() {
        this.updateExpression('happy', '¡Hola! 🌱 ¿Listo para reciclar?');
    }
}

class InputManager {
    constructor() {
        this.inputs = new Map();
        this.validators = new Map();
    }

    /**
     * Registra un input para manejo automático
     * @param {string} inputId - ID del input
     * @param {object} config - Configuración del input
     */
    registerInput(inputId, config = {}) {
        const inputElement = document.getElementById(inputId);
        if (!inputElement) {
            console.warn(`Input con ID '${inputId}' no encontrado`);
            return;
        }

        const inputConfig = {
            element: inputElement,
            type: config.type || 'text',
            validation: config.validation || {},
            realTimeValidation: config.realTimeValidation || false,
            placeholder: config.placeholder || inputElement.placeholder,
            ...config
        };

        this.inputs.set(inputId, inputConfig);
        this.setupInputEvents(inputId, inputConfig);
    }

    /**
     * Configura eventos para un input
     * @param {string} inputId - ID del input
     * @param {object} config - Configuración del input
     */
    setupInputEvents(inputId, config) {
        const { element, realTimeValidation } = config;

        // Validación en tiempo real
        if (realTimeValidation) {
            const debouncedValidation = ValidationUtils.debounce((value) => {
                this.validateInput(inputId, value);
            }, ValidationConfig.debounceTime);

            element.addEventListener('input', (e) => {
                debouncedValidation(e.target.value);
            });
        }

        // Limpiar errores al enfocar
        element.addEventListener('focus', () => {
            this.clearInputError(inputId);
        });

        // Efectos visuales
        element.addEventListener('focus', () => {
            element.parentElement.classList.add('input-focused');
        });

        element.addEventListener('blur', () => {
            element.parentElement.classList.remove('input-focused');
        });
    }

    /**
     * Valida un input específico
     * @param {string} inputId - ID del input
     * @param {string} value - Valor a validar
     * @returns {boolean} - True si es válido
     */
    validateInput(inputId, value) {
        const config = this.inputs.get(inputId);
        if (!config) return true;

        const validator = this.validators.get(inputId) || new FormValidator();
        const error = validator.validateField(inputId, value);

        if (error) {
            this.showInputError(inputId, error);
            return false;
        } else {
            this.clearInputError(inputId);
            return true;
        }
    }

    /**
     * Muestra error en un input
     * @param {string} inputId - ID del input
     * @param {string} errorMessage - Mensaje de error
     */
    showInputError(inputId, errorMessage) {
        const config = this.inputs.get(inputId);
        if (!config) return;

        const { element } = config;
        const errorElement = document.getElementById(`${inputId}Error`);

        element.classList.add('error');
        if (errorElement) {
            errorElement.textContent = errorMessage;
            errorElement.classList.add('error-appear');
        }
    }

    /**
     * Limpia error de un input
     * @param {string} inputId - ID del input
     */
    clearInputError(inputId) {
        const config = this.inputs.get(inputId);
        if (!config) return;

        const { element } = config;
        const errorElement = document.getElementById(`${inputId}Error`);

        element.classList.remove('error');
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('error-appear');
        }
    }

    /**
     * Obtiene el valor de un input
     * @param {string} inputId - ID del input
     * @returns {string} - Valor del input
     */
    getValue(inputId) {
        const config = this.inputs.get(inputId);
        return config ? config.element.value.trim() : '';
    }

    /**
     * Establece el valor de un input
     * @param {string} inputId - ID del input
     * @param {string} value - Valor a establecer
     */
    setValue(inputId, value) {
        const config = this.inputs.get(inputId);
        if (config) {
            config.element.value = value;
        }
    }

    /**
     * Limpia todos los inputs registrados
     */
    clearAll() {
        this.inputs.forEach((config, inputId) => {
            this.setValue(inputId, '');
            this.clearInputError(inputId);
        });
    }
}

class PasswordToggle {
    constructor(passwordFieldId, toggleButtonId) {
        this.passwordField = document.getElementById(passwordFieldId);
        this.toggleButton = document.getElementById(toggleButtonId);
        this.isVisible = false;
        
        if (this.passwordField && this.toggleButton) {
            this.init();
        }
    }

    init() {
        this.toggleButton.addEventListener('click', () => this.toggle());
        
        // Actualizar icono inicial
        this.updateIcon();
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.passwordField.type = this.isVisible ? 'text' : 'password';
        this.updateIcon();
        
        // Agregar animación sutil
        this.toggleButton.classList.add('animate-scale-in');
        setTimeout(() => {
            this.toggleButton.classList.remove('animate-scale-in');
        }, 200);
    }

    updateIcon() {
        const icon = this.toggleButton.querySelector('svg');
        if (!icon) return;

        if (this.isVisible) {
            // Icono de ojo cerrado
            icon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
            `;
        } else {
            // Icono de ojo abierto
            icon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            `;
        }
    }
}

class LoadingManager {
    constructor() {
        this.activeLoaders = new Set();
    }

    /**
     * Muestra loading en un botón
     * @param {string} buttonId - ID del botón
     * @param {string} loadingText - Texto durante carga
     */
    showButtonLoading(buttonId, loadingText = 'Cargando...') {
        const button = document.getElementById(buttonId);
        if (!button) return;

        button.disabled = true;
        button.dataset.originalText = button.textContent;
        
        // Crear spinner
        const spinner = document.createElement('div');
        spinner.className = 'inline-block w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent';
        
        button.innerHTML = '';
        button.appendChild(spinner);
        button.appendChild(document.createTextNode(loadingText));
        
        this.activeLoaders.add(buttonId);
    }

    /**
     * Oculta loading de un botón
     * @param {string} buttonId - ID del botón
     */
    hideButtonLoading(buttonId) {
        const button = document.getElementById(buttonId);
        if (!button || !this.activeLoaders.has(buttonId)) return;

        button.disabled = false;
        button.textContent = button.dataset.originalText || 'Enviar';
        delete button.dataset.originalText;
        
        this.activeLoaders.delete(buttonId);
    }

    /**
     * Muestra loading global
     */
    showGlobalLoading() {
        let overlay = document.getElementById('globalLoadingOverlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'globalLoadingOverlay';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            overlay.innerHTML = `
                <div class="bg-white rounded-lg p-6 flex flex-col items-center">
                    <div class="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p class="text-gray-700">Cargando...</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        
        overlay.classList.add('animate-fade-in');
    }

    /**
     * Oculta loading global
     */
    hideGlobalLoading() {
        const overlay = document.getElementById('globalLoadingOverlay');
        if (overlay) {
            overlay.classList.add('animate-fade-out');
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    }
}

class NotificationManager {
    constructor() {
        this.container = this.createContainer();
        this.notifications = new Map();
    }

    createContainer() {
        let container = document.getElementById('notificationContainer');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            container.className = 'fixed top-4 right-4 z-50 space-y-2';
            document.body.appendChild(container);
        }
        
        return container;
    }

    /**
     * Muestra una notificación
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo: success, error, warning, info
     * @param {number} duration - Duración en ms
     */
    show(message, type = 'info', duration = 10000) {
        const id = ValidationUtils.generateUniqueId();
        
        const notification = this.createNotification(id, message, type);
        this.container.appendChild(notification);
        
        // Animación de entrada
        setTimeout(() => {
            notification.classList.add('animate-slide-up');
        }, 10);

        this.notifications.set(id, {
            element: notification,
            timeout: setTimeout(() => this.hide(id), duration)
        });

        return id;
    }

    createNotification(id, message, type) {
        const notification = document.createElement('div');
        notification.id = `notification-${id}`;
        notification.className = `
            max-w-sm bg-white rounded-lg shadow-lg border-l-4 p-4 transform translate-x-full transition-all
            ${type === 'success' ? 'border-green-500' : ''}
            ${type === 'error' ? 'border-red-500' : ''}
            ${type === 'warning' ? 'border-yellow-500' : ''}
            ${type === 'info' ? 'border-blue-500' : ''}
        `;

        const colors = {
            success: 'text-green-600',
            error: 'text-red-600', 
            warning: 'text-yellow-600',
            info: 'text-blue-600'
        };

        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };

        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full ${colors[type]} bg-opacity-10">
                        ${icons[type]}
                    </span>
                </div>
                <div class="ml-3 flex-1">
                    <p class="text-sm text-gray-700">${ValidationUtils.escapeHtml(message)}</p>
                </div>
                <button onclick="notificationManager.hide('${id}')" class="flex-shrink-0 ml-4 text-gray-400 hover:text-gray-600">
                    <span class="sr-only">Cerrar</span>
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;

        return notification;
    }

    /**
     * Oculta una notificación
     * @param {string} id - ID de la notificación
     */
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const { element, timeout } = notification;
        clearTimeout(timeout);

        element.classList.add('animate-fade-out');
        setTimeout(() => {
            element.remove();
            this.notifications.delete(id);
        }, 300);
    }

    /**
     * Limpia todas las notificaciones
     */
    clearAll() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }
}

class ViewManager {
    constructor() {
        this.views = new Map();
        this.currentView = null;
        this.history = [];
    }

    /**
     * Registra una vista
     * @param {string} viewId - ID de la vista
     * @param {Element} element - Elemento de la vista
     */
    registerView(viewId, element) {
        this.views.set(viewId, {
            element: element,
            isActive: !element.style.display || element.style.display !== 'none'
        });
    }

    /**
     * Cambia a una vista específica
     * @param {string} viewId - ID de la vista
     * @param {object} options - Opciones de transición
     */
    showView(viewId, options = {}) {
        const targetView = this.views.get(viewId);
        if (!targetView) {
            console.warn(`Vista '${viewId}' no encontrada`);
            return;
        }

        const { animation = 'fade', addToHistory = true } = options;

        // Agregar a historial
        if (addToHistory && this.currentView && this.currentView !== viewId) {
            this.history.push(this.currentView);
        }

        // Ocultar vista actual
        if (this.currentView && this.currentView !== viewId) {
            this.hideView(this.currentView, animation);
        }

        // Mostrar nueva vista
        setTimeout(() => {
            targetView.element.style.display = 'block';
            targetView.element.classList.add(`animate-${animation}-in`);
            targetView.isActive = true;
            this.currentView = viewId;

            // Limpiar clases de animación
            setTimeout(() => {
                targetView.element.classList.remove(`animate-${animation}-in`);
            }, 500);
        }, this.currentView && this.currentView !== viewId ? 300 : 0);
    }

    /**
     * Oculta una vista
     * @param {string} viewId - ID de la vista
     * @param {string} animation - Tipo de animación
     */
    hideView(viewId, animation = 'fade') {
        const view = this.views.get(viewId);
        if (!view || !view.isActive) return;

        view.element.classList.add(`animate-${animation}-out`);
        view.isActive = false;

        setTimeout(() => {
            view.element.style.display = 'none';
            view.element.classList.remove(`animate-${animation}-out`);
        }, 300);
    }

    /**
     * Vuelve a la vista anterior
     */
    goBack() {
        if (this.history.length === 0) return;

        const previousView = this.history.pop();
        this.showView(previousView, { addToHistory: false });
    }
}

// Instancias globales para uso en toda la aplicación
const ecoCharacter = new EcoCharacter(document.querySelector('.eco-character-container'));
const inputManager = new InputManager();
const loadingManager = new LoadingManager();
const notificationManager = new NotificationManager();
const viewManager = new ViewManager();

// Exportar para uso en módulos si es necesario
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        EcoCharacter,
        InputManager,
        PasswordToggle,
        LoadingManager,
        NotificationManager,
        ViewManager
    };
} else {
    // Para uso en el navegador
    window.EcoCharacter = EcoCharacter;
    window.InputManager = InputManager;
    window.PasswordToggle = PasswordToggle;
    window.LoadingManager = LoadingManager;
    window.NotificationManager = NotificationManager;
    window.ViewManager = ViewManager;
    
    // Instancias globales
    window.ecoCharacter = ecoCharacter;
    window.inputManager = inputManager;
    window.loadingManager = loadingManager;
    window.notificationManager = notificationManager;
    window.viewManager = viewManager;
}
