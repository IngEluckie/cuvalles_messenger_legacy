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
    if (
      this.chatId &&
      parseInt(message.chat_id) === parseInt(this.chatId)
    ) {
      await this.renderMessages([message], false);
      this.messages.push(message);
      this.user.messageSound();
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
  async retrieveFileURL(messageId) {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return "[archivo adjunto]";
    try {
      const r = await fetch(`${browserUrl}/chats/attachments/${messageId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      return r.ok
        ? `${browserUrl}/chats/attachments/${messageId}`
        : "[archivo adjunto]";
    } catch {
      return "[archivo adjunto]";
    }
  }

  async renderMessages(msgList, prepend = false) {
    if (!this.conversationElement) return;

    const enriched = await Promise.all(
      msgList.map(async m => {
        if (m.content === "[archivo adjunto]") {
          const url = await this.retrieveFileURL(m.message_id);
          if (url !== "[archivo adjunto]") {
            const isImg = /\.(jpe?g|png|webp|gif)$/i.test(url);
            m.content = isImg
              ? `<a href="${url}" target="_blank">
                   <img src="${url}" class="chat-attachment-thumb">
                 </a>`
              : `<a href="${url}" target="_blank">📎 Descargar archivo</a>`;
          }
        }
        return m;
      })
    );

    let html = "";
    enriched.forEach(m => {
      const isMine = parseInt(m.user_id) === parseInt(this.myUserId);
      const cls    = isMine ? "mine" : "theirs";
      const author = isMine ? "" : `<span class="message-author">${m.username}</span>`;
      html += `
        <div class="message-item ${cls}">
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
      await this.renderMessages([newMsg], false);
      this.messages.push(newMsg);
      textarea.value = "";
      this.ws?.sendMessage?.(newMsg);
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
        const data = await r.json(); // contiene msg_id y relative_path

        // Render local del adjunto
        const fileUrl = `${browserUrl}${data.relative_path}`;
        const localMsg = {
          message_id: data.msg_id,
          chat_id: this.chatId,
          user_id: this.myUserId,
          created_at: new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " "),
          content: `<a href="${fileUrl}" target="_blank">${file.name}</a>`
        };
        await this.renderMessages([localMsg], false);
        this.messages.push(localMsg);

        // Placeholder para WebSocket
        const wsMsg = {
          message_id: data.msg_id,
          chat_id: this.chatId,
          user_id: this.myUserId,
          created_at: localMsg.created_at,
          content: "[archivo adjunto]"
        };
        this.ws?.sendMessage(wsMsg);
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
