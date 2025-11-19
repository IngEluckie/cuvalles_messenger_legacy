export class WebSockets {
    /**
     * Constructor de la clase WebSockets.
     * @param {string} url - URL del endpoint WebSocket (ej: ws://127.0.0.1:8000/ws)
     */
    constructor(url) {
      this.url = url;
      this.ws = null;
      // Array de callbacks que se ejecutarán cuando se reciba un mensaje.
      this.onMessageCallbacks = [];
      this.connect();
    }
  
    /**
     * Conecta al servidor WebSocket y configura los manejadores de eventos.
     */
    connect() {
      this.ws = new WebSocket(this.url);
  
      this.ws.onopen = () => {
        console.log("WebSocket conectado:", this.url);
      };
  
      this.ws.onmessage = (event) => {
        let data;
        try {
          data = JSON.parse(event.data);
        } catch (error) {
          console.error("Error al parsear mensaje WebSocket:", error);
          return;
        }
        // Ejecuta todos los callbacks registrados con el mensaje recibido.
        this.onMessageCallbacks.forEach(callback => callback(data));
      };
  
      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
  
      this.ws.onclose = (event) => {
        console.log("WebSocket cerrado:", event);
        // Aquí se podría implementar lógica de reconexión automática si se desea.
      };
    }
  
    /**
     * Envía un mensaje a través del WebSocket.
     * @param {Object|string} message - Mensaje a enviar. Si no es string, se convierte a JSON.
     */
    sendMessage(message) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const msgStr = typeof message === "string" ? message : JSON.stringify(message);
        this.ws.send(msgStr);
      } else {
        console.error("No se puede enviar el mensaje. La conexión WebSocket no está abierta.");
      }
    }
  
    /**
     * Registra un callback que se ejecutará cuando se reciba un mensaje.
     * @param {Function} callback - Función a ejecutar con el mensaje recibido.
     */
    registerOnMessageCallback(callback) {
      if (typeof callback === "function") {
        this.onMessageCallbacks.push(callback);
      }
    }
  
    /**
     * Remueve un callback registrado previamente.
     * @param {Function} callback - Función a remover.
     */
    unregisterOnMessageCallback(callback) {
      const index = this.onMessageCallbacks.indexOf(callback);
      if (index !== -1) {
        this.onMessageCallbacks.splice(index, 1);
      }
    }

    /**
     * Retorna el estado de conexión del WebSocket.
     * @returns {boolean} true si la conexión está abierta, false en caso contrario.
     */
    isConnected() {
      return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

  }
  