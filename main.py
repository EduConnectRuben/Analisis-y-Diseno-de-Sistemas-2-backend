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

class EstadoUpdate(BaseModel):
    denuncia_id: int
    estado: str

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
    cursor.execute("CREATE TABLE IF NOT EXISTS denuncias (id SERIAL PRIMARY KEY, nombre TEXT, ci TEXT, descripcion TEXT, fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP, estado TEXT DEFAULT 'activo');")
    cursor.execute("ALTER TABLE denuncias ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';")
    cursor.execute("CREATE TABLE IF NOT EXISTS citaciones (id SERIAL PRIMARY KEY, denuncia_id INTEGER, nivel TEXT, fecha TEXT, fiscal TEXT);")
    cursor.execute("ALTER TABLE citaciones ADD COLUMN IF NOT EXISTS nivel TEXT;")
    cursor.execute("ALTER TABLE citaciones ADD COLUMN IF NOT EXISTS fecha TEXT;")
    cursor.execute("ALTER TABLE citaciones ADD COLUMN IF NOT EXISTS fiscal TEXT;")
    
    # Cuentas Maestras (Pass: 12345)
    cuentas = [("admin@gmail.com", "admin"), ("policia@gmail.com", "policia"), ("fiscal@gmail.com", "fiscal")]
    for em, rl in cuentas:
        cursor.execute("SELECT id FROM usuarios WHERE email=%s", (em,))
        if not cursor.fetchone():
            h = pwd_context.hash("12345")
            cursor.execute("INSERT INTO usuarios (email, password, rol) VALUES (%s, %s, %s)", (em, h, rl))
        else:
            # Fuerza el rol correcto si ya existían pero perdieron su rol
            cursor.execute("UPDATE usuarios SET rol=%s WHERE email=%s", (rl, em))
            
    conn.commit()
    conn.close()

@app.get("/setup_tables")
def setup_tables():
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS citaciones (id SERIAL PRIMARY KEY, denuncia_id INTEGER, nivel TEXT, fecha TEXT, fiscal TEXT);")
    cursor.execute("ALTER TABLE citaciones ADD COLUMN IF NOT EXISTS nivel TEXT;")
    cursor.execute("ALTER TABLE citaciones ADD COLUMN IF NOT EXISTS fecha TEXT;")
    cursor.execute("ALTER TABLE citaciones ADD COLUMN IF NOT EXISTS fiscal TEXT;")
    cursor.execute("ALTER TABLE denuncias ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'activo';")
    conn.commit()
    conn.close()
    return {"ok": True, "msg": "Tablas creadas y parchadas correctamente. Ya puedes procesar citaciones."}

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
        
        # Validar si correo ya existe
        cursor.execute("SELECT id FROM usuarios WHERE email=%s", (u.email.lower().strip(),))
        if cursor.fetchone():
            return {"ok": False, "error": "correo_existe"}
            
        h = pwd_context.hash(u.password)
        cursor.execute("INSERT INTO usuarios (email, password, rol) VALUES (%s, %s, 'pendiente')", (u.email.lower().strip(), h))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

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
    cursor.execute("""
        SELECT d.id, d.nombre, d.ci, d.descripcion, 
               (SELECT COUNT(*) FROM citaciones c WHERE c.denuncia_id = d.id) as num_citaciones,
               (SELECT fecha FROM citaciones c WHERE c.denuncia_id = d.id ORDER BY id DESC LIMIT 1) as ultima_fecha,
               d.estado
        FROM denuncias d ORDER BY d.id DESC
    """)
    res = cursor.fetchall()
    conn.close()
    return res

@app.post("/citaciones")
async def guardar_citacion(c: Citacion):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO citaciones (denuncia_id, nivel, fecha, fiscal) VALUES (%s, %s, %s, %s)", (c.denuncia_id, c.nivel, c.fecha, c.fiscal))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

@app.post("/denuncias/estado")
async def cambiar_estado(e: EstadoUpdate):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        cursor.execute("UPDATE denuncias SET estado=%s WHERE id=%s", (e.estado, e.denuncia_id))
        conn.commit()
        conn.close()
        return {"ok": True}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}

@app.get("/citaciones/{denuncia_id}")
async def listar_citaciones_x_denuncia(denuncia_id: int):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute("SELECT id, nivel, fecha, fiscal FROM citaciones WHERE denuncia_id = %s ORDER BY id ASC", (denuncia_id,))
    res = cursor.fetchall()
    conn.close()
    return res