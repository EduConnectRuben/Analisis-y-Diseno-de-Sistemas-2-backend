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

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MODELOS DE DATOS
class Usuario(BaseModel):
    email: str
    password: str

class Denuncia(BaseModel):
    nombre: str
    ci: str
    descripcion: str

def get_conn():
    return psycopg2.connect(DATABASE_URL)

@app.on_event("startup")
def startup():
    conn = get_conn()
    cursor = conn.cursor()
    # Crear tabla de usuarios
    cursor.execute("CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT);")
    # CREAR TABLA DE DENUNCIAS (Faltaba esto)
    cursor.execute("CREATE TABLE IF NOT EXISTS denuncias (id SERIAL PRIMARY KEY, nombre TEXT, ci TEXT, descripcion TEXT);")
    conn.commit()
    conn.close()

@app.get("/")
def home():
    return {"mensaje": "Servidor PD8 activo"}

# --- RUTAS DE USUARIO ---
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
        return {"mensaje": "registrado"}
    except:
        raise HTTPException(status_code=400, detail="Usuario ya existe")

@app.post("/login")
async def login(user: Usuario):
    email_limpio = user.email.strip().lower()
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM usuarios WHERE email=%s", (email_limpio,))
    result = cursor.fetchone()
    conn.close()
    if result and pwd_context.verify(user.password, result[0]):
        return {"mensaje": "ok"}
    raise HTTPException(status_code=400, detail="Credenciales incorrectas")

# --- RUTAS DE DENUNCIAS (ESTO ES LO QUE FALTABA) ---
@app.post("/denuncias")
async def crear_denuncia(d: Denuncia):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO denuncias (nombre, ci, descripcion) VALUES (%s, %s, %s)", (d.nombre, d.ci, d.descripcion))
        conn.commit()
        conn.close()
        return {"mensaje": "Denuncia guardada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/denuncias")
async def listar_denuncias():
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, ci, descripcion FROM denuncias ORDER BY id DESC")
        datos = cursor.fetchall()
        conn.close()
        return datos
    except Exception as e:
        return []