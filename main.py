from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "postgresql://pd8_db_user:9LmN3qxtlJC969WX8yeUq7BRmkgr68sV@dpg-d73srcua2pns73acu8qg-a.oregon-postgres.render.com/pd8_db"

# Forzamos el uso de bcrypt de forma correcta
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class Usuario(BaseModel):
    email: str
    password: str

def get_conn():
    return psycopg2.connect(DATABASE_URL)

@app.get("/")
def home():
    return {"status": "ok"}

@app.post("/registro")
async def registro(user: Usuario):
    email_limpio = user.email.strip().lower()
    try:
        conn = get_conn()
        cursor = conn.cursor()
        hashed = pwd_context.hash(user.password)
        cursor.execute("INSERT INTO usuarios (email, password) VALUES (%s, %s)", (email_limpio, hashed))
        conn.commit()
        conn.close()
        print(f"DEBUG: Usuario {email_limpio} registrado con éxito")
        return {"mensaje": "registrado"}
    except Exception as e:
        print(f"DEBUG: Error en registro: {e}")
        raise HTTPException(status_code=400, detail="El usuario ya existe")

@app.post("/login")
async def login(user: Usuario):
    email_limpio = user.email.strip().lower()
    print(f"DEBUG: Intentando login para: {email_limpio}")
    
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM usuarios WHERE email=%s", (email_limpio,))
    result = cursor.fetchone()
    conn.close()

    if not result:
        print("DEBUG: Usuario no encontrado en la base de datos")
        raise HTTPException(status_code=400, detail="Credenciales incorrectas")

    # Verificación de la contraseña
    es_valido = pwd_context.verify(user.password, result[0])
    print(f"DEBUG: ¿Contraseña coincide?: {es_valido}")

    if es_valido:
        return {"mensaje": "Login exitoso"}
    
    raise HTTPException(status_code=400, detail="Credenciales incorrectas")