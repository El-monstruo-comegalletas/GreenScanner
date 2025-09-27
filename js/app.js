// =====================================================
// Guard de sesión (pon este bloque al inicio del archivo)
(() => {
  const LOGIN_URL = "./login/html/index.html";
  const email = localStorage.getItem("userEmail");
  if (!email) {
    window.location.href = LOGIN_URL;
  }
})();
// =====================================================

// --- CONFIGURACIÓN ---
// IMPORTANTE: Esta es la URL de tu backend.
// En desarrollo (local), usa: 'http://127.0.0.1:8000'
// En producción (desplegado), reemplázala por la URL pública de tu API.
//const API_BASE_URL = 'http://127.0.0.1:8000'; // <-- ¡CAMBIA ESTO ANTES DE DESPLEGAR!
const API_BASE_URL = 'https://gs.kwb.com.co'; // <-- ¡CAMBIA ESTO ANTES DE DESPLEGAR!
// const API_BASE_URL = 'http://localhost:8000'; // <-- ¡CAMBIA ESTO ANTES DE DESPLEGAR!

// === Config API (frontend) ===
const API_BASE = API_BASE_URL;   // Usamos la misma constante para consistencia

// Helper seguro para asignar texto (evita ?.textContent en LHS)
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

class EcoRecycleApp {  constructor() {
    this.activeTab = 'scanner';
    this.userPoints = 0;              // saldo actual (desde backend)
    this.userPointsTotal = 0;         // total acumulado (nunca baja)
    this.isScanning = false;
    this.isListening = false;
    this.scanResult = null;
    this.notifications = [];

    // Control de llamadas de puntos (evita spam)
    this._fetchingPoints = false;
    this._lastPointsFetch = 0; // epoch ms
    this.myRecyclingHistory = [];
    this.serverHistory = []; 
    
    // NUEVO: Sistema de colección de fotos y canje
    this.photoCollection = [];        // Fotos clasificadas en la sesión actual
    this.requiredPhotos = 3;          // Fotos necesarias para canje
    this.canExchangePoints = false;   // Si puede canjear puntos
    this.classificationHistory = []; // Historial de clasificaciones para encuesta
    
    // NUEVO: APIs para clasificaciones
    this.CLASIFICACIONES_API = 'http://localhost:8000/clasificaciones';
    this.currentClassifications = []; // Clasificaciones actuales del servidor
    
    // Recycling data (simulación)
    this.recyclingData = {
      'botella de plástico': { recyclable: true, bin: 'azul',   binColor: 'bg-blue-500-bin',  instructions: 'Lava la botella y retira la tapa antes de depositarla en la caneca azul.', points: 5 },
      'papel':               { recyclable: true, bin: 'gris',   binColor: 'bg-gray-500',      instructions: 'Asegúrate de que esté limpio y seco. Deposita en caneca gris.',            points: 3 },
      'vidrio':              { recyclable: true, bin: 'blanca', binColor: 'bg-white-bin',     instructions: 'Lava el vidrio y deposita en caneca blanca.',                             points: 4 },
      'residuo orgánico':    { recyclable: true, bin: 'verde',  binColor: 'bg-green-500-bin', instructions: 'Perfecto para compostaje. Deposita en caneca verde.',                      points: 2 },
      'residuo no reciclable':{recyclable:false, bin: 'negra',  binColor: 'bg-black',         instructions: 'Este residuo no es reciclable. Deposita en caneca negra.',                 points: 0 },
      'lata de aluminio':    { recyclable: true, bin: 'azul',   binColor: 'bg-blue-500-bin',  instructions: 'Lava la lata y deposita en caneca azul para reciclaje.',                   points: 4 },
      'cartón':              { recyclable: true, bin: 'gris',   binColor: 'bg-gray-500',      instructions: 'Asegúrate de que esté limpio y seco. Deposita en caneca gris.',            points: 3 },
      'botella vidrio':      { recyclable: true, bin: 'blanca', binColor: 'bg-white-bin',     instructions: 'Lava la botella de vidrio y deposita en caneca blanca.',                   points: 4 }
    };

    // Premios: se cargan desde el backend
    this.rewards = [];

    this.init();
  }

  // ------------------ Ciclo de vida -------------------
  async init() {
    this.bindEvents();

    // Cargar datos remotos en orden: puntos → UI → premios → estadísticas
    await this.fetchPoints();          // saldo y total
    this.updatePointsDisplay();
    await this.loadRewards();          // premios
    this.updateStatistics();

    // Auto-refresh de puntos
    this.pointsTimer = setInterval(() => this.fetchPoints(), 10000);
    window.addEventListener('focus', () => this.fetchPoints());
  }
  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // --- LÓGICA DE ESCANEO ---
    const cameraBtn = document.getElementById('camera-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const captureBtn = document.getElementById('capture-btn');
    const scanCapturedBtn = document.getElementById('scan-captured-btn');
    const cameraInput = document.getElementById('camera-input');
    const voiceBtn = document.getElementById('voice-btn');
    const downloadImageBtn = document.getElementById('download-image-btn');
    const retakeBtn = document.getElementById('retake-btn');    if (cameraBtn) cameraBtn.addEventListener('click', () => this.startCamera());
    if (uploadBtn) uploadBtn.addEventListener('click', () => this.triggerFileUpload());
    if (captureBtn) captureBtn.addEventListener('click', () => this.capturePhoto());
    if (scanCapturedBtn) scanCapturedBtn.addEventListener('click', () => this.scanCapturedImage());
    if (voiceBtn) voiceBtn.addEventListener('click', () => this.toggleVoiceRecognition());
    if (cameraInput) cameraInput.addEventListener('change', (event) => this.handleFileUpload(event));    if (downloadImageBtn) downloadImageBtn.addEventListener('click', () => this.downloadCapturedImage());
    if (retakeBtn) retakeBtn.addEventListener('click', () => this.retakePhoto());

    // Delegación para botones de premios
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('reward-btn')) {
        const rewardId = parseInt(e.target.getAttribute('data-reward-id'));
        this.claimReward(rewardId);
      }
    });
  }

  async startCamera() {
    const video = document.getElementById('camera-stream');
    const scanPlaceholder = document.getElementById('scan-placeholder');

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            // Configuraciones de cámara mejoradas para mejor compatibilidad
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' }, // Preferir cámara trasera pero no requerir
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    aspectRatio: { ideal: 16/9 }
                }
            };

            // Intentar primero con cámara trasera
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (backCameraError) {
                console.warn("No se pudo acceder a la cámara trasera, intentando con cualquier cámara disponible:", backCameraError);
                // Fallback: cualquier cámara disponible
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: {
                        width: { ideal: 1920, max: 1920 },
                        height: { ideal: 1080, max: 1080 }
                    } 
                });
            }

            video.srcObject = stream;
            this.stream = stream;
            
            // Esperar a que el video esté listo
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });            video.classList.remove('hidden');
            scanPlaceholder.classList.add('hidden');
            
            // Activar estado visual del escáner
            document.getElementById('scanner-area').classList.add('active');
            
            // Mostrar botones de cámara con animación
            const cameraButtons = document.getElementById('camera-buttons');
            cameraButtons.classList.remove('hidden');
            cameraButtons.classList.add('show');
            
            this.showNotification("Cámara activada. Ajusta el objeto y presiona 'Capturar Foto'", "success");
            
        } catch (error) {
            console.error("Error al acceder a la cámara: ", error);
            this.showNotification("No se pudo acceder a la cámara. Verificando permisos...", "error");
            
            // Intentar obtener lista de dispositivos disponibles
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === 'videoinput');
                
                if (videoDevices.length === 0) {
                    alert("No se encontraron cámaras disponibles en este dispositivo.");
                } else {
                    alert(`Se encontraron ${videoDevices.length} cámara(s), pero no se pudieron activar. Verifica los permisos del navegador.`);
                }
            } catch (deviceError) {
                console.error("Error al enumerar dispositivos:", deviceError);
            }
            
            // Fallback al input de archivo
            document.getElementById('camera-input').click();
        }
    } else {
        alert("Tu navegador no soporta acceso a la cámara. Usando selector de archivos.");
        document.getElementById('camera-input').click();
    }
  }

  triggerFileUpload() {
      document.getElementById('camera-input').click();
  }

  async capturePhoto() {
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');

    if (!video.videoWidth || !video.videoHeight) {
        this.showNotification("Error: El video no está listo. Intenta de nuevo.", "error");
        return;
    }

    // Ajustar tamaño del canvas al del video para mejor calidad
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibujar el frame actual del video en el canvas con mejor calidad
    context.drawImage(video, 0, 0, canvas.width, canvas.height);    // Detener el stream de la cámara
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
    }

    // Ocultar stream y botones de cámara, resetear estado visual
    document.getElementById('camera-stream').classList.add('hidden');
    document.getElementById('camera-buttons').classList.add('hidden');
    document.getElementById('scanner-area').classList.remove('active');

    try {
        // Efecto visual de captura (flash)
        const flashEffect = document.createElement('div');
        flashEffect.className = 'absolute top-0 left-0 w-full h-full bg-white opacity-0 rounded-lg pointer-events-none';
        flashEffect.style.animation = 'flash 0.3s ease-out';
        document.getElementById('scanner-area').appendChild(flashEffect);
        setTimeout(() => flashEffect.remove(), 300);

        // Crear la imagen con alta calidad JPG
        const imageBlob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.9); // Calidad 90%
        });

        if (!imageBlob) {
            throw new Error("No se pudo generar la imagen");
        }

        // Guardar referencia de la imagen capturada
        this.capturedImage = {
            blob: imageBlob,
            dataUrl: canvas.toDataURL('image/jpeg', 0.9),
            timestamp: new Date().toISOString(),
            filename: `eco_capture_${Date.now()}.jpg`
        };

        // Mostrar notificación de éxito
        this.showNotification("¡Foto capturada! Lista para escanear", "success");

        // Mostrar vista previa de la imagen capturada
        this.showCapturedImagePreview();

        this.showNotification("Foto capturada exitosamente. Usa 'Escanear Foto' para analizar.", "success");

    } catch (error) {
        console.error('Error al capturar la imagen:', error);
        this.showNotification("Error al capturar la imagen. Intenta de nuevo.", "error");
        this.resetScannerUI();
    }
  }

  async captureAndClassify() {
    // Método legacy para compatibilidad
    await this.capturePhoto();
  }
  resetScannerUI() {
      // Ocultar elementos de cámara
      document.getElementById('camera-stream').classList.add('hidden');
      document.getElementById('camera-buttons').classList.add('hidden');
      document.getElementById('secondary-buttons').classList.add('hidden');
      
      // Resetear estado visual del escáner
      document.getElementById('scanner-area').classList.remove('active');
      
      // Mostrar elementos principales
      document.getElementById('scan-placeholder').classList.remove('hidden');
      document.getElementById('scanning-animation').classList.add('hidden');
      
      // Limpiar vistas previas si existen
      const imagePreview = document.getElementById('image-preview');
      const uploadPreview = document.getElementById('uploaded-preview');
      if (imagePreview) imagePreview.remove();
      if (uploadPreview) uploadPreview.remove();
      
      // Limpiar imagen capturada
      this.capturedImage = null;
  }

  retakePhoto() {
      // Limpiar estado actual
      this.resetScannerUI();
      
      // Ocultar resultados anteriores
      document.getElementById('scan-result').classList.add('hidden');
      const form = document.getElementById('recycling-form');
      if (form) {
          form.remove();
      }
      
      // Iniciar cámara nuevamente
      this.startCamera();
  }  showCapturedImagePreview() {
      const scannerArea = document.getElementById('scanner-area');
      
      // Remover vista previa anterior si existe
      const existingPreview = document.getElementById('image-preview');
      if (existingPreview) {
          existingPreview.remove();
      }

      // Crear elemento de vista previa que ocupe toda la vista
      const previewContainer = document.createElement('div');
      previewContainer.id = 'image-preview';
      previewContainer.className = 'absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black bg-opacity-90 rounded-lg';
      
      const previewImage = document.createElement('img');
      previewImage.src = this.capturedImage.dataUrl;
      previewImage.className = 'max-w-full max-h-48 object-contain rounded mb-3 shadow-2xl';
      previewImage.alt = 'Imagen capturada';
      
      const previewText = document.createElement('p');
      previewText.textContent = 'Imagen capturada - Lista para escanear';
      previewText.className = 'text-white text-sm text-center font-medium mb-3';
      
      const scanImageBtn = document.createElement('button');
      scanImageBtn.innerHTML = '<i class="fas fa-search mr-2"></i>Escanear Imagen';
      scanImageBtn.className = 'bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg';
      scanImageBtn.addEventListener('click', () => this.scanCapturedImage());
      
      previewContainer.appendChild(previewImage);
      previewContainer.appendChild(previewText);
      previewContainer.appendChild(scanImageBtn);
      
      scannerArea.appendChild(previewContainer);
        // Mostrar botones secundarios con animación
      const secondaryButtons = document.getElementById('secondary-buttons');
      secondaryButtons.classList.remove('hidden');
      secondaryButtons.classList.add('show');
  }

  async scanCapturedImage() {
      if (!this.capturedImage) {
          this.showNotification("No hay imagen capturada para escanear.", "error");
          return;
      }
      //console.log(this.capturedImage)
      // Mostrar animación de escaneo
      document.getElementById('scanning-animation').classList.remove('hidden');
      document.getElementById('scan-result').classList.add('hidden');
      
      const preview = document.getElementById('image-preview');
      if (preview) {
          preview.classList.add('hidden');
      }

      try {
          const formData = new FormData();
          formData.append('file', this.capturedImage.blob, this.capturedImage.filename);
          
          await this.sendImageForClassification(formData);
          
      } catch (error) {
          console.error('Error al escanear la imagen:', error);
          this.showNotification("Error al escanear la imagen. Intenta de nuevo.", "error");
      }
  }

  downloadCapturedImage() {
      if (!this.capturedImage) {
          this.showNotification("No hay imagen para descargar.", "error");
          return;
      }

      const link = document.createElement('a');
      link.href = this.capturedImage.dataUrl;
      link.download = this.capturedImage.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showNotification("Imagen descargada exitosamente.", "success");
  }

  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
        this.showNotification("Por favor selecciona un archivo de imagen válido.", "error");
        return;
    }

    // Mostrar información del archivo
    this.showNotification(`Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, "info");

    const formData = new FormData();
    formData.append('file', file);

    // Mostrar vista previa del archivo subido
    const reader = new FileReader();
    reader.onload = (e) => {
        this.showUploadedImagePreview(e.target.result, file.name);
    };
    reader.readAsDataURL(file);

    // Mostrar animación de escaneo
    document.getElementById('scan-placeholder').classList.add('hidden');
    document.getElementById('scanning-animation').classList.remove('hidden');
    document.getElementById('scan-result').classList.add('hidden');

    await this.sendImageForClassification(formData);

    // Limpiar el input para poder seleccionar otra imagen
    event.target.value = '';  }
  
  showUploadedImagePreview(dataUrl, filename) {
      const scannerArea = document.getElementById('scanner-area');
      
      // Remover vista previa anterior si existe
      const existingPreview = document.getElementById('uploaded-preview');
      if (existingPreview) {
          existingPreview.remove();
      }

      // Crear elemento de vista previa que ocupe toda la vista
      const previewContainer = document.createElement('div');
      previewContainer.id = 'uploaded-preview';
      previewContainer.className = 'absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black bg-opacity-90 rounded-lg';
      
      const previewImage = document.createElement('img');
      previewImage.src = dataUrl;
      previewImage.className = 'max-w-full max-h-48 object-contain rounded mb-3 shadow-2xl';
      previewImage.alt = 'Imagen subida';
      
      const previewText = document.createElement('p');
      previewText.textContent = `Escaneando: ${filename}`;
      previewText.className = 'text-white text-sm text-center font-medium mb-3';
      
      const loadingSpinner = document.createElement('div');
      loadingSpinner.className = 'spinner mb-2';
      
      const loadingText = document.createElement('p');
      loadingText.textContent = 'Analizando imagen con IA...';
      loadingText.className = 'text-white text-xs text-center font-medium';
      
      previewContainer.appendChild(previewImage);
      previewContainer.appendChild(previewText);
      previewContainer.appendChild(loadingSpinner);
      previewContainer.appendChild(loadingText);
      
      scannerArea.appendChild(previewContainer);
      
      // Remover vista previa después de 8 segundos (más tiempo para ver la imagen)
      setTimeout(() => {
          if (previewContainer.parentNode) {
              previewContainer.remove();
          }
      }, 8000);
  }  async sendImageForClassification(formData) {
    try {
        console.log('📤 Enviando imagen al backend...');
        
        const response = await fetch(`${API_BASE_URL}/classify`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('📥 Respuesta del backend:', result);
        
        // Procesar respuesta del backend
        if (result.error) {
            throw new Error(result.error);
        }

        // El backend devuelve la clasificación en result.resultado
        const classificationResult = result.resultado;
        console.log('🔍 Resultado de clasificación:', classificationResult);
        
        // Transformar para mostrar en UI y obtener más información
        const transformedResult = this.transformBackendResponse(classificationResult);
        console.log('🔄 Resultado transformado:', transformedResult);
        
        // Agregar información del servidor al resultado transformado
        transformedResult.serverResponse = result;
        transformedResult.predictedClass = classificationResult.predicted_class;
        transformedResult.confidence = classificationResult.confidence || 0;
        
        // Agregar a la colección de fotos
        console.log('📸 Agregando foto a colección...');
        this.addPhotoToCollection({
            filename: result.filename || 'uploaded_image.jpg',
            classification: classificationResult,
            timestamp: result.fecha || new Date().toISOString(),
            serverResult: result,
            transformedResult: transformedResult
        });        // Mostrar resultado
        this.displayScanResult(transformedResult);

        // NUEVO: Crear panel de respuesta del modelo
        this.createModelResponsePanel(result, classificationResult, transformedResult);

        // NUEVO: Actualizar panel dinámico de clasificaciones
        await this.updateClassificationsPanel();

        // Verificar si ya puede canjear puntos
        this.checkForPointExchange();

    } catch (error) {
        console.error('❌ Error al clasificar la imagen:', error);
        this.showNotification('No se pudo conectar con el servidor de IA. Revisa la conexión.', 'error');
        
        // Fallback: usar clasificación local simulada
        this.showNotification('Usando clasificación local como respaldo...', 'info');
        this.simulateAIScan();
    } finally {
        // Ocultar animación y restaurar placeholder
        document.getElementById('scanning-animation').classList.add('hidden');
        document.getElementById('scan-placeholder').classList.remove('hidden');
    }
  }
  // Método para transformar la respuesta del servidor al formato esperado
  transformServerResponse(serverResponse) {
      // Si la respuesta ya está en el formato correcto, devolverla tal como está
      if (serverResponse.item || serverResponse.bin) {
          return serverResponse;
      }
      
      // Si la respuesta viene con predicted_class, transformarla
      let predictedClass = '';
      if (serverResponse.predicted_class) {
          predictedClass = serverResponse.predicted_class.toLowerCase();
      } else if (typeof serverResponse === 'string') {
          predictedClass = serverResponse.toLowerCase();
      }
      
      // Mapear las clases predichas a nuestro formato de datos de reciclaje
      const recyclingMapping = {
          // Objetos reciclables - contenedor azul
          'plastic bottle': { 
              item: 'Botella de plástico', 
              bin: 'Azul (Aprovechables)', 
              instructions: 'Lava la botella y retira la tapa antes de depositarla en la caneca azul.', 
              points: 5, 
              recyclable: true 
          },
          'botella de plastico': { 
              item: 'Botella de plástico', 
              bin: 'Azul (Aprovechables)', 
              instructions: 'Lava la botella y retira la tapa antes de depositarla en la caneca azul.', 
              points: 5, 
              recyclable: true 
          },
          'bottle': { 
              item: 'Botella', 
              bin: 'Azul (Aprovechables)', 
              instructions: 'Lava la botella antes de depositarla en la caneca azul.', 
              points: 5, 
              recyclable: true 
          },
          'can': { 
              item: 'Lata de aluminio', 
              bin: 'Azul (Aprovechables)', 
              instructions: 'Lava la lata y deposita en caneca azul para reciclaje.', 
              points: 4, 
              recyclable: true 
          },
          'aluminum can': { 
              item: 'Lata de aluminio', 
              bin: 'Azul (Aprovechables)', 
              instructions: 'Lava la lata y deposita en caneca azul para reciclaje.', 
              points: 4, 
              recyclable: true 
          },
          // Papel y cartón - contenedor gris
          'paper': { 
              item: 'Papel', 
              bin: 'Gris (Papel y cartón)', 
              instructions: 'Asegúrate de que esté limpio y seco. Deposita en caneca gris.', 
              points: 3, 
              recyclable: true 
          },
          'cardboard': { 
              item: 'Cartón', 
              bin: 'Gris (Papel y cartón)', 
              instructions: 'Asegúrate de que esté limpio y seco. Deposita en caneca gris.', 
              points: 3, 
              recyclable: true 
          },
          // Vidrio - contenedor blanco
          'glass': { 
              item: 'Vidrio', 
              bin: 'Blanco (Aprovechables)', 
              instructions: 'Lava el vidrio y deposita en caneca blanca.', 
              points: 4, 
              recyclable: true 
          },
          'glass bottle': { 
              item: 'Botella de vidrio', 
              bin: 'Blanco (Aprovechables)', 
              instructions: 'Lava la botella de vidrio y deposita en caneca blanca.', 
              points: 4, 
              recyclable: true 
          },
          // Orgánicos - contenedor verde
          'organic': { 
              item: 'Residuo orgánico', 
              bin: 'Verde (Orgánicos)', 
              instructions: 'Perfecto para compostaje. Deposita en caneca verde.', 
              points: 2, 
              recyclable: true 
          },
          'food waste': { 
              item: 'Residuo orgánico', 
              bin: 'Verde (Orgánicos)', 
              instructions: 'Perfecto para compostaje. Deposita en caneca verde.', 
              points: 2, 
              recyclable: true 
          },
          // Residuos no reciclables - contenedor negro
          'trash': { 
              item: 'Residuo no reciclable', 
              bin: 'Negro (No aprovechables)', 
              instructions: 'Este residuo no es reciclable. Deposita en caneca negra.', 
              points: 0, 
              recyclable: false 
          },
          'non-recyclable': { 
              item: 'Residuo no reciclable', 
              bin: 'Negro (No aprovechables)', 
              instructions: 'Este residuo no es reciclable. Deposita en caneca negra.', 
              points: 0, 
              recyclable: false 
          }
      };
      
      // Buscar coincidencia exacta o parcial
      let matchedData = recyclingMapping[predictedClass];
      
      // Si no hay coincidencia exacta, buscar coincidencia parcial
      if (!matchedData) {
          for (const [key, value] of Object.entries(recyclingMapping)) {
              if (predictedClass.includes(key) || key.includes(predictedClass)) {
                  matchedData = value;
                  break;
              }
          }
      }
      
      // Si aún no hay coincidencia, crear una respuesta por defecto
      if (!matchedData) {
          matchedData = {
              item: predictedClass || 'Objeto no identificado',
              bin: 'Negro (No aprovechables)',
              instructions: 'No se pudo determinar el tipo de reciclaje. Consulta con un experto o deposita en caneca negra.',
              points: 0,
              recyclable: false          };
      }
      
      return matchedData;
  }  displayScanResult(result) {
      console.log('🎯 Mostrando resultado del escaneo:', result);
      
      const scanResultEl = document.getElementById('scan-result');
      const resultItem = document.getElementById('result-item');
      const resultBin = document.getElementById('result-bin');
      const resultBinColor = document.getElementById('result-bin-color');
      const resultInstructions = document.getElementById('result-instructions');
      const pointsEarnedSpan = document.getElementById('points-earned');
      const resultPoints = document.getElementById('result-points');

      // Verificar que todos los elementos existan
      if (!scanResultEl || !resultItem || !resultBin || !resultInstructions) {
          console.error('❌ Error: No se encontraron elementos del DOM para mostrar resultados');
          this.showNotification('Error en la interfaz: elementos no encontrados', 'error');
          return;
      }

      if (result.error) {
          console.error('❌ Error en el resultado:', result.error);
          this.showNotification(`Error del servidor: ${result.error}`, 'error');
          scanResultEl.classList.add('hidden');
          return;
      }

      // Verificar que el resultado tenga los campos necesarios
      if (!result.item) {
          console.warn('⚠️ Resultado sin campo item:', result);
          result.item = 'Objeto no identificado';
      }
      
      if (!result.bin) {
          console.warn('⚠️ Resultado sin campo bin:', result);
          result.bin = 'Negro (No aprovechables)';
      }

      // Mostrar la información del material clasificado
      console.log('📋 Actualizando elementos del DOM:', {
          item: result.item,
          bin: result.bin,
          instructions: result.instructions,
          points: result.points
      });

      resultItem.textContent = result.item;
      resultBin.textContent = result.bin;
      resultInstructions.textContent = result.instructions || 'Sin instrucciones específicas';
      
      // Asignar color a la caneca según el contenedor
      const binColors = {
          'Verde (Orgánicos)': 'bg-green-500',
          'Azul (Aprovechables)': 'bg-blue-500', 
          'Negro (No aprovechables)': 'bg-gray-800',
          'Blanco (Aprovechables)': 'bg-gray-200 border border-gray-400',
          'Gris (Papel y cartón)': 'bg-gray-500'
      };
        const colorClass = binColors[result.bin] || 'bg-gray-400';
      if (resultBinColor) {
          resultBinColor.className = `w-8 h-8 rounded-full mr-3 ${colorClass}`;
      }

      // Mostrar puntos si los hay
      if (result.points > 0 && pointsEarnedSpan && resultPoints) {
          pointsEarnedSpan.textContent = result.points;
          resultPoints.classList.remove('hidden');
          console.log('✅ Mostrando puntos:', result.points);
          
          // Actualizar puntos del usuario si es reciclable
          if (result.recyclable) {
              this.fetchPoints(); 
          }
      } else if (resultPoints) {
          resultPoints.classList.add('hidden');
      }

      // Almacenar resultado para uso posterior
      this.lastScanResult = result;

      // IMPORTANTE: Asegurar que el panel de resultados sea visible
      scanResultEl.classList.remove('hidden');
      
      // Hacer scroll suave al resultado para que sea visible
      setTimeout(() => {
          scanResultEl.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'nearest' 
          });
      }, 300);
      
      console.log('✅ Panel de resultados mostrado exitosamente');

      // Generar formulario basado en la respuesta (si es necesario)
      this.generateRecyclingForm(result);
  }  generateRecyclingForm(result) {
      // Esta función se puede omitir para simplificar la UI
      // El panel de resultados ya muestra toda la información necesaria
      console.log('📋 Formulario de reciclaje omitido - panel de resultados mostrado');
  }  createModelResponsePanel(serverResult, classificationResult, transformedResult) {
    console.log('🎯 Creando panel de respuesta del modelo:', {
      serverResult, 
      classificationResult, 
      transformedResult
    });

    // Remover panel anterior si existe
    const existingPanel = document.getElementById('model-response-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    // Crear nuevo panel exactamente como la imagen
    const panel = document.createElement('div');
    panel.id = 'model-response-panel';
    panel.className = 'bg-white rounded-xl p-4 shadow-lg mt-4 border-2 border-teal-200';
    
    // Insertar después del panel de resultados principal
    const scanResult = document.getElementById('scan-result');
    if (scanResult && scanResult.parentNode) {
      scanResult.parentNode.insertBefore(panel, scanResult.nextSibling);
    }

    // Obtener datos de la clasificación
    const materialDetected = classificationResult?.predicted_class || 'papel';
    const confidence = classificationResult?.confidence || 0;

    // Panel exactamente como la imagen enviada
    panel.innerHTML = `
      <!-- Encabezado con icono y material -->
      <div class="flex items-center mb-4">
        <!-- Círculo gris con el material -->
        <div class="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
        </div>
        
        <div class="flex-1">
          <h4 class="text-xl font-semibold text-gray-800 capitalize">${materialDetected}</h4>
        </div>
      </div>

      <!-- Información de la caneca -->
      <div class="mb-4">
        <div class="flex items-start">
          <span class="text-sm text-gray-700 font-medium mr-2">Caneca:</span>
          <span class="text-sm text-green-600 font-medium">${transformedResult.bin || 'Gris (Papel y cartón)'}</span>
        </div>
      </div>

      <!-- Instrucciones -->
      <div class="text-sm text-gray-700 mb-4 leading-relaxed">
        ${transformedResult.instructions || 'Asegúrate de que esté limpio y seco. Deposita en caneca gris.'}
      </div>

      <!-- Puntos ganados -->
      ${transformedResult.points > 0 ? `
        <div class="flex items-center text-green-600">
          <i class="fas fa-check-circle mr-2"></i>
          <span class="text-sm font-medium">+${transformedResult.points} puntos GreenScanner</span>
        </div>
      ` : `
        <div class="flex items-center text-gray-600">
          <i class="fas fa-info-circle mr-2"></i>
          <span class="text-sm">No genera puntos (residuo no reciclable)</span>
        </div>
      `}
    `;

    // Agregar animación de entrada
    panel.classList.add('fade-in');

    // Auto-scroll al panel con delay
    setTimeout(() => {
      panel.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }, 400);

    console.log('✅ Panel de respuesta del modelo creado exitosamente');
  }

  getMaterialDisplayInfo(material) {
    const materialLower = material.toLowerCase();
    
    const materialMappings = {
      'papel': {
        bgColor: 'bg-gray-500',
        icon: 'fas fa-file-alt',
        binName: 'gris',
        binTextColor: 'text-gray-600'
      },
      'paper': {
        bgColor: 'bg-gray-500',
        icon: 'fas fa-file-alt',
        binName: 'gris',
        binTextColor: 'text-gray-600'
      },
      'plastic': {
        bgColor: 'bg-blue-500',
        icon: 'fas fa-recycle',
        binName: 'azul',
        binTextColor: 'text-blue-600'
      },
      'plastico': {
        bgColor: 'bg-blue-500',
        icon: 'fas fa-recycle',
        binName: 'azul',
        binTextColor: 'text-blue-600'
      },
      'metal': {
        bgColor: 'bg-blue-600',
        icon: 'fas fa-cog',
        binName: 'azul',
        binTextColor: 'text-blue-600'
      },
      'aluminum': {
        bgColor: 'bg-blue-600',
        icon: 'fas fa-cog',
        binName: 'azul',
        binTextColor: 'text-blue-600'
      },
      'glass': {
        bgColor: 'bg-blue-300',
        icon: 'fas fa-wine-glass',
        binName: 'blanca',
        binTextColor: 'text-blue-400'
      },
      'vidrio': {
        bgColor: 'bg-blue-300',
        icon: 'fas fa-wine-glass',
        binName: 'blanca',
        binTextColor: 'text-blue-400'
      },
      'organic': {
        bgColor: 'bg-green-500',
        icon: 'fas fa-leaf',
        binName: 'verde',
        binTextColor: 'text-green-600'
      },
      'organico': {
        bgColor: 'bg-green-500',
        icon: 'fas fa-leaf',
        binName: 'verde',
        binTextColor: 'text-green-600'
      },
      'cardboard': {
        bgColor: 'bg-gray-600',
        icon: 'fas fa-box',
        binName: 'gris',
        binTextColor: 'text-gray-600'
      },
      'carton': {
        bgColor: 'bg-gray-600',
        icon: 'fas fa-box',
        binName: 'gris',
        binTextColor: 'text-gray-600'
      }
    };

    // Buscar coincidencia exacta o parcial
    for (const [key, info] of Object.entries(materialMappings)) {
      if (materialLower.includes(key) || key.includes(materialLower)) {
        return info;
      }
    }

    // Por defecto (residuo no identificado)
    return {
      bgColor: 'bg-gray-400',
      icon: 'fas fa-question',
      binName: 'negra',
      binTextColor: 'text-gray-800'
    };
  }

  // ---------------- Navegación/pestañas ----------------
  switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    const tabEl = document.getElementById(`${tabName}-tab`);
    if (tabEl) tabEl.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const navEl = document.querySelector(`[data-tab="${tabName}"]`);
    if (navEl) navEl.classList.add('active');

    this.activeTab = tabName;

    // 🔵 Carga el historial real del backend al abrir la pestaña
    if (tabName === 'history') {
      this.loadHistoryFromBackend().then(() => this.renderHistory());
    }
    if (tabName === 'rewards') this.renderRewards();
  }

  // ---------------- Logout functionality ----------------
  handleLogout() {
    // Confirmar logout
    const confirmLogout = confirm('¿Estás seguro de que quieres cerrar sesión?');
    if (!confirmLogout) return;

    // Limpiar datos locales
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    
    // Detener intervalos y timers
    if (this.pointsTimer) {
      clearInterval(this.pointsTimer);
    }
    
    // Detener stream de cámara si está activo
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    // Mostrar notificación de logout
    this.showNotification('Cerrando sesión...', 'info');
    
    // Redirigir a login después de un breve delay
    setTimeout(() => {
      window.location.href = './login/html/index.html';
    }, 1000);
  }

  // ------------------- Escaneo (sim) -------------------
  simulateAIScan() {
    if (this.isScanning) return;
    this.isScanning = true;

    const ph = document.getElementById('scan-placeholder');
    if (ph) ph.classList.add('hidden');
    const anim = document.getElementById('scanning-animation');
    if (anim) anim.classList.remove('hidden');
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) scanBtn.setAttribute('disabled', 'true');
    const sr = document.getElementById('scan-result');
    if (sr) sr.classList.add('hidden');

    setTimeout(async () => {
      const items = Object.keys(this.recyclingData);
      const randomItem = items[Math.floor(Math.random() * items.length)];
      const result = this.recyclingData[randomItem];

      // Crear estructura similar a la respuesta del backend
      const simulatedBackendResponse = {
        predicted_class: randomItem,
        confidence: Math.random() * 0.4 + 0.6 // Entre 0.6 y 1.0
      };

      const transformedResult = this.transformBackendResponse(simulatedBackendResponse);
      
      console.log('🎲 Simulación generada:', {
        randomItem,
        simulatedBackendResponse,
        transformedResult
      });      this.displayScanResult(transformedResult);

      // NUEVO: Crear panel de respuesta del modelo para simulación
      this.createModelResponsePanel(
        { resultado: simulatedBackendResponse, fecha: new Date().toISOString(), filename: `simulation_${Date.now()}.jpg` }, 
        simulatedBackendResponse, 
        transformedResult
      );

      // Agregar a la colección de fotos para el sistema de canje
      this.addPhotoToCollection({
        filename: `simulation_${Date.now()}.jpg`,
        classification: simulatedBackendResponse,
        timestamp: new Date().toISOString(),
        transformedResult: transformedResult,
        serverResult: { resultado: simulatedBackendResponse },
        isSimulation: true
      });

      if (transformedResult.recyclable && transformedResult.points > 0) {
        // Registrar puntos en backend y refrescar saldos
        const correo = localStorage.getItem("userEmail");
        try {
          await fetch(`${API_BASE}/puntos/agregar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, puntos: transformedResult.points })
          });
        } catch (_) {}
        this.addNotification(`¡Bien hecho! +${transformedResult.points} puntos por reciclar correctamente`);
        this.addToHistory(transformedResult.item, transformedResult.points);
        await this.fetchPoints();  // saldo y total actualizados        await this.loadHistoryFromBackend();
        this.renderHistory();
      }

      // Verificar si ya puede canjear puntos
      this.checkForPointExchange();

      // NUEVO: Actualizar panel dinámico después de simulación
      await this.updateClassificationsPanel();

      if (anim) anim.classList.add('hidden');
      if (ph) ph.classList.remove('hidden');
      if (scanBtn) scanBtn.removeAttribute('disabled');
      this.isScanning = false;
    }, 2000);
  }

  // ---------------- Reconocimiento de voz ---------------
  toggleVoiceRecognition() {
    const voiceBtn = document.getElementById('voice-btn');
    if (!voiceBtn) return;

    if (this.isListening) {
      this.isListening = false;
      voiceBtn.classList.remove('voice-listening');
      voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    } else {
      this.isListening = true;
      voiceBtn.classList.add('voice-listening');
      voiceBtn.innerHTML = '<i class="fas fa-microphone-slash"></i>';

      setTimeout(async () => {
        const result = this.recyclingData['lata de aluminio'];
        this.scanResult = { item: 'lata de aluminio', ...result };
        this.displayScanResult();

        const correo = localStorage.getItem("userEmail");
        try {
          await fetch(`${API_BASE}/puntos/agregar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, puntos: result.points })
          });
        } catch (_) {}
        this.addNotification('¡Consulta por voz procesada! +4 puntos');
        this.addToHistory('lata de aluminio', result.points);
        await this.fetchPoints();
        await this.loadHistoryFromBackend();
        this.renderHistory();


        this.isListening = false;
        voiceBtn.classList.remove('voice-listening');
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      }, 3000);
    }
  }

  // ----------------- Historial/estadísticas -------------
  addToHistory(item, points) {
    this.myRecyclingHistory.unshift({
      id: Date.now(),
      user: 'Tú',
      item,
      time: 'Ahora',
      points,
      location: 'Casa',
      avatar: 'YO'
    });
    this.updateStatistics();
  }

  renderHistory() {
  const historyList = document.getElementById('history-list');
  if (!historyList) return;

  const data = this.serverHistory.length ? this.serverHistory : this.myRecyclingHistory.map(h => ({
    accion: 'escaneo',
    detalle: `+${h.points} puntos por reciclaje`,
    badge: `+${h.points}`,
    delta: +h.points,
    fecha: h.time || 'Ahora'
  }));

  if (!data.length) {
    historyList.innerHTML = `
      <div class="text-center py-8">
        <i class="fas fa-trash-alt text-gray-300 text-6xl mb-4"></i>
        <p class="text-gray-500 text-lg">¡Aún no hay actividades!</p>
        <p class="text-gray-400 text-sm">Usa el escáner o canjea para ver el registro.</p>
      </div>`;
    return;
  }

  historyList.innerHTML = data.map(entry => `
    <div class="history-item">
      <div class="history-content">
        <div class="history-info">
          <h3>${entry.accion === 'canje' ? 'Canje de premio' : 'Puntos por reciclaje'}</h3>
          <p>${entry.detalle || ''}</p>
          <div class="history-time">${entry.fecha}</div>
        </div>
        <div class="history-points">
          <div class="history-points-badge ${entry.delta >= 0 ? 'hist-badge-pos' : 'hist-badge-neg'}">
            <span class="history-points-text">${entry.badge} pts</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}


  updateStatistics() {
    const totalRecycled = this.myRecyclingHistory.length;
    const co2Avoided = (totalRecycled * 0.35).toFixed(1);
    const averagePoints = totalRecycled > 0
      ? Math.round(this.myRecyclingHistory.reduce((s, it) => s + it.points, 0) / totalRecycled)
      : 0;

    setText('total-recycled', totalRecycled);
    // 🔵 “Puntos ganados” debe mostrar el TOTAL acumulado real del backend
    setText('total-points-earned', this.userPointsTotal);
    setText('co2-avoided', `${co2Avoided}kg`);
    setText('average-points', averagePoints);
  }

  // ================= PREMIOS ===========================
  async loadRewards() {
    try {
      const res = await fetch(`${API_BASE}/premios`);
      const premios = await res.json();
      this.rewards = (premios || []).map((p, i) => ({
        id: i + 1,
        name: p.nombre,
        points: p.puntos_necesarios,
        stock: typeof p.stock === 'number' ? p.stock : 0,
        partner: p.partner || ''
      }));
      this.renderRewards();
    } catch (err) {
      console.error('No pude cargar premios:', err);
    }
  }

  renderRewards() {
    const rewardsGrid = document.getElementById('rewards-grid');
    if (!rewardsGrid) return;

    // saldo actual y total acumulado (sin optional chaining en LHS)
    setText('rewards-points', this.userPoints);
    setText('rewards-points-total', this.userPointsTotal);

    rewardsGrid.innerHTML = this.rewards.map(reward => {
      const sinPuntos = this.userPoints < reward.points;
      const agotado = (reward.stock ?? 0) <= 0;
      const disabled = sinPuntos || agotado;

      return `
        <div class="border border-gray-200 rounded-lg p-4">
          <div class="text-center">
            <i class="fas fa-gift text-purple-500 text-2xl mb-2"></i>
            <h3 class="font-semibold text-gray-800 text-sm">${reward.name}</h3>
            ${reward.partner ? `<p class="text-xs text-gray-600 mt-1">${reward.partner}</p>` : ``}
            <div class="mt-2"><span class="text-green-600 font-medium text-sm">${reward.points} pts</span></div>
            <div class="text-xs text-gray-500 mt-1">Stock: ${reward.stock ?? 0}</div>
            <button
              class="reward-btn mt-2 w-full px-3 py-1 rounded-lg text-xs font-medium transition-colors ${disabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}"
              data-reward-id="${reward.id}" ${disabled ? 'disabled' : ''}>
              ${agotado ? 'Agotado' : (sinPuntos ? 'Faltan pts' : 'Canjear')}
            </button>
          </div>
        </div>`;
    }).join('');
  }

  async claimReward(rewardId) {
    const reward = this.rewards.find(r => r.id === rewardId);
    if (!reward) return;

    if ((reward.stock ?? 0) <= 0) return;
    if (this.userPoints < reward.points) return;

    try {
      const correo = localStorage.getItem('userEmail');
      if (!correo) { alert('Debes iniciar sesión para canjear.'); return; }

      const resp = await fetch(`${API_BASE}/puntos/canjear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo, premio: reward.name })
      });
      const data = await resp.json();
      if (data.error) { alert('No se pudo canjear: ' + data.error); return; }

      reward.stock = Math.max(0, (reward.stock ?? 0) - 1);
      this.addNotification(data.mensaje || `¡Canjeaste ${reward.name}!`);
      await this.fetchPoints();        // saldo real (el total acumulado NO baja)
      await this.loadHistoryFromBackend();
      this.renderRewards();   // ya lo tienes

      this.renderRewards();
    } catch (err) {
      console.error(err);
      alert('Error al canjear. Revisa la conexión con el servidor.');
    }
  }

  // --------------- Puntos (sincronización) -------------
  async fetchPoints() {
    // Throttle: evita llamadas concurrentes y muy seguidas (<8s)
    const now = Date.now();
    if (this._fetchingPoints) return;
    if (now - (this._lastPointsFetch || 0) < 8000) return;
    const correo = localStorage.getItem('userEmail');
    if (!correo) return;
    this._fetchingPoints = true;
    this._lastPointsFetch = now;

    try {
      // Pedimos SALDO y TOTAL en paralelo
      const [saldoRes, totalRes] = await Promise.all([
        fetch(`${API_BASE}/usuarios/${encodeURIComponent(correo)}/puntos`),
        fetch(`${API_BASE}/usuarios/${encodeURIComponent(correo)}/puntos-acumulados`)
      ]);

      const saldo = await saldoRes.json();
      const total = await totalRes.json();

      // Asignamos (con fallback numérico)
      this.userPoints      = Number(saldo?.puntos ?? 0);
      this.userPointsTotal = Number(total?.puntos_acumulados ?? 0);

      this.updatePointsDisplay();

      // Si estás en la pestaña de recompensas, re-renderiza para habilitar/bloquear botones
      if (this.activeTab === 'rewards') this.renderRewards();
      } catch (e) {
        console.error('No pude traer puntos:', e);
      } finally {
        this._fetchingPoints = false;
      }
    }

  updatePointsDisplay() {
    // saldo actual (cabecera y bloque de premios)
    setText('user-points', this.userPoints);
    setText('rewards-points', this.userPoints);

    // total acumulado (no baja al canjear) – tarjeta de estadísticas y, si lo usas, badges
    setText('total-points-earned', this.userPointsTotal);
    setText('user-points-total', this.userPointsTotal);
    setText('rewards-points-total', this.userPointsTotal);
  }

  // ----------------- Notificaciones --------------------
  addNotification(message) {
    const notification = { id: Date.now(), message, timestamp: new Date().toLocaleTimeString() };
    this.notifications.unshift(notification);
    this.showNotification(message);
  }

  showNotification(message, type = 'success') {
    const notificationDiv = document.getElementById('notifications');
    const messageP = document.getElementById('notification-message');
    if (!notificationDiv || !messageP) return;

    // Remover clases de color anteriores
    notificationDiv.className = notificationDiv.className.replace(/bg-\w+-100|border-\w+-500/g, '');
    messageP.className = messageP.className.replace(/text-\w+-700/g, '');

    // Aplicar estilos según el tipo
    switch (type) {
        case 'error':
            notificationDiv.classList.add('bg-red-100', 'border-red-500');
            messageP.classList.add('text-red-700');
            break;
        case 'warning':
            notificationDiv.classList.add('bg-yellow-100', 'border-yellow-500');
            messageP.classList.add('text-yellow-700');
            break;
        case 'info':
            notificationDiv.classList.add('bg-blue-100', 'border-blue-500');
            messageP.classList.add('text-blue-700');
            break;
        default: // success
            notificationDiv.classList.add('bg-green-100', 'border-green-500');
            messageP.classList.add('text-green-700');
            break;
    }

    messageP.textContent = message;
    notificationDiv.classList.remove('hidden');
    
    // Auto-hide después de 4 segundos (más tiempo para leer)
    setTimeout(() => {
        notificationDiv.classList.add('hidden');
    }, 4000);
  }
  



  async loadHistoryFromBackend() {
    const correo = localStorage.getItem('userEmail');
    if (!correo) return;
    try {
      const res = await fetch(`${API_BASE}/historial/${encodeURIComponent(correo)}`);
      const raw = await res.json();
      // Normaliza: delta (+/-), etiqueta, fecha bonita
      this.serverHistory = (raw || []).map((h) => {
        const delta = parseDeltaFromDetalle(h.accion, h.detalle);
        const badge = delta >= 0 ? `+${delta}` : `${delta}`;
        // Etiqueta legible
        let label = h.detalle || '';
        if (!label) {
          label = (h.accion === 'escaneo')
            ? 'Puntos por reciclaje'
            : (h.accion === 'canje') ? 'Puntos gastados en canje' : 'Actividad';
        }
        return {
          accion: h.accion,
          detalle: h.detalle,
          badge,
          delta,
          fecha: h.fecha ? formatFecha(h.fecha) : 'Ahora'
        };
      });
      // Ordena por fecha descendente si backend no viene ordenado
      this.serverHistory.sort((a, b) => (new Date(b.fecha) - new Date(a.fecha)));
    } catch (e) {
      console.error('No pude cargar historial:', e);
    }
  }  // NUEVO: Sistema de colección de fotos y canje de puntos
  addPhotoToCollection(photo) {
    console.log('📸 Agregando foto a la colección:', photo);
    
    this.photoCollection.push(photo);
    this.classificationHistory.push(photo);
    
    // Actualizar contador visual
    this.updatePhotoCounter();
    
    // Verificar si ya puede canjear
    if (this.photoCollection.length >= this.requiredPhotos) {
      this.canExchangePoints = true;
      console.log('🎁 Ya se pueden canjear puntos! Fotos recolectadas:', this.photoCollection.length);
      
      // Mostrar botón del formulario educativo
      this.showFormAccessButton();
    }
    
    // Mostrar material clasificado correctamente
    const materialName = photo.transformedResult?.item || 
                        photo.classification?.predicted_class || 
                        'Material';
    
    this.showNotification(`Foto ${this.photoCollection.length}/${this.requiredPhotos} guardada. ${materialName} clasificado.`, 'success');
    
    console.log('📊 Estado de la colección:', {
      totalFotos: this.photoCollection.length,
      necesarias: this.requiredPhotos,
      puedeCanjar: this.canExchangePoints
    });
  }

  updatePhotoCounter() {
    // Mostrar progreso en la UI
    let counterElement = document.getElementById('photo-counter');
    if (!counterElement) {
      // Crear contador si no existe
      counterElement = document.createElement('div');
      counterElement.id = 'photo-counter';
      counterElement.className = 'fixed top-20 right-4 bg-green-500 text-white px-3 py-2 rounded-full text-sm font-bold shadow-lg z-50';
      document.body.appendChild(counterElement);
    }
    
    const count = this.photoCollection.length;
    const required = this.requiredPhotos;
    counterElement.textContent = `${count}/${required} 📸`;
    
    if (count >= required) {
      counterElement.className = counterElement.className.replace('bg-green-500', 'bg-orange-500');
      counterElement.innerHTML = `${count}/${required} 🎁 ¡Listo!`;
    }
  }
  checkForPointExchange() {
    console.log('🔍 Verificando si se puede canjear puntos:', {
      fotosRecolectadas: this.photoCollection.length,
      fotosNecesarias: this.requiredPhotos,
      puedeCanjar: this.canExchangePoints,
      existeBoton: !!document.getElementById('exchange-button')
    });
    
    if (this.photoCollection.length >= this.requiredPhotos && !document.getElementById('exchange-button')) {
      console.log('✅ Mostrando botón de canje de puntos');
      this.showExchangeButton();
    }
  }

  showExchangeButton() {
    // Crear botón de canje que aparece después del resultado
    const exchangeContainer = document.createElement('div');
    exchangeContainer.id = 'exchange-container';
    exchangeContainer.className = 'bg-gradient-to-r from-orange-400 to-red-500 rounded-xl p-6 shadow-lg mt-4 text-center';
    
    exchangeContainer.innerHTML = `
      <div class="flex items-center justify-center mb-4">
        <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center mr-3">
          <i class="fas fa-gift text-orange-500 text-xl"></i>
        </div>
        <div>
          <h3 class="text-white font-bold text-lg">¡Felicidades!</h3>
          <p class="text-orange-100 text-sm">Has clasificado ${this.photoCollection.length} materiales</p>
        </div>
      </div>
      <button id="exchange-button" class="w-full bg-white text-orange-600 font-bold py-4 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg">
        <i class="fas fa-trophy mr-2"></i>
        ¡Canjear Puntos y Aprender!
      </button>
    `;
    
    // Insertar después del área del escáner
    const scannerSection = document.querySelector('#scanner-tab .bg-white.rounded-xl');
    scannerSection.parentNode.insertBefore(exchangeContainer, scannerSection.nextSibling);
    
    // Event listener para el botón
    document.getElementById('exchange-button').addEventListener('click', () => {
      this.startPointExchange();
    });
    
    // Animación de entrada
    exchangeContainer.classList.add('fade-in');
  }  transformBackendResponse(backendResult) {
    // Transformar respuesta del backend al formato esperado por la UI
    // El backend devuelve: { predicted_class: "metal", confidence: 0.95 }
    const categoria = backendResult?.predicted_class || backendResult?.categoria || 'desconocido';
    const confianza = backendResult?.confidence || backendResult?.confianza || 0;
    
    console.log('🔄 Transformando respuesta del backend:', {
      backendResult,
      categoria,
      confianza
    });
    
    // Mapeo completo de categorías del backend a nuestro sistema de contenedores
    const categoryMapping = {
      // Plásticos - Contenedor Azul
      'plastic': { 
        item: 'Plástico', 
        bin: 'Azul (Aprovechables)', 
        binColor: 'bg-blue-500-bin', 
        instructions: 'Lava el envase de plástico y retira las etiquetas antes de depositarlo en la caneca azul.', 
        points: 5 
      },
      'plastic_bottle': { 
        item: 'Botella de plástico', 
        bin: 'Azul (Aprovechables)', 
        binColor: 'bg-blue-500-bin', 
        instructions: 'Lava la botella y retira la tapa antes de depositarla en la caneca azul.', 
        points: 5 
      },
      
      // Papel y cartón - Contenedor Gris
      'paper': { 
        item: 'Papel', 
        bin: 'Gris (Papel y cartón)', 
        binColor: 'bg-gray-500', 
        instructions: 'Asegúrate de que esté limpio y seco. Deposita en caneca gris.', 
        points: 3 
      },
      'cardboard': { 
        item: 'Cartón', 
        bin: 'Gris (Papel y cartón)', 
        binColor: 'bg-gray-500', 
        instructions: 'Asegúrate de que esté limpio y seco. Aplana las cajas antes de depositar en caneca gris.', 
        points: 3 
      },
      
      // Vidrio - Contenedor Blanco
      'glass': { 
        item: 'Vidrio', 
        bin: 'Blanco (Aprovechables)', 
        binColor: 'bg-white-bin', 
        instructions: 'Lava el vidrio y deposita en caneca blanca. ¡Cuidado con los fragmentos!', 
        points: 4 
      },
      'glass_bottle': { 
        item: 'Botella de vidrio', 
        bin: 'Blanco (Aprovechables)', 
        binColor: 'bg-white-bin', 
        instructions: 'Lava la botella de vidrio y deposita en caneca blanca.', 
        points: 4 
      },
      
      // Orgánicos - Contenedor Verde
      'organic': { 
        item: 'Residuo orgánico', 
        bin: 'Verde (Orgánicos)', 
        binColor: 'bg-green-500-bin', 
        instructions: 'Perfecto para compostaje. Deposita en caneca verde.', 
        points: 2 
      },
      'food_waste': { 
        item: 'Residuo de comida', 
        bin: 'Verde (Orgánicos)', 
        binColor: 'bg-green-500-bin', 
        instructions: 'Ideal para compostaje. Deposita en caneca verde.', 
        points: 2 
      },
      
      // Metales - Contenedor Azul
      'metal': { 
        item: 'Metal', 
        bin: 'Azul (Aprovechables)', 
        binColor: 'bg-blue-500-bin', 
        instructions: 'Lava el objeto de metal y deposita en caneca azul para reciclaje.', 
        points: 4 
      },
      'aluminum': { 
        item: 'Aluminio', 
        bin: 'Azul (Aprovechables)', 
        binColor: 'bg-blue-500-bin', 
        instructions: 'Lava el aluminio y deposita en caneca azul para reciclaje.', 
        points: 4 
      },
      'can': { 
        item: 'Lata', 
        bin: 'Azul (Aprovechables)', 
        binColor: 'bg-blue-500-bin', 
        instructions: 'Lava la lata y deposita en caneca azul para reciclaje.', 
        points: 4 
      },
      
      // No reciclables - Contenedor Negro
      'non_recyclable': { 
        item: 'Residuo no reciclable', 
        bin: 'Negro (No aprovechables)', 
        binColor: 'bg-black', 
        instructions: 'Este residuo no es reciclable. Deposita en caneca negra.', 
        points: 0 
      },
      'trash': { 
        item: 'Basura común', 
        bin: 'Negro (No aprovechables)', 
        binColor: 'bg-black', 
        instructions: 'Este residuo no se puede reciclar. Deposita en caneca negra.', 
        points: 0 
      }
    };
    
    // Buscar coincidencia exacta primero
    let mappedResult = categoryMapping[categoria.toLowerCase()];
    
    // Si no hay coincidencia exacta, buscar coincidencia parcial
    if (!mappedResult) {
      console.log('🔍 Buscando coincidencia parcial para:', categoria.toLowerCase());
      for (const [key, value] of Object.entries(categoryMapping)) {
        if (categoria.toLowerCase().includes(key) || key.includes(categoria.toLowerCase())) {
          mappedResult = value;
          console.log('✅ Coincidencia parcial encontrada:', key);
          break;
        }
      }
    }
    
    // Si aún no hay coincidencia, crear una respuesta por defecto
    if (!mappedResult) {
      console.log('⚠️ No se encontró coincidencia, usando categoría por defecto');
      mappedResult = {
        item: categoria || 'Objeto no identificado',
        bin: 'Negro (No aprovechables)',
        binColor: 'bg-black',
        instructions: 'No se pudo determinar el tipo de reciclaje. Por precaución, deposita en caneca negra.',
        points: 0
      };
    }
    
    const result = {
      ...mappedResult,
      confidence: confianza,
      originalCategory: categoria,
      recyclable: mappedResult.points > 0
    };
      console.log('✅ Resultado transformado final:', result);
    return result;
  }

  // ================= PANEL DINÁMICO DE CLASIFICACIONES ===========================
  
  async updateClassificationsPanel() {
    console.log('🔄 Actualizando panel de clasificaciones...');
    
    try {
      // Obtener todas las clasificaciones del servidor
      const response = await fetch(`${this.CLASIFICACIONES_API}`);
      const data = await response.json();
      
      console.log(`📊 Total clasificaciones en servidor: ${data.total}`, data.clasificaciones);
      this.currentClassifications = data.clasificaciones || [];
      
      // Crear o actualizar el panel dinámico
      this.createClassificationsPanel();
      
      // Verificar si se puede mostrar el formulario
      this.checkFormAvailability();
      
    } catch (error) {
      console.error('❌ Error al actualizar panel de clasificaciones:', error);
    }
  }

  createClassificationsPanel() {
    // Buscar o crear contenedor del panel
    let panel = document.getElementById('classifications-panel');
    
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'classifications-panel';
      panel.className = 'bg-white rounded-xl p-4 shadow-lg mt-4 fade-in';
      
      // Insertar después del panel de resultados
      const scanResult = document.getElementById('scan-result');
      if (scanResult && scanResult.parentNode) {
        scanResult.parentNode.insertBefore(panel, scanResult.nextSibling);
      }
    }

    // Título del panel
    const title = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-gray-800 flex items-center">
          <i class="fas fa-camera mr-2 text-green-500"></i>
          Clasificaciones Recientes
        </h3>
        <span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
          ${this.currentClassifications.length} fotos
        </span>
      </div>
    `;

    // Obtener las últimas 5 clasificaciones para mostrar
    const recentClassifications = this.currentClassifications.slice(-5).reverse();
    
    if (recentClassifications.length === 0) {
      panel.innerHTML = title + `
        <div class="text-center py-4">
          <i class="fas fa-camera text-gray-300 text-3xl mb-2"></i>
          <p class="text-gray-500">No hay clasificaciones aún</p>
          <p class="text-gray-400 text-sm">Toma una foto para empezar</p>
        </div>
      `;
      return;
    }

    // Generar lista de clasificaciones
    const classificationsHTML = recentClassifications.map((item, index) => {
      const isLatest = index === 0;
      const material = item.categoria || item.predicted_class || 'Desconocido';
      const confidence = item.confianza || item.confidence || 0;
      const timestamp = item.fecha ? new Date(item.fecha).toLocaleTimeString() : 'Ahora';
      
      // Determinar color e icono basado en el material
      const materialInfo = this.getMaterialInfo(material);
      
      return `
        <div class="flex items-center p-3 rounded-lg border ${isLatest ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'} mb-2 transition-all hover:shadow-md">
          <div class="w-10 h-10 ${materialInfo.bgColor} rounded-full flex items-center justify-center mr-3 flex-shrink-0">
            <i class="${materialInfo.icon} text-white text-sm"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h4 class="font-medium text-gray-800 capitalize truncate">${material}</h4>
              ${isLatest ? '<span class="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium ml-2">Nuevo</span>' : ''}
            </div>
            <div class="flex items-center justify-between text-sm text-gray-600">
              <span>Confianza: ${Math.round(confidence * 100)}%</span>
              <span>${timestamp}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    panel.innerHTML = title + `
      <div class="space-y-2">
        ${classificationsHTML}
      </div>
    `;
  }

  getMaterialInfo(material) {
    const materialLower = material.toLowerCase();
    
    if (materialLower.includes('papel') || materialLower.includes('paper')) {
      return { bgColor: 'bg-gray-500', icon: 'fas fa-file-alt' };
    } else if (materialLower.includes('plastic') || materialLower.includes('plastico')) {
      return { bgColor: 'bg-blue-500', icon: 'fas fa-recycle' };
    } else if (materialLower.includes('metal') || materialLower.includes('aluminum')) {
      return { bgColor: 'bg-blue-600', icon: 'fas fa-cog' };
    } else if (materialLower.includes('glass') || materialLower.includes('vidrio')) {
      return { bgColor: 'bg-blue-300', icon: 'fas fa-wine-glass' };
    } else if (materialLower.includes('organic') || materialLower.includes('organico')) {
      return { bgColor: 'bg-green-500', icon: 'fas fa-leaf' };
    } else {
      return { bgColor: 'bg-gray-400', icon: 'fas fa-question' };
    }
  }

  async checkFormAvailability() {
    console.log('🔍 Verificando disponibilidad del formulario...');
    
    // Verificar si hay 3 o más clasificaciones
    if (this.currentClassifications.length >= 3) {
      this.showFormAccessButton();
    } else {
      this.hideFormAccessButton();
    }
  }
  showFormAccessButton() {
    // Buscar si ya existe el botón
    let button = document.getElementById('form-access-button');
    
    if (!button) {
      button = document.createElement('div');
      button.id = 'form-access-button';
      button.className = 'mt-4 fade-in';
      
      // Insertar después del panel de clasificaciones o después del panel del modelo si no hay clasificaciones
      const classPanel = document.getElementById('classifications-panel');
      const modelPanel = document.getElementById('model-response-panel');
      const insertAfter = classPanel || modelPanel;
      
      if (insertAfter && insertAfter.parentNode) {
        insertAfter.parentNode.insertBefore(button, insertAfter.nextSibling);
      }
    }

    const totalPhotos = this.photoCollection.length;
    const recentPhotos = this.photoCollection.slice(-3);
    
    button.innerHTML = `
      <div class="bg-gradient-to-r from-green-400 to-blue-500 rounded-xl p-6 shadow-lg text-center">
        <div class="flex items-center justify-center mb-4">
          <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center mr-3">
            <i class="fas fa-clipboard-list text-green-500 text-xl"></i>
          </div>
          <div class="text-left">
            <h3 class="text-white font-bold text-lg">¡Formulario Disponible!</h3>
            <p class="text-green-100 text-sm">Tienes ${totalPhotos} clasificaciones</p>
          </div>
        </div>
        
        <p class="text-white mb-4 text-sm">
          Responde un breve cuestionario sobre tus últimas clasificaciones y gana puntos extra
        </p>
        
        <div class="flex flex-wrap justify-center gap-2 mb-4">
          ${recentPhotos.map(photo => {
            const material = photo.classification?.predicted_class || 
                           photo.transformedResult?.item || 
                           'Desconocido';
            const materialInfo = this.getMaterialInfo(material);
            return `
              <span class="bg-white bg-opacity-20 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center">
                <i class="${materialInfo.icon} mr-1"></i>
                ${material}
              </span>
            `;
          }).join('')}
        </div>
        
        <button 
          onclick="app.openSurveyForm()" 
          class="bg-white hover:bg-gray-100 text-green-600 font-bold py-3 px-8 rounded-lg transition-all transform hover:scale-105 shadow-lg">
          <i class="fas fa-play mr-2"></i>
          Abrir Formulario
        </button>
      </div>
    `;
  }

  hideFormAccessButton() {
    const button = document.getElementById('form-access-button');
    if (button) {
      button.classList.add('fade-out');
      setTimeout(() => {
        if (button.parentNode) {
          button.remove();
        }
      }, 300);
    }
  }
  async openSurveyForm() {
    console.log('📋 Abriendo formulario de encuesta...');
    
    // Usar las clasificaciones de photoCollection directamente
    const recentPhotos = this.photoCollection.slice(-3);
    const classifications = recentPhotos.map(photo => ({
      categoria: photo.classification?.predicted_class || photo.transformedResult?.item,
      predicted_class: photo.classification?.predicted_class || photo.transformedResult?.item,
      confianza: photo.classification?.confidence || 0.8,
      confidence: photo.classification?.confidence || 0.8,
      fecha: photo.timestamp || new Date().toISOString()
    }));
    
    console.log('📋 Clasificaciones para formulario:', classifications);
    
    // Crear modal del formulario
    this.createSurveyModal(classifications);
  }
  // NUEVO: Sistema de canje de puntos con mini-encuesta educativa
  async startPointExchange() {
    // Remover botón de intercambio
    const exchangeContainer = document.getElementById('exchange-container');
    if (exchangeContainer) {
      exchangeContainer.remove();
    }

    // Obtener clasificaciones recientes para la encuesta
    try {
      const response = await fetch(`${this.CLASIFICACIONES_API}/filtradas?limite=3`);
      const data = await response.json();
      const classifications = data.clasificaciones || this.currentClassifications.slice(-3);
      
      // Crear modal de encuesta con clasificaciones reales
      this.createSurveyModal(classifications);
    } catch (error) {
      console.error('Error al obtener clasificaciones:', error);
      // Fallback con datos locales
      this.createSurveyModal(this.photoCollection.slice(-3));
    }
  }

  createSurveyModal(classifications = []) {
    // Generar preguntas basadas en las clasificaciones reales
    const questions = this.generateSurveyQuestions(classifications);
    
    // Crear modal
    const modal = document.createElement('div');
    modal.id = 'survey-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-gradient-to-r from-green-400 to-blue-500 text-white p-6 rounded-t-2xl">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold">🎓 Mini Quiz GreenScanner</h2>
              <p class="text-green-100 text-sm">¡Aprende y gana puntos bonus!</p>
            </div>
            <button id="close-survey" class="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2">
              <i class="fas fa-times"></i>
            </button>
          </div>
        </div>
        
        <div class="p-6">
          <div class="mb-6 text-center">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-brain text-green-500 text-2xl"></i>
            </div>
            <p class="text-gray-600 text-sm">
              Responde ${questions.length} preguntas sobre los materiales que has clasificado para ganar 
              <strong class="text-green-600">${questions.length * 2} puntos bonus</strong>
            </p>
          </div>
          
          <form id="survey-form">
            ${questions.map((q, index) => `
              <div class="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 class="font-semibold text-gray-800 mb-3 flex items-center">
                  <span class="bg-green-500 text-white text-xs px-2 py-1 rounded-full mr-2">${index + 1}</span>
                  ${q.question}
                </h3>
                ${q.options.map((option, optIndex) => `
                  <label class="block mb-2 cursor-pointer">
                    <input type="radio" name="q${index}" value="${optIndex}" class="mr-2">
                    <span class="text-gray-700">${option}</span>
                  </label>
                `).join('')}
              </div>
            `).join('')}
            
            <div class="flex gap-3">
              <button type="button" id="cancel-survey" class="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-300 transition-colors">
                Cancelar
              </button>
              <button type="submit" class="flex-1 bg-green-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-600 transition-colors">
                <i class="fas fa-check mr-2"></i>
                Completar Quiz
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    document.getElementById('close-survey').addEventListener('click', () => {
      this.closeSurveyModal();
    });
    
    document.getElementById('cancel-survey').addEventListener('click', () => {
      this.closeSurveyModal();
    });
    
    document.getElementById('survey-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.processSurveyAnswers(questions);
    });

    // Animación de entrada
    setTimeout(() => modal.classList.add('fade-in'), 100);
  }

  generateSurveyQuestions(classifications = []) {
    const questions = [];
    
    console.log('📝 Generando preguntas para clasificaciones:', classifications);
    
    // Crear preguntas específicas basadas en las clasificaciones reales
    const uniqueMaterials = [...new Set(classifications.map(c => 
      c.categoria || c.predicted_class || 'desconocido'
    ))];
    
    console.log('📝 Materiales únicos encontrados:', uniqueMaterials);
    
    // Preguntas específicas por material clasificado
    uniqueMaterials.forEach((material, index) => {
      const materialQuestions = this.getMaterialSpecificQuestions(material.toLowerCase());
      if (materialQuestions.length > 0) {
        // Agregar una pregunta aleatoria para cada material
        const randomQuestion = materialQuestions[Math.floor(Math.random() * materialQuestions.length)];
        questions.push({
          id: index + 1,
          question: randomQuestion.text,
          options: randomQuestion.options,
          correct: randomQuestion.correctAnswer,
          explanation: randomQuestion.explanation,
          material: material
        });
      }
    });
    
    // Si no hay suficientes preguntas específicas, agregar preguntas generales
    while (questions.length < 3) {
      const generalQuestions = this.getGeneralRecyclingQuestions();
      const randomGeneral = generalQuestions[Math.floor(Math.random() * generalQuestions.length)];
      
      // Evitar duplicados
      if (!questions.some(q => q.question === randomGeneral.question)) {
        questions.push({
          id: questions.length + 1,
          ...randomGeneral,
          material: 'general'
        });
      }
    }
    
    // Limitar a máximo 5 preguntas
    return questions.slice(0, 5);
  }

  getMaterialSpecificQuestions(material) {
    const materialQuestions = {
      'papel': [
        {
          text: `Acabas de clasificar papel. ¿Cuál es la forma correcta de reciclarlo?`,
          options: [
            'Mojarlo antes de tirarlo',
            'Asegurarse de que esté limpio y seco',
            'Mezclarlo con restos de comida',
            'Quemarlo en casa'
          ],
          correctAnswer: 1,
          explanation: 'El papel debe estar limpio y seco para poder reciclarse correctamente. La humedad y los restos de comida contaminan el proceso de reciclaje.'
        },
        {
          text: `Has identificado papel correctamente. ¿En qué contenedor va?`,
          options: [
            'Contenedor azul (plásticos)',
            'Contenedor verde (orgánicos)', 
            'Contenedor gris (papel y cartón)',
            'Contenedor negro (basura)'
          ],
          correctAnswer: 2,
          explanation: 'El papel y cartón van en el contenedor gris para su posterior reciclaje.'
        }
      ],
      'paper': [
        {
          text: `You just classified paper. What's the correct way to recycle it?`,
          options: [
            'Wet it before throwing away',
            'Make sure it\'s clean and dry',
            'Mix it with food waste',
            'Burn it at home'
          ],
          correctAnswer: 1,
          explanation: 'Paper must be clean and dry to be recycled correctly. Moisture and food waste contaminate the recycling process.'
        }
      ],
      'metal': [
        {
          text: `Has clasificado metal correctamente. ¿Qué debes hacer antes de reciclarlo?`,
          options: [
            'Pintarlo de otro color',
            'Lavarlo para quitar residuos',
            'Doblarlo por la mitad',
            'Dejarlo al sol por un día'
          ],
          correctAnswer: 1,
          explanation: 'Es importante lavar los envases metálicos para eliminar residuos antes del reciclaje, esto mejora la calidad del material reciclado.'
        },
        {
          text: `Detectaste metal. ¿Cuántas veces se puede reciclar el aluminio?`,
          options: [
            'Solo una vez',
            'Máximo 3 veces',
            'Hasta 10 veces',
            'Infinitas veces'
          ],
          correctAnswer: 3,
          explanation: 'El aluminio puede reciclarse infinitas veces sin perder sus propiedades, siendo uno de los materiales más sostenibles.'
        }
      ],
      'plastic': [
        {
          text: `Clasificaste plástico. ¿Qué significa el número dentro del símbolo de reciclaje?`,
          options: [
            'Las veces que se ha reciclado',
            'El tipo de plástico',
            'El año de fabricación',
            'El tamaño del envase'
          ],
          correctAnswer: 1,
          explanation: 'Los números del 1 al 7 indican el tipo de plástico y determinan si se puede reciclar y cómo hacerlo.'
        }
      ],
      'plastico': [
        {
          text: `Identificaste plástico correctamente. ¿Cuál es el principal problema del plástico en el océano?`,
          options: [
            'Cambia el color del agua',
            'Se convierte en microplásticos tóxicos',
            'Hace que el agua esté más fría',
            'Atrae más peces'
          ],
          correctAnswer: 1,
          explanation: 'El plástico se descompone en microplásticos que contaminan la cadena alimentaria marina y llegan hasta nuestros alimentos.'
        }
      ],
      'glass': [
        {
          text: `Has identificado vidrio. ¿Cuánto tiempo tarda en descomponerse en la naturaleza?`,
          options: [
            'Unos pocos meses',
            'Entre 1-5 años',
            'Aproximadamente 100 años',
            'Más de 1000 años'
          ],
          correctAnswer: 3,
          explanation: 'El vidrio puede tardar más de 1000 años en descomponerse naturalmente, por eso es crucial reciclarlo.'
        }
      ],
      'vidrio': [
        {
          text: `Clasificaste vidrio correctamente. ¿Se puede reciclar vidrio infinitas veces?`,
          options: [
            'No, solo 2-3 veces',
            'Sí, sin perder calidad',
            'Solo si está limpio',
            'Depende del color'
          ],
          correctAnswer: 1,
          explanation: 'El vidrio es 100% reciclable y puede reciclarse infinitas veces sin perder calidad ni pureza.'
        }
      ],
      'organic': [
        {
          text: `Detectaste residuo orgánico. ¿Cuál es el mejor destino para este material?`,
          options: [
            'Tirarlo a la basura común',
            'Compostaje para hacer abono',
            'Quemarlo al aire libre',
            'Enterrarlo en cualquier lugar'
          ],
          correctAnswer: 1,
          explanation: 'Los residuos orgánicos pueden convertirse en compost, un excelente fertilizante natural que enriquece el suelo.'
        }
      ],
      'organico': [
        {
          text: `Identificaste residuo orgánico. ¿Qué porcentaje de la basura doméstica son residuos orgánicos?`,
          options: [
            'Aproximadamente 10%',
            'Cerca del 25%',
            'Alrededor del 40-50%',
            'Más del 80%'
          ],
          correctAnswer: 2,
          explanation: 'Los residuos orgánicos representan entre 40-50% de la basura doméstica, por eso es tan importante separarlos correctamente.'
        }
      ]
    };
    
    return materialQuestions[material] || [];
  }

  getGeneralRecyclingQuestions() {
    return [
      {
        question: '¿Cuál es la regla de las 3 R del reciclaje?',
        options: [
          'Reducir, Reutilizar, Reciclar',
          'Recoger, Reunir, Reciclar',
          'Revisar, Reparar, Reutilizar',
          'Reemplazar, Renovar, Reciclar'
        ],
        correct: 0,
        explanation: 'Las 3 R son: Reducir el consumo, Reutilizar objetos y Reciclar materiales.'
      },
      {
        question: '¿Cuánto tiempo tarda una botella de plástico en descomponerse?',
        options: [
          '1-5 años',
          '10-50 años',
          '100-450 años',
          '1000 años'
        ],
        correct: 2,
        explanation: 'Las botellas de plástico tardan entre 100-450 años en degradarse, por eso es crucial reciclarlas.'
      },
      {
        question: '¿Qué color de contenedor se usa típicamente para papel y cartón?',
        options: [
          'Verde',
          'Azul',
          'Gris',
          'Amarillo'
        ],
        correct: 2,
        explanation: 'El contenedor gris se utiliza para papel y cartón en muchos sistemas de reciclaje.'
      },
      {
        question: '¿Cuál es el principal beneficio del reciclaje?',
        options: [
          'Reducir la contaminación y conservar recursos',
          'Solo ahorrar dinero',
          'Crear más empleos únicamente',
          'Hacer que las ciudades se vean mejor'
        ],
        correct: 0,
        explanation: 'El reciclaje reduce la contaminación, conserva recursos naturales y protege el medio ambiente.'
      },
      {
        question: '¿Qué porcentaje de una lata de aluminio puede reciclarse?',
        options: [
          '50%',
          '75%',
          '90%',
          '100%'
        ],
        correct: 3,
        explanation: 'Las latas de aluminio se pueden reciclar al 100% y el proceso ahorra hasta 95% de energía.'
      }
    ];
  }

  async processSurveyAnswers(questions) {
    const form = document.getElementById('survey-form');
    const formData = new FormData(form);
    
    let correctAnswers = 0;
    let totalQuestions = questions.length;
    let results = [];

    // Verificar respuestas
    questions.forEach((question, index) => {
      const userAnswer = parseInt(formData.get(`q${index}`));
      const isCorrect = userAnswer === question.correct;
      
      if (isCorrect) correctAnswers++;
      
      results.push({
        question: question.question,
        userAnswer: userAnswer,
        correctAnswer: question.correct,
        isCorrect: isCorrect,
        explanation: question.explanation,
        userAnswerText: question.options[userAnswer] || 'Sin respuesta',
        correctAnswerText: question.options[question.correct]
      });
    });

    // Calcular puntos (2 puntos por respuesta correcta)
    const bonusPoints = correctAnswers * 2;
    
    // Mostrar resultados
    this.showSurveyResults(results, bonusPoints, correctAnswers, totalQuestions);
    
    // Agregar puntos al backend si obtuvo al menos 1 respuesta correcta
    if (bonusPoints > 0) {
      await this.addBonusPoints(bonusPoints);
    }

    // Limpiar la colección de fotos para el siguiente ciclo
    this.resetPhotoCollection();
  }

  showSurveyResults(results, bonusPoints, correctAnswers, totalQuestions) {
    const modal = document.getElementById('survey-modal');
    const percentage = Math.round((correctAnswers / totalQuestions) * 100);
    
    // Determinar mensaje y emoji según el rendimiento
    let performanceMessage = '';
    let performanceEmoji = '';
    let performanceColor = '';
    
    if (percentage >= 80) {
      performanceMessage = '¡Excelente conocimiento sobre reciclaje!';
      performanceEmoji = '🏆';
      performanceColor = 'text-yellow-600';
    } else if (percentage >= 60) {
      performanceMessage = '¡Buen trabajo! Sigues aprendiendo.';
      performanceEmoji = '👍';
      performanceColor = 'text-green-600';
    } else {
      performanceMessage = '¡Sigue practicando! Cada paso cuenta.';
      performanceEmoji = '💪';
      performanceColor = 'text-blue-600';
    }

    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div class="sticky top-0 bg-gradient-to-r from-purple-400 to-pink-500 text-white p-6 rounded-t-2xl">
          <div class="text-center">
            <div class="text-4xl mb-2">${performanceEmoji}</div>
            <h2 class="text-xl font-bold">¡Quiz Completado!</h2>
            <p class="text-purple-100 text-sm">Resultados de tu aprendizaje</p>
          </div>
        </div>
        
        <div class="p-6">
          <!-- Resumen de puntos -->
          <div class="bg-green-50 rounded-lg p-4 mb-6 text-center">
            <div class="text-3xl font-bold text-green-600 mb-2">+${bonusPoints} puntos</div>
            <p class="text-gray-600 text-sm">Has ganado puntos bonus por aprender</p>
            <div class="mt-3">
              <div class="text-lg font-semibold ${performanceColor}">${correctAnswers}/${totalQuestions} correctas (${percentage}%)</div>
              <p class="text-gray-600 text-sm">${performanceMessage}</p>
            </div>
          </div>

          <!-- Resultados detallados -->
          <div class="space-y-4 mb-6">
            <h3 class="font-semibold text-gray-800 mb-3">📚 Resultados y Aprendizaje:</h3>
            ${results.map((result, index) => `
              <div class="border rounded-lg p-4 ${result.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
                <div class="flex items-center mb-2">
                  <span class="text-xl mr-2">${result.isCorrect ? '✅' : '❌'}</span>
                  <span class="font-medium text-sm text-gray-700">Pregunta ${index + 1}</span>
                </div>
                
                <p class="text-gray-800 text-sm mb-3">${result.question}</p>
                
                <div class="space-y-2 text-xs">
                  <div class="flex">
                    <span class="font-medium text-gray-600 w-20">Tu respuesta:</span>
                    <span class="${result.isCorrect ? 'text-green-600' : 'text-red-600'}">${result.userAnswerText}</span>
                  </div>
                  ${!result.isCorrect ? `
                    <div class="flex">
                      <span class="font-medium text-gray-600 w-20">Correcta:</span>
                      <span class="text-green-600">${result.correctAnswerText}</span>
                    </div>
                  ` : ''}
                  <div class="mt-2 p-2 bg-blue-50 rounded text-blue-800 text-xs">
                    <strong>💡 Dato interesante:</strong> ${result.explanation}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Botones finales -->
          <div class="flex gap-3">
            <button id="continue-scanning" class="flex-1 bg-green-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-600 transition-colors">
              <i class="fas fa-camera mr-2"></i>
              Seguir Escaneando
            </button>
            <button id="view-rewards" class="flex-1 bg-purple-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-purple-600 transition-colors">
              <i class="fas fa-gift mr-2"></i>
              Ver Premios
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners para botones finales
    document.getElementById('continue-scanning').addEventListener('click', () => {
      this.closeSurveyModal();
      this.switchTab('scanner');
    });

    document.getElementById('view-rewards').addEventListener('click', () => {
      this.closeSurveyModal(); 
      this.switchTab('rewards');
    });
  }

  async addBonusPoints(points) {
    try {
      const correo = localStorage.getItem('userEmail');
      if (!correo) return;

      await fetch(`${API_BASE}/puntos/agregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          correo, 
          puntos: points,
          detalle: `Quiz educativo completado (+${points} pts bonus)`
        })
      });

      // Actualizar puntos locales y backend
      await this.fetchPoints();
      await this.loadHistoryFromBackend();
      
      this.showNotification(`¡${points} puntos bonus ganados por aprender!`, 'success');
      
    } catch (error) {
      console.warn('Error al agregar puntos bonus:', error);
      this.showNotification('Puntos ganados localmente', 'warning');
    }
  }

  resetPhotoCollection() {
    // Reiniciar el sistema de colección para el siguiente ciclo
    this.photoCollection = [];
    this.canExchangePoints = false;
    
    // Actualizar contador visual
    this.updatePhotoCounter();
    
    // Remover contador después de un momento
    setTimeout(() => {
      const counter = document.getElementById('photo-counter');
      if (counter) {
        counter.remove();
      }
    }, 3000);
    
    this.showNotification('¡Sistema reiniciado! Puedes comenzar una nueva colección de fotos.', 'info');
  }

  closeSurveyModal() {
    const modal = document.getElementById('survey-modal');
    if (modal) {
      modal.classList.add('fade-out');
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  }
}





// --- Helpers para historial ---
function parseDeltaFromDetalle(accion, detalle) {
  // Para "escaneo": ejemplo "+5 puntos por reciclaje"
  // Para "canje":   ejemplo "Gastó 150 pts por: Entrada cine"
  if (!detalle) return 0;
  let m;
  if (accion === 'escaneo') {
    m = detalle.match(/\+(\d+)\s*puntos?/i);
    return m ? parseInt(m[1], 10) : 0;
  }
  if (accion === 'canje') {
    m = detalle.match(/gast[oó]\s+(\d+)\s*pts/i);
    return m ? -parseInt(m[1], 10) : 0;
  }
  // fallback genérico: busca número con signo
  m = detalle.match(/([+-]?\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function formatFecha(fechaISO) {
  try {
    const d = new Date(fechaISO);
    if (isNaN(d)) return 'Ahora';
    return d.toLocaleString();
  } catch { return 'Ahora'; }
}


// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new EcoRecycleApp();
});
