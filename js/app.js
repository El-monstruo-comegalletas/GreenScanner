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

// === Config API (frontend) ===
const API_BASE = API_BASE_URL;   // Usamos la misma constante para consistencia

// Helper seguro para asignar texto (evita ?.textContent en LHS)
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

class EcoRecycleApp {

  constructor() {
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

    // --- LÓGICA DE ESCANEO ---
    const scanBtn = document.getElementById('scan-btn');
    const captureBtn = document.getElementById('capture-btn');
    const cameraInput = document.getElementById('camera-input');
    const voiceBtn = document.getElementById('voice-btn');
    const downloadImageBtn = document.getElementById('download-image-btn');
    const retakeBtn = document.getElementById('retake-btn');

    if (scanBtn) scanBtn.addEventListener('click', () => this.startCamera());
    if (captureBtn) captureBtn.addEventListener('click', () => this.captureAndClassify());
    if (voiceBtn) voiceBtn.addEventListener('click', () => this.toggleVoiceRecognition());
    if (cameraInput) cameraInput.addEventListener('change', (event) => this.handleFileUpload(event));
    if (downloadImageBtn) downloadImageBtn.addEventListener('click', () => this.downloadCapturedImage());
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
    const scanBtn = document.getElementById('scan-btn');
    const captureBtn = document.getElementById('capture-btn');

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
            });

            video.classList.remove('hidden');
            scanPlaceholder.classList.add('hidden');
            scanBtn.classList.add('hidden');
            captureBtn.classList.remove('hidden');
            
            this.showNotification("Cámara activada. Ajusta el objeto y presiona 'Capturar'", "success");
            
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

  async captureAndClassify() {
    const video = document.getElementById('camera-stream');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');

    if (!video.videoWidth || !video.videoHeight) {
        alert("Error: El video no está listo. Intenta de nuevo.");
        return;
    }

    // Ajustar tamaño del canvas al del video para mejor calidad
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibujar el frame actual del video en el canvas con mejor calidad
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Detener el stream de la cámara
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
    }

    // Resetear la UI
    this.resetScannerUI();

    // Mostrar animación de escaneo
    document.getElementById('scanning-animation').classList.remove('hidden');
    document.getElementById('scan-placeholder').classList.add('hidden');
    document.getElementById('scan-result').classList.add('hidden');

    try {
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

        // Mostrar vista previa de la imagen capturada
        this.showCapturedImagePreview();

        this.showNotification("Foto capturada exitosamente. Presiona 'Escanear' para analizar.", "success");

    } catch (error) {
        console.error('Error al capturar la imagen:', error);
        this.showNotification("Error al capturar la imagen. Intenta de nuevo.", "error");
        this.resetScannerUI();
    }
  }

  resetScannerUI() {
      document.getElementById('camera-stream').classList.add('hidden');
      document.getElementById('capture-btn').classList.add('hidden');
      document.getElementById('scan-btn').classList.remove('hidden');
      document.getElementById('scan-placeholder').classList.remove('hidden');
      document.getElementById('scanning-animation').classList.add('hidden');
      document.getElementById('secondary-buttons').classList.add('hidden');
      
      // Limpiar vista previa si existe
      const preview = document.getElementById('image-preview');
      if (preview) {
          preview.remove();
      }
      
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
  }

  showCapturedImagePreview() {
      const scannerArea = document.getElementById('scanner-area');
      
      // Remover vista previa anterior si existe
      const existingPreview = document.getElementById('image-preview');
      if (existingPreview) {
          existingPreview.remove();
      }

      // Crear elemento de vista previa
      const previewContainer = document.createElement('div');
      previewContainer.id = 'image-preview';
      previewContainer.className = 'absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black bg-opacity-75 rounded-lg';
      
      const previewImage = document.createElement('img');
      previewImage.src = this.capturedImage.dataUrl;
      previewImage.className = 'max-w-full max-h-32 object-contain rounded mb-2';
      
      const previewText = document.createElement('p');
      previewText.textContent = 'Imagen capturada - Lista para escanear';
      previewText.className = 'text-white text-sm text-center';
      
      const scanImageBtn = document.createElement('button');
      scanImageBtn.textContent = 'Escanear esta imagen';
      scanImageBtn.className = 'mt-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors';
      scanImageBtn.addEventListener('click', () => this.scanCapturedImage());
      
      previewContainer.appendChild(previewImage);
      previewContainer.appendChild(previewText);
      previewContainer.appendChild(scanImageBtn);
      
      scannerArea.appendChild(previewContainer);
      
      // Mostrar botones secundarios
      document.getElementById('secondary-buttons').classList.remove('hidden');
  }

  async scanCapturedImage() {
      if (!this.capturedImage) {
          this.showNotification("No hay imagen capturada para escanear.", "error");
          return;
      }

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

    const formData = new FormData();
    formData.append('file', file);

    // Mostrar animación
    document.getElementById('scan-placeholder').classList.add('hidden');
    document.getElementById('scanning-animation').classList.remove('hidden');
    document.getElementById('scan-result').classList.add('hidden');

    await this.sendImageForClassification(formData);

    // Limpiar el input para poder tomar la misma foto otra vez
    event.target.value = '';
  }

  async sendImageForClassification(formData) {
    try {
        const response = await fetch(`${API_BASE_URL}/classify`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.statusText}`);
        }

        const result = await response.json();
        this.displayScanResult(result);

    } catch (error) {
        console.error('Error al clasificar la imagen:', error);
        alert('No se pudo conectar con el servidor de IA. Revisa la URL de la API y que el servidor esté funcionando.');
    } finally {
        // Ocultar animación y restaurar placeholder
        document.getElementById('scanning-animation').classList.add('hidden');
        document.getElementById('scan-placeholder').classList.remove('hidden');
    }
  }


  displayScanResult(result) {
      const scanResultEl = document.getElementById('scan-result');
      const resultItem = document.getElementById('result-item');
      const resultBin = document.getElementById('result-bin');
      const resultBinColor = document.getElementById('result-bin-color');
      const resultInstructions = document.getElementById('result-instructions');
      const pointsEarnedSpan = document.getElementById('points-earned');
      const resultPoints = document.getElementById('result-points');

      if (result.error) {
          alert(`Error: ${result.error}`);
          scanResultEl.classList.add('hidden');
          return;
      }

      resultItem.textContent = result.item;
      resultBin.textContent = result.bin;
      resultInstructions.textContent = result.instructions;
      
      // Asignar color a la caneca
      const binColors = {
          'Verde (Orgánicos)': 'bg-green-500',
          'Azul (Aprovechables)': 'bg-blue-500',
          'Negro (No aprovechables)': 'bg-gray-800',
          'Blanco (Aprovechables)': 'bg-gray-200'
      };
      resultBinColor.className = `w-8 h-8 rounded-full mr-3 ${binColors[result.bin] || 'bg-gray-400'}`;

      if (result.points > 0) {
          pointsEarnedSpan.textContent = result.points;
          resultPoints.classList.remove('hidden');
          this.fetchPoints(); // Actualizar puntos del usuario
      } else {
          resultPoints.classList.add('hidden');
      }

      // Almacenar resultado para generar formulario
      this.lastScanResult = result;

      // Generar formulario basado en la respuesta
      this.generateRecyclingForm(result);

      scanResultEl.classList.remove('hidden');
  }

  generateRecyclingForm(result) {
      // Remover formulario anterior si existe
      const existingForm = document.getElementById('recycling-form');
      if (existingForm) {
          existingForm.remove();
      }

      const formContainer = document.createElement('div');
      formContainer.id = 'recycling-form';
      formContainer.className = 'bg-white rounded-xl p-6 shadow-lg mt-4';

      const formHTML = `
          <h3 class="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <i class="fas fa-clipboard-list mr-2 text-blue-500"></i>
              Formulario de Reciclaje
          </h3>
          
          <form id="recycling-data-form" class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Objeto Identificado</label>
                      <input type="text" name="item" value="${result.item || ''}" 
                             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" readonly>
                  </div>
                  
                  <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Contenedor Asignado</label>
                      <input type="text" name="bin" value="${result.bin || ''}" 
                             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" readonly>
                  </div>
                  
                  <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Puntos Obtenidos</label>
                      <input type="number" name="points" value="${result.points || 0}" 
                             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" readonly>
                  </div>
                  
                  <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label>
                      <input type="datetime-local" name="timestamp" value="${new Date().toISOString().slice(0, 16)}" 
                             class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" readonly>
                  </div>
              </div>
              
              <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Instrucciones de Reciclaje</label>
                  <textarea name="instructions" rows="3" 
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500" readonly>${result.instructions || ''}</textarea>
              </div>
              
              <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Ubicación (Opcional)</label>
                  <input type="text" name="location" placeholder="Ej: Casa, Oficina, Parque..."
                         class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500">
              </div>
              
              <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Notas Adicionales (Opcional)</label>
                  <textarea name="notes" rows="2" placeholder="Observaciones adicionales..."
                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"></textarea>
              </div>
              
              <div class="flex space-x-3 pt-4">
                  <button type="submit" class="flex-1 bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                      <i class="fas fa-save mr-2"></i>
                      Guardar Registro
                  </button>
                  
                  <button type="button" id="download-form-btn" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                      <i class="fas fa-download mr-2"></i>
                      Descargar
                  </button>
                  
                  <button type="button" id="share-form-btn" class="px-4 py-3 rounded-lg transition-colors bg-purple-500 hover:bg-purple-600 text-white">
                      <i class="fas fa-share"></i>
                  </button>
              </div>
          </form>
      `;

      formContainer.innerHTML = formHTML;

      // Insertar el formulario después del resultado del escaneo
      const scanResultEl = document.getElementById('scan-result');
      scanResultEl.parentNode.insertBefore(formContainer, scanResultEl.nextSibling);

      // Añadir event listeners
      this.bindFormEvents();
  }

  bindFormEvents() {
      const form = document.getElementById('recycling-data-form');
      const downloadBtn = document.getElementById('download-form-btn');
      const shareBtn = document.getElementById('share-form-btn');

      if (form) {
          form.addEventListener('submit', (e) => this.handleFormSubmit(e));
      }

      if (downloadBtn) {
          downloadBtn.addEventListener('click', () => this.downloadFormData());
      }

      if (shareBtn) {
          shareBtn.addEventListener('click', () => this.shareFormData());
      }
  }

  async handleFormSubmit(event) {
      event.preventDefault();
      
      const formData = new FormData(event.target);
      const data = Object.fromEntries(formData.entries());
      
      // Añadir imagen si está disponible
      if (this.capturedImage) {
          data.imageFilename = this.capturedImage.filename;
          data.imageTimestamp = this.capturedImage.timestamp;
      }

      try {
          // Guardar en localStorage como backup
          const existingRecords = JSON.parse(localStorage.getItem('recyclingRecords') || '[]');
          existingRecords.push({
              ...data,
              id: Date.now(),
              createdAt: new Date().toISOString()
          });
          localStorage.setItem('recyclingRecords', JSON.stringify(existingRecords));

          // Intentar enviar al backend si está disponible
          try {
              const response = await fetch(`${API_BASE_URL}/save-recycling-record`, {
                  method: 'POST',
                  headers: {
                      'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(data),
              });

              if (response.ok) {
                  this.showNotification("Registro guardado exitosamente en el servidor.", "success");
              } else {
                  this.showNotification("Registro guardado localmente. El servidor no está disponible.", "warning");
              }
          } catch (serverError) {
              console.warn("Servidor no disponible, guardado solo localmente:", serverError);
              this.showNotification("Registro guardado localmente.", "success");
          }

      } catch (error) {
          console.error('Error al guardar el registro:', error);
          this.showNotification("Error al guardar el registro.", "error");
      }
  }

  downloadFormData() {
      const form = document.getElementById('recycling-data-form');
      if (!form) return;

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      const jsonData = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `registro_reciclaje_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showNotification("Datos del formulario descargados.", "success");
  }

  shareFormData() {
      const form = document.getElementById('recycling-data-form');
      if (!form) return;

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      const shareText = `🌱 Registro de Reciclaje EcoRecycle\n\n` +
                       `📦 Objeto: ${data.item}\n` +
                       `🗑️ Contenedor: ${data.bin}\n` +
                       `⭐ Puntos: ${data.points}\n` +
                       `📍 Ubicación: ${data.location || 'No especificada'}\n` +
                       `📝 Instrucciones: ${data.instructions}\n\n` +
                       `#EcoRecycle #Reciclaje #MedioAmbiente`;

      if (navigator.share) {
          navigator.share({
              title: 'Registro de Reciclaje - EcoRecycle',
              text: shareText,
          });
      } else {
          // Fallback: copiar al portapapeles
          navigator.clipboard.writeText(shareText).then(() => {
              this.showNotification("Datos copiados al portapapeles.", "success");
          });
      }
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

      this.scanResult = { item: randomItem, ...result };
      this.displayScanResult();

      if (result.recyclable && result.points > 0) {
        // Registrar puntos en backend y refrescar saldos
        const correo = localStorage.getItem("userEmail");
        try {
          await fetch(`${API_BASE}/puntos/agregar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, puntos: result.points })
          });
        } catch (_) {}
        this.addNotification(`¡Bien hecho! +${result.points} puntos por reciclar correctamente`);
        this.addToHistory(randomItem, result.points);
        await this.fetchPoints();  // saldo y total actualizados
        await this.loadHistoryFromBackend();
        this.renderHistory();

      }

      if (anim) anim.classList.add('hidden');
      if (ph) ph.classList.remove('hidden');
      if (scanBtn) scanBtn.removeAttribute('disabled');
      this.isScanning = false;
    }, 2000);
  }

  displayScanResult() {
    const resultDiv = document.getElementById('scan-result');
    if (!resultDiv) return;

    const binColorDiv = document.getElementById('result-bin-color');
    const itemSpan = document.getElementById('result-item');
    const binSpan = document.getElementById('result-bin');
    const instructionsP = document.getElementById('result-instructions');
    const pointsDiv = document.getElementById('result-points');
    const pointsEarnedSpan = document.getElementById('points-earned');

    if (binColorDiv) binColorDiv.className = `w-8 h-8 rounded-full mr-3 ${this.scanResult.binColor}`;
    if (itemSpan) itemSpan.textContent = this.scanResult.item;
    if (binSpan) binSpan.textContent = this.scanResult.bin;
    if (instructionsP) instructionsP.textContent = this.scanResult.instructions;

    if (this.scanResult.recyclable && this.scanResult.points > 0) {
      if (pointsEarnedSpan) pointsEarnedSpan.textContent = this.scanResult.points;
      if (pointsDiv) pointsDiv.classList.remove('hidden');
    } else {
      if (pointsDiv) pointsDiv.classList.add('hidden');
    }

    resultDiv.classList.remove('hidden');
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
  new EcoRecycleApp();
});
