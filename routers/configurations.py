# configurations.py

from fastapi import APIRouter, Depends, HTTPException, status
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from icecream import ic

# Importamos el usuario autenticado y la clase Database del singleton
from routers.authentication import current_user, User
from database.singleton import Database

router_configurations = APIRouter(prefix="/settings")

@router_configurations.get("/ison")
async def ison():
    return "Yes, I'm working!"

# Modelo para el status del usuario
class StatusModel(BaseModel):
    status_text: str

def create_null_status(db: Database, user_id: int, status_text: str = "") -> None:
    """
    Inserta un status vacío para el usuario si no existe alguno.
    """
    query = """
        INSERT INTO status (status, iD_User)
        VALUES (?, ?)
    """
    try:
        db.execute_query(query, (status_text, user_id))
    except Exception as e:
        print(f"Error en create_null_status: {e}")

def insert_status(db: Database, user_id: int, status_text: str = "") -> str:
    """
    Inserta un nuevo status en la base de datos para el usuario dado.
    Primero verifica que el usuario exista; de lo contrario lanza un error.
    """
    user_exists_query = "SELECT * FROM Usuarios WHERE Id_Usuarios = ?"
    user_exists = db.fetch_query(user_exists_query, (user_id,))
    if not user_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El usuario con Id {user_id} no existe en la base de datos"
        )
    
    query = """
        INSERT INTO status (status, iD_User)
        VALUES (?, ?)
    """
    try:
        db.execute_query(query, (status_text, user_id))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en insert_status: {e}"
        )
    return "Status insertado exitosamente"

@router_configurations.get("/get_status")
async def get_status(user: User = Depends(current_user)):
    """
    Retorna el status más reciente del usuario autenticado.
    Si no existe, crea un status vacío y retorna "".
    """
    db = Database()
    user_id = user.user_iD
    query = """
        SELECT *
        FROM status
        WHERE iD_User = ?
        ORDER BY fecha DESC
        LIMIT 1
    """
    try:
        rows = db.fetch_query(query, (user_id,))
        if rows and len(rows) > 0:
            current_status = rows[0]["status"]
        else:
            create_null_status(db, user_id)
            current_status = ""
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en /get_status: {e}"
        )
    return StatusModel(status_text=current_status)

@router_configurations.post("/update_status")
async def update_status(request: StatusModel, user: User = Depends(current_user)):
    """
    Inserta un nuevo status en la base de datos para el usuario autenticado.
    """
    db = Database()
    user_id = user.user_iD
    result = insert_status(db, user_id, request.status_text)
    return {"message": "Status actualizado exitosamente", "result": result}

# Modelo para el tema (por ejemplo, claro u oscuro)
class Tema(BaseModel):
    tema: str

@router_configurations.post("/update_tema")
async def update_tema(request: Tema, user: User = Depends(current_user)):
    """
    Actualiza el tema (claro u oscuro) del usuario.
    Actualmente, este endpoint es de prueba y se debe implementar la lógica.
    """
    # Aquí iría la lógica para actualizar el tema en la base de datos.
    return {"message": "Tema actualizado (endpoint en desarrollo)", "tema": request.tema}

# Modelo para actualizar el nombre de usuario (display name)
class DisplayNombre(BaseModel):
    username: str

@router_configurations.post("/update_displayNombre")
async def update_display_nombre(request: DisplayNombre, user: User = Depends(current_user)):
    """
    Actualiza el username del usuario autenticado.
    """
    db = Database()
    user_id = user.user_iD

    # Verificar que el usuario exista
    user_exists_query = "SELECT * FROM Usuarios WHERE Id_Usuarios = ?"
    user_exists = db.fetch_query(user_exists_query, (user_id,))
    if not user_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El usuario con Id {user_id} no existe en la base de datos"
        )
    
    query_update = "UPDATE Usuarios SET username = ? WHERE Id_Usuarios = ?"
    try:
        db.execute_query(query_update, (request.username, user_id))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar el username: {e}"
        )
    return {"message": "Username actualizado correctamente"}

@router_configurations.get("/get_foto_perfil")
async def get_foto_perfil(user: User = Depends(current_user)):
    """
    Retorna la foto de perfil del usuario.
    Actualmente, esta funcionalidad está en desarrollo.
    """
    return {"message": "Funcionalidad de foto de perfil en desarrollo"}

@router_configurations.post("/update_foto_perfil")
async def update_foto_perfil(user: User = Depends(current_user)):
    """
    Actualiza la foto de perfil del usuario.
    Actualmente, esta funcionalidad está en desarrollo.
    """
    return {"message": "Actualización de foto de perfil en desarrollo"}
