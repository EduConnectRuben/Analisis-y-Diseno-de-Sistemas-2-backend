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

class RolUpdate(BaseModel):
    user_id: int
    nuevo_rol: str

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
    # 1. Crear tablas
    cursor.execute("CREATE TABLE IF NOT EXISTS usuarios (id SERIAL PRIMARY KEY, email TEXT UNIQUE, password TEXT, rol TEXT DEFAULT 'pendiente');")
    cursor.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'pendiente';")
    cursor.execute("CREATE TABLE IF NOT EXISTS denuncias (id SERIAL PRIMARY KEY, nombre TEXT, ci TEXT, descripcion TEXT, fecha_reg TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
    
    # 2. CREACIÓN AUTOMÁTICA DE LAS 3 CUENTAS MAESTRAS
    cuentas = [
        ("admin@gmail.com", "12345", "admin"),
        ("policia@gmail.com", "12345", "policia"),
        ("fiscal@gmail.com", "12345", "fiscal")
    ]
    
    for email, password, rol in cuentas:
        cursor.execute("SELECT id FROM usuarios WHERE email = %s", (email,))
        if not cursor.fetchone():
            hashed = pwd_context.hash(password)
            cursor.execute("INSERT INTO usuarios (email, password, rol) VALUES (%s, %s, %s)", (email, hashed, rol))
            print(f"Cuenta creada: {email}")
    
    conn.commit()
    conn.close()

@app.get("/")
def home(): return {"mensaje": "SISTEMA PD-8 LISTO"}

@app.post("/login")
async def login(user: Usuario):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT password, rol, email FROM usuarios WHERE email=%s", (user.email.lower().strip(),))
    res = cursor.fetchone()
    conn.close()
    if res and pwd_context.verify(user.password, res[0]):
        return {"rol": res[1], "email": res[2]}
    raise HTTPException(status_code=400, detail="Credenciales incorrectas")

@app.post("/registro")
async def registro(user: Usuario):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        hashed = pwd_context.hash(user.password)
        cursor.execute("INSERT INTO usuarios (email, password, rol) VALUES (%s, %s, 'pendiente')", (user.email.lower().strip(), hashed))
        conn.commit()
        conn.close()
        return {"mensaje": "Solicitud enviada"}
    except:
        raise HTTPException(status_code=400, detail="El correo ya existe")

@app.get("/admin/usuarios")
async def listar_usuarios():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, rol FROM usuarios WHERE rol != 'admin' ORDER BY id DESC")
    res = cursor.fetchall()
    conn.close()
    return res

@app.post("/admin/asignar_rol")
async def asignar_rol(data: RolUpdate):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuarios SET rol=%s WHERE id=%s", (data.nuevo_rol, data.user_id))
    conn.commit()
    conn.close()
    return {"mensaje": "ok"}

@app.post("/denuncias")
async def crear_denuncia(d: Denuncia):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO denuncias (nombre, ci, descripcion) VALUES (%s, %s, %s)", (d.nombre, d.ci, d.descripcion))
    conn.commit()
    conn.close()
    return {"mensaje": "ok"}

@app.get("/denuncias")
async def listar_denuncias():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, ci, descripcion FROM denuncias ORDER BY id DESC")
    res = cursor.fetchall()
    conn.close()
    return res