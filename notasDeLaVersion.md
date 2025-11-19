# Notas de desarrollo de las versiones

## Versión 2.0.9
### Funciones añadidas
- Incorpora mensajería grupal: creación de grupos.
- Se puede salir: los usuarios integrantes de un grupo pueden salirse
### Notas y detalles
- Falta la personalización de grupos
    - Admin puede: Añadir y eliminar usuarios, cambiar nombre, descripción e imágen de grupo
- Agregar proyecto a GitHub


Algo no está funcionando como debería. Para empezar, el html que debes modificar es el siguiente:

<!-- MODAL crear grupo -->
    <div id="modalCrearGrupo" class="modal">
      <div class="modal-content crear-grupo-modal">
        <!-- Cierre -->
        <span class="close" id="closeCrearGrupo">&times;</span>

        <!-- Nombre del grupo -->
        <div class="form-row">
          <label for="nombreGrupo" class="form-label">Nombre del grupo:</label>
          <input
            type="text"
            id="nombreGrupo"
            class="input-text"
            placeholder="Escribe…"
          />
        </div>

        <!-- Buscador + lista de usuarios / seleccionados -->
        <div class="pick-section">
          <!-- Columna izquierda -->
          <div class="buscador">
            <input
              type="text"
              id="buscarUsuario"
              class="input-text"
              placeholder="Escribe para buscar…"
            />

            <div class="opcionesUsuarios" id="usuariosOpciones">
              <ul id="listaUsuarios" class="lista-usuarios">
                <!-- Ejemplos hard-coded: sustitúyelos por render dinámico -->
                <li class="user-item">
                  <img src="images/app/default_user.png" alt="" />
                  <span>Pepe2</span>
                </li>
                <li class="user-item">
                  <img src="images/app/default_user.png" alt="" />
                  <span>Pepe6</span>
                </li>
                <li class="user-item">
                  <img src="images/app/default_user.png" alt="" />
                  <span>Pepe3</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Columna derecha -->
          <div class="seleccionados" id="seleccionated">
            <h3>Seleccionados:</h3>
            <ul id="usuariosSeleccionados" class="lista-seleccionados">
              <!-- Aquí se irán añadiendo los elegidos -->
              <!-- <li class="user-item seleccionado-item"> … </li> -->
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn-cancelar">Cancelar</button>
          <button class="btn-crear" id="btn-iniciar-creacion">Crear</button>
        </div>
      </div>
    </div>

Que es el contenedor que tiene la clase GroupManager por defecto. La tabla inicialmente fue diseñada para crear grupos, pero me di cuenta que puedo reciclar la estructura para modificar dichos grupos.

Cuando la tabla sea invocada por la clase ConfGroup (tú mismo me acabas de ayudar con el código), la clase GroupManager debe invocar la ventana modal con los datos actuales del grupo, es decir:

1. Cargar el nombre en la barra superior de input texto:
<input
            type="text"
            id="nombreGrupo"
            class="input-text"
            placeholder="Escribe…"
          />
        </div>
Que simplemente se encuentre escrito y ya se el admin desea cambiarlo o no...

2.- Justo abajo debe aparecer un nuevo cuadro de input text para actualizar la descripción del 