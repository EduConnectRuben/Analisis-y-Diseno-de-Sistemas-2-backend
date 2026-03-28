from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from passlib.context import CryptContext

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

@app.get("/")
def read_root():
    return {"mensaje": "Servidor activo"}

@app.post("/registro")
async def registro(user: Usuario):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    hashed = pwd_context.hash(user.password)
    try:
        cursor.execute("INSERT INTO usuarios (email, password) VALUES (%s, %s)", (user.email, hashed))
        conn.commit()
        return {"mensaje": "registrado"}
    except:
        return {"error": "ya existe"}
    finally:
        conn.close()

@app.post("/login")
async def login(user: Usuario):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM usuarios WHERE email=%s", (user.email,))
    res = cursor.fetchone()
    conn.close()
    if res and pwd_context.verify(user.password, res[0]):
        return {"mensaje": "ok"}
    return {"error": "incorrecto"}