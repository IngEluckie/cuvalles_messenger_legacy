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

    /* Estado inicial */
    this.state = {
      chatId:      null,
      nombre:      "",
      descripcion: "",
      members:     [],   // [{ user_id, username, foto_perfil, role }]
      isAdmin:     false
    };
  }

  /* ───────── utilidades básicas ───────── */
  hide() { this.container.style.display = "none"; }
  show() { this.container.style.display = "flex"; }
  regresarAlLogin() { window.location.href = browser_url + "/login.html"; }

  /* ───────── setter que refresca la UI ───────── */
  setState(partial) {
    Object.assign(this.state, partial);
    this.render();
    this.bindEvents();
  }

  /* ───────── carga de datos ───────── */
  async load(chatId) {
    const jwt = localStorage.getItem("jwt");
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
        isAdmin:     data.is_admin
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

    this.container.innerHTML = /*html*/`
      <button class="close-btn">×</button>

      <!-- Encabezado -->
      <div class="conf-header">
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
        ${members.map(m => `
          <li class="member-item" data-id="${m.user_id}">
            <!--img src="${m.foto_perfil}" class="member-avatar"-->
            <span class="member-name">${m.username}${m.role === 'admin' ? ' (admin)' : ''}</span>
          </li>`).join("")}
      </ul>

      <div class="conf-footer">
        ${isAdmin ? '<button id="btn-configurar" class="icon-btn" title="Configurar grupo">⚙️</button>' : ''}
        <button class="btn-leave">Salir ❌</button>
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
      if (window.barraLateralInstance?.loadChats) window.barraLateralInstance.loadChats(true);
    } catch (err) {
      console.error("Error al salir del grupo:", err);
      alert("No fue posible salir del grupo.");
    }
  }

  /* ───────── API pública ───────── */
  open(chatId) { this.show(); this.load(chatId); }
}
