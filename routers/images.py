# images.py

import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import FileResponse
from multiprocessing import Process

# Importamos módulos de autenticación y base de datos
from routers.authentication import current_user, User
from database.singleton import Database
from protected.gestorArchivos import GestorImagenesPerfil, GestorImagenesGrupos

router_images = APIRouter(prefix="/media")

@router_images.get("/ison")
async def ison():
    return {"messages": "Yes ma'afaka"}

@router_images.get("/images/{image_name}")
async def get_image(image_name: str, user: User = Depends(current_user)):
    """
    ESTA FUNCIÓN TE RETORNA CUALQUIER IMAGEN CON EL NOMBRE Y EXTENSIÓN.
    Aunque solo busca en la carpeta de imágenes de usuario.
    """
    # Ajusta la ruta de tu carpeta "protected/images/users"
    file_path = os.path.join("protected", "images", "users", image_name)
    print("Se ha accedido al router images")
    
    # Verificar si existe el archivo
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Imagen no encontrada.")
    
    # Retornar el archivo
    return FileResponse(file_path)


@router_images.get("/groups/{image_name}")
async def get_group_image(image_name: str, user: User = Depends(current_user)):
    """
    Retorna la imagen de un grupo almacenada en protected/images/groups.
    """
    file_path = os.path.join("protected", "images", "groups", image_name)

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Imagen de grupo no encontrada.")

    return FileResponse(file_path)


def _ensure_group_admin(db: Database, chat_id: int, user_id: int) -> None:
    chat_row = db.fetch_query(
        """SELECT chat_id, is_group FROM chats WHERE chat_id = ? LIMIT 1""",
        (chat_id,)
    )
    if not chat_row:
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")
    if chat_row[0]["is_group"] == 0:
        raise HTTPException(status_code=400, detail="El chat especificado no es grupal.")

    membership = db.fetch_query(
        """SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ? LIMIT 1""",
        (chat_id, user_id)
    )
    if not membership:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No perteneces a este grupo.")
    if membership[0]["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Solo un administrador puede actualizar la imagen del grupo.")


@router_images.post("/groups/{chat_id}/upload")
async def upload_group_image(
    chat_id: int,
    file: UploadFile = File(...),
    user: User = Depends(current_user)
):
    db = Database()
    _ensure_group_admin(db, chat_id, user.user_iD)

    file_bytes = await file.read()
    gestor = GestorImagenesGrupos()

    unique_suffix = uuid.uuid4().hex[:8]
    normalized, new_file_name = gestor.normalizarImagenFromBytes(
        file_bytes,
        file.filename,
        f"group_{chat_id}_{unique_suffix}"
    )
    gestor.guardarArchivo(normalized, new_file_name)

    info_row = db.fetch_query(
        "SELECT avatar_path FROM info_grupos WHERE chat_id = ? LIMIT 1",
        (chat_id,)
    )
    if not info_row:
        raise HTTPException(status_code=404, detail="No existe información del grupo.")

    old_file = info_row[0]["avatar_path"]
    db.execute_query(
        "UPDATE info_grupos SET avatar_path = ? WHERE chat_id = ?",
        (new_file_name, chat_id)
    )

    if old_file:
        old_path = os.path.join("protected", "images", "groups", old_file)
        if os.path.isfile(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    return {"avatar_url": f"/media/groups/{new_file_name}"}

def procesar_y_guardar_imagen(file_bytes: bytes, original_filename: str, username: str):
    try:
        # Instancia el gestor de imágenes
        gestor = GestorImagenesPerfil()
        # Normaliza la imagen a partir de los bytes
        normalized_file, new_file_name = gestor.normalizarImagenFromBytes(file_bytes, original_filename, username)
        # Guarda el archivo normalizado en disco
        resultado = gestor.guardarArchivo(normalized_file, new_file_name)
        print(resultado)
    except Exception as e:
        print(f"Error en el proceso: {e}")


@router_images.post("/upload-profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    user: User = Depends(current_user)
):
    try:
        # Leer el contenido del archivo (bytes)
        file_bytes = await file.read()
        # Crear un proceso que se encargue de normalizar y guardar la imagen
        p = Process(target=procesar_y_guardar_imagen, args=(file_bytes, file.filename, user.username))
        p.start()
        p.join()  # Esperamos a que finalice el proceso (o puedes delegar sin join si no requieres esperar)
        return {"message": "Imagen procesada y guardada correctamente"}
    except Exception as e:
        return {"message": f"Error al procesar la imagen: {e}"}
