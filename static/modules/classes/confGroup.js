/* modules/classes/confGroup.js – versión con botón de configuración (solo admin) */
const browser_url  = window.location.origin;
const api_base_url = `${browser_url}/chats`;

export class ConfGroup {
  /**
   * @param {string} containerSelector  Selector CSS donde se inyecta el sidebar
   * @param {{ gm?: any }} opts         Opciones (puedes pasar GroupManager via opts.gm)
   */
  constructor(containerSelector, opts = {}) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) throw new Error(`No se encontró el contenedor: ${containerSelector}`);

    this.gm = opts.gm;  // referencia opcional a GroupManager
    this.chatManager = opts.chatManager || null;
    this._groupAvatarObjectUrl = null;
    this._currentGroupAvatarSource = null;

    /* Estado inicial */
    this.state = {
      chatId:      null,
      nombre:      "",
      descripcion: "",
      members:     [],   // [{ user_id, username, foto_perfil, role }]
      isAdmin:     false,
      avatarUrl:   null
    };
  }

  /* ───────── utilidades básicas ───────── */
  hide() {
    this.container.style.display = "none";
    this.clearGroupAvatarObjectUrl();
  }
  show() { this.container.style.display = "flex"; }
  regresarAlLogin() { window.location.href = browser_url + "/login.html"; }
  attachChatManager(manager) { this.chatManager = manager; }

  /* ───────── setter que refresca la UI ───────── */
  setState(partial) {
    Object.assign(this.state, partial);
    this.render();
    this.bindEvents();
    this.populateMemberAvatars();
    this.populateGroupAvatar();
  }

  /* ───────── carga de datos ───────── */
  async load(chatId) {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      avatarEl.src = "/images/app/grupo_default_image.png";
      return;
    }
    if (!jwt) { this.regresarAlLogin(); return; }

    try {
      const res = await fetch(`${api_base_url}/grupo_info/${chatId}`, { headers: { Authorization: `Bearer ${jwt}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      this.setState({
        chatId:      data.chat_id,
        nombre:      data.nombre,
        descripcion: data.descripcion || "",
        members:     data.members,
        isAdmin:     data.is_admin,
        avatarUrl:   data.avatar_url || null
      });
    } catch (err) {
      console.error("Error al obtener info del grupo:", err);
      alert("No se pudo cargar la información del grupo.");
      this.hide();
    }
  }

  /* ───────── render ───────── */
  render() {
    const { nombre, descripcion, members, isAdmin } = this.state;

    // Asegura estilos específicos para vista de grupo
    this.container.classList.add("info--group");
    this.container.classList.remove("info--user");

    this.container.innerHTML = /*html*/`
      <button class="close-btn">×</button>
      <div class="info-content-scroll">
        <!-- Encabezado -->
        <div class="conf-header">
          <img id="conf-group-avatar" class="conf-avatar" src="/images/app/grupo_default_image.png" alt="${nombre}">
          <div class="conf-header-col">
            <div class="conf-name-row">
              <h2>${nombre}</h2>
            </div>
          </div>
        </div>

        <!-- Descripción -->
        <div class="section-header">
          <h3>Descripción</h3>
        </div>
        <textarea id="conf-desc" class="desc-area" readonly>${descripcion}</textarea>

        <!-- Integrantes -->
        <div class="section-header" style="margin-top:24px;">
          <h3>Integrantes</h3>
        </div>
        <ul class="member-list">
          ${members.map(member => {
            const avatar = member.foto_perfil || "/images/app/default_user.png";
            const statusLine = member.status || member.descripcion || "";
            const isAdmin = member.role === "admin";
            return `
              <li class="member-item" data-id="${member.user_id}">
                <div class="member-left">
                  <img src="${avatar}" alt="${member.username}" class="member-avatar" data-username="${member.username}" />
                  <div class="member-text">
                    <span class="member-name">${member.username}</span>
                    ${statusLine ? `<span class="member-status">${statusLine}</span>` : ""}
                  </div>
                </div>
                <div class="member-right">
                  ${isAdmin ? `<span class="member-admin">Admin</span>` : ""}
                  <button class="member-chat-btn" data-user-id="${member.user_id}" aria-label="Abrir chat con ${member.username}">
                    <span class="member-chat-icon">&gt;</span>
                  </button>
                </div>
              </li>
            `;
          }).join("")}
        </ul>

        <div class="conf-footer">
          ${isAdmin ? '<button id="btn-configurar" class="icon-btn" title="Configurar grupo">⚙️</button>' : ''}
          <button class="btn-leave">Salir ❌</button>
        </div>
      </div>
    `;
  }

  /* ───────── listeners ───────── */
  bindEvents() {
    // Cerrar panel
    this.container.querySelector(".close-btn")?.addEventListener("click", () => this.hide());

    // Botón configurar (solo admin)
    this.container.querySelector("#btn-configurar")?.addEventListener("click", () => {
      this.hide();
      if (this.gm && typeof this.gm.modificarGrupo === "function") {
        this.gm.modificarGrupo(this.state.chatId);
      } else {
        alert("No se pudo abrir el configurador. GroupManager no disponible.");
      }
    });

    // Salir del grupo
    this.container.querySelector(".btn-leave")?.addEventListener("click", () => this.leaveGroup());

    // Abrir chat individual
    this.container.querySelectorAll(".member-chat-btn").forEach(btn => {
      btn.addEventListener("click", (event) => {
        const { userId } = event.currentTarget.dataset;
        if (!userId) return;
        if (this.chatManager && typeof this.chatManager.openChat === "function") {
          this.chatManager.openChat(userId);
          this.hide();
        } else {
          console.warn("ChatManager no configurado, no se puede abrir el chat individual.");
        }
      });
    });
  }

  populateMemberAvatars() {
    const jwt = localStorage.getItem("jwt");
    if (!jwt) return;
    this.container.querySelectorAll(".member-avatar[data-username]").forEach(img => {
      const username = img.dataset.username;
      if (!username) return;
      fetch(`${browser_url}/media/images/${username}.webp`, {
        headers: {
          Authorization: `Bearer ${jwt}`
        }
      })
        .then(res => {
          if (!res.ok) throw new Error(res.statusText);
          return res.blob();
        })
        .then(blob => {
          const objectUrl = URL.createObjectURL(blob);
          img.src = objectUrl;
        })
        .catch(err => {
          console.warn(`No se pudo cargar la imagen de ${username}:`, err);
          img.src = "/images/app/default_user.png";
      });
    });
  }

  populateGroupAvatar() {
    const avatarEl = this.container.querySelector("#conf-group-avatar");
    if (!avatarEl) return;

    const avatarPath = this.state.avatarUrl;
    if (!avatarPath) {
      this.clearGroupAvatarObjectUrl();
      this._currentGroupAvatarSource = null;
      avatarEl.src = "/images/app/grupo_default_image.png";
      return;
    }

    if (avatarPath === this._currentGroupAvatarSource && this._groupAvatarObjectUrl) {
      avatarEl.src = this._groupAvatarObjectUrl;
      return;
    }

    this.clearGroupAvatarObjectUrl();
    this._currentGroupAvatarSource = avatarPath;

    const jwt = localStorage.getItem("jwt");
    if (!jwt) {
      avatarEl.src = "/images/app/grupo_default_image.png";
      return;
    }

    const endpoint = avatarPath.startsWith("http")
      ? avatarPath
      : `${browser_url}${avatarPath}`;

    fetch(endpoint, {
      headers: { Authorization: `Bearer ${jwt}` }
    })
      .then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
        this._groupAvatarObjectUrl = objectUrl;
        avatarEl.src = objectUrl;
      })
      .catch(err => {
        console.warn("No se pudo cargar avatar del grupo:", err);
        this.clearGroupAvatarObjectUrl();
        avatarEl.src = "/images/app/grupo_default_image.png";
      });
  }

  /* ───────── salir del grupo ───────── */
  async leaveGroup() {
    if (!confirm("¿Seguro que deseas salir de este grupo?")) return;
    const jwt = localStorage.getItem("jwt");
    if (!jwt) { this.regresarAlLogin(); return; }
    try {
      const res = await fetch(`${api_base_url}/${this.state.chatId}/leave`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` }
      });
      if (!res.ok) throw new Error(await res.text());
      this.hide();
      // Recarga barra lateral si existe
      if (window.barraLateralInstance?.reload) window.barraLateralInstance.reload();
    } catch (err) {
      console.error("Error al salir del grupo:", err);
      alert("No fue posible salir del grupo.");
    }
  }

  /* ───────── API pública ───────── */
  open(chatId) { this.show(); this.load(chatId); }

  clearGroupAvatarObjectUrl() {
    if (this._groupAvatarObjectUrl) {
      URL.revokeObjectURL(this._groupAvatarObjectUrl);
      this._groupAvatarObjectUrl = null;
    }
    this._currentGroupAvatarSource = null;
  }
}
