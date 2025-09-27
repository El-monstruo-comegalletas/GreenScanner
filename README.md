# 🌱 EcoRecycle - App de Reciclaje con IA

Una aplicación web mobile-first para clasificación inteligente de residuos reciclables con integración de IA y sistema de recompensas.

## ✨ Características Principales

### 📱 Interfaz Móvil Optimizada
- **Diseño responsive** adaptado para dispositivos móviles
- **Vista previa de imágenes** que ocupa toda la pantalla del escáner
- **Botones mejorados** con mejor visibilidad y accesibilidad
- **Efectos visuales** como flash de captura y animaciones suaves

### 📷 Sistema de Cámara Avanzado
- **Acceso a cámara** con preferencia por cámara trasera
- **Captura de alta calidad** (JPEG 90%)
- **Vista previa en tiempo real** con controles intuitivos
- **Subida de imágenes** desde galería del dispositivo

### 🤖 Clasificación con IA
- **Integración con backend** para análisis de imágenes
- **Clasificación automática** de residuos reciclables
- **Instrucciones detalladas** para cada tipo de residuo
- **Sistema de contenedores** por colores (azul, gris, verde, negro, blanco)

### 🏆 Sistema de Recompensas
- **Puntos por reciclaje** según tipo de residuo
- **Historial personal** de actividades
- **Estadísticas de impacto** (CO₂ evitado, objetos reciclados)
- **Canjes de premios** con partners locales

### 🔐 Autenticación Segura
- **Sistema de login/registro** completo
- **Almacenamiento local** seguro de sesión
- **Botón de logout** con confirmación
- **Redirección automática** a login

## 🚀 Instalación y Uso

### Requisitos Previos
- Navegador moderno con soporte para cámara
- Conexión a internet para funciones de IA
- Permisos de cámara activados

### Inicio Rápido

1. **Clonar o descargar** el proyecto
2. **Ejecutar servidor local:**
   ```powershell
   # Windows PowerShell
   .\start-server.ps1
   ```
   O manualmente:
   ```bash
   # Con Python
   python -m http.server 8080
   
   # Con Node.js
   npx http-server -p 8080
   ```

3. **Abrir en navegador:**
   - App principal: `http://localhost:8080`
   - Testing UI: `http://localhost:8080/test-ui.html`

### Estructura del Proyecto
```
📁 Front-end/
├── 📄 index.html              # App principal
├── 📄 test-ui.html           # Herramientas de testing
├── 📄 start-server.ps1       # Script de servidor
├── 📁 css/
│   └── 📄 styles.css         # Estilos principales
├── 📁 js/
│   └── 📄 app.js             # Lógica de la aplicación
└── 📁 login/                 # Sistema de autenticación
    ├── 📁 html/
    ├── 📁 css/
    └── 📁 js/
```

## 🎨 Mejoras Recientes

### Interfaz Visual
- ✅ **Área del escáner** rediseñada con mejor contraste
- ✅ **Botones más visibles** con gradientes y sombras
- ✅ **Vista previa de imágenes** ocupa toda la pantalla negra
- ✅ **Efectos de hover** y animaciones mejoradas
- ✅ **Responsive design** para pantallas pequeñas

### Funcionalidad
- ✅ **Console.log limpio** - removido spam de debugging
- ✅ **Efecto flash** en captura de fotos
- ✅ **Mejor feedback visual** para acciones del usuario
- ✅ **Estados de carga** más claros
- ✅ **Manejo de errores** mejorado

### Móvil
- ✅ **Optimización touch** para dispositivos táctiles
- ✅ **Viewport mejorado** para diferentes tamaños
- ✅ **Botones accesibles** con tamaño mínimo de 44px
- ✅ **Imágenes responsive** que se adaptan automáticamente

## 🔧 Testing y Desarrollo

### Herramientas de Testing
- **test-ui.html**: Interfaz para probar responsividad, cámara y estilos
- **Consola del navegador**: Verificar errores y funcionamiento
- **DevTools móvil**: Simular diferentes dispositivos

### Comandos Útiles
```powershell
# Iniciar servidor de desarrollo
.\start-server.ps1

# Testing en diferentes dispositivos (DevTools)
# F12 > Toggle device toolbar > Seleccionar dispositivo
```

### Debugging
- Console limpia sin spam de `console.log`
- Errores importantes se muestran en consola
- Notificaciones visuales para feedback del usuario

## 📱 Compatibilidad

### Navegadores Soportados
- ✅ Chrome 70+ (móvil y escritorio)
- ✅ Firefox 65+
- ✅ Safari 12+ (iOS)
- ✅ Edge 79+

### Dispositivos Probados
- ✅ iPhone (Safari)
- ✅ Android (Chrome)
- ✅ Tablets
- ✅ Escritorio

## 🌐 Backend Integration

La aplicación se conecta con backend para:
- **Clasificación IA**: `POST /classify`
- **Sistema de puntos**: `GET/POST /puntos/*`
- **Historial**: `GET /historial/*`
- **Recompensas**: `GET /premios`

Configuración en `js/app.js`:
```javascript
const API_BASE_URL = 'https://gs.kwb.com.co';
```

## 📞 Soporte

Para problemas técnicos:
1. Verificar consola del navegador (F12)
2. Probar en modo incógnito
3. Verificar permisos de cámara
4. Usar `test-ui.html` para diagnóstico

---

**Desarrollado con 💚 para un futuro más sostenible** 🌍
