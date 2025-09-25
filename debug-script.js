// Script de debug temporal para probar el escaneo
// Agrega esto al final de tu index.html antes del </body>

console.log('🔧 Script de debug cargado');

// Función para probar manualmente el escaneo
window.testScanFunction = async function() {
    console.log('🧪 Iniciando prueba manual de escaneo');
    
    // Simular una respuesta del servidor con predicted_class
    const mockServerResponse = {
        predicted_class: "plastic bottle"
    };
    
    console.log('📡 Respuesta simulada del servidor:', mockServerResponse);
    
    // Obtener instancia de la aplicación
    const app = window.app || document.app;
    if (!app) {
        console.error('❌ No se encontró la instancia de la aplicación');
        return;
    }
    
    // Probar la transformación
    const transformed = app.transformServerResponse(mockServerResponse);
    console.log('🔄 Resultado transformado:', transformed);
    
    // Probar la visualización
    app.displayScanResult(transformed);
    console.log('✅ Prueba completada');
};

// Función para probar con archivo real
window.testWithRealFile = function() {
    console.log('📁 Probando con archivo real...');
    document.getElementById('camera-input').click();
};

// Interceptar fetch para ver las peticiones
const originalFetch = window.fetch;
window.fetch = function(...args) {
    console.log('🌐 Fetch interceptado:', args[0], args[1]);
    return originalFetch.apply(this, args)
        .then(response => {
            console.log('📥 Respuesta recibida:', response.status, response.statusText);
            return response.clone().json().then(data => {
                console.log('📋 Datos de respuesta:', data);
                return response;
            }).catch(() => response);
        })
        .catch(error => {
            console.error('❌ Error en fetch:', error);
            throw error;
        });
};

console.log('🎯 Funciones de debug disponibles:');
console.log('  - window.testScanFunction() - Probar transformación');
console.log('  - window.testWithRealFile() - Probar con archivo real');
console.log('  - Todas las peticiones fetch serán interceptadas y mostradas en consola');