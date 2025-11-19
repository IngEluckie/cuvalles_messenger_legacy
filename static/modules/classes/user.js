export class User {
    constructor() {
      this.id = "";    // Inicializamos el id
      this.username = "";
      this.theme = "";
      this.nombreCompleto = "";
      this.sonido = true
    }
  
    get window_url() {
      return window.location.origin;
    }
  
    get jwt() {
      return localStorage.getItem("jwt");
    }
  
    async getUserInfo() {
      try {
        const response = await fetch(`${this.window_url}/auth/me`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.jwt}`,
            "Content-Type": "application/json",
          }
        });
        
        if (!response.ok) {
          alert("Autenticación caducada");
          console.log("Regresando al /login.html");
          this.regresaralLogin();
          return null;
        }
    
        const data = await response.json();
        
        // Asignamos los valores recibidos a las propiedades de la instancia
        this.id = data.user_iD;
        this.username = data.username;
        this.nombreCompleto = data.name;
        this.theme = data.theme || "default"; // Valor por defecto si no se recibe
    
        return data;
      } catch (error) {
        console.error("Error en getUserInfo:", error);
        return null;
      }
    }
  
    async obtenerNombreCompleto() {
      const data = await this.getUserInfo();
      if (data) return data.name;
      return null;
    }
    
    regresaralLogin() {
      window.location.href = this.window_url + "/login.html";
    }
  
    async obtenerStatus() {
      try {
        const response = await fetch(`${this.window_url}/settings/get_status`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.jwt}`,
            "Content-Type": "application/json",
          }
        });
    
        if (!response.ok) {
          console.error("Error en la respuesta con el servidor de obtenerStatus()");
        }
    
        const data = await response.json();
        // Retorna directamente el valor de status_text
        return data.status_text;
      } catch (error) {
        console.error("Error en obtenerStatus()", error);
        return null;
      }
    }
    
    // Método para obtener la imagen de perfil
    async getProfileImage() {
      try {
        const imageResponse = await fetch(`${this.window_url}/media/images/${this.username}.webp`, {
          headers: {
            "Authorization": `Bearer ${this.jwt}`,
          }
        });
    
        if (imageResponse.ok) {
          // Convertimos la respuesta a un blob y creamos un URL temporal
          const blob = await imageResponse.blob();
          const imageUrl = URL.createObjectURL(blob);
          return imageUrl;
        } else {
          console.error("Error al cargar la imagen de perfil:", imageResponse.statusText);
          return "/images/app/default_user.png";
        }
      } catch (error) {
        console.error("Error en getProfileImage()", error);
        return "/images/app/default_user.png";
      }
    }

    async getUserStatus(username) {
      try {
        const response = await fetch(`${this.window_url}/is_user_on/${username}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          }
        });
    
        if (!response.ok) {
          throw new Error(`Error al obtener el estado: ${response.status}`);
        }
    
        const data = await response.json();
        console.log("Respuesta del servidor:", data);
        return data;
      } catch (error) {
        console.error("Error en getUserStatus:", error);
      }
    }

    messageSound(){
      const audio = new Audio("/sounds/message.wav")

      if (this.sonido) {
        audio.play()
        .catch(error => {
          console.error("Error al reproducir el sonido ", error)
        })
      } else {
        return
      }
    }

    botonSound() {
      const audio = new Audio("/sounds/button.wav")

      if (this.sonido) {
        audio.play()
        .catch(error => {
          console.error("Error al reproducir el sonido ", error)
        })
      } else {
        return
      }
    }
}
  