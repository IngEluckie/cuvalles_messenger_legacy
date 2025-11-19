# websockets.py

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import redis
import time
import uuid
from icecream import ic

router_websockets = APIRouter()

# Ruta de testeo para verificar que el módulo esté activo
@router_websockets.get("/ison")
async def ison():
    return "Yes, I'm working!"

#################################
class RedisDB:

    def __init__(self):
        self.r = redis.Redis(host='localhost', port=6379, db=0)
        self.hash_key = "active_connections"

    def add_connection(self, username: str, connection_id: str):
        connection_data = {
            "connection_id": connection_id,
            "timestamp": time.time()
        }
        self.r.hset(self.hash_key, username, json.dumps(connection_data))

    def remove_connection(self, username: str):
        self.r.hdel(self.hash_key, username)

    def get_all_connections(self):
        data = self.r.hgetall(self.hash_key)
        # Convertir las claves y valores de bytes a string y dict
        connections = {
            k.decode(): json.loads(v.decode()) for k, v in data.items()
        }
        return connections

    def get_connection(self, username: str):
        value = self.r.hget(self.hash_key, username)
        if value:
            return json.loads(value.decode())
        return None

#################################
class ConnectionManager:

    def __init__(self, redis_db: RedisDB):
        self.active_connections = {}
        self.redis_db = redis_db

    async def connect(self, websocket: WebSocket, username: str):
        await websocket.accept()
        connection_id = str(uuid.uuid4())
        self.active_connections[username] = {
            "websocket": websocket,
            "connection_id": connection_id
        }
        # Registrar en Redis
        self.redis_db.add_connection(username, connection_id)

    def disconnect(self, username: str):
        if username in self.active_connections:
            del self.active_connections[username]
        self.redis_db.remove_connection(username)

    async def send_personal_message(self, message: dict, username: str):
        connection = self.active_connections.get(username)
        if connection:
            websocket = connection["websocket"]
            await websocket.send_json(message)

    async def broadcast(self, message: dict, exclude_username: str = None):
        """
        En esta parte del broadcast, debo excluir a todos menos al destinatario.
        ¿CÓMO? Posiblemente sea solo cambiar la condición if uid != exclude_username:
        Lo dejaré para después ya que me permite continuar con las demás
        funcionalidades.
        """
        for uid, info in self.active_connections.items():
            if uid != exclude_username:
                await info["websocket"].send_json(message)

# Instanciar RedisDB
manager = ConnectionManager(redis_db=RedisDB())

#################################
@router_websockets.websocket("/ws/{username}")
async def websocket_endpoint(websocket: WebSocket, username: str):
    print(f"función websocket activada para usuario {username}")
    await manager.connect(websocket, username)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
            except json.JSONDecodeError:
                message_data = {"text": data}
            await manager.broadcast(message_data, exclude_username=username)
    except WebSocketDisconnect:
        manager.disconnect(username)
        await manager.broadcast({"info": f"El usuario {username} se ha desconectado."})

@router_websockets.get("/is_user_on/{username}")
async def is_user_on(username: str):
    connection = manager.redis_db.get_connection(username)
    if connection:
        #ic(f"retorno positivo: {username}")
        return {"username": username, "online": True, "connection": connection}
    else:
        #ic(f"retorno negativo: {username}")
        return {"username": username, "online": False}

