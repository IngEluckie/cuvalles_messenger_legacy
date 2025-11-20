"""Utilidades de cifrado simétrico para mensajes en reposo.

Se utiliza AES-GCM con una clave leída desde la variable de entorno
`MESSAGE_ENCRYPTION_KEY` (Base64). El formato almacenado es:

    base64( nonce(12 bytes) || ciphertext+tag )

Si la clave no tiene un tamaño válido o no se define, se lanzará un
`EncryptionError`.
"""

from __future__ import annotations

import base64
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class EncryptionError(Exception):
    """Señala problemas al cifrar o cargar la clave."""


class DecryptionError(Exception):
    """Señala problemas al descifrar un payload cifrado."""


_key_cache: Optional[bytes] = None


def _load_key() -> bytes:
    """Obtiene y valida la clave simétrica desde el entorno.

    La clave debe estar codificada en Base64 y tener un tamaño de 16, 24 o 32
    bytes (AES-128/192/256).
    """

    global _key_cache
    if _key_cache:
        return _key_cache

    key_b64 = os.getenv("MESSAGE_ENCRYPTION_KEY")
    if not key_b64:
        raise EncryptionError("La variable MESSAGE_ENCRYPTION_KEY no está configurada.")

    try:
        key = base64.urlsafe_b64decode(key_b64)
    except Exception as exc:  # pragma: no cover - defensivo
        raise EncryptionError("MESSAGE_ENCRYPTION_KEY debe estar en Base64.") from exc

    if len(key) not in (16, 24, 32):
        raise EncryptionError(
            "La clave simétrica debe tener 16, 24 o 32 bytes (128/192/256 bits)."
        )

    _key_cache = key
    return key


def encrypt_text(plain_text: str) -> str:
    """Cifra texto plano y devuelve una cadena Base64 lista para persistir."""

    key = _load_key()
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plain_text.encode("utf-8"), None)
    payload = nonce + ciphertext
    return base64.b64encode(payload).decode("utf-8")


def decrypt_text(payload_b64: str) -> str:
    """Descifra una cadena Base64 generada por :func:`encrypt_text`."""

    key = _load_key()
    try:
        payload = base64.b64decode(payload_b64)
    except Exception as exc:  # pragma: no cover - defensivo
        raise DecryptionError("El mensaje cifrado tiene un formato inválido.") from exc

    if len(payload) < 13:
        raise DecryptionError("El mensaje cifrado es demasiado corto.")

    nonce, ciphertext = payload[:12], payload[12:]
    aesgcm = AESGCM(key)

    try:
        plain_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    except Exception as exc:  # pragma: no cover - defensivo
        raise DecryptionError("No se pudo descifrar el mensaje.") from exc

    try:
        return plain_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:  # pragma: no cover - defensivo
        raise DecryptionError("El mensaje descifrado no es texto UTF-8.") from exc
