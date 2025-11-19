const browser_url = window.location.origin;

export class InfoUsers {
  constructor(containerSelection) {
    this.container = document.querySelector(containerSelection);
    if (!this.container) {
      throw new Error(`No se encontró el contenedor: ${containerSelection}`);
    }
  }

  hide() {
    this.container.style.display = 'none';
  }

  show() {
    this.container.style.display = 'flex';
  }

  regresaralLogin() {
    window.location.href = browser_url + "/login.html";
  }

  async get_status(otherUser) {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) {
      this.regresaralLogin();
      return;
    }

    try {
      const response = await fetch(`${browser_url}/chats/other-user-info/${otherUser}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        }
      });

      if (!response.ok) {
        throw new Error(`Error en la consulta: ${response.statusText}`);
      }

      const data = await response.json();
      const statusUser = data.status;  // Suponemos que data.status es un string con la información del estado

      // Insertamos el HTML formateado en el contenedor
      this.container.innerHTML = `
        <button class="close-btn" id="close-btn">x</button>
        <div class="info-content-scroll">
          <img src="images/app/default_user.png" class="avatar" id="avatar">
          <h2 class="name">${otherUser}</h2>
          <p class="role">Estado:</p>
          <p class="description">
            ${statusUser ? statusUser : "Información adicional del usuario. Puedes agregar más detalles aquí si lo deseas."}
          </p>
        </div>
      `;

      // Asignamos el listener para el botón de cerrado
      const closeBtn = this.container.querySelector(".close-btn");
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.hide());
      }

      // Actualizamos el src de la imagen de perfil usando el método userProfilePic con el parámetro otherUser
      this.userProfilePic(otherUser).then(imageUrl => {
        const profileImg = this.container.querySelector("#avatar");
        if (profileImg) {
          profileImg.src = imageUrl;
        }
      });

      return data;
    } catch (error) {
      console.error("Error al obtener el status del otro usuario:", error);
      throw error;
    }
  }

  async userProfilePic(username) {
    const endpoint = `${browser_url}/media/images/${username}.webp`;
    console.log("Estoy buscando la imagen de:", username);
    const jwt = localStorage.getItem("jwt");
    try {
      const imageResponse = await fetch(endpoint, {
        headers: {
          "Authorization": `Bearer ${jwt}`,
        }
      });

      if (imageResponse.ok) {
        const blob = await imageResponse.blob();
        const imageURL = URL.createObjectURL(blob);
        return imageURL;
      } else {
        console.error("Error al cargar la imagen de perfil:", imageResponse.statusText);
        return "/images/app/default_user.png";
      }
    } catch (error) {
      console.error("Error en userProfilePic()", error);
      return "/images/app/default_user.png";
    }
  }
}
