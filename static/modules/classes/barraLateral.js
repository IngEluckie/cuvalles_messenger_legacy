// barraLateral.js

const browserUrl = window.location.origin;

export class BarraLateral {
  /**
   * @param {string} containerSelector - Selector del contenedor donde se renderizará la barra lateral.
   * @param {Chats}  chatsManager      - Instancia para chats 1-a-1.
   * @param {GroupChat} groupManager   - Instancia para chats grupales.
   * @param {Object} infoUsersBarra    - Gestor de la barra de info de usuario.
   */
  constructor(containerSelector, chatsManager, groupManager, infoUsersBarra) {
    this.container       = document.querySelector(containerSelector);
    if (!this.container) {
      console.error("No se encontró el contenedor para la BarraLateral:", containerSelector);
      return;
    }

    this.chatsManager    = chatsManager;
    this.groupManager    = groupManager;
    this.infoUsersBarra  = infoUsersBarra;

    this.limit     = 10;
    this.offset    = 0;
    this.loading   = false;
    this.chats     = [];       // [{ chat_id, chat_name, is_group }]
    this.unreadCounts = {};    // { chatId: count }
    this._intervals   = [];    // guarda setIntervals para limpiarlos
    this._groupAvatarUrls = new Map(); // { chatId: { objectUrl, source } }

    this.render();
    this.loadChats();
    this.setupScrollListener();
  }

  /* ──────────────────── Render base ──────────────────── */
  render() {
    this.container.innerHTML = "";
  }

  /* ──────────────────── Cargar lista de chats ──────────────────── */
  async loadChats() {
    if (this.loading) return;
    this.loading = true;

    try {
      const token    = localStorage.getItem("jwt");
      const response = await fetch(
        `${browserUrl}/chats/my_chats?limit=${this.limit}&offset=${this.offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        console.error("Error al cargar chats:", response.statusText);
        return;
      }

      const data  = await response.json();
      const chats = data.chats || [];
      this.chats  = this.chats.concat(chats);

      this.renderChats(chats);
      this.offset += this.limit;
    } catch (err) {
      console.error("Error en loadChats:", err);
    } finally {
      this.loading = false;
    }
  }

  /* ──────────────────── Helpers de perfil/online ──────────────────── */
  async userProfilePic(username) {
    const endpoint = `${browserUrl}/media/images/${username}.webp`;
    const jwt      = localStorage.getItem("jwt");

    try {
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${jwt}` } });
      if (res.ok) {
        const blob = await res.blob();
        return URL.createObjectURL(blob);
      }
    } catch {/* silencioso */}
    return "/images/app/default_user.png";
  }

  async groupAvatarPic(avatarPath, chatId) {
    if (!avatarPath) return "/images/app/grupo_default_image.png";
    const cached = this._groupAvatarUrls.get(chatId);
    if (cached && cached.source === avatarPath && cached.objectUrl) {
      return cached.objectUrl;
    }

    if (cached?.objectUrl) {
      URL.revokeObjectURL(cached.objectUrl);
      this._groupAvatarUrls.delete(chatId);
    }

    const endpoint = avatarPath.startsWith("http")
      ? avatarPath
      : `${browserUrl}${avatarPath}`;
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return "/images/app/grupo_default_image.png";

    try {
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${jwt}` } });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      this._groupAvatarUrls.set(chatId, { objectUrl, source: avatarPath });
      return objectUrl;
    } catch (err) {
      console.error("Error al obtener avatar de grupo:", err);
      return "/images/app/grupo_default_image.png";
    }
  }

  updateGroupAvatar(chatId, avatarUrl) {
    if (!chatId || !avatarUrl) return;
    const chat = this.chats.find(c => c.chat_id === chatId);
    if (chat) {
      chat.chat_avatar_url = avatarUrl;
    }
    this.groupAvatarPic(avatarUrl, chatId).then(url => {
      const img = document.getElementById(`chat-img-${chatId}`);
      if (img) img.src = url;
    });
  }

  async checkUserOnline(username, chatId) {
    const jwt = localStorage.getItem("jwt");
    try {
      const res = await fetch(`${browserUrl}/is_user_on/${username}`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      if (!res.ok) return;

      const { online } = await res.json();
      const img = document.getElementById(`chat-img-${chatId}`);
      if (img)
        img.style.border = online ? "3px solid green" : "3px solid #B00020";
    } catch (err) {
      console.error("Error en checkUserOnline():", err);
    }
  }

  /* ──────────────────── Render de cada chat ──────────────────── */
  renderChats(chats) {
    chats.forEach(chat => {
      const btn = document.createElement("button");
      btn.classList.add("chatbox");
      btn.dataset.chatId = chat.chat_id;

      const imgSrc = chat.is_group
        ? "/images/app/grupo_default_image.png"
        : "/images/app/default_user.png";

      btn.innerHTML = `
        <img src="${imgSrc}" class="chat_image" id="chat-img-${chat.chat_id}">
        <p  class="chat_info">${chat.chat_name}</p>
        <span class="unread-badge" id="badge-${chat.chat_id}" style="display:none">0</span>
      `;

      /* ───── Decidir manager según tipo de chat ───── */
      btn.addEventListener("click", () => {
        if (chat.is_group) {
          if (this.groupManager?.openGroupChat) {
            this.groupManager.openGroupChat(chat.chat_id);
          } else if (this.groupManager?.openChatByChat) {
            this.groupManager.openChatByChat(chat);          // fallback
          } else {
            console.error("groupManager no implementa openGroupChat / openChatByChat");
          }
        } else {
          if (this.chatsManager?.openChatByChat) {
            this.chatsManager.openChatByChat(chat);
          } else {
            console.error("chatsManager no implementa openChatByChat");
          }
        }

        this.infoUsersBarra.hide();
        this.clearUnread(chat.chat_id);
      });

      this.container.appendChild(btn);
      this._paintUnread(chat.chat_id);

      /* ───── Solo para chats 1-a-1: avatar y estado online ───── */
      if (chat.is_group) {
        if (chat.chat_avatar_url) {
          this.groupAvatarPic(chat.chat_avatar_url, chat.chat_id).then(url => {
            const img = document.getElementById(`chat-img-${chat.chat_id}`);
            if (img) img.src = url;
          });
        } else if (this._groupAvatarUrls.has(chat.chat_id)) {
          const entry = this._groupAvatarUrls.get(chat.chat_id);
          if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
          this._groupAvatarUrls.delete(chat.chat_id);
        }
      } else {
        this.userProfilePic(chat.chat_name).then(url => {
          const img = document.getElementById(`chat-img-${chat.chat_id}`);
          if (img) img.src = url;
        });

        const id = setInterval(() => {
          this.checkUserOnline(chat.chat_name, chat.chat_id);
        }, 1000);
        this._intervals.push(id);
      }
    });
  }

  /* ──────────────────── Scroll infinito ──────────────────── */
  setupScrollListener() {
    this.container.addEventListener("scroll", () => {
      if (
        this.container.scrollTop + this.container.clientHeight >=
        this.container.scrollHeight - 10
      ) {
        this.loadChats();
      }
    });
  }

  /* ──────────────────── Reload completo ──────────────────── */
  reload() {
    this._intervals.forEach(clearInterval);
    this._intervals = [];
    this._groupAvatarUrls.forEach(entry => {
      if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl);
    });
    this._groupAvatarUrls.clear();
    this.chats      = [];
    this.offset     = 0;
    this.loading    = false;
    this.render();
    this.loadChats();
  }

  /* ───────────── Gestión de no-leídos ───────────── */
  moveChatToTop(chatId) {
    const btn = this.container.querySelector(`[data-chat-id="${chatId}"]`);
    if (btn) this.container.prepend(btn);

    const idx = this.chats.findIndex(c => c.chat_id === chatId);
    if (idx > -1) {
      const [chatObj] = this.chats.splice(idx, 1);
      this.chats.unshift(chatObj);
    }
  }

  incrementUnread(chatId) {
    this.unreadCounts[chatId] = (this.unreadCounts[chatId] || 0) + 1;
    this._paintUnread(chatId);
    this.moveChatToTop(chatId);
  }

  clearUnread(chatId) {
    if (this.unreadCounts[chatId]) {
      delete this.unreadCounts[chatId];
      this._paintUnread(chatId);
    }
  }

  _paintUnread(chatId) {
    const badge = document.getElementById(`badge-${chatId}`);
    if (!badge) return;
    const count = this.unreadCounts[chatId] || 0;
    badge.textContent   = count;
    badge.style.display = count ? "inline-block" : "none";
  }
}
