// groupChat.js
import { Chats } from "./chats.js";

const browserUrl = window.location.origin;

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
    this.groupAvatar = "/images/app/grupo_default_image.png";
    this._groupAvatarObjectUrl = null;

    const lastChatType = sessionStorage.getItem("lastChatType");
    const lastChatId = sessionStorage.getItem("lastChatId");
    if (lastChatType === "group" && lastChatId) {
      this.openGroupChat(parseInt(lastChatId, 10));
    }
  }

  async openChatByChat(chatObj) {
    if (chatObj?.is_group) {
      await this.openGroupChat(chatObj.chat_id);
      return;
    }
    return super.openChatByChat(chatObj);
  }

  async openGroupChat(chatId) {
    try {
      this.chatId = chatId;

      const jwt = localStorage.getItem("jwt");
      const infoRes = await fetch(`${browserUrl}/chats/grupo_info/${chatId}`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      if (!infoRes.ok) {
        throw new Error(await infoRes.text());
      }
      const data = await infoRes.json();

      this.otherUserUsername = data.nombre;
      this.description = data.descripcion || "";
      this.members = data.members || [];
      this.role = data.is_admin ? "admin" : "regular";

      await this.updateGroupAvatar(data.avatar_url);

      await super.openChatByChat({
        chat_id: chatId,
        chat_name: data.nombre
      });

      sessionStorage.setItem("lastChatType", "group");
    } catch (err) {
      console.error("openGroupChat:", err);
      alert("No se pudo abrir la conversación del grupo.");
    }
  }

  renderChatUI(chatName) {
    const defaultPic = this.groupAvatar || "/images/app/grupo_default_image.png";
    const headerTitle = chatName || `Chat con: ${this.otherUserUsername}`;

    this.mainContainer.innerHTML = `
      <div class="chat-header" id="chat-header">
        <div class="chat-header-left">
          <img
            class="chat-header-profile-pic"
            id="chat-profile-pic"
            src="${defaultPic}"
          >
          <div class="chat-header-info">
            <h3 class="chat-username">${headerTitle}</h3>
          </div>
        </div>
        <div class="chat-header-right">
          <button id="ver-status" class="ver-status">Info</button>
          <button
            type="button"
            class="open-mobile-chats chat-header-mobile-button"
            id="open-mobile-chats-group"
          >
            Chats recientes
          </button>
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

    if (typeof window.closeMobileChatsPanel === "function") {
      window.closeMobileChatsPanel();
    }
    if (typeof window.attachMobileChatsButtons === "function") {
      window.attachMobileChatsButtons(this.mainContainer);
    }

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

    const img = document.getElementById("chat-profile-pic");
    if (img) {
      img.src = this.groupAvatar || "/images/app/grupo_default_image.png";
    }

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

  async updateGroupAvatar(avatarUrl) {
    this.clearGroupAvatarObjectUrl();
    if (!avatarUrl) {
      this.groupAvatar = "/images/app/grupo_default_image.png";
      return;
    }

    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      this.groupAvatar = "/images/app/grupo_default_image.png";
      return;
    }
    const endpoint = avatarUrl.startsWith("http")
      ? avatarUrl
      : `${browserUrl}${avatarUrl}`;

    try {
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${jwt}` } });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      this._groupAvatarObjectUrl = objectUrl;
      this.groupAvatar = objectUrl;
    } catch (err) {
      console.error("updateGroupAvatar:", err);
      this.groupAvatar = "/images/app/grupo_default_image.png";
    }
  }

  clearGroupAvatarObjectUrl() {
    if (this._groupAvatarObjectUrl) {
      URL.revokeObjectURL(this._groupAvatarObjectUrl);
      this._groupAvatarObjectUrl = null;
    }
  }
}
