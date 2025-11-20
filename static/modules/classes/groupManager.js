/* modules/classes/groupManager.js – corrección de sintaxis y duplicados */
const browser_url = window.location.origin;

export class GroupManager {
  constructor(containerSelector = '#modalCrearGrupo', { onGrupoActualizado = () => {} } = {}) {
    this.container = document.querySelector(containerSelector);
    if (!this.container) throw new Error(`No se encontró el contenedor: ${containerSelector}`);

    /* Callback para refrescar barra lateral, etc. */
    this.onGrupoActualizado = onGrupoActualizado;

    /* ----------------- Referencias DOM ----------------- */
    this.btnOpen      = document.querySelector('.btn-crear-grupo');
    this.btnClose     = this.container.querySelector('#closeCrearGrupo');
    this.inputNombre  = this.container.querySelector('#nombreGrupo');
    this.inputDesc    = this.container.querySelector('#descripcionGrupo');
    this.inputBuscar  = this.container.querySelector('#buscarUsuario');
    this.resultsBox   = this.container.querySelector('#usuariosOpciones');
    this.listSelect   = this.container.querySelector('#usuariosSeleccionados');
    this.btnSubmit    = this.container.querySelector('#btn-iniciar-creacion');
    this.avatarPreview   = this.container.querySelector('#groupAvatarPreview');
    this.btnChangeAvatar = this.container.querySelector('#btnCambiarFotoGrupo');
    this.inputAvatarFile = this.container.querySelector('#inputFotoGrupo');

    /* Span de error tras el nombre */
    this.errorNombre = document.createElement('span');
    this.errorNombre.classList.add('error');
    this.errorNombre.style.fontSize = '0.8rem';
    this.errorNombre.style.marginLeft = '8px';
    this.inputNombre.parentNode.insertBefore(this.errorNombre, this.inputNombre.nextSibling);

    /* ----------------------- Estado ----------------------- */
    this.state = {
      modo: 'crear',         // 'crear' | 'editar'
      chatId: null,
      nombre: '',
      descripcion: '',
      miembros: [],          // array de usernames
      searchResults: [],
      errores: {},
      avatarPreviewUrl: '/images/app/grupo_default_image.png',
      avatarFile: null
    };

    this._avatarObjectUrl = null;

    this.bindEvents();
    this.render();
  }

  /* ========= Métodos de visibilidad ========= */
  hide() {
    this.container.style.display = 'none';
    this._clearAvatarObjectUrl();
    if (this.inputAvatarFile) this.inputAvatarFile.value = '';
  }
  show() { this.container.style.display = 'block'; }

  /* ========= Gestión de estado ========= */
  setState(partial) {
    this.state = { ...this.state, ...partial };
    this.render();
  }

  /* ========= Flujos públicos ========= */
  crearGrupo() {
    this._clearAvatarObjectUrl();
    this.setState({
      modo: 'crear', chatId: null,
      nombre: '', descripcion: '', miembros: [],
      searchResults: [], errores: {},
      avatarPreviewUrl: '/images/app/grupo_default_image.png',
      avatarFile: null
    });
    this.show();
    if (this.inputAvatarFile) this.inputAvatarFile.value = '';
  }

  async modificarGrupo(chatId) {
    this.setState({ modo: 'editar', chatId, errores: {} });
    try {
      const data = await this.fetchGroupInfo(chatId);
      const miembros = (data.members || []).map(m => m.username);
      const avatarPreviewUrl = await this.prepareAvatarPreview(data.avatar_url);
      this.setState({
        nombre: data.nombre,
        descripcion: data.descripcion || '',
        miembros,
        avatarPreviewUrl,
        avatarFile: null
      });
      this.show();
      if (this.inputAvatarFile) this.inputAvatarFile.value = '';
    } catch (err) {
      console.error(err);
      alert('No se pudo cargar la información del grupo.');
    }
  }

  /* ========= Backend helpers ========= */
  async fetchGroupInfo(chatId) {
    const token = localStorage.getItem('jwt');
    if (!token) throw new Error('Sesión no válida.');
    if (!token) return '/images/app/grupo_default_image.png';
    const resp = await fetch(`${browser_url}/chats/grupo_info/${chatId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) throw new Error(await resp.text());
    return resp.json();
  }

  async updateGroup() {
    const { chatId, nombre, descripcion, miembros } = this.state;
    if (!this.validate()) return;

    const token = localStorage.getItem('jwt');
    const resp = await fetch(`${browser_url}/chats/grupos/${chatId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim(), members: miembros })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || resp.statusText);
    }

    return resp.json().catch(() => ({}));
  }

  async createGroup() {
    const { nombre, descripcion, miembros } = this.state;
    if (!this.validate()) return;

    const token = localStorage.getItem('jwt');
    const resp = await fetch(`${browser_url}/chats/grupos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre: nombre.trim(), descripcion: descripcion.trim(), members: miembros })
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || resp.statusText);
    }

    return resp.json();
  }

  /* ========= Validación ========= */
  validate() {
    const { nombre, miembros } = this.state;
    if (!nombre.trim()) {
      this.setState({ errores: { nombre: 'Campo obligatorio' } });
      return false;
    }
    if (miembros.length === 0) {
      alert('Selecciona al menos un miembro para el grupo.');
      return false;
    }
    this.setState({ errores: {} });
    return true;
  }

  /* ========= Render ========= */
  render() {
    const { modo, nombre, descripcion, miembros, searchResults, errores } = this.state;

    this.inputNombre.value = nombre;
    this.errorNombre.textContent = errores.nombre || '';
    if (this.inputDesc) this.inputDesc.value = descripcion;
    this.btnSubmit.textContent = modo === 'crear' ? 'Crear' : 'Guardar';

    // Resultados búsqueda
    this.resultsBox.innerHTML = searchResults.map(u => `<div class="search-result-item" data-user-id="${u}">${u}</div>`).join('');
    this.resultsBox.style.display = searchResults.length ? 'block' : 'none';

    // Seleccionados
    this.listSelect.innerHTML = miembros.map(u => GroupManager.selectedMemberTemplate(u)).join('');
    this.listSelect.style.display = miembros.length ? 'block' : 'none';

    if (this.avatarPreview) {
      this.avatarPreview.src = this.state.avatarPreviewUrl || '/images/app/grupo_default_image.png';
    }

    this.populateSelectedAvatars();
  }

  /* ========= Eventos ========= */
  bindEvents() {
    // Abrir modal nuevo grupo
    this.btnOpen?.addEventListener('click', () => this.crearGrupo());
    // Cerrar modal
    this.btnClose.addEventListener('click', () => this.hide());
    window.addEventListener('click', e => { if (e.target === this.container) this.hide(); });

    // Inputs
    this.inputNombre.addEventListener('input', e => this.setState({ nombre: e.target.value }));
    if (this.inputDesc) this.inputDesc.addEventListener('input', e => this.setState({ descripcion: e.target.value }));

    // Búsqueda
    this.inputBuscar.addEventListener('input', GroupManager.debounce(e => this.handleSearch(e), 300));

    // Seleccionar usuario de búsqueda
    this.resultsBox.addEventListener('click', e => {
      const usr = e.target.dataset.userId;
      if (!usr) return;
      this.setState({ miembros: Array.from(new Set([...this.state.miembros, usr])), searchResults: [] });
    });

    // Quitar usuario
    this.listSelect.addEventListener('click', e => {
      if (!e.target.classList.contains('seleccionado-remove')) return;
      const card = e.target.closest('[data-user-id]');
      if (!card) return;
      const usr = card.dataset.userId;
      const img = card.querySelector('.seleccionado-avatar');
      if (img?.dataset.objectUrl) {
        URL.revokeObjectURL(img.dataset.objectUrl);
      }
      this.setState({ miembros: this.state.miembros.filter(u => u !== usr) });
    });

    // Submit
    this.btnSubmit.addEventListener('click', async () => {
      try {
        let chatId = this.state.chatId;
        if (this.state.modo === 'crear') {
          const data = await this.createGroup();
          chatId = data?.chat_id ?? null;
          if (chatId && this.state.avatarFile) {
            await this.uploadGroupAvatar(chatId);
          }
        } else {
          await this.updateGroup();
          if (this.state.avatarFile && chatId) {
            await this.uploadGroupAvatar(chatId);
          }
        }
        alert(`Grupo “${this.state.nombre}” ${this.state.modo === 'crear' ? 'creado' : 'actualizado'} 🎉`);
        this.hide();
        this.onGrupoActualizado();
      } catch (err) {
        console.error(err);
        alert(`No se pudo ${this.state.modo === 'crear' ? 'crear' : 'actualizar'} el grupo: ${err.message}`);
      }
    });

    // Avatar: abrir selector
    this.btnChangeAvatar?.addEventListener('click', () => {
      this.inputAvatarFile?.click();
    });

    // Avatar: previsualizar archivo
    this.inputAvatarFile?.addEventListener('change', e => this.handleAvatarSelection(e));
  }

  /* ========= Búsqueda remota ========= */
  async handleSearch(e) {
    const q = e.target.value.trim();
    if (q.length < 2) { this.setState({ searchResults: [] }); return; }
    try {
      const token = localStorage.getItem('jwt');
      const resp = await fetch(`${browser_url}/chats/search_user_navbar/${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      this.setState({ searchResults: data.flat() });
    } catch {
      this.setState({ searchResults: [] });
    }
  }

  /* ========= Debounce ========= */
  static debounce(fn, delay) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  static selectedMemberTemplate(username) {
    return `
      <div class="seleccionado-card" data-user-id="${username}">
        <div class="seleccionado-info">
          <img src="/images/app/default_user.png" alt="${username}" class="seleccionado-avatar" data-username="${username}">
          <span class="seleccionado-name">${username}</span>
        </div>
        <div class="seleccionado-actions">
          <span class="seleccionado-arrow">&gt;</span>
          <button class="seleccionado-remove" aria-label="Quitar ${username}">✕</button>
        </div>
      </div>
    `;
  }

  populateSelectedAvatars() {
    const jwt = localStorage.getItem('jwt');
    if (!jwt) return;

    Array.from(this.listSelect.querySelectorAll('.seleccionado-avatar[data-username]')).forEach(img => {
      const username = img.dataset.username;
      if (!username) return;

      fetch(`${browser_url}/media/images/${encodeURIComponent(username)}.webp`, {
        headers: { Authorization: `Bearer ${jwt}` }
      })
        .then(res => {
          if (!res.ok) throw new Error(res.statusText);
          return res.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          if (img.dataset.objectUrl) {
            URL.revokeObjectURL(img.dataset.objectUrl);
          }
          img.src = url;
          img.dataset.objectUrl = url;
        })
        .catch(() => {
          img.src = '/images/app/default_user.png';
        });
    });
  }

  async uploadGroupAvatar(chatId) {
    const file = this.state.avatarFile;
    if (!file) return null;

    const token = localStorage.getItem('jwt');
    const formData = new FormData();
    formData.append('file', file);

    const resp = await fetch(`${browser_url}/media/groups/${chatId}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || resp.statusText);
    }

    const data = await resp.json().catch(() => ({}));
    const avatarUrl = data?.avatar_url;
    if (avatarUrl) {
      const preview = await this.prepareAvatarPreview(avatarUrl);
      this.setState({ avatarPreviewUrl: preview, avatarFile: null });

      if (window.groupChats?.chatId && Number(window.groupChats.chatId) === Number(chatId)) {
        try {
          await window.groupChats.updateGroupAvatar(avatarUrl);
          const headerImg = document.getElementById("chat-profile-pic");
          if (headerImg && window.groupChats.groupAvatar) {
            headerImg.src = window.groupChats.groupAvatar;
          }
        } catch (err) {
          console.error("No se pudo actualizar la vista del grupo con el nuevo avatar:", err);
        }
      }

      try {
        window.barraLateralInstance?.updateGroupAvatar?.(chatId, avatarUrl);
      } catch (err) {
        console.error("No se pudo refrescar el avatar en la barra lateral:", err);
      }

      try {
        if (window.configuracionGrupos?.state?.chatId === chatId) {
          window.configuracionGrupos.setState({ avatarUrl });
        }
      } catch (err) {
        console.error("No se pudo actualizar la vista de configuración de grupo:", err);
      }
    } else {
      this.setState({ avatarFile: null });
    }
    if (this.inputAvatarFile) this.inputAvatarFile.value = '';
    return data;
  }

  async prepareAvatarPreview(avatarUrl) {
    if (!avatarUrl) {
      this._clearAvatarObjectUrl();
      return '/images/app/grupo_default_image.png';
    }

    if (avatarUrl.startsWith("blob:")) {
      if (this._avatarObjectUrl && this._avatarObjectUrl !== avatarUrl) {
        this._clearAvatarObjectUrl();
      }
      this._avatarObjectUrl = avatarUrl;
      return avatarUrl;
    }

    this._clearAvatarObjectUrl();

    const token = localStorage.getItem('jwt');
    const isAbsolute = /^https?:\/\//i.test(avatarUrl) || avatarUrl.startsWith("data:");
    const endpoint = isAbsolute ? avatarUrl : `${browser_url}${avatarUrl}`;

    try {
      const resp = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(resp.statusText);
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      this._avatarObjectUrl = objectUrl;
      return objectUrl;
    } catch (err) {
      console.error("prepareAvatarPreview:", err);
      return '/images/app/grupo_default_image.png';
    }
  }

  handleAvatarSelection(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen válido.');
      event.target.value = '';
      return;
    }

    if (this._avatarObjectUrl) {
      URL.revokeObjectURL(this._avatarObjectUrl);
      this._avatarObjectUrl = null;
    }

    const objectUrl = URL.createObjectURL(file);
    this._avatarObjectUrl = objectUrl;
    this.setState({ avatarFile: file, avatarPreviewUrl: objectUrl });
  }

  _clearAvatarObjectUrl() {
    if (this._avatarObjectUrl) {
      URL.revokeObjectURL(this._avatarObjectUrl);
      this._avatarObjectUrl = null;
    }
  }
}
