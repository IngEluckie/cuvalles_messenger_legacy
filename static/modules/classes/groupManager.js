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
  hide() { this.container.style.display = 'none'; }
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
      if (!data.avatar_url) this._clearAvatarObjectUrl();
      this.setState({
        nombre: data.nombre,
        descripcion: data.descripcion || '',
        miembros,
        avatarPreviewUrl: data.avatar_url || '/images/app/grupo_default_image.png',
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
    this.listSelect.innerHTML = miembros.map(u => `<div class="search-result-item fila-usuario" data-user-id="${u}"><span>${u}</span><button class="btn-eliminar">✕</button></div>`).join('');
    this.listSelect.style.display = miembros.length ? 'block' : 'none';

    if (this.avatarPreview) {
      this.avatarPreview.src = this.state.avatarPreviewUrl || '/images/app/grupo_default_image.png';
    }
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
      if (!e.target.classList.contains('btn-eliminar')) return;
      const usr = e.target.closest('[data-user-id]').dataset.userId;
      this.setState({ miembros: this.state.miembros.filter(u => u !== usr) });
    });

    // Submit
    this.btnSubmit.addEventListener('click', async () => {
      try {
        if (this.state.modo === 'crear') await this.createGroup();
        else await this.updateGroup();
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
