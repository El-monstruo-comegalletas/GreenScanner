/**
 * Funciones de validación para EcoRecycle
 * Maneja todas las validaciones de formularios
 */

class FormValidator {
    constructor() {
        this.errors = {};
        this.rules = {
            email: {
                required: 'El correo es obligatorio',
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                patternMessage: 'Correo electrónico no válido'
            },
            password: {
                required: 'La contraseña es obligatoria',
                minLength: 6,
                minLengthMessage: 'La contraseña debe tener al menos 6 caracteres'
            },
            name: {
                required: 'El nombre es obligatorio',
                minLength: 2,
                minLengthMessage: 'El nombre debe tener al menos 2 caracteres'
            },
            confirmPassword: {
                required: 'Confirma tu contraseña',
                match: 'password',
                matchMessage: 'Las contraseñas no coinciden'
            }
        };
    }

    /**
     * Valida un campo individual
     * @param {string} fieldName - Nombre del campo
     * @param {string} value - Valor del campo
     * @param {object} formData - Datos completos del formulario
     * @returns {string|null} - Mensaje de error o null si es válido
     */
    validateField(fieldName, value, formData = {}) {
        const rule = this.rules[fieldName];
        if (!rule) return null;

        // Validación de campo requerido
        if (rule.required && (!value || value.trim() === '')) {
            return rule.required;
        }

        // Si el campo está vacío pero no es requerido, no validar más
        if (!value || value.trim() === '') {
            return null;
        }

        // Validación de longitud mínima
        if (rule.minLength && value.length < rule.minLength) {
            return rule.minLengthMessage;
        }

        // Validación de patrón (regex)
        if (rule.pattern && !rule.pattern.test(value)) {
            return rule.patternMessage;
        }

        // Validación de coincidencia con otro campo
        if (rule.match && formData[rule.match] !== value) {
            return rule.matchMessage;
        }

        return null;
    }

    /**
     * Valida todos los campos de un formulario
     * @param {object} formData - Datos del formulario
     * @param {array} fieldsToValidate - Campos a validar
     * @returns {object} - Objeto con errores por campo
     */
    validateForm(formData, fieldsToValidate) {
        const errors = {};

        fieldsToValidate.forEach(fieldName => {
            const error = this.validateField(fieldName, formData[fieldName], formData);
            if (error) {
                errors[fieldName] = error;
            }
        });

        return errors;
    }

    /**
     * Valida formulario de login
     * @param {object} loginData - Datos del login
     * @returns {object} - Errores de validación
     */
    validateLogin(loginData) {
        return this.validateForm(loginData, ['email', 'password']);
    }

    /**
     * Valida formulario de registro
     * @param {object} registerData - Datos del registro
     * @returns {object} - Errores de validación
     */
    validateRegister(registerData) {
        return this.validateForm(registerData, ['name', 'email', 'password', 'confirmPassword']);
    }

    /**
     * Valida email en tiempo real
     * @param {string} email - Email a validar
     * @returns {boolean} - True si es válido
     */
    isValidEmail(email) {
        const rule = this.rules.email;
        return rule.pattern.test(email);
    }

    /**
     * Valida fortaleza de contraseña
     * @param {string} password - Contraseña a validar
     * @returns {object} - Información sobre la fortaleza
     */
    validatePasswordStrength(password) {
        const result = {
            score: 0,
            feedback: [],
            isStrong: false
        };

        if (!password) {
            return result;
        }

        // Longitud mínima
        if (password.length >= 6) result.score += 1;
        else result.feedback.push('Mínimo 6 caracteres');

        // Contiene números
        if (/\d/.test(password)) {
            result.score += 1;
        } else {
            result.feedback.push('Incluye al menos un número');
        }

        // Contiene letras minúsculas
        if (/[a-z]/.test(password)) {
            result.score += 1;
        } else {
            result.feedback.push('Incluye letras minúsculas');
        }

        // Contiene letras mayúsculas
        if (/[A-Z]/.test(password)) {
            result.score += 1;
        } else {
            result.feedback.push('Incluye letras mayúsculas');
        }

        // Contiene caracteres especiales
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
            result.score += 1;
        } else {
            result.feedback.push('Incluye caracteres especiales');
        }

        result.isStrong = result.score >= 3;
        return result;
    }

    /**
     * Limpia un valor de entrada
     * @param {string} value - Valor a limpiar
     * @returns {string} - Valor limpio
     */
    sanitizeInput(value) {
        if (typeof value !== 'string') return '';
        
        return value
            .trim()
            .replace(/[<>]/g, '') // Remover caracteres peligrosos básicos
            .substring(0, 255); // Limitar longitud
    }

    /**
     * Verifica si un email ya está en uso (simulado)
     * @param {string} email - Email a verificar
     * @returns {Promise<boolean>} - True si está disponible
     */
    async isEmailAvailable(email) {
        // Simulación de verificación de email
        return new Promise((resolve) => {
            setTimeout(() => {
                // Lista de emails "ya registrados" para testing
                const existingEmails = [
                    'admin@ecorecycle.com',
                    'test@test.com',
                    'user@example.com'
                ];
                
                resolve(!existingEmails.includes(email.toLowerCase()));
            }, 500);
        });
    }

    /**
     * Muestra error en el campo
     * @param {string} fieldName - Nombre del campo
     * @param {string} errorMessage - Mensaje de error
     */
    showFieldError(fieldName, errorMessage) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const inputElement = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = errorMessage;
            errorElement.classList.add('error-appear');
        }
        
        if (inputElement) {
            inputElement.classList.add('error');
            inputElement.parentElement.classList.add('animate-shake');
            
            // Remover animación después de completarse
            setTimeout(() => {
                inputElement.parentElement.classList.remove('animate-shake');
            }, 500);
        }
    }

    /**
     * Limpia error del campo
     * @param {string} fieldName - Nombre del campo
     */
    clearFieldError(fieldName) {
        const errorElement = document.getElementById(`${fieldName}Error`);
        const inputElement = document.getElementById(fieldName);
        
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.remove('error-appear');
        }
        
        if (inputElement) {
            inputElement.classList.remove('error');
        }
    }

    /**
     * Muestra todos los errores de un formulario
     * @param {object} errors - Objeto con errores por campo
     */
    showFormErrors(errors) {
        // Primero limpiar errores existentes
        Object.keys(this.rules).forEach(fieldName => {
            this.clearFieldError(fieldName);
        });

        // Mostrar nuevos errores
        Object.entries(errors).forEach(([fieldName, errorMessage]) => {
            this.showFieldError(fieldName, errorMessage);
        });

        // Enfocar el primer campo con error
        const firstErrorField = Object.keys(errors)[0];
        if (firstErrorField) {
            const firstErrorElement = document.getElementById(firstErrorField);
            if (firstErrorElement) {
                firstErrorElement.focus();
            }
        }
    }

    /**
     * Limpia todos los errores del formulario
     */
    clearAllErrors() {
        Object.keys(this.rules).forEach(fieldName => {
            this.clearFieldError(fieldName);
        });
    }
}

// Funciones utilitarias de validación
const ValidationUtils = {
    /**
     * Debounce function para validación en tiempo real
     * @param {Function} func - Función a ejecutar
     * @param {number} wait - Tiempo de espera en ms
     * @returns {Function} - Función con debounce
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Escapa caracteres HTML para prevenir XSS
     * @param {string} text - Texto a escapar
     * @returns {string} - Texto escapado
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    },

    /**
     * Genera un ID único para elementos
     * @returns {string} - ID único
     */
    generateUniqueId() {
        return 'eco_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * Verifica si un valor es un objeto vacío
     * @param {object} obj - Objeto a verificar
     * @returns {boolean} - True si está vacío
     */
    isEmpty(obj) {
        return Object.keys(obj).length === 0;
    },

    /**
     * Formatea un mensaje de error para mostrar
     * @param {string} message - Mensaje original
     * @returns {string} - Mensaje formateado
     */
    formatErrorMessage(message) {
        if (!message) return '';
        
        // Capitalizar primera letra
        return message.charAt(0).toUpperCase() + message.slice(1);
    },

    /**
     * Valida que el dispositivo soporte las características necesarias
     * @returns {object} - Información de compatibilidad
     */
    checkBrowserCompatibility() {
        const support = {
            localStorage: typeof(Storage) !== 'undefined',
            formValidation: 'checkValidity' in document.createElement('input'),
            css3: 'transform' in document.createElement('div').style,
            es6: (function() {
                try {
                    new Function('(a = 0) => a');
                    return true;
                } catch (err) {
                    return false;
                }
            })()
        };

        support.isCompatible = Object.values(support).every(Boolean);
        return support;
    }
};

// Mensajes de validación personalizables
const ValidationMessages = {
    es: {
        required: 'Este campo es obligatorio',
        email: 'Ingresa un correo electrónico válido',
        minLength: 'Mínimo {min} caracteres',
        maxLength: 'Máximo {max} caracteres',
        match: 'Los campos no coinciden',
        passwordWeak: 'Contraseña muy débil',
        passwordMedium: 'Contraseña moderada',
        passwordStrong: 'Contraseña fuerte',
        emailTaken: 'Este correo ya está registrado',
        networkError: 'Error de conexión. Intenta nuevamente',
        genericError: 'Ha ocurrido un error. Por favor intenta nuevamente'
    },
    en: {
        required: 'This field is required',
        email: 'Please enter a valid email address',
        minLength: 'Minimum {min} characters',
        maxLength: 'Maximum {max} characters',
        match: 'Fields do not match',
        passwordWeak: 'Password too weak',
        passwordMedium: 'Password strength: medium',
        passwordStrong: 'Strong password',
        emailTaken: 'This email is already registered',
        networkError: 'Connection error. Please try again',
        genericError: 'An error occurred. Please try again'
    }
};

// Configuración de validación
const ValidationConfig = {
    // Idioma por defecto
    defaultLanguage: 'es',
    
    // Tiempo de debounce para validación en tiempo real (ms)
    debounceTime: 300,
    
    // Tiempo para mostrar mensajes de éxito (ms)
    successMessageTime: 3000,
    
    // Configuración de fortaleza de contraseña
    passwordStrength: {
        minLength: 6,
        requireNumbers: false,
        requireUppercase: false,
        requireLowercase: false,
        requireSpecialChars: false
    },
    
    // Patrones de validación
    patterns: {
        email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
        phone: /^[\+]?[1-9][\d]{0,15}$/,
        name: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/,
        password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/
    },
    
    // Límites de campos
    limits: {
        name: { min: 2, max: 50 },
        email: { min: 5, max: 254 },
        password: { min: 6, max: 128 },
        message: { min: 10, max: 1000 }
    }
};

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FormValidator,
        ValidationUtils,
        ValidationMessages,
        ValidationConfig
    };
} else {
    // Para uso en el navegador
    window.FormValidator = FormValidator;
    window.ValidationUtils = ValidationUtils;
    window.ValidationMessages = ValidationMessages;
    window.ValidationConfig = ValidationConfig;
}