// dash.js

// Importamos módulos
import { User } from "../modules/classes/user.js"
import { WebSockets } from "./classes/webSockets.js"
import { Chats } from "./classes/chats.js"
import { BarraLateral } from "./classes/barraLateral.js"
import { InfoUsers } from "./classes/infoUsers.js"
//import { WebSockets2 } from "./classes/webSockets2.js"
import { Notificaciones } from "./classes/notificaciones.js"
import { GroupChat } from "./classes/groupChat.js"
import { ConfGroup } from "./classes/confGroup.js"
import { GroupManager } from "./classes/groupManager.js"

// Primero lo primero, saber la ruta del servidor:
const browser_url = window.location.origin

/**
 * PRIMERO EL USUARIO AUTHENTICADO
 * Y SU CONTEXTO
 */

const user = new User()
window.user = user
let user_local = {
    "jwt" : "",
    "id": 0,
    "username": "",
    "theme": "dark"
}
// Al llamar al método, se ejecuta la petición y actualiza las propiedades de la instancia
user.getUserInfo().then(data => {
    if (data) {
        //console.log("Usuario autenticado:", user); // Ya lo puedo borrar
        document.getElementById("username").textContent = user.username;
        user_local.jwt = localStorage.getItem("jwt")
        user_local.id = user.id
        user_local.username = user.username
        // Guardar así: {"iD":1,"username":"eluckie","name":"Ernesto Luckie","email":"ing.eluckie@gmail.com"}
        localStorage.setItem("user", JSON.stringify(user_local))
    } else {
        console.error("No se pudo obtener la información del usuario");
    }
});

/**
 * FUNCIONALIDADES DE LA NAVBAR
 */

// Para la ventana modal
// 1. Tomamos referencias a los elementos
const settingsButton = document.querySelector('.settings');
const modal = document.getElementById('myModal');
const closeButton = modal.querySelector('.close');
const statusTextarea = document.querySelector('.status-textarea');
const btnGuardar = document.querySelector('.btn-guardar');

// 2. Abrir la modal al hacer clic en el botón de ajustes
// Abrir el modal al hacer clic en el botón de ajustes y cargar el status actual

settingsButton.addEventListener('click', async () => {
  user.botonSound()
  modal.style.display = 'block';
  // Obtener el status actual usando la instancia global de User (ya asignada a window.user)
  const statusText = await window.user.obtenerStatus();
  if (statusText !== null && statusText !== undefined) {
    // Colocamos el status actual en el textarea
    statusTextarea.value = statusText;
  } else {
    // En caso de no tener status, dejamos el textarea vacío o con un mensaje predeterminado
    statusTextarea.value = "";
  }
});



// 3. Cerrar la modal al hacer clic en la "X" (span.close)
closeButton.addEventListener('click', () => {
  user.botonSound()
  modal.style.display = 'none';
});

// 4. (Opcional) Cerrar la modal si el usuario hace clic fuera del contenido de la ventana
window.addEventListener('click', (event) => {
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});

btnGuardar.addEventListener('click', async () => {
  const newStatus = statusTextarea.value;

  try {
    const response = await fetch(`${window.location.origin}/settings/update_status`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('jwt')}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status_text: newStatus })
    });

    if (!response.ok) {
      console.error("No se pudo actualizar el status:", response.statusText);
      return;
    }

    const result = await response.json();
    console.log("Status actualizado exitosamente:", result);
    // Opcional: mostrar una notificación o actualizar la UI
    modal.style.display = 'none';
  } catch (error) {
    console.error("Error al actualizar el status:", error);
  }
});


// Referencia al checkbox que activa/desactiva el modo oscuro:
const themeToggle = document.getElementById("themeToggle");

// Referencia a la imagen del botón de settings:
const settingsImage = document.querySelector(".settings_image");

const applyTheme = (theme) => {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
    settingsImage.src = "images/app/settingsBlack.png";
    themeToggle.checked = true;
  } else {
    document.documentElement.classList.remove("dark");
    settingsImage.src = "images/app/settings.png";
    themeToggle.checked = false;
  }
  user_local.theme = theme;
};

const storedTheme = localStorage.getItem("temaApp");
const initialTheme = storedTheme === "light" ? "light" : "dark";
applyTheme(initialTheme);

themeToggle.addEventListener("change", () => {
  const selectedTheme = themeToggle.checked ? "dark" : "light";
  applyTheme(selectedTheme);
  localStorage.setItem("temaApp", selectedTheme);
});

/*
// MODAL CREAR GRUPOS
const btnAbrir = document.querySelector('.btn-crear-grupo');
const modalGrupo = document.getElementById('modalCrearGrupo');
const cerrar = document.getElementById('closeCrearGrupo');
btnAbrir.addEventListener('click', () => modalGrupo.style.display = 'block');
cerrar.addEventListener('click', () => modalGrupo.style.display = 'none');
window.addEventListener('click', e => {
  if (e.target === modalGrupo) modalGrupo.style.display = 'none';
});

const inputBuscarUsuario = document.getElementById("buscarUsuario")
const resultsUsuariosOpciones = document.getElementById("usuariosOpciones")
const iniciarCreacionGrupo = document.getElementById("btn-iniciar-creacion")
let lista_usuarios_seleccionados = []
const inputNombreGrupo = document.getElementById("nombreGrupo");

// para mensaje de error
const errorNombreGrupo = document.createElement("span");
errorNombreGrupo.classList.add("error");
errorNombreGrupo.style.fontSize = "0.8rem";
errorNombreGrupo.style.marginLeft = "8px";
errorNombreGrupo.textContent = "";              // vacío inicialmente
// Lo insertamos justo después del input
inputNombreGrupo.parentNode.insertBefore(errorNombreGrupo, inputNombreGrupo.nextSibling);
*/
// Funciones auxiliares

const debounce = (fn, delay) => {
  // Función para no saturar de peticienes en cada pulsación de tecla
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
};

/*
const handleSearchGroups = async(event) => {
  const terminoBusqueda = event.target.value.trim()
  // Si el usuario ha borrado casi todo o está escribiendo muy poco, no hacemos nada
  if (terminoBusqueda.length < 2) {
    resultsUsuariosOpciones.innerHTML = "";
    resultsUsuariosOpciones.style.display = "none";
    return;
  }

  try {
    
    const token = localStorage.getItem("jwt");

    // Llamamos a nuestro endpoint en FastAPI
    const response = await fetch(
      `${browser_url}/chats/search_user_navbar/${encodeURIComponent(
        terminoBusqueda
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      // Manejo de error, por ejemplo token expirado o sin autorización
      console.error("Error al buscar usuarios:", response.statusText);
      // Redirigir a /login.html o mostrar un mensaje, etc.
      return;
    }

    // Parseamos la respuesta, que asumes te regresa un array de usernames
    const resultadosSinAplanar = await response.json();
    const resultados = resultadosSinAplanar.flat();
    console.log("Usuarios encontrados:", resultados);

    // Si no hay coincidencias
    if (!resultados || resultados.length === 0) {
      resultsUsuariosOpciones.innerHTML = "<p>No se encontraron resultados</p>";
      resultsUsuariosOpciones.style.display = "block";
      return;
    }

    // Construimos la lista de sugerencias
    let html = "";
    resultados.forEach((usuario) => {
      // Ajusta según los datos que recibas de la API
      html += `
        <div 
          class="search-result-item" 
          data-user-id="${usuario}"
          style="
            padding: 5px; 
            cursor: pointer; 
            border-bottom: 1px solid #ccc;
          "
        >
          ${usuario}
        </div>
      `;
    });

    resultsUsuariosOpciones.innerHTML = html;
    resultsUsuariosOpciones.style.display = "block";
  } catch (err) {
    console.error("Error en la búsqueda:", err);
  }
}

inputBuscarUsuario.addEventListener("input", debounce(handleSearchGroups,300))

// Renderizar lista de usuarios
const lista_renderizada = document.getElementById("seleccionated")
const renderiza_lista_seleccionados = (lista_usuarios) => {
  let html = ""
  lista_usuarios.forEach((username) => {
    html += `
      <div 
        class="search-result-item fila-usuario"
        data-user-id="${username}"
        style="display:flex; justify-content:space-between; align-items:center;
               padding:5px; border-bottom:1px solid #ccc;">
        
        <span>${username}</span>
        
        <!-- Botón de eliminación -->
        <button class="btn-eliminar"
                style="background:none;border:none;font-size:18px;
                       cursor:pointer;line-height:1;">✕</button>
      </div>
    `;
  })

  lista_renderizada.innerHTML = html
  lista_renderizada.style.display = lista_usuarios.length ? "block" : "none"
}

lista_renderizada.addEventListener("click", (e) => {
  // ¿Hicieron clic en el botón ✕?
  if (e.target.classList.contains("btn-eliminar")) {
    const fila = e.target.closest(".fila-usuario");
    const username = fila.dataset.userId;

    // Quita el usuario del arreglo (si existe)
    const idx = lista_usuarios_seleccionados.indexOf(username);
    if (idx !== -1) {
      lista_usuarios_seleccionados.splice(idx, 1);
      // Vuelve a pintar la lista
      renderiza_lista_seleccionados(lista_usuarios_seleccionados);
    }
  }
});

// Selección de usuarios
resultsUsuariosOpciones.addEventListener("click", (event) => {
  const clickedItem = event.target

  if (clickedItem.classList.contains("search-result-item")){
    const username = clickedItem.getAttribute("data-user-id")
    if (!lista_usuarios_seleccionados.includes(username)) {
      lista_usuarios_seleccionados.push(username)
      console.log("Seleccionado para grupo: ", username)
    } 
  }

  renderiza_lista_seleccionados(lista_usuarios_seleccionados)

})
*/
/* ----------- CREAR GRUPO: listener definitivo ----------- */
/*
iniciarCreacionGrupo.addEventListener("click", async () => {
  const nombreGrupo   = inputNombreGrupo.value.trim();
  const descripcion   = "";                              // opcional, si luego añades un textarea
  const miembros      = lista_usuarios_seleccionados;    // usernames

  // 1️⃣ Validación
  if (!nombreGrupo) {
    errorNombreGrupo.textContent = "Campo obligatorio";
    return;
  } else {
    errorNombreGrupo.textContent = "";
  }

  if (miembros.length === 0) {
    alert("Selecciona al menos un miembro para el grupo.");
    return;
  }

  // 2️⃣  Llamada al endpoint 
  const token = localStorage.getItem("jwt");
  try {
    const resp = await fetch(`${browser_url}/chats/grupos`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        nombre: nombreGrupo,
        descripcion,
        members: miembros
      })
    });

    if (!resp.ok) {
      const detail = await resp.json().catch(() => ({}));
      throw new Error(detail.detail || resp.statusText);
    }

    const data = await resp.json();
    console.log("Grupo creado:", data);          // { chat_id, nombre }

    // 3️⃣  UI post‑éxito
    alert(`Grupo “${nombreGrupo}” creado con éxito 🎉`);
    modalGrupo.style.display = "none";
    inputNombreGrupo.value = "";
    lista_usuarios_seleccionados.length = 0;
    renderiza_lista_seleccionados([]);

    // Opcional: recargar barra lateral para que aparezca el nuevo chat
    barraLateralInstance.loadChats(true);        // si tu clase tiene este método
  } catch (err) {
    console.error("Error creando grupo:", err);
    alert(`No se pudo crear el grupo: ${err.message}`);
  }
});
*/


// BARRA DE BÚSQUEDA DE USUARIOS

// Referencias a elementos
const searchInput = document.getElementById("searchInput")
const searchResults = document.getElementById("searchResults")


// Lógica para buscar usuarios desde la barra

const handleSearch = async (event) => {
    const terminoBusqueda = event.target.value.trim();
  
    // Si el usuario ha borrado casi todo o está escribiendo muy poco, no hacemos nada
    if (terminoBusqueda.length < 2) {
      searchResults.innerHTML = "";
      searchResults.style.display = "none";
      return;
    }
  
    try {
      
      const token = localStorage.getItem("jwt");
  
      // Llamamos a nuestro endpoint en FastAPI
      const response = await fetch(
        `${browser_url}/chats/search_user_navbar/${encodeURIComponent(
          terminoBusqueda
        )}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
  
      if (!response.ok) {
        // Manejo de error, por ejemplo token expirado o sin autorización
        console.error("Error al buscar usuarios:", response.statusText);
        // Redirigir a /login.html o mostrar un mensaje, etc.
        return;
      }
  
      // Parseamos la respuesta, que asumes te regresa un array de usernames
      const resultadosSinAplanar = await response.json();
      const resultados = resultadosSinAplanar.flat();
      console.log("Usuarios encontrados:", resultados);
  
      // Si no hay coincidencias
      if (!resultados || resultados.length === 0) {
        searchResults.innerHTML = "<p>No se encontraron resultados</p>";
        searchResults.style.display = "block";
        return;
      }
  
      // Construimos la lista de sugerencias
      let html = "";
      resultados.forEach((usuario) => {
        // Ajusta según los datos que recibas de la API
        html += `
          <div 
            class="search-result-item" 
            data-user-id="${usuario}"
            style="
              padding: 5px; 
              cursor: pointer; 
              border-bottom: 1px solid #ccc;
            "
          >
            ${usuario}
          </div>
        `;
      });
  
      searchResults.innerHTML = html;
      searchResults.style.display = "block";
    } catch (err) {
      console.error("Error en la búsqueda:", err);
    }
};

// Eventos de la barra de búsqueda
// Cuando el usuario escribe, aplicamos debounce para no spamear el servidor
searchInput.addEventListener("input", debounce(handleSearch, 300));

// Cuando el usuario hace clic en un resultado
searchResults.addEventListener("click", (event) => {
  const clickedItem = event.target;

  if (clickedItem.classList.contains("search-result-item")) {
    const userId = clickedItem.getAttribute("data-user-id");
    console.log("Usuario seleccionado con ID:", userId);

    // Abre el chat con el usuario seleccionado
    chatsManager.openChat(userId);
    infoUsersBarra.hide()

    // Ocultamos la lista de resultados
    searchResults.style.display = "none";
  }
});

// ACTIVAR Y/O DESACTIVAR SONIDOS
// Obtenemos la referencia al checkbox
const disposicionToggle = document.getElementById("disposicionToggle")

// Escuchamos el evento change
disposicionToggle.addEventListener('change', () => {
  if (disposicionToggle.checked) {
    user.sonido = false
  } else {
    user.sonido = true
  }
})

// PARA CAMBIAR EL NOMBRE COMPLETO DE USUARIO EN LA VENTANA MODAL
const currentUsername = await user.obtenerNombreCompleto()
if (currentUsername) {
    document.getElementById("nombre-usuario").textContent = currentUsername
}

/***************************************************
 * CAMBIAR NOMBRE DE USUARIO
 ***************************************************/
const btnCambiarNombre = document.getElementById("btn-cambiar-nombre");
const nombreUsuarioElement = document.getElementById("username");

// Variable para almacenar el input dinámico (si existe)
let inputNombre = null;

btnCambiarNombre.addEventListener('click', async () => {
  // Si el botón muestra "Cambiar nombre mostrado"
  if (btnCambiarNombre.innerText.trim() === "Cambiar nombre mostrado") {
    // Creamos el input dinámicamente solo si no existe
    if (!inputNombre) {
      inputNombre = document.createElement("input");
      inputNombre.type = "text";
      inputNombre.id = "input-nombre-usuario";
      inputNombre.value = nombreUsuarioElement.innerText; // Prellenamos con el nombre actual
      // Opcional: agregar estilos para que se integre con el diseño
      inputNombre.style.marginRight = "10px";
      inputNombre.style.transition = "all 0.3s ease";
      // Insertamos el input antes del botón
      btnCambiarNombre.parentNode.insertBefore(inputNombre, btnCambiarNombre);
    }
    // Cambiamos el texto del botón a "Guardar"
    btnCambiarNombre.innerText = "Guardar";
  } else {
    // El botón muestra "Guardar"
    const newName = inputNombre.value.trim();
    // Si el input está vacío, se conserva el valor actual
    if (newName === "") {
      inputNombre.value = nombreUsuarioElement.innerText;
    } else if (newName !== nombreUsuarioElement.innerText) {
      // Se llama al endpoint para actualizar el username
      try {
        const response = await fetch(`${window.location.origin}/settings/update_displayNombre`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("jwt")}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ username: newName })
        });
  
        if (!response.ok) {
          console.error("Error al actualizar el nombre:", response.statusText);
        } else {
          const result = await response.json();
          // Actualizamos el nombre mostrado en la UI
          nombreUsuarioElement.innerText = newName;
          console.log("Nombre actualizado correctamente:", result);
        }
      } catch (error) {
        console.error("Error en la petición para actualizar el nombre:", error);
      }
    }
    // Se remueve el input y se restablece el botón a su estado original
    if (inputNombre) {
      inputNombre.remove();
      inputNombre = null;
    }
    btnCambiarNombre.innerText = "Cambiar nombre mostrado";
  }
});

/**
 * CAMBIAR LA IMAGEN DE PERFIL
 */

const btnCambiarFoto = document.getElementById('btn-cambiar-foto')
const fileInput = document.getElementById('fileInput')
//const profilePic = document.getElementById('profilePic') // Para actualizar la imagen. Aún no me interesa

btnCambiarFoto.addEventListener('click', () => {
  //console.log("Holisssss") // Sí funciona
  fileInput.click()
})

fileInput.addEventListener('change', async() => {
  //console.log("Me activé!!") // Sí funcionaaaaa
  const file = fileInput.files[0]
  if (!file) {
    alert("No se ingresó imagen")
    return
  }

  // Crear el objeto FormData y agregar el archivo
  const formData = new FormData()
  formData.append('file',file)

  // Obtener el token JWT
  const token = localStorage.getItem('jwt')

  try {
    const response = await fetch(`${browser_url}/media/upload-profile-picture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}` // Agrega el JWT al header
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error('Error al subir la imagen')
    }
    const result = await response.json();
    console.log('Imagen subida correctamente:', result);

  } catch (error) {
    console.error('Error: ', error)
    alert('Hubo un problema al subir la imagen')
  }
  
  window.user.getProfileImage().then(imageUrl => {
    document.querySelector(".userImage").src = imageUrl;
    document.querySelector(".profile-pic").src = imageUrl;
  });
})


// Suponiendo que ya tienes la instancia global de User en window.user
window.user.getProfileImage().then(imageUrl => {
  document.querySelector(".userImage").src = imageUrl;
  document.querySelector(".profile-pic").src = imageUrl;
});

/**
 * BARRA INFO-USERS
 */
// callback para refrescar tu barra lateral tras crear/editar
const recargarChats = () => barraLateralInstance.loadChats(true);

const groupManager = new GroupManager("#modalCrearGrupo", {
  onGrupoActualizado: recargarChats
});

// Opcionalmente lo expones al global para depurar
window.groupManager = groupManager;

const btnCerrarInfo = document.querySelector(".close-btn")
const infoUsersBarra = new InfoUsers(".info")
const configuracionGrupos = new ConfGroup(".info", { gm: groupManager })

btnCerrarInfo.addEventListener('click', () => {
  infoUsersBarra.hide()
})


/**
 * WEBSOCKETS
 */
const userData = JSON.parse(localStorage.getItem("user"));
const username = userData.username;
const socketEndpoint = browser_url+`/ws/${username}`
const ws = new WebSockets(socketEndpoint)
// Ya lo mencioné, pero otra vez: una de estas clases se tiene que ir
//const ws_user = new WebSockets2()

/**
 * CHATS MANAGER
 */
const chatsManager = new Chats(".main", ws, user, infoUsersBarra)
window.chatsManager = chatsManager

const groupChats = new GroupChat(".main", ws, user, infoUsersBarra, configuracionGrupos)
window.groupChats = groupChats

/**
 * BARRA LATERAL
 */
const barraLateralInstance = new BarraLateral("#chats", chatsManager, groupChats,infoUsersBarra)
window.barraLateralInstance = barraLateralInstance

// **Nuevo: escucha mensajes y avisa a la barra lateral**
ws.registerOnMessageCallback((msg) => {
  if (!msg.chat_id) return;
  if (parseInt(msg.chat_id) !== parseInt(chatsManager.chatId)) {
    barraLateralInstance.incrementUnread(msg.chat_id);
  }
});


const userImageBorder = document.getElementsByClassName("userImage");
setTimeout(() => {
  if (ws.isConnected()) {
    console.log("El WebSocket está conectado");
    // Asegurarse de que hay al menos un elemento en la colección:
    if (userImageBorder.length > 0) {
      userImageBorder[0].style.border = "2px solid green";
    }
  } else {
    console.log("El WebSocket no está conectado");
  }
}, 1000);



const gestorNotificaciones = new Notificaciones(barraLateralInstance, user)
