// chats.js

// Definimos la URÑ base usando la ubicación actual del navegador
const browserUrl = window.location.origin

/**
 * La clase para manejar todo lo necesario de las conversaciones
 */
export class Chats {
    /**
     * @param {string} mainContainerSelector - Selector del contenedor donde se montará la vista del chat.
     * @param {WebSockets} wsInstance - Instancia de la clase WebSockets para recibir mensajes en tiempo real.
     */
    constructor(mainContainerSelector, wsInstance) {
      // Referencia al contenedor principal donde se montará la vista del chat
      this.mainContainer = document.querySelector(mainContainerSelector);
      if (!this.mainContainer) {
        console.error("No se encontró el contenedor para Chats:", mainContainerSelector);
        return;
      }
  
      // Leer el usuario logueado desde localStorage
      this.myUserId = null;
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          this.myUserId = parsedUser.iD; // O "id", según corresponda
        } catch (err) {
          console.error("Error al parsear user de localStorage:", err);
        }
      }
  
      // Variables para la conversación
      this.chatId = null;       // ID del chat en la BD
      this.otherUserId = null;  // ID del usuario con quien chateamos
      this.messages = [];
      this.limit = 20;
      this.offset = 0;
      this.conversationElement = null;
  
      // Asigna la instancia de WebSockets recibida y registra el callback para mensajes entrantes
      this.ws = wsInstance;
      if (this.ws && typeof this.ws.registerOnMessageCallback === "function") {
        this.ws.registerOnMessageCallback((message) => {
          this.handleIncomingMessage(message);
        });
      }
      console.log("Chats: Instancia de WebSockets asignada:", this.ws);
    }
  
    /**
     * Maneja los mensajes entrantes vía WebSocket.
     * Si el mensaje pertenece al chat actualmente abierto, lo renderiza.
     * Se asume que el mensaje incluye la propiedad "chat_id".
     */
    handleIncomingMessage(message) {
      console.log("handleIncomingMessage:", message);
      if (this.chatId && message.chat_id && parseInt(message.chat_id) === parseInt(this.chatId)) {
        // Renderiza el mensaje y lo agrega a la lista de mensajes
        this.renderMessages([message], false);
        this.messages.push(message);
      } else {
        console.log("Mensaje recibido no pertenece al chat actual:", message.chat_id, "chatId:", this.chatId);
      }
    }
  
    /**
     * Abre (o crea) un chat individual a partir del ID del otro usuario.
     */
    async openChat(userId) {
      try {
        this.otherUserId = userId;
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://127.0.0.1:8000/chats/open_single_chat/${userId}?limit=${this.limit}&offset=${this.offset}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          }
        );
        if (!response.ok) {
          console.error("Error al abrir/crear chat:", response.statusText);
          return;
        }
        const data = await response.json();
        this.chatId = data.chat_id;
        this.messages = data.messages ? data.messages.reverse() : [];
        this.renderChatUI();
        this.renderMessages(this.messages, false);
        this.handleScrollLoad();
      } catch (error) {
        console.error("Error en openChat:", error);
      }
    }
  
    /**
     * Abre un chat ya existente usando un objeto de chat (por ejemplo, seleccionado desde la barra lateral).
     * Se asume que chatObj contiene al menos { chat_id, chat_name } y, opcionalmente, other_user_id.
     */
    async openChatByChat(chatObj) {
      try {
        this.chatId = chatObj.chat_id;
        this.otherUserId = chatObj.other_user_id || null;
        this.renderChatUI(chatObj.chat_name);
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://127.0.0.1:8000/chats/get_chat/${this.chatId}?limit=${this.limit}&offset=0`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          }
        );
        if (!response.ok) {
          console.error("Error al obtener chat:", response.statusText);
          return;
        }
        const data = await response.json();
        this.messages = data.messages ? data.messages.reverse() : [];
        this.renderMessages(this.messages, false);
        this.handleScrollLoad();
      } catch (error) {
        console.error("Error en openChatByChat:", error);
      }
    }
  
    /**
     * Renderiza la interfaz del chat.
     * @param {string} chatName - Nombre a mostrar en el encabezado (opcional).
     */
    renderChatUI(chatName) {
      const userProfilePic = "https://via.placeholder.com/150";
      const headerTitle = chatName ? chatName : `Chat de: ${this.otherUserId}`;
      this.mainContainer.innerHTML = `
        <div class="chat-header">
          <div class="chat-header-left">
            <!--img class="chat-header-profile-pic" src="${userProfilePic}" alt="Foto del contacto"-->
            <div class="chat-header-info">
              <h3 class="chat-username">${headerTitle}</h3>
            </div>
          </div>
        </div>
        <div class="conversation" id="conversation" style="overflow-y:auto; flex:1;"></div>
        <div class="static">
          <textarea class="messageInput" id="messageInput" rows="2" placeholder="Escribe tu mensaje..."></textarea>
          <button class="sendMessage" id="sendMessageBtn">Enviar</button>
        </div>
      `;
      this.conversationElement = this.mainContainer.querySelector("#conversation");
      const sendBtn = this.mainContainer.querySelector("#sendMessageBtn");
      sendBtn.addEventListener("click", () => this.handleSendMessage());
      const messageInput = this.mainContainer.querySelector("#messageInput");
      messageInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          this.handleSendMessage();
        }
      });
    }
  
    /**
     * Renderiza una lista de mensajes en el contenedor de la conversación.
     * @param {Array} msgList - Lista de mensajes.
     * @param {boolean} prepend - Si es true, agrega los mensajes al inicio.
     */
    renderMessages(msgList, prepend = false) {
      if (!this.conversationElement) return;
      let html = "";
      msgList.forEach(msg => {
        const isMine = parseInt(msg.user_id) === parseInt(this.myUserId);
        const messageClass = isMine ? "mine" : "theirs";
        html += `
          <div class="message-item ${messageClass}">
            <p class="message-content">${msg.content}</p>
            <span class="message-date">${msg.created_at}</span>
          </div>
        `;
      });
      if (prepend) {
        const oldScrollHeight = this.conversationElement.scrollHeight;
        this.conversationElement.insertAdjacentHTML("afterbegin", html);
        const newScrollHeight = this.conversationElement.scrollHeight;
        this.conversationElement.scrollTop = newScrollHeight - oldScrollHeight;
      } else {
        this.conversationElement.insertAdjacentHTML("beforeend", html);
        this.conversationElement.scrollTop = this.conversationElement.scrollHeight;
      }
    }
  
    /**
     * Envía un mensaje mediante el endpoint REST y, a continuación, lo retransmite vía WebSocket.
     */
    async handleSendMessage() {
      const inputEl = this.mainContainer.querySelector("#messageInput");
      const messageText = inputEl.value.trim();
      if (!messageText) return;
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`http://127.0.0.1:8000/chats/${this.chatId}/send_message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ content: messageText })
        });
        if (!response.ok) {
          console.error("Error al enviar mensaje:", response.statusText);
          return;
        }
        const newMessage = await response.json();
        // Renderiza el mensaje en el cliente que lo envió
        this.renderMessages([newMessage], false);
        this.messages.push(newMessage);
        inputEl.value = "";
        // Ahora, envía el mensaje vía WebSocket para que los demás clientes lo reciban.
        if (this.ws && this.ws.sendMessage) {
          this.ws.sendMessage(newMessage);
        }
      } catch (err) {
        console.error("Error en handleSendMessage:", err);
      }
    }
  
    /**
     * Configura el listener de scroll para cargar mensajes anteriores (paginación).
     */
    handleScrollLoad() {
      if (!this.conversationElement) return;
      this.conversationElement.addEventListener("scroll", async () => {
        if (this.conversationElement.scrollTop === 0) {
          this.offset += this.limit;
          const olderMessages = await this.fetchMoreMessages(this.offset, this.limit);
          if (olderMessages.length > 0) {
            olderMessages.reverse();
            this.renderMessages(olderMessages, true);
            this.messages = [...olderMessages, ...this.messages];
          } else {
            console.log("No hay mensajes más antiguos.");
          }
        }
      });
    }
  
    /**
     * Obtiene mensajes anteriores del chat usando paginación.
     */
    async fetchMoreMessages(offset, limit) {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `http://127.0.0.1:8000/chats/open_single_chat/${this.otherUserId}?limit=${limit}&offset=${offset}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`
            }
          }
        );
        if (!response.ok) {
          console.error("Error al cargar mensajes antiguos:", response.statusText);
          return [];
        }
        const data = await response.json();
        return data.messages || [];
      } catch (err) {
        console.error("Error en fetchMoreMessages:", err);
        return [];
      }
    }
}  