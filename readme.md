# Most used commands

**Para conseguir el requirements.txt**
> pip freeze > requirements.txt

**Activar entorno virtual**
> source venv/bin/activate   # En Linux/Mac
.\\venv\\Scripts\\activate    # En Windows

**Instalar los paquetes desde el txt**
pip install -r requirements.txt

## Variables de entorno

Define `MESSAGE_ENCRYPTION_KEY` en `.env` para que los mensajes se guarden cifrados.
Debe ser una clave simétrica en Base64 (16, 24 o 32 bytes decodificados). Puedes
generarla así:

```bash
python - <<'PY'
import base64, os
print(base64.urlsafe_b64encode(os.urandom(32)).decode())
PY
```
