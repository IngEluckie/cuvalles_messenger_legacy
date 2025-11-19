# images.py

import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from fastapi.responses import FileResponse
from multiprocessing import Process

# Importamos módulos de autenticación y base de datos
from routers.authentication import current_user, User
from database.singleton import Database
from protected.gestorArchivos import GestorImagenesPerfil

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