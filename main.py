@app.post("/login")
async def login(user: Usuario):
    try:
        conn = get_conn()
        cursor = conn.cursor()
        # Limpiamos el correo de espacios y lo pasamos a minúsculas
        email_buscado = user.email.strip().lower()
        
        cursor.execute("SELECT password FROM usuarios WHERE email=%s", (email_buscado,))
        res = cursor.fetchone()
        conn.close()

        if not res:
            raise HTTPException(status_code=400, detail="El usuario no existe en la base de datos")

        if pwd_context.verify(user.password, res[0]):
            return {"mensaje": "ok"}
        else:
            raise HTTPException(status_code=400, detail="La contraseña es incorrecta")
    except Exception as e:
        # Esto nos dirá el error real en el alert
        raise HTTPException(status_code=400, detail=str(e))