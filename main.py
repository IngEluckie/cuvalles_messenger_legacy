# main.py

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Importamos modulos y routers
from routers import authentication, chats, configurations, websockets, images
from database.singleton import Database
from routers.systemTools.scheduler import start_scheduler, stop_scheduler

# App instance
app: FastAPI = FastAPI()

# App routers
app.include_router(authentication.router_authentication)
app.include_router(chats.router_chats)
app.include_router(configurations.router_configurations)
app.include_router(websockets.router_websockets)
app.include_router(images.router_images)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # O especifica tu dominio 'http://localhost:5500', etc.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

load_dotenv()

"""
Eventos para la base de datos
"""
@app.on_event("startup")
def startup_event():
    db = Database()  # Esto inicializa la conexión al iniciar la app
    start_scheduler()

@app.on_event("shutdown")
def shutdown_event():
    db = Database()
    db.close_connection()
    stop_scheduler()
"""
-----------------------------
"""

@app.get("/isWorking")
async def isWorking():
    return {
        "message" : "Yes, I'm working!"
    }



#Esta parte se deja hasta el final de este script
#  Por cómo funcionan las direcciones por defecto en FastAPI
app.mount("/", StaticFiles(directory="static", html=True), name="static")

#Documentation on Swagger: http://127.0.0.1:8000/docs
#Documentation on Redocly: http://127.0.0.1:8000/redoc

#Inicia el servidor: uvicorn server:app --reload
#uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Para MacOS
#ipconfig getifaddr en0 
