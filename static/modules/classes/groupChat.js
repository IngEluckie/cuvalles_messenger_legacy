// groupChat.js
import { Chats } from "./chats.js";

export class GroupChat extends Chats {
  /**
   * Por ahora hereda todo el comportamiento de Chats.
   * Se inicializan campos adicionales (placeholders) para
   * funciones grupales que agregaremos más adelante.
   *
   * @param {string} mainContainerSelector  Selector CSS del contenedor principal.
   * @param {Object} wsInstance             Instancia WebSocket.
   * @param {Object} user                   Objeto de usuario actual.
   * @param {Object} infoUsersBarra         Gestor de la barra de información.
   */
  constructor(mainContainerSelector, wsInstance, user, infoUsersBarra, confGroup) {
    super(mainContainerSelector, wsInstance, user, infoUsersBarra);
    console.log("Clase de grupo creada")

    /* ── Campos específicos de grupo (por ahora vacíos) ── */
    this.confGroup = confGroup
    this.description = "";
    this.members     = [];        // [{ id, username, avatar }, ...]
    this.role        = "regular"; // "admin" | "regular"
  }

  renderChatUI(chatName) {
    const defaultPic = "/images/app/default_user.png";
    const headerTitle = chatName || `Chat con: ${this.otherUserUsername}`;

    this.mainContainer.innerHTML = `
      <div class="chat-header" id="chat-header">
        <div class="chat-header-left">
          <!--img
            class="chat-header-profile-pic"
            id="chat-profile-pic"
            src="${defaultPic}"
          -->
          <div class="chat-header-info">
            <h3 class="chat-username">${headerTitle}</h3>
          </div>
          <button id="ver-status" class="ver-status">Info</button>
        </div>
      </div>
      <div
        id="conversation"
        class="conversation"
        style="overflow-y:auto; flex:1;"
      ></div>
      <div class="static">
        <input type="file" id="fileInput" multiple style="display:none">
        <textarea
          id="messageInput"
          class="messageInput"
          rows="2"
          placeholder="Escribe tu mensaje..."
        ></textarea>
        <button id="attachFileBtn" class="attachFile" title="Adjuntar">📎</button>
        <button id="sendMessageBtn" class="sendMessage">Enviar</button>
      </div>
    `;

    this.conversationElement = this.mainContainer.querySelector("#conversation");

    this.mainContainer
      .querySelector("#sendMessageBtn")
      .addEventListener("click", () => this.handleSendMessage());

    this.mainContainer
      .querySelector("#messageInput")
      .addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });

    this.userProfilePic(chatName).then(url => {
      const img = document.getElementById("chat-profile-pic");
      if (img) img.src = url;
    });

    this.mainContainer
      .querySelector("#attachFileBtn")
      .addEventListener("click", () =>
        this.mainContainer.querySelector("#fileInput").click()
      );
    this.mainContainer
      .querySelector("#fileInput")
      .addEventListener("change", e => this.handleFileSelected(e));

    this.mainContainer.querySelector("#ver-status")
    .addEventListener("click", () => {
      this.confGroup.open(this.chatId);   // ← envía el id
    });
  }
}
