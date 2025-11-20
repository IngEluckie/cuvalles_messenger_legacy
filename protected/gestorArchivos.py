# GestorArchivhos.py

from fastapi import UploadFile
import os
from PIL import Image
from io import BytesIO
import threading
from typing import Tuple


"""
AQUÍ VAN LAS CLASES ENCARGADAS DE GENERAR INSTANCIAS
PARA LA GESTIÓN DE LOS ARCHIVOS: TODOS
- Almacenar
- Normalizar: dar formato, tamaño, nombre correcto
- Eliminar (de ser necesario)
- Las rutas de almacenamiento
"""

# Importamos librerías
import os

class GestorImagenesBase:
    """
    Clase base reutilizable para manejar imágenes (normalizar/guardar) en una carpeta específica.
    """

    def __init__(self, folder_relative: str) -> None:
        self._base_path: str = os.path.dirname(__file__)
        self._folder_path: str = self._ensure_folder(folder_relative)

    def _ensure_folder(self, folder_relative: str) -> str:
        folder = os.path.join(self._base_path, folder_relative)
        os.makedirs(folder, exist_ok=True)  # Crea el directorio si no existe
        return folder

    def guardarArchivo(self, normalized_file: BytesIO, file_name: str) -> dict:
        """
        Guarda el archivo normalizado en la ruta definida por `_folder_path`.
        """
        try:
            file_location = os.path.join(self._folder_path, file_name)
            # Aseguramos que el puntero esté al inicio
            normalized_file.seek(0)
            with open(file_location, "wb") as f:
                f.write(normalized_file.read())
        except Exception as e:
            return {"message": f"El archivo no fue guardado, error: {e}"}
        return {"message": "Archivo guardado exitosamente"}

    def normalizarImagenFromBytes(self, file_bytes: bytes, original_filename: str, output_name: str):
        """
        Normaliza la imagen a partir de los bytes:
          - Verifica que la extensión sea .jpg o .jpeg.
          - Redimensiona la imagen a 500x500 píxeles.
          - Convierte la imagen a formato WEBP.
          - Retorna un objeto BytesIO con la imagen procesada y el nuevo nombre con sufijo `.webp`.
        """
        file_extension = os.path.splitext(original_filename)[-1].lower()
        
        if file_extension not in [".jpg", ".jpeg", ".png", ".webp"]:
            raise Exception("Extensión de archivo no compatible")
        
        try:
            # Crear un objeto BytesIO a partir de los bytes
            fake_file = BytesIO(file_bytes)
            img = Image.open(fake_file)
            # Redimensiona a 500x500 píxeles
            img = img.resize((500, 500))
            # Guarda la imagen en un nuevo objeto BytesIO en formato WEBP
            output = BytesIO()
            img.save(output, format="WEBP")
            output.seek(0)
            new_file_name = f"{output_name}.webp"
            return output, new_file_name
        except Exception as e:
            raise Exception(f"Error al procesar la imagen: {e}")


class GestorImagenesPerfil(GestorImagenesBase):
    def __init__(self) -> None:
        super().__init__(os.path.join("images", "users"))

    def normalizarImagenFromBytes(self, file_bytes: bytes, original_filename: str, username: str):
        return super().normalizarImagenFromBytes(file_bytes, original_filename, username)


class GestorImagenesGrupos(GestorImagenesBase):
    def __init__(self) -> None:
        super().__init__(os.path.join("images", "groups"))

    def normalizarImagenFromBytes(self, file_bytes: bytes, original_filename: str, group_identifier: str):
        return super().normalizarImagenFromBytes(file_bytes, original_filename, group_identifier)
        
def getLastFile(full_path):
    pass

class GestorArchivosChats:
    """
    Patrón Singleton:
    - Se garantiza una única instancia por proceso.
    - Es thread‑safe con doble verificación y un candado (`_lock`).
    """

    _instance: "GestorArchivosChats | None" = None
    _lock: threading.Lock = threading.Lock()

    _ALLOWED_FORMATS: Tuple[str, ...] = (
        ".jpg", ".jpeg", ".png", ".pdf",
        ".mp4", ".webm", ".zip", ".rar",
        ".docx", ".xlsx"
    )

    # ----------------------  SINGLETON ----------------------
    def __new__(cls, *args, **kwargs):
        # 1. Primera comprobación (rápida, sin lock)
        if cls._instance is None:
            with cls._lock:                 # 2. Entra 1 solo hilo
                if cls._instance is None:   # 3. Doble verificación
                    cls._instance = super().__new__(cls)
        return cls._instance

    # ----------------------  INIT ÚNICO ---------------------
    def __init__(self) -> None:
        # Evita re‑inicializar si la instancia ya está creada
        if getattr(self, "_initialized", False):
            return

        self._base_path: str = os.path.dirname(os.path.abspath(__file__))
        self._folder_path: str = self._ensure_base_folder()
        self._initialized: bool = True   # Marca que ya se inicializó

    # ----------------------  API PÚBLICA --------------------
    @property
    def allowed_formats(self) -> Tuple[str, ...]:
        return self._ALLOWED_FORMATS

    @property
    def uploads_folder(self) -> str:
        """Ruta absoluta donde se guardarán los archivos del chat."""
        return self._folder_path
    
    def saveFile(self):
        pass

    def getFiles(self):
        pass

    # ----------------------  MÉTODOS PRIVADOS ---------------
    def _ensure_base_folder(self) -> str:
        """
        Crea (si no existe) la carpeta /protected/uploads/chats
        justo al lado de este módulo.
        """
        folder = os.path.join(self._base_path, "protected", "chats")
        os.makedirs(folder, exist_ok=True)
        return folder
    
    def _createFolder(self):
        pass

if __name__ == "__main__":
    imagen = GestorImagenesPerfil("pepe2.jpg")
