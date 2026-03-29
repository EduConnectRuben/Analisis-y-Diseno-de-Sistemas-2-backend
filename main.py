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

class Usuario(BaseModel):
    email: str
    password: str

class Denuncia(BaseModel):
    nombre: str
    ci: str
    descripcion: str

class Citacion(BaseModel):
    denuncia_id: int
    nivel: str
    fecha: str
    fiscal: str

def get_conn():
    return psycopg2.connect(DATABASE_URL)

@app.on_event("startup")
def startup():
    conn = get_conn()
    cursor = conn.cursor()
    # Tablas Pro
    cursor.execute("CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, rol TEXT DEFAULT 'pendiente');")
    cursor.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'pendiente';")
    cursor.execute("CREATE TABLE IF NOT EXISTS denuncias (id SERIAL PRIMARY KEY, nombre TEXT, ci TEXT, descripcion TEXT, fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
    cursor.execute("CREATE TABLE IF NOT EXISTS citaciones (id SERIAL PRIMARY KEY, denuncia_id INTEGER, nivel TEXT, fecha TEXT, fiscal TEXT);")
    
    # Cuentas Maestras (Pass: 12345)
    cuentas = [("admin@gmail.com", "admin"), ("policia@gmail.com", "policia"), ("fiscal@gmail.com", "fiscal")]
    for em, rl in cuentas:
        cursor.execute("SELECT id FROM usuarios WHERE email=%s", (em,))
        if not cursor.fetchone():
            h = pwd_context.hash("12345")
            cursor.execute("INSERT INTO usuarios (email, password, rol) VALUES (%s, %s, %s)", (em, h, rl))
    conn.commit()
    conn.close()

@app.post("/login")
async def login(u: Usuario):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT password, rol, email FROM usuarios WHERE email=%s", (u.email.lower().strip(),))
    res = cursor.fetchone()
    conn.close()
    if res and pwd_context.verify(u.password, res[0]):
        return {"rol": res[1], "email": res[2]}
    raise HTTPException(status_code=400)

@app.post("/registro")
async def registro(u: Usuario):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        h = pwd_context.hash(u.password)
        cursor.execute("INSERT INTO usuarios (email, password, rol) VALUES (%s, %s, 'pendiente')", (u.email.lower().strip(), h))
        conn.commit()
        conn.close()
        return {"ok": True}
    except: raise HTTPException(status_code=400)

@app.get("/admin/usuarios")
async def admin_list():
    conn = get_conn()
    cursor = conn.cursor()
    # LISTA A TODOS EXCEPTO AL ADMIN ACTUAL PARA ASIGNARLES CARGO
    cursor.execute("SELECT id, email, rol FROM usuarios WHERE email != 'admin@gmail.com' ORDER BY id DESC")
    res = cursor.fetchall()
    conn.close()
    return res

@app.post("/admin/asignar")
async def asignar(user_id: int, rol: str):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET rol=%s WHERE id=%s", (rol, user_id))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/denuncias")
async def guardar_denuncia(d: Denuncia):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO denuncias (nombre, ci, descripcion) VALUES (%s, %s, %s)", (d.nombre, d.ci, d.descripcion))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/denuncias")
async def listar_denuncias():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, ci, descripcion FROM denuncias ORDER BY id DESC")
    res = cursor.fetchall()
    conn.close()
    return res