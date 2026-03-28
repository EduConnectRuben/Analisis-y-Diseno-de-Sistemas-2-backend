from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
from passlib.context import CryptContext
from fastapi.middleware.cors import CORSMiddleware
import traceback

app = FastAPI()

# Permisos para conectar con Netlify
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔗 TU URL DE BASE DE DATOS
DATABASE_URL = "postgresql://pd8_db_user:9LmN3qxtlJC969WX8yeUq7BRmkgr68sV@dpg-d73srcua2pns73acu8qg-a.oregon-postgres.render.com/pd8_db"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- MODELOS DE DATOS ---
class Usuario(BaseModel):
    email: str
    password: str

class Denuncia(BaseModel):
    nombre: str
    ci: str
    descripcion: str

class Citacion(BaseModel):
    denuncia_id: int
    fecha: str
    fiscal: str

def get_conn():
    return psycopg2.connect(DATABASE_URL)

@app.on_event("startup")
def startup():
    try:
        conn = get_conn()
        cursor = conn.cursor()
        # 1. Tabla Usuarios
        cursor.execute("CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT);")
        # 2. Tabla Denuncias
        cursor.execute("CREATE TABLE IF NOT EXISTS denuncias (id SERIAL PRIMARY KEY, nombre TEXT, ci TEXT, descripcion TEXT, fecha_reg TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
        # 3. Tabla Citaciones
        cursor.execute("CREATE TABLE IF NOT EXISTS citaciones (id SERIAL PRIMARY KEY, denuncia_id INTEGER, fecha_cita TEXT, fiscal_nombre TEXT);")
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Error en startup: {e}")

@app.get("/")
def home():
    return {"status": "SISTEMA PD-8 ONLINE"}

# --- RUTAS DE LOGIN Y REGISTRO ---
@app.post("/registro")
async def registro(user: Usuario):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        hashed = pwd_context.hash(user.password)
        cursor.execute("INSERT INTO usuarios (email, password) VALUES (%s, %s)", (user.email.lower().strip(), hashed))
        conn.commit()
        conn.close()
        return {"mensaje": "ok"}
    except:
        raise HTTPException(status_code=400, detail="El usuario ya existe")

@app.post("/login")
async def login(user: Usuario):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT password FROM usuarios WHERE email=%s", (user.email.lower().strip(),))
        res = cursor.fetchone()
        conn.close()
        if res and pwd_context.verify(user.password, res[0]):
            return {"mensaje": "ok"}
        raise HTTPException(status_code=400, detail="Clave incorrecta")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- RUTAS DE DENUNCIAS ---
@app.post("/denuncias")
async def crear_denuncia(d: Denuncia):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO denuncias (nombre, ci, descripcion) VALUES (%s, %s, %s)", (d.nombre, d.ci, d.descripcion))
        conn.commit()
        conn.close()
        return {"mensaje": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/denuncias")
async def listar_denuncias():
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("SELECT id, nombre, ci, descripcion FROM denuncias ORDER BY id DESC")
        res = cursor.fetchall()
        conn.close()
        return res
    except Exception as e:
        return []

# --- RUTAS DE CITACIONES ---
@app.post("/citaciones")
async def crear_citacion(c: Citacion):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO citaciones (denuncia_id, fecha_cita, fiscal_nombre) VALUES (%s, %s, %s)", (c.denuncia_id, c.fecha, c.fiscal))
        conn.commit()
        conn.close()
        return {"mensaje": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))