import base64
import hashlib
import hmac
import json
import os
import sqlite3
import time
from typing import List, Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

DB_PATH = os.getenv("SECURITY_DB_PATH", "data/security.db")
SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "UrbanPulse_Default_Secure_HMAC_Secret_Key_2026_!@#$")

security_scheme = HTTPBearer()

ROLES_INFO = {
    "Administrator": "Full platform access including user provisioning, system logs, CCTV inference execution, and diagnostic training reports.",
    "Traffic Engineer": "Access to advanced traffic forecasting models, feature attribution analysis, route optimization, and CCTV analytics feeds.",
    "Field Operator": "Read-only access to basic traffic speed monitoring, network congestion heatmaps, and optimal routing utilities."
}

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str

class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: str

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        event_type TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Check if any user exists
    cursor.execute("SELECT count(*) FROM users;")
    count = cursor.fetchone()[0]
    if count == 0:
        salt_bytes = os.urandom(16)
        salt_hex = salt_bytes.hex()
        password_hash = hash_password("pulse2026", salt_hex)
        cursor.execute(
            "INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, ?);",
            ("admin", password_hash, salt_hex, "Administrator")
        )
        conn.commit()
    
    conn.close()

def hash_password(password: str, salt_hex: str) -> str:
    salt_bytes = bytes.fromhex(salt_hex)
    hash_bytes = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt_bytes,
        100000
    )
    return hash_bytes.hex()

def create_access_token(username: str, role: str, valid_duration: int = 28800) -> str:
    header = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).decode().rstrip("=")
    now = int(time.time())
    payload_data = {
        "sub": username,
        "role": role,
        "iat": now,
        "exp": now + valid_duration
    }
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
    signature_input = f"{header}.{payload}".encode()
    sig_bytes = hmac.new(SECRET_KEY.encode(), signature_input, hashlib.sha256).digest()
    sig = base64.urlsafe_b64encode(sig_bytes).decode().rstrip("=")
    return f"{header}.{payload}.{sig}"

def verify_access_token(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Malformed token format")
    header, payload, sig = parts
    signature_input = f"{header}.{payload}".encode()
    expected_sig_bytes = hmac.new(SECRET_KEY.encode(), signature_input, hashlib.sha256).digest()
    expected_sig = base64.urlsafe_b64encode(expected_sig_bytes).decode().rstrip("=")
    
    if not hmac.compare_digest(sig, expected_sig):
        raise HTTPException(status_code=401, detail="Token cryptographic signature mismatch")
        
    try:
        padded_payload = payload + "=" * (-len(payload) % 4)
        payload_data = json.loads(base64.urlsafe_b64decode(padded_payload).decode())
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token payload decoding")
        
    if time.time() > payload_data.get("exp", 0):
        raise HTTPException(status_code=401, detail="Authentication session token expired")
        
    return payload_data

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> dict:
    token = credentials.credentials
    user_data = verify_access_token(token)
    return user_data

def require_roles(allowed_roles: List[str]):
    def role_validator(current_user: dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted. Role '{current_user.get('role')}' is not permitted for this resource."
            )
        return current_user
    return role_validator

def record_audit_log(conn: sqlite3.Connection, username: str, event_type: str, status_val: str):
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO audit_logs (username, event_type, status) VALUES (?, ?, ?)",
        (username, event_type, status_val)
    )
    conn.commit()
