// chats.js – versión completa con auto‐recarga de la conversación tras reload

const browserUrl = window.location.origin;

export class Chats {
  constructor(mainContainerSelector, wsInstance, user, infoUsersBarra) {
    /* ---------- referencias y estado ---------- */
    this.mainContainer = document.querySelector(mainContainerSelector);
    if (!this.mainContainer) {
      console.error("No se encontró el contenedor:", mainContainerSelector);
      return;
    }

    try {
      this.myUserId = JSON.parse(localStorage.getItem("user") || "{}").id ?? null;
    } catch (e) {
      console.error("Error al parsear user:", e);
    }

    this.chatId = null;
    this.otherUserUsername = null;
    this.messages = [];
    this.limit = 20;
    this.offset = 0;
    this.attachmentCache = new Map();
    this.conversationElement = null;
    this.user = user;
    this.infoUsersBarra = infoUsersBarra;

    /* ---------- WebSocket ---------- */
    this.ws = wsInstance;
    if (this.ws && typeof this.ws.registerOnMessageCallback === "function") {
      this.ws.registerOnMessageCallback(async msg => {
        await this.handleIncomingMessage(msg);
      });
    }

    /* ---------- Auto-recarga si hay chat previo ---------- */
    const lastChatId = sessionStorage.getItem("lastChatId");
    const lastChatName = sessionStorage.getItem("lastChatName");
    const lastChatType = sessionStorage.getItem("lastChatType");
    if (lastChatId && lastChatName && lastChatType !== "group") {
      // recarga la UI y la historia de mensajes
      this.openChatByChat({
        chat_id: lastChatId,
        chat_name: lastChatName
      });
    }
  }

  /* ========== 1. mensajes entrantes (async) ========== */
  async handleIncomingMessage(message) {
    if (!message || !message.chat_id) return;

    const incomingChatId = Number(message.chat_id);
    const activeChatId = this.chatId ? Number(this.chatId) : null;
    const incomingUserId = message.user_id != null ? Number(message.user_id) : null;
    const currentUserId = this.myUserId != null ? Number(this.myUserId) : null;

    const isCurrentChat = activeChatId != null && incomingChatId === activeChatId;
    const isOwnMessage = currentUserId != null && incomingUserId === currentUserId;

    if (!isOwnMessage) {
      // Reproduce el sonido aun si la conversación no está abierta.
      this.user?.messageSound?.();
    }

    if (isCurrentChat) {
      await this.renderMessages([message], false);
      this.messages.push(message);
    }
  }

  /* ========== 2. abrir chat ========== */
  async openChat(targetUsername) {
    try {
      this.otherUserUsername = targetUsername;
      const jwt = localStorage.getItem("jwt");
      const r = await fetch(
        `${browserUrl}/chats/open_single_chat/${encodeURIComponent(
          targetUsername
        )}?limit=${this.limit}&offset=${this.offset}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (!r.ok) return console.error("Error:", r.statusText);
      const data = await r.json();

      this.chatId = data.chat_id;
      this.messages = (data.messages ?? []).reverse();

      // persistir para recarga
      sessionStorage.setItem("lastChatId", this.chatId);
      sessionStorage.setItem("lastChatName", this.otherUserUsername);
      sessionStorage.setItem("lastChatType", "single");

      this.renderChatUI(targetUsername);
      await this.renderMessages(this.messages, false);
      this.handleScrollLoad();
      window.barraLateralInstance?.clearUnread(this.chatId);
    } catch (e) {
      console.error("openChat:", e);
    }
  }

  async openChatByChat(chatObj) {
    try {
      this.chatId = chatObj.chat_id;
      this.otherUserUsername = chatObj.chat_name;

      // persistir para recarga
      sessionStorage.setItem("lastChatId", this.chatId);
      sessionStorage.setItem("lastChatName", this.otherUserUsername);
      sessionStorage.setItem("lastChatType", "single");

      this.renderChatUI(this.otherUserUsername);

      const jwt = localStorage.getItem("jwt");
      const r = await fetch(
        `${browserUrl}/chats/get_chat/${this.chatId}?limit=${this.limit}&offset=0`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (!r.ok) return console.error("Error:", r.statusText);
      const data = await r.json();
      this.messages = (data.messages ?? []).reverse();

      await this.renderMessages(this.messages, false);
      this.handleScrollLoad();
      window.barraLateralInstance?.clearUnread(this.chatId);
    } catch (e) {
      console.error("openChatByChat:", e);
    }
  }

  /* ========== 3. utils (imagen de perfil / status) ========== */
  async userProfilePic(otherUserId) {
    const endpoint = `${browserUrl}/media/images/${otherUserId}.webp`;
    const jwt = localStorage.getItem("jwt");
    try {
      const r = await fetch(endpoint, { headers: { Authorization: `Bearer ${jwt}` } });
      if (!r.ok) return "/images/app/default_user.png";
      const blob = await r.blob();
      return URL.createObjectURL(blob);
    } catch {
      return "/images/app/default_user.png";
    }
  }

  async checkOtherUserOnline(username) {
    const jwt = localStorage.getItem("jwt");
    try {
      const r = await fetch(`${browserUrl}/is_user_on/${username}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!r.ok) return;
      const { online } = await r.json();
      const img = document.getElementById("chat-profile-pic");
      if (img) img.style.border = online ? "2px solid green" : "2px solid #B00020";
    } catch (e) {
      console.error(e);
    }
  }

  /* ========== 4. UI base del chat ========== */
  renderChatUI(chatName) {
    const defaultPic = "/images/app/default_user.png";
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
          <button id="ver-status" class="ver-status">Ver status</button>
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
    if (this.conversationElement) {
      this.conversationElement.addEventListener("click", e =>
        this.handleConversationClick(e)
      );
    }

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

    this.mainContainer
      .querySelector("#ver-status")
      .addEventListener("click", async () => {
        this.infoUsersBarra.show();
        await this.infoUsersBarra.get_status(chatName);
      });
  }

  /* ========== 5. adjuntos util / render ========== */
  async getAttachmentData(messageId, force = false) {
    if (!force && this.attachmentCache.has(messageId)) {
      return this.attachmentCache.get(messageId);
    }
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return null;
    try {
      const response = await fetch(
        `${browserUrl}/chats/attachments/${messageId}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (!response.ok) return null;
      const disposition = response.headers.get("Content-Disposition") || "";
      const rawName =
        this.parseFilenameFromDisposition(disposition) || `archivo_${messageId}`;
      const filename = this.normalizeFileName(rawName);
      const blob = await response.blob();
      const mimeType = blob.type || response.headers.get("Content-Type") || "";
      const objectUrl = URL.createObjectURL(blob);
      const data = { objectUrl, mimeType, filename };
      this.attachmentCache.set(messageId, data);
      return data;
    } catch (error) {
      console.error("getAttachmentData:", error);
      return null;
    }
  }

  parseFilenameFromDisposition(disposition = "") {
    const utf8Match = disposition.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
    if (utf8Match && utf8Match[1]) {
      const value = utf8Match[1].replace(/["']/g, "").trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
    const match = disposition.match(/filename="?([^";]+)"?/i);
    return match ? match[1].replace(/["']/g, "").trim() : null;
  }

  escapeHtml(value = "") {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  escapeAttr(value = "") {
    return this.escapeHtml(value);
  }

  normalizeFileName(name = "") {
    const trimmed = String(name).trim();
    const parts = trimmed.split(/[/\\]/);
    return parts.pop() || "archivo";
  }

  isImageMime(mime = "") {
    return /^image\//i.test(mime);
  }

  buildDownloadMarkup(messageId, filename, label = "Descargar archivo") {
    const cleanName = this.normalizeFileName(filename || "archivo");
    const safeAttr = this.escapeAttr(cleanName);
    const safeLabel = this.escapeHtml(label);
    return `<a href="#" class="chat-attachment-download" data-attachment-download="true" data-message-id="${messageId}" data-filename="${safeAttr}">📎 ${safeLabel}</a>`;
  }

  async buildAttachmentContent(message) {
    const attachment = message.attachment || {};
    const messageId = message.message_id;
    const displayName = this.normalizeFileName(
      attachment.original_name || attachment.file_name || `archivo_${messageId}`
    );
    const mimeType = attachment.mime_type || "";
    const shouldPreview = attachment.is_image || this.isImageMime(mimeType);

    if (shouldPreview) {
      const data = await this.getAttachmentData(messageId);
      if (data?.objectUrl) {
        return `
          <div class="chat-attachment chat-attachment-image">
            <img
              src="${data.objectUrl}"
              alt="${this.escapeAttr(displayName)}"
              class="chat-attachment-thumb"
            >
            ${this.buildDownloadMarkup(messageId, displayName, "Descargar archivo")}
          </div>
        `;
      }
    }

    return this.buildDownloadMarkup(messageId, displayName);
  }

  async buildLegacyAttachmentContent(message) {
    const data = await this.getAttachmentData(message.message_id);
    if (!data) {
      return this.buildDownloadMarkup(message.message_id, "archivo");
    }

    if (this.isImageMime(data.mimeType)) {
      return `
        <div class="chat-attachment chat-attachment-image">
          <img
            src="${data.objectUrl}"
            alt="${this.escapeAttr(data.filename)}"
            class="chat-attachment-thumb"
          >
          ${this.buildDownloadMarkup(
            message.message_id,
            data.filename,
            "Descargar archivo"
          )}
        </div>
      `;
    }

    return this.buildDownloadMarkup(message.message_id, data.filename);
  }

  formatMessageText(content) {
    if (typeof content !== "string") return "";
    return this.escapeHtml(content).replace(/\n/g, "<br>");
  }

  async renderMessages(msgList, prepend = false) {
    if (!this.conversationElement) return;

    const enriched = await Promise.all(
      msgList.map(async m => {
        if (m?.attachment) {
          m.content = await this.buildAttachmentContent(m);
        } else if (m.content === "[archivo adjunto]") {
          m.content = await this.buildLegacyAttachmentContent(m);
        } else {
          m.content = this.formatMessageText(m.content);
        }
        return m;
      })
    );

    let html = "";
    enriched.forEach(m => {
      const isMine = parseInt(m.user_id) === parseInt(this.myUserId);
      const cls    = isMine ? "mine" : "theirs";
      const hasAttachment = /chat-attachment/.test(m.content);
      const classes = ["message-item", cls];
      if (hasAttachment) classes.push("has-attachment");
      const classAttr = classes.join(" ");
      const author = isMine
        ? ""
        : `<span class="message-author">${this.escapeHtml(m.username)}</span>`;
      html += `
        <div class="${classAttr}">
          ${author}
          <div class="message-content">${m.content}</div>
          <span class="message-date">${m.created_at}</span>
        </div>`;
    });

    if (prepend) {
      const oldH = this.conversationElement.scrollHeight;
      this.conversationElement.insertAdjacentHTML("afterbegin", html);
      this.conversationElement.scrollTop =
        this.conversationElement.scrollHeight - oldH;
    } else {
      this.conversationElement.insertAdjacentHTML("beforeend", html);
      this.conversationElement.scrollTop = this.conversationElement.scrollHeight;
    }
  }

  handleConversationClick(event) {
    const target = event.target.closest("[data-attachment-download]");
    if (!target) return;
    event.preventDefault();
    const messageId = target.getAttribute("data-message-id");
    const filename = target.getAttribute("data-filename");
    if (messageId) {
      this.downloadAttachment(messageId, filename);
    }
  }

  async downloadAttachment(messageId, filenameHint) {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return;
    try {
      const response = await fetch(
        `${browserUrl}/chats/attachments/${messageId}`,
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      if (!response.ok) {
        console.error("downloadAttachment:", response.statusText);
        return;
      }
      const disposition = response.headers.get("Content-Disposition") || "";
      const rawName =
        this.parseFilenameFromDisposition(disposition) ||
        filenameHint ||
        `archivo_${messageId}`;
      const filename = this.normalizeFileName(rawName);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (error) {
      console.error("downloadAttachment:", error);
    }
  }

  /* ========== 6. enviar texto ========== */
  async handleSendMessage() {
    const textarea = this.mainContainer.querySelector("#messageInput");
    const text = textarea.value.trim();
    if (!text) return;

    const jwt = localStorage.getItem("jwt");
    try {
      const r = await fetch(
        `${browserUrl}/chats/${this.chatId}/send_message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${jwt}`
          },
          body: JSON.stringify({ content: text })
        }
      );
      if (!r.ok) return console.error("Error:", r.statusText);
      const newMsg = await r.json();
      const outgoing = JSON.parse(JSON.stringify(newMsg));
      await this.renderMessages([newMsg], false);
      this.messages.push(newMsg);
      textarea.value = "";
      this.ws?.sendMessage?.(outgoing);
    } catch (e) {
      console.error("handleSendMessage:", e);
    }
  }

  /* ========== 7. enviar archivos ========== */
  async handleFileSelected(event) {
    const files = event.target.files;
    if (!files?.length) return;
    const jwt = localStorage.getItem("jwt");

    for (const file of files) {
      const fd = new FormData();
      fd.append("file", file, file.name);

      try {
        const r = await fetch(
          `${browserUrl}/chats/${this.chatId}/send_file`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${jwt}` },
            body: fd
          }
        );
        if (!r.ok) {
          console.error("Subida falló:", r.statusText);
          continue;
        }
        const data = await r.json();
        const newMessage = data.message || {};
        if (data.attachment) {
          newMessage.attachment = data.attachment;
        }
        const outgoing = JSON.parse(JSON.stringify(newMessage));
        if (newMessage.message_id && file) {
          const previewUrl = URL.createObjectURL(file);
          const cachedName = this.normalizeFileName(
            data?.attachment?.original_name || file.name || "archivo"
          );
          this.attachmentCache.set(newMessage.message_id, {
            objectUrl: previewUrl,
            mimeType: file.type,
            filename: cachedName,
          });
        }
        await this.renderMessages([newMessage], false);
        this.messages.push(newMessage);
        this.ws?.sendMessage?.(outgoing);
      } catch (e) {
        console.error("handleFileSelected:", e);
      }
    }
    event.target.value = "";
  }

  /* ========== 8. scroll / paginación ========== */
  handleScrollLoad() {
    if (!this.conversationElement) return;
    this.conversationElement.addEventListener("scroll", async () => {
      if (this.conversationElement.scrollTop === 0) {
        this.offset += this.limit;
        const older = await this.fetchMoreMessages(this.offset, this.limit);
        if (older.length) {
          older.reverse();
          await this.renderMessages(older, true);
          this.messages = [...older, ...this.messages];
        }
      }
    });
  }

  async fetchMoreMessages(offset, limit) {
    const jwt = localStorage.getItem("jwt");
    const url = this.otherUserUsername
      ? `${browserUrl}/chats/open_single_chat/${encodeURIComponent(
          this.otherUserUsername
        )}?limit=${limit}&offset=${offset}`
      : `${browserUrl}/chats/get_chat/${this.chatId}?limit=${limit}&offset=${offset}`;

    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      if (!r.ok) return [];
      const data = await r.json();
      return data.messages ?? [];
    } catch {
      return [];
    }
  }
}
