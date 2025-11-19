# chats.py

from fastapi import APIRouter, HTTPException, Depends, status, File, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import os
import uuid
from multiprocessing import Process
from datetime import datetime
import mimetypes
from icecream import ic

# Importamos la función de autenticación y el modelo de usuario actualizado
from routers.authentication import current_user, User
# Importamos la clase Database de nuestro singleton
from database.singleton import Database
from protected.gestorArchivos import GestorArchivosChats

router_chats = APIRouter(prefix="/chats")

# MODELO para la creación de mensajes
class MessageCreate(BaseModel):
    content: str

def create_message(db: Database, chat_id: int, user_id: int, content: str) -> dict:
    """
    Inserta un nuevo mensaje en la tabla 'messages' y retorna el mensaje recién creado.
    """
    insert_query = """
        INSERT INTO messages (chat_id, user_id, content, created_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    """
    db.execute_query(insert_query, (chat_id, user_id, content))
    
    # Obtener el ID del mensaje recién insertado
    row = db.fetch_query("SELECT last_insert_rowid() as message_id")
    new_id = row[0]["message_id"]
    
    # Recuperar el registro completo
    fetch_query = """
    SELECT m.message_id, m.chat_id, m.user_id,
           u.username,                    --  👈
           m.content, m.created_at
    FROM messages m
    JOIN Usuarios u ON u.Id_Usuarios = m.user_id
    WHERE m.message_id = ?
    """
    msg_row = db.fetch_query(fetch_query, (new_id,))
    return msg_row[0] if msg_row else {}

@router_chats.post("/{chat_id}/send_message")
async def send_message_to_chat(
    chat_id: int,
    message: MessageCreate,
    user: User = Depends(current_user)
):
    """
    Envía (crea) un mensaje en el chat con id = chat_id, usando el usuario logueado (user.user_iD)
    como remitente. Retorna el mensaje recién creado.
    """
    db = Database()
    
    # Verificar si el usuario es miembro del chat
    member_check = db.fetch_query(
        """
        SELECT COUNT(*) as count 
        FROM chat_members 
        WHERE chat_id = ? AND user_id = ?
        """,
        (chat_id, user.user_iD)
    )
    if not member_check or member_check[0]["count"] == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para enviar mensajes a este chat."
        )
    
    new_message = create_message(db, chat_id, user.user_iD, message.content)
    return new_message

def find_user_by_username(db: Database, username: str) -> Optional[int]:
    """
    Retorna el 'Id_Usuarios' del usuario dado su username.
    """
    query = """
        SELECT Id_Usuarios as id
        FROM Usuarios
        WHERE username = ?
        LIMIT 1
    """
    resultado = db.fetch_query(query, (username,))
    if resultado and len(resultado) > 0:
        return resultado[0]["id"]
    return None

def find_single_chat(db: Database, user_a_id: int, user_b_id: int) -> Optional[int]:
    """
    Retorna el chat_id de un chat 1:1 en el que participan ambos usuarios.
    """
    query = """
        SELECT c.chat_id
        FROM chats c
        WHERE c.is_group = 0
          AND c.chat_id IN (
              SELECT chat_id FROM chat_members WHERE user_id = ?
          )
          AND c.chat_id IN (
              SELECT chat_id FROM chat_members WHERE user_id = ?
          )
        LIMIT 1
    """
    resultado = db.fetch_query(query, (user_a_id, user_b_id))
    if resultado and len(resultado) > 0:
        return resultado[0]["chat_id"]
    return None

def create_single_chat(db: Database, creator_id: int, other_user_id: int) -> int:
    """
    Crea un chat no grupal y agrega a ambos usuarios en la tabla 'chat_members'.
    Retorna el chat_id recién creado.
    """
    insert_chat = """
        INSERT INTO chats (is_group, created_by, created_at)
        VALUES (0, ?, CURRENT_TIMESTAMP)
    """
    db.execute_query(insert_chat, (creator_id,))
    
    last_chat_id_query = "SELECT last_insert_rowid() as chat_id"
    row = db.fetch_query(last_chat_id_query)
    chat_id = row[0]["chat_id"]
    
    insert_member = """
        INSERT INTO chat_members (chat_id, user_id, joined_at, role)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?)
    """
    db.execute_query(insert_member, (chat_id, creator_id, "admin"))
    db.execute_query(insert_member, (chat_id, other_user_id, "member"))
    
    return chat_id

def fetch_chat_messages(db: Database, chat_id: int, limit: int = 20, offset: int = 0) -> List[dict]:
    """
    Devuelve mensajes + username del remitente.
    """
    query = """
        SELECT  m.message_id,
                m.chat_id,
                m.user_id,
                u.username,                --  👈
                m.content,
                m.created_at
        FROM messages m
        JOIN Usuarios u ON u.Id_Usuarios = m.user_id
        WHERE m.chat_id = ?
        ORDER BY m.created_at DESC
        LIMIT ? OFFSET ?
    """
    return db.fetch_query(query, (chat_id, limit, offset)) or []

@router_chats.get("/open_single_chat/{target_username}")
async def open_single_chat(
    target_username: str,
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(current_user)
):
    """
    Abre (o crea si no existe) un chat 1:1 entre el usuario logueado y el usuario cuyo username es target_username.
    Retorna el chat_id y los mensajes.
    """
    db = Database()
    user2_id = find_user_by_username(db, target_username)
    if not user2_id:
        raise HTTPException(
            status_code=404,
            detail=f"No se encontró usuario con username '{target_username}'"
        )
    
    existing_chat_id = find_single_chat(db, user.user_iD, user2_id)
    if existing_chat_id is None:
        existing_chat_id = create_single_chat(db, user.user_iD, user2_id)
    
    mensajes = fetch_chat_messages(db, existing_chat_id, limit, offset)
    return {"chat_id": existing_chat_id, "messages": mensajes}

@router_chats.get("/search_user_navbar/{terminoBusqueda}")
async def search_user_navbar(terminoBusqueda: str, user: User = Depends(current_user)):
    """
    Busca y retorna una lista de usernames que coincidan con el término de búsqueda.
    """
    db = Database()
    like_pattern = f"%{terminoBusqueda}%"
    query = """
        SELECT username 
        FROM Usuarios 
        WHERE username LIKE ?
    """
    try:
        resultados = db.fetch_query(query, (like_pattern,))
        usernames_list = [row["username"] for row in resultados] 
        print("Error en el try") 
        return usernames_list
    except Exception as e:
        print("Error en el except")
        raise HTTPException(status_code=500, detail=str(e))

@router_chats.get("/my_chats", tags=["Chats"])
async def get_my_chats(
    limit: int = 10,
    offset: int = 0,
    user: User = Depends(current_user),
):
    """
    Devuelve los chats del usuario ordenados por la última actividad.
    • Si es chat 1:1  → nombre del otro participante.
    • Si es grupal   → nombre del grupo (tabla info_grupos).
    """
    db = Database()

    query = """
    SELECT
        c.chat_id,
        c.is_group,
        COALESCE(c.last_activity, c.created_at) AS last_activity,
        CASE
            /* ---------- Chat 1 a 1 ---------- */
            WHEN c.is_group = 0 THEN (
                SELECT u.username
                FROM Usuarios AS u
                WHERE u.Id_Usuarios = (
                    SELECT cm2.user_id
                    FROM chat_members AS cm2
                    WHERE cm2.chat_id = c.chat_id
                      AND cm2.user_id != ?         -- distinto del solicitante
                    LIMIT 1
                )
            )
            /* ---------- Chat grupal ---------- */
            ELSE (
                SELECT ig.nombre
                FROM info_grupos AS ig
                WHERE ig.chat_id = c.chat_id
                LIMIT 1
            )
        END AS chat_name
    FROM chats AS c
    INNER JOIN chat_members AS cm
        ON cm.chat_id = c.chat_id
    WHERE cm.user_id = ?
    ORDER BY last_activity DESC
    LIMIT ? OFFSET ?;
    """

    results = db.fetch_query(
        query,
        (user.user_iD,  # para username del otro participante
         user.user_iD,  # filtrado de chats donde es miembro
         limit,
         offset)
    )

    return {"chats": results}


@router_chats.get("/get_chat/{chat_id}", tags=["Chats"])
async def get_chat(
    chat_id: int,
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(current_user)
):
    """
    Retorna los mensajes del chat especificado, previa verificación de que el usuario sea miembro del mismo.
    """
    db = Database()
    
    member_check = db.fetch_query(
        """
        SELECT COUNT(*) as count 
        FROM chat_members 
        WHERE chat_id = ? AND user_id = ?
        """,
        (chat_id, user.user_iD)
    )
    
    if not member_check or member_check[0]["count"] == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para acceder a este chat."
        )
    
    messages = fetch_chat_messages(db, chat_id, limit, offset)
    return {"chat_id": chat_id, "messages": messages}

@router_chats.get("/other-user-info/{otherUser}")
async def get_other_user_info(otherUser: str):
    """
    Endpoint para obtener el último status publicado del usuario 'otherUser'.
    Recibe el username, busca el 'Id_Usuarios' en la tabla Usuarios y consulta en la tabla
    status el último registro (ordenado por fecha descendente).
    """
    db = Database()
    
    # Buscar el ID del usuario en la tabla Usuarios.
    query_user = """
        SELECT Id_Usuarios as id
        FROM Usuarios
        WHERE username = ?
        LIMIT 1
    """
    user_result = db.fetch_query(query_user, (otherUser,))
    if not user_result:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    user_id = user_result[0]['id']
    
    # Consultar el último status publicado por el usuario.
    query_status = """
        SELECT status, fecha
        FROM status
        WHERE iD_User = ?
        ORDER BY fecha DESC
        LIMIT 1
    """
    status_result = db.fetch_query(query_status, (user_id,))
    if not status_result:
        return {"message": "El usuario no ha publicado ningún status."}
    
    # Devolver el último status encontrado.
    return status_result[0]



@router_chats.post("/{chat_id}/send_file", tags=["Chats"])
async def send_file_to_chat(
    chat_id: int,
    file: UploadFile = File(...),
    user: User = Depends(current_user)
):
    """
    Envía un archivo adjunto al chat y registra:
    - mensaje placeholder en messages
    - archivo en disco
    - metadatos en attachments
    Devuelve el mensaje recién creado con `username` incluido + datos del archivo.
    """
    db     = Database()
    gestor = GestorArchivosChats()   # Singleton

    # 1️⃣  Verificar chat existente
    if not db.fetch_query("SELECT 1 FROM chats WHERE chat_id = ? LIMIT 1", (chat_id,)):
        raise HTTPException(status_code=404, detail="Chat no encontrado")

    # 2️⃣  Verificar membresía
    member_ok = db.fetch_query(
        "SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ? LIMIT 1",
        (chat_id, user.user_iD)
    )
    if not member_ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para enviar archivos a este chat."
        )

    # 3️⃣  Validar extensión
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in gestor.allowed_formats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida: {ext}"
        )

    # 4️⃣  Insertar mensaje placeholder
    db.execute_query(
        """
        INSERT INTO messages (chat_id, user_id, content, created_at)
        VALUES (?, ?, '[archivo adjunto]', CURRENT_TIMESTAMP)
        """,
        (chat_id, user.user_iD)
    )
    msg_id = db.fetch_query("SELECT last_insert_rowid() AS id")[0]["id"]

    # 5️⃣  Generar nombre de archivo y guardarlo en disco
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    new_name  = f"{chat_id}_{msg_id}_{user.user_iD}_{timestamp}{ext}"
    save_path = os.path.join(gestor.uploads_folder, new_name)

    try:
        contents = await file.read()
        with open(save_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al almacenar el archivo: {e}")

    # 6️⃣  Metadatos en attachments
    mime_type  = file.content_type or mimetypes.guess_type(new_name)[0] or "application/octet-stream"
    size_bytes = len(contents)

    db.execute_query(
        """
        INSERT INTO attachments (
            chat_id, message_id, sender_id,
            file_name, mime_type, size_bytes
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (chat_id, msg_id, user.user_iD, new_name, mime_type, size_bytes)
    )

    # 7️⃣  Recuperar el mensaje con JOIN a Usuarios para incluir `username`
    mensaje = db.fetch_query(
        """
        SELECT m.message_id,
               m.chat_id,
               m.user_id,
               u.username,                 -- 👈  autor
               m.content,
               m.created_at
        FROM messages m
        JOIN Usuarios u ON u.Id_Usuarios = m.user_id
        WHERE m.message_id = ?
        LIMIT 1
        """,
        (msg_id,)
    )[0]

    # 8️⃣  Respuesta
    return {
        "message": mensaje,                # burbuja lista (con username)
        "file_name": new_name,
        "relative_path": f"/media/chats/{chat_id}/{new_name}",
        "mime_type": mime_type,
        "size": size_bytes
    }

def searchFileDB(msg_id: int) -> dict:
    """
    Devuelve un dict con chat_id, file_name y mime_type
    o lanza 404 si no existe.
    """
    db = Database()
    row = db.fetch_query(
        """
        SELECT chat_id, file_name, mime_type
        FROM   attachments
        WHERE  message_id = ?
        LIMIT  1
        """,
        (msg_id,)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Adjunto no encontrado")

    return row[0]

from fastapi.responses import FileResponse
from pathlib import Path

@router_chats.get("/attachments/{msg_id}", tags=["Chats"])
async def download_attachment(
    msg_id: int,
    user: User = Depends(current_user)
):
    """
    Devuelve (stream) el archivo adjunto vinculado al `msg_id`
    solo si el usuario pertenece al chat.
    """
    db = Database()
    gestor = GestorArchivosChats()          # Singleton

    # 1️⃣  Buscar metadatos
    meta = searchFileDB(msg_id)
    chat_id    = meta["chat_id"]
    file_name  = meta["file_name"]
    mime_type  = meta["mime_type"]

    # 2️⃣  Verificar que el solicitante es miembro del chat
    member = db.fetch_query(
        "SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ? LIMIT 1",
        (chat_id, user.user_iD)
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder a este archivo."
        )

    # 3️⃣  Construir ruta absoluta en disco
    #    a)  Si guardas en sub-carpeta por chat:
    # path = Path(gestor.uploads_folder) / str(chat_id) / file_name
    #    b)  Si todo va en la misma carpeta (según tu ejemplo):
    path = Path(gestor.uploads_folder) / file_name

    if not path.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco.")

    # 4️⃣  Stream mediante FileResponse
    return FileResponse(
        path,
        media_type=mime_type,
        filename=file_name,          # sugiere nombre al navegador
        headers={"Cache-Control": "private, max-age=604800"}  # opcional
    )

"""
CREAR GRUPOS
"""
class GroupCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=50)
    descripcion: Optional[str] = None
    members: List[str] = Field(default_factory=list)   # usernames

def create_group_chat(
    db: Database,
    creator_id: int,
    nombre: str,
    descripcion: str | None,
    member_usernames: list[str],
) -> int:
    """
    Crea un chat grupal, registra info_grupos y agrega a todos los miembros.
    Devuelve el `chat_id`.
    """
    # 1️⃣  Crear registro en `chats` (is_group = 1)
    db.execute_query(
        "INSERT INTO chats (is_group, created_by, created_at) VALUES (1, ?, CURRENT_TIMESTAMP)",
        (creator_id,),
    )
    chat_id = db.fetch_query("SELECT last_insert_rowid() AS id")[0]["id"]

    # 2️⃣  info_grupos: nombre & descripción
    db.execute_query(
        "INSERT INTO info_grupos (chat_id, nombre, descripcion) VALUES (?, ?, ?)",
        (chat_id, nombre, descripcion),
    )

    # 3️⃣  Agregar creador como ADMIN
    db.execute_query(
        """INSERT INTO chat_members (chat_id, user_id, joined_at, role)
           VALUES (?, ?, CURRENT_TIMESTAMP, 'admin')""",
        (chat_id, creator_id),
    )

    # 4️⃣  Agregar resto de miembros
    if member_usernames:
        # Sanitizar duplicados y que no incluyan de nuevo al creador
        unique_usernames = {
            uname for uname in member_usernames if uname and uname != ""
        } - {db.fetch_query("SELECT username FROM Usuarios WHERE Id_Usuarios = ?", (creator_id,))[0]["username"]}

        if unique_usernames:
            # Mapear username ➜ id; abortar si alguno no existe
            placeholders = ",".join(["?"] * len(unique_usernames))
            rows = db.fetch_query(
                f"SELECT username, Id_Usuarios AS id FROM Usuarios WHERE username IN ({placeholders})",
                tuple(unique_usernames),
            )
            found = {row["username"]: row["id"] for row in rows}

            missing = unique_usernames - found.keys()
            if missing:
                raise HTTPException(
                    status_code=404,
                    detail=f"Los siguientes usuarios no existen: {', '.join(missing)}",
                )

            # Inserción masiva
            member_values = [
                (chat_id, uid, "member") for uid in found.values()
            ]
            db.executemany(
                """INSERT INTO chat_members (chat_id, user_id, joined_at, role)
                   VALUES (?, ?, CURRENT_TIMESTAMP, ?)""",
                member_values,
            )

    return chat_id


@router_chats.post("/grupos", tags=["Chats"])
async def crear_grupo(
    payload: GroupCreate,
    user: User = Depends(current_user),
):
    """
    Crea un grupo de chat y devuelve su `chat_id`.
    """
    db = Database()
    try:
        chat_id = create_group_chat(
            db=db,
            creator_id=user.user_iD,
            nombre=payload.nombre,
            descripcion=payload.descripcion,
            member_usernames=payload.members,
        )
    except HTTPException:
        raise
    except Exception as e:
        # Cualquier otro error 500 controlado
        raise HTTPException(status_code=500, detail=str(e))

    return {"chat_id": chat_id, "nombre": payload.nombre}


"""
Configuración de grupos
"""
from typing import List, Dict

# ──────────────────────────────────────────────────────────────
# Helper interno: valida que el chat sea grupo y el usuario sea miembro
# ──────────────────────────────────────────────────────────────
def _validate_group_membership(db: Database, chat_id: int, user_id: int) -> Dict:
    """
    • Comprueba que el chat exista, sea grupal y que el usuario pertenezca a él.
    • Devuelve info básica (is_group, created_by) si pasa todas las validaciones.
    """
    row = db.fetch_query(
        """
        SELECT chat_id, is_group, created_by
        FROM   chats
        WHERE  chat_id = ?
        LIMIT  1
        """,
        (chat_id,)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Chat no encontrado.")

    chat = row[0]
    if chat["is_group"] == 0:
        raise HTTPException(status_code=400, detail="El chat especificado no es grupal.")

    member = db.fetch_query(
        "SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ? LIMIT 1",
        (chat_id, user_id)
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a este grupo."
        )

    return chat   # contiene created_by si lo necesitas




# ──────────────────────────────────────────────────────────────
# Endpoint: información completa del grupo
# ──────────────────────────────────────────────────────────────
@router_chats.get("/grupo_info/{chat_id}", tags=["Chats"])
async def get_group_info(
    chat_id: int,
    user: User = Depends(current_user),
):
    """
    Devuelve la información de configuración de un **chat grupal**:
    • nombre, descripción (tabla `info_grupos`)
    • lista de integrantes + rol (tabla `chat_members` + `Usuarios`)
    • bool `is_admin` para que el frontend sepa si el usuario puede editar
    """
    db = Database()

    # 1️⃣  Validar pertenencia y que sea grupo
    chat_meta = _validate_group_membership(db, chat_id, user.user_iD)

    # 2️⃣  Obtener nombre y descripción del grupo
    info_row = db.fetch_query(
        """
        SELECT nombre, descripcion
        FROM   info_grupos
        WHERE  chat_id = ?
        LIMIT  1
        """,
        (chat_id,)
    )
    if not info_row:
        # Nunca debería pasar si la DB está coherente
        raise HTTPException(status_code=500, detail="No se encontró info del grupo.")

    # 3️⃣  Obtener miembros (username, foto, rol)
    members_rows = db.fetch_query(
        """
        SELECT
            u.Id_Usuarios  AS user_id,
            u.username,
            COALESCE(u.Foto_perfil, '/images/app/default_user.png') AS foto_perfil,
            cm.role
        FROM chat_members AS cm
        JOIN Usuarios     AS u ON u.Id_Usuarios = cm.user_id
        WHERE cm.chat_id = ?
        ORDER BY 
            CASE WHEN cm.role = 'admin' THEN 0 ELSE 1 END,  -- admins primero
            u.username ASC
        """,
        (chat_id,)
    )

    # 4️⃣  ¿El solicitante es admin?
    is_admin = any(
        r["user_id"] == user.user_iD and r["role"] == "admin"
        for r in members_rows
    )

    # 5️⃣  Armar respuesta
    return {
        "chat_id":    chat_id,
        "nombre":     info_row[0]["nombre"],
        "descripcion": info_row[0]["descripcion"],
        "members":    members_rows,      # lista de dicts
        "is_admin":   is_admin,
    }


# chats.py  – nuevo endpoint para abandonar un chat grupal
@router_chats.delete("/{chat_id}/leave", tags=["Chats"])
async def leave_group(
    chat_id: int,
    user: User = Depends(current_user),
):
    """
    Permite a un miembro abandonar un chat grupal.
    • Si es el único admin y aún hay otros miembros, se nombra automáticamente
      a un nuevo admin (el más antiguo en el grupo).
    • Si al salir no queda ningún miembro, se elimina el grupo.
    Devuelve:
      { "left": true, "group_deleted": <bool> }
    """
    db = Database()

    # 1️⃣  Validar que el chat existe, es grupal y que el usuario pertenece
    _validate_group_membership(db, chat_id, user.user_iD)

    # 2️⃣  ¿El usuario es admin?
    my_role_row = db.fetch_query(
        "SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ? LIMIT 1",
        (chat_id, user.user_iD)
    )
    my_role = my_role_row[0]["role"]

    # 3️⃣  Eliminar al usuario del grupo
    db.execute_query(
        "DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?",
        (chat_id, user.user_iD)
    )

    # 4️⃣  ¿Quedan miembros?
    remaining_rows = db.fetch_query(
        "SELECT user_id, role, joined_at FROM chat_members WHERE chat_id = ?",
        (chat_id,)
    )
    if not remaining_rows:
        # 4a) Sin miembros → borrar el grupo (ON DELETE CASCADE limpiará todo)
        db.execute_query("DELETE FROM chats WHERE chat_id = ?", (chat_id,))
        return {"left": True, "group_deleted": True}

    # 4b) Aún quedan miembros …
    if my_role == "admin":
        #  Si el saliente era admin, comprobar si hay otro admin
        other_admin = any(r["role"] == "admin" for r in remaining_rows)
        if not other_admin:
            #  Promover al más antiguo (joined_at ASC) a admin
            promote_id = sorted(remaining_rows, key=lambda r: r["joined_at"])[0]["user_id"]
            db.execute_query(
                "UPDATE chat_members SET role = 'admin' WHERE chat_id = ? AND user_id = ?",
                (chat_id, promote_id)
            )

    return {"left": True, "group_deleted": False}

# ──────────────────────────────────────────────────────────────
# Cambiar configuración de un grupo
# ──────────────────────────────────────────────────────────────
from pydantic import BaseModel, Field
from typing import Optional, List

# —————————— NUEVO MODELO PARA ACTUALIZAR GRUPO ——————————
class GroupUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=50)
    descripcion: Optional[str] = None
    members: Optional[List[str]] = None  # lista de usernames

# —————————— ENDPOINT PARA MODIFICAR GRUPO ——————————
@router_chats.put("/grupos/{chat_id}", tags=["Chats"])
async def actualizar_grupo(
    chat_id: int,
    payload: GroupUpdate,
    user: User = Depends(current_user)
):
    db = Database()

    # 1️⃣ Validar que pertenezca al grupo y que sea grupal
    chat_meta = _validate_group_membership(db, chat_id, user.user_iD)

    # 2️⃣ Comprobar rol de admin
    role_row = db.fetch_query(
        "SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ? LIMIT 1",
        (chat_id, user.user_iD)
    )
    if not role_row or role_row[0]["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los administradores pueden modificar el grupo."
        )

    # 3️⃣ Actualizar nombre y/o descripción en info_grupos
    if payload.nombre is not None or payload.descripcion is not None:
        # Recoger valores actuales
        info = db.fetch_query(
            "SELECT nombre, descripcion FROM info_grupos WHERE chat_id = ? LIMIT 1",
            (chat_id,)
        )[0]
        nuevo_nombre = payload.nombre or info["nombre"]
        nueva_desc   = payload.descripcion if payload.descripcion is not None else info["descripcion"]
        db.execute_query(
            "UPDATE info_grupos SET nombre = ?, descripcion = ? WHERE chat_id = ?",
            (nuevo_nombre, nueva_desc, chat_id)
        )

    # 4️⃣ Sincronizar miembros si vienen en el payload
    if payload.members is not None:
        # 4a) Obtener lista actual de usernames
        rows = db.fetch_query(
            """SELECT u.username
               FROM chat_members cm
               JOIN Usuarios u ON u.Id_Usuarios = cm.user_id
               WHERE cm.chat_id = ?""",
            (chat_id,)
        )
        actuales = {r["username"] for r in rows}
        deseados = set(payload.members)

        to_remove = actuales - deseados
        to_add    = deseados - actuales

        # 4b) Eliminar miembros no deseados
        for username in to_remove:
            uid = find_user_by_username(db, username)
            if uid:
                db.execute_query(
                    "DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?",
                    (chat_id, uid)
                )

        # 4c) Agregar nuevos miembros como 'member'
        for username in to_add:
            uid = find_user_by_username(db, username)
            if uid:
                db.execute_query(
                    """INSERT INTO chat_members
                       (chat_id, user_id, joined_at, role)
                       VALUES (?, ?, CURRENT_TIMESTAMP, 'member')""",
                    (chat_id, uid)
                )

    # 5️⃣ Responder con el ID del chat modificado
    return {"chat_id": chat_id}


# Ruta de testeo para verificar que el módulo esté activo
@router_chats.get("/ison")
async def ison():
    return "Yes, I'm working!"
