const API = "https://analisis-y-diseno-de-sistemas-2-backend.onrender.com";
const { jsPDF } = window.jspdf;

async function login() {
    const email = document.getElementById("login_email").value.trim().toLowerCase();
    const password = document.getElementById("login_password").value;
    try {
        const res = await fetch(`${API}/login`, {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email, password})
        });
        const data = await res.json();
        if (res.ok) {
            // Auto-reparar tablas del backend silenciosamente
            fetch(`${API}/setup_tables`).catch(()=>console.log("Setup finalizado"));
            
            document.getElementById("auth-section").style.display = "none";
            document.getElementById("dashboard").style.display = "block";
            const userRole = data.rol ? data.rol : 'pendiente';
            document.getElementById("user-display").innerText = data.email;
            document.getElementById("rol-display").innerText = userRole.toUpperCase();

            document.getElementById("view-pendiente").style.display = "none";
            document.getElementById("view-admin").style.display = "none";
            document.getElementById("view-policia").style.display = "none";
            document.getElementById("view-fiscal").style.display = "none";

            const sysTitle = document.getElementById("sys-title");
            const sysSub = document.getElementById("sys-subtitle");

            if (userRole === 'admin') {
                if(sysTitle) sysTitle.innerText = "PANEL DE ADMINISTRACIÓN";
                if(sysSub) sysSub.innerText = "SISTEMA DE CONTROL DE OFICIALES";
                document.getElementById("view-admin").style.display = "block";
                cargarAdmin();
            } else if (userRole === 'policia') {
                if(sysTitle) sysTitle.innerText = "SISTEMA POLICIAL OFICIAL";
                if(sysSub) sysSub.innerText = "FUERZA ESPECIAL DE LUCHA CONTRA EL CRIMEN";
                document.getElementById("view-policia").style.display = "block";
                cargarDenunciasPolicia();
            } else if (userRole === 'fiscal') {
                if(sysTitle) sysTitle.innerText = "MINISTERIO PÚBLICO";
                if(sysSub) sysSub.innerText = "FISCALÍA DE MATERIA PENAL";
                document.getElementById("view-fiscal").style.display = "block";
                cargarFiscalia();
            } else {
                if(sysTitle) sysTitle.innerText = "ACCESO RESTRINGIDO";
                if(sysSub) sysSub.innerText = "VERIFICANDO CREDENCIALES";
                document.getElementById("view-pendiente").style.display = "block";
            }
        } else {
            alert("Credenciales incorrectas");
        }
    } catch(e) { alert("Servidor no responde o está en mantenimiento."); }
}

async function registrar() {
    const email = document.getElementById("reg_email").value;
    const password = document.getElementById("reg_password").value;
    if(!email || !password) return alert("Ingrese correo y contraseña");
    
    // Add visual feedback
    const btn = document.querySelector("#auth-section .btn-gray");
    btn.innerText = "SOLICITANDO...";
    
    try {
        const res = await fetch(`${API}/registro`, {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({email: email, password: password})
        });
        const data = await res.json();
        
        btn.innerText = "REGISTRAR";
        
        if (res.ok && data.ok) {
            alert("✅ Registro exitoso. Comunícate con el Administrador para que asigne tu acceso.");
            document.getElementById("reg_email").value = "";
            document.getElementById("reg_password").value = "";
        } else {
            if(data.error === "correo_existe") alert("⚠️ Este correo ya está registrado en el SINCOJ.");
            else alert("Error interno de red: " + (data.error || ""));
        }
    } catch(e) {
        alert("Error de conexión con el servidor principal.");
    }
    btn.innerText = "SOLICITAR ACCESO";
}

// ADMIN
async function cargarAdmin() {
    const res = await fetch(`${API}/admin/usuarios?t=${Date.now()}`);
    const users = await res.json();
    const tbody = document.getElementById("lista-admin");
    tbody.innerHTML = "";
    users.forEach(u => {
        tbody.innerHTML += `<tr>
            <td style="font-size:13px; font-weight:500;">${u[1]}</td>
            <td><span class="badge" style="background:${u[2]==='pendiente'?'#EF4444':(u[2]==='policia'?'#3B82F6':'#F59E0B')}">${u[2].toUpperCase()}</span></td>
            <td>
                <div class="btn-container" style="display:flex; gap:5px; justify-content:flex-start;">
                    <button onclick="asignar(${u[0]},'policia')" class="btn-blue" style="width:auto; padding:6px 12px; font-size:11px; font-weight:bold; letter-spacing:0.5px; border-radius:4px;">Asignar Policía</button>
                    <button onclick="asignar(${u[0]},'fiscal')" class="btn-warning" style="width:auto; padding:6px 12px; font-size:11px; font-weight:bold; letter-spacing:0.5px; border-radius:4px;">Asignar Fiscal</button>
                    <button onclick="asignar(${u[0]},'pendiente')" style="background:#dc2626; color:white; border:none; width:auto; padding:6px 12px; font-size:11px; font-weight:bold; letter-spacing:0.5px; border-radius:4px; box-shadow:0 0 5px rgba(220,38,38,0.5); cursor:pointer;">Eliminar Cargo</button>
                </div>
            </td>
        </tr>`;
    });
}

async function asignar(id, rol) {
    try {
        const res = await fetch(`${API}/admin/asignar?user_id=${id}&rol=${rol}`, {method: "POST"});
        if (!res.ok) throw new Error("Error interno del servidor");
        alert(`Cargo ${rol.toUpperCase()} asignado correctamente.`);
        cargarAdmin();
    } catch(e) {
        alert("Error: El backend no pudo procesar la asignación de cargo.");
    }
}

function getEstadoClase(numCitaciones) {
    if(!numCitaciones || numCitaciones === 0) return {class: "row-normal", text: "Registrado", badge: "0 Citaciones"};
    if(numCitaciones === 1) return {class: "row-yellow", text: "Alerta Nivel 1", badge: "1ra Citación"};
    if(numCitaciones === 2) return {class: "row-orange", text: "Alerta Nivel 2", badge: "2da Citación"};
    return {class: "row-red", text: "Riesgo de Aprehensión", badge: `${numCitaciones} Citaciones`};
}

// POLICIA
async function procesarDenuncia() {
    const nombre = document.getElementById("den_nombre").value;
    const ci = document.getElementById("den_ci").value;
    const desc = document.getElementById("den_desc").value;
    if(!nombre || !ci) return alert("Faltan datos obligatorios del sujeto.");

    const res = await fetch(`${API}/denuncias`, {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({nombre, ci, descripcion: desc})
    });
    if(res.ok) {
        alert("DENUNCIA GUARDADA EN EL SISTEMA JUDICIAL");
        document.getElementById("den_nombre").value = "";
        document.getElementById("den_ci").value = "";
        document.getElementById("den_desc").value = "";
        cargarDenunciasPolicia();
        generarPDFDenuncia(nombre, ci, desc);
    }
}

async function cargarDenunciasPolicia(filtro = '') {
    const res = await fetch(`${API}/denuncias?t=${Date.now()}`);
    let datos = await res.json();
    const tbody = document.getElementById("lista-denuncias-policia");
    tbody.innerHTML = "";
    datos.forEach(d => {
        // d: [id, nombre, ci, descripcion, num_citaciones, ultima_fecha]
        const count = d[4] || 0;
        const e = getEstadoClase(count);
        tbody.innerHTML += `<tr class="${e.class}">
            <td><strong>${d[1]}</strong></td>
            <td>C.I. ${d[2]}</td>
            <td><span class="status-badge status">${e.badge}</span><br><small style="color:#94a3b8;font-size:10px;">${e.text}</small></td>
            <td>
                <div class="btn-container">
                    <button onclick="generarPDFDenuncia('${d[1]}','${d[2]}','${d[3].replace(/'/g,"\\'").replace(/\n/g," ")}')" class="btn-green">Acta Denuncia</button>
                    ${count > 0 ? `<button onclick="descargarHistorialPDF('${d[1]}','${d[2]}', ${count})" class="btn-red" style="width:auto!important; padding:8px; font-size:12px;">Reporte PDF</button>` : ''}
                </div>
            </td>
        </tr>`;
    });
}

function generarPDFDenuncia(nombre, ci, hecho) {
    const doc = new jsPDF();
    const img = new Image(); img.src = 'denuncia.png';
    img.onload = () => {
        doc.addImage(img, 'PNG', 15, 10, 25, 30);
        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.text("POLICÍA BOLIVIANA", 105, 20, {align:'center'});
        doc.setFontSize(12);
        doc.text("FUERZA ESPECIAL DE LUCHA CONTRA EL CRIMEN (F.E.L.C.C.)", 105, 28, {align:'center'});
        doc.text("DISTRITO POLICIAL N° 8", 105, 36, {align:'center'});
        
        doc.line(15, 42, 195, 42); // Línea separadora
        
        doc.setFontSize(14);
        doc.text("ACTA DE DENUNCIA FORMAL", 105, 55, {align:'center'});
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        
        const fechaActual = new Date().toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' });
        
        doc.text("En las instalaciones de la FELCC, Distrito 8, en fecha y hora detalladas:", 15, 65, {maxWidth: 180});
        doc.setFont("times", "bold"); doc.text(`${fechaActual}`, 15, 72);
        
        doc.setFont("times", "normal");
        doc.text("En virtud a las atribuciones conferidas por la Constitución Política del Estado Plurinacional de Bolivia y la Ley Orgánica de la Policía Boliviana, se procesa la denuncia en contra de:", 15, 82, {maxWidth: 180, align: 'justify'});
        doc.text(`El/La ciudadano(a) C.I.: `, 15, 95);
        doc.setFont("times", "bold"); doc.text(`${ci}`, 60, 95); doc.setFont("times", "normal");
        doc.text(`Identificado bajo el nombre de: `, 15, 102);
        doc.setFont("times", "bold"); doc.text(`${nombre.toUpperCase()}`, 75, 102);
        
        doc.setFont("times", "bold"); doc.text("HECHO DENUNCIADO:", 15, 115);
        doc.setFont("times", "normal");
        doc.text(`"${hecho}"`, 15, 122, {maxWidth: 180, align: 'justify'});
        
        doc.text("Se remiten todos los antecedentes documentales al Ministerio Público para que asuma competencia y emita las directrices investigativas conforme al Art. 277 de la Ley 1970 del Código de Procedimiento Penal Boliviano.", 15, 145, {maxWidth: 180, align: 'justify'});
        doc.text("Cualquier obstrucción o desobediencia al llamado de la autoridad fiscal derivará en los agravantes estipulados por Ley, habilitando la respectiva Orden de Aprehensión inmediata transcurridas las citaciones por norma.", 15, 160, {maxWidth: 180, align: 'justify'});
        
        doc.line(60, 225, 150, 225);
        doc.setFontSize(10);
        doc.text("Firma de Sello Oficial Uniformado", 105, 230, {align:'center'});
        doc.setFont("times", "normal");

        const qr = `https://quickchart.io/qr?text=PD8-DEN-${ci}&size=100`;
        const qrImg = new Image(); 
        qrImg.crossOrigin = "Anonymous";
        qrImg.src = qr;
        qrImg.onload = () => { 
            try { doc.addImage(qrImg, 'PNG', 160, 240, 30, 30); } catch(ex){} 
            doc.save(`ACTA_DENUNCIA_${ci}.pdf`); 
        };
        qrImg.onerror = () => { doc.save(`ACTA_DENUNCIA_${ci}.pdf`); };
    };
    img.onerror = () => {
        doc.save(`ACTA_DENUNCIA_${ci}.pdf`);
    };
}

// FISCALIA
async function cargarFiscalia() {
    const res = await fetch(`${API}/denuncias?t=${Date.now()}`);
    const datos = await res.json();
    const tbody = document.getElementById("lista-fiscal");
    tbody.innerHTML = "";
    datos.forEach(d => {
        const id = d[0], nombre = d[1], ci = d[2], desc = d[3], numCitaciones = d[4], fechaU = d[5], estado = d[6];
        
        let colorFila = 'border-bottom: 1px solid rgba(255,255,255,0.05); transition: 0.3s;';
        if (numCitaciones === 1) colorFila += 'background: linear-gradient(90deg, rgba(234, 179, 8, 0.1) 0%, transparent 50%); border-left: 4px solid #EAB308;';
        if (numCitaciones === 2) colorFila += 'background: linear-gradient(90deg, rgba(249, 115, 22, 0.1) 0%, transparent 50%); border-left: 4px solid #F97316;';
        if (numCitaciones >= 3) colorFila  += 'background: linear-gradient(90deg, rgba(239, 68, 68, 0.15) 0%, transparent 50%); border-left: 4px solid #EF4444;';
        
        let estadoBadge = `<span style="background:#1E293B; padding:5px 10px; border-radius:6px; font-size:12px; border:1px solid #334155;">${numCitaciones} Citaciones</span>`;
        if (numCitaciones === 1) estadoBadge = `<span style="background:rgba(234, 179, 8, 0.2); border:1px solid #EAB308; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:bold; color:#FDE047;">1ra Citación Oficial</span>`;
        if (numCitaciones === 2) estadoBadge = `<span style="background:rgba(249, 115, 22, 0.2); border:1px solid #F97316; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:bold; color:#FFEDD5;">2da Citación Oficial</span>`;
        if (numCitaciones >= 3) estadoBadge  = `<span style="background:rgba(239, 68, 68, 0.2); border:1px solid #EF4444; padding:5px 10px; border-radius:6px; font-size:12px; font-weight:bold; color:#FECACA; box-shadow:0 0 10px rgba(239, 68, 68, 0.5);">ORDEN DE APREHENSIÓN HABILITADA</span>`;
        if (estado === 'solucionado') {
             colorFila = 'background: rgba(16, 185, 129, 0.05); border-left: 4px solid #10B981; opacity:0.8;';
             estadoBadge = `<span style="background:rgba(16, 185, 129, 0.2); padding:5px 10px; border-radius:6px; font-size:12px; font-weight:bold; color:#A7F3D0; border:1px solid #10B981;">EXPEDIENTE CERRADO</span>`;
        }

        let botonesHTML = '';
        if (estado === 'solucionado') {
            botonesHTML = `<div style="color:#10B981; font-weight:bold; font-size:13px; letter-spacing:1px; display:inline-flex; align-items:center; gap:8px;"><svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg> CASO ARCHIVADO</div>`;
        } else if (numCitaciones >= 3) {
            botonesHTML = `
                <button class="btn-blue" style="background:linear-gradient(135deg, #EF4444, #B91C1C); border:none; font-weight:bold; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); text-transform:uppercase; font-size:12px; padding:10px 15px;" onclick="generarPDFAprehension('${nombre}', '${ci}')">PDF Aprehensión</button>
                <button style="background:linear-gradient(135deg, #10B981, #059669); border:none; font-weight:bold; color:white; padding:10px 15px; border-radius:5px; cursor:pointer; font-size:12px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);" onclick="marcarSolucionado(${id})">Solucionar Caso</button>
            `;
        } else {
            botonesHTML = `
                <button class="btn-blue" style="font-size:12px; padding:8px 15px; font-weight:bold;" onclick="abrirModal(${id}, '${nombre}')">CITAR</button>
                <button class="btn-warning" onclick="generarPDFExpediente('${nombre}','${ci}','${numCitaciones}')" style="font-size:12px; padding:8px 15px; display: ${numCitaciones===0?'none':'inline-block'};">Expediente</button>
                <button style="background:linear-gradient(135deg, #10B981, #059669); border:none; margin-left:10px; color:white; font-weight:bold; padding:8px 15px; border-radius:5px; cursor:pointer; font-size:12px;" onclick="marcarSolucionado(${id})">Solucionar Caso</button>
            `;
        }

        tbody.innerHTML += `
        <tr style="${colorFila}" class="fiscal-row">
            <td style="padding:15px; font-weight:bold; letter-spacing:0.5px;">${nombre.toUpperCase()}</td>
            <td style="padding:15px; opacity:0.8; font-family:monospace; font-size:14px;">C.I. ${ci}</td>
            <td style="padding:15px; text-align:center;">${estadoBadge}</td>
            <td style="padding:15px;">
                <div style="display:flex; gap:10px; align-items:center;">
                    ${botonesHTML}
                </div>
            </td>
        </tr>`;
    });
}

async function marcarSolucionado(id) {
    if(!confirm("¿Estás seguro que deseas Marcar este Caso como SOLUCIONADO y Cerrarlo Definitivamente?")) return;
    try {
        const res = await fetch(`${API}/denuncias/estado`, {
            method: "POST", headers:{"Content-Type": "application/json"},
            body: JSON.stringify({denuncia_id: parseInt(id), estado: 'solucionado'})
        });
        if(res.ok) cargarFiscalia();
    } catch(e) {}
}

function generarPDFAprehension(nombre, ci) {
    const doc = new jsPDF('p', 'mm', 'letter');
    const img = new Image(); img.src = 'citacion.png';
    img.onload = () => {
        doc.addImage(img, 'PNG', 15, 10, 25, 30);
        doc.setFontSize(22); doc.setFont("helvetica", "bold");
        doc.text("MINISTERIO PÚBLICO - ESTADO PLURINACIONAL", 105, 25, {align: 'center'});
        doc.setFontSize(16); doc.text("FISCALÍA DE MATERIA PENAL", 105, 35, {align: 'center'});
        doc.setFontSize(18); doc.setTextColor(239, 68, 68);
        doc.text("MANDAMIENTO DE APREHENSIÓN", 105, 48, {align: 'center'});
        doc.setTextColor(0, 0, 0); doc.line(15, 55, 195, 55);
        doc.setFontSize(12); doc.setFont("helvetica", "normal");
        const f = new Date().toLocaleDateString('es-BO', { year:'numeric', month:'long', day:'numeric' });
        doc.text(`En estricto apego al Artículo 226 de la Ley N° 1970, en fecha ${f}, se emite la orden \nde APREHENSIÓN inmediata y conducción obligatoria de la siguiente persona ante las instalaciones \nde la Fiscalía de la materia, por evadir recurrentemente las tres citaciones preventivas emitidas.`, 15, 65);
        
        doc.setFont("helvetica", "bold"); doc.text(`APREHENDIDO:`, 15, 85); doc.setFont("helvetica", "normal"); doc.text(`${nombre.toUpperCase()}`, 55, 85);
        doc.setFont("helvetica", "bold"); doc.text(`CÉDULA IDENTIDAD:`, 15, 95); doc.setFont("helvetica", "normal"); doc.text(`${ci}`, 62, 95);
        
        doc.text("Las fuerzas policiales quedan habilitadas e instruidas para la búsqueda y traslado físico del\nciudadano descrito, pudiendo allanar domicilios en horarios habilitados de ser necesario.", 15, 115);
        
        doc.line(70, 240, 140, 240);
        doc.text("FISCAL GENERAL ASIGNADO", 105, 245, {align:'center'});

        const qr = `https://quickchart.io/qr?text=APREHENSION-${ci}&size=100`;
        const qrImg = new Image(); qrImg.crossOrigin = "Anonymous"; qrImg.src = qr;
        qrImg.onload = () => { try { doc.addImage(qrImg, 'PNG', 160, 240, 30, 30); } catch(e){} doc.save(`APREHENSION_${ci}.pdf`); };
        qrImg.onerror = () => { doc.save(`APREHENSION_${ci}.pdf`); };
    };
    img.onerror = () => { doc.save(`APREHENSION_${ci}.pdf`); };
}

function abrirModal(id, nombre) {
    document.getElementById("modal_id").value = id;
    document.getElementById("modal_nombre").value = nombre;
    document.getElementById("modal-citacion").style.display = "flex";
}

function cerrarModal() {
    document.getElementById("modal-citacion").style.display = "none";
}

async function procesarCitacion() {
    const denuncia_id = document.getElementById("modal_id").value;
    const nombre = document.getElementById("modal_nombre").value;
    const nivel = document.getElementById("modal_nivel").value;
    const fecha = document.getElementById("modal_fecha").value;
    const fiscal = document.getElementById("modal_fiscal").value;

    if(!fecha || !fiscal) return alert("Por favor complete todos los datos requeridos.");

    // Guardar en la base de datos backend primero
    try {
        const res = await fetch(`${API}/citaciones`, {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                denuncia_id: parseInt(denuncia_id),
                nivel: nivel,
                fecha: fecha,
                fiscal: fiscal
            })
        });
        if(!res.ok) throw new Error("Backend devolvió error");
    } catch(e) {
        alert("NOTA: Tu Backend en Render no está actualizado o está fallando. Se generará el PDF de forma local para no interrumpir el proceso.");
    }

    // Generar PDF Profesional de la Citación
    const doc = new jsPDF();
    const img = new Image(); img.src = 'citacion.png';
    img.onload = () => {
        doc.addImage(img, 'PNG', 15, 10, 25, 30);
        doc.setFont("times", "bold");
        doc.setFontSize(16);
        doc.text("MINISTERIO PÚBLICO DEL ESTADO", 105, 20, {align:'center'});
        doc.setFontSize(12);
        doc.text("FISCALÍA DEPARTAMENTAL", 105, 28, {align:'center'});
        
        doc.line(15, 42, 195, 42); // Línea
        
        doc.setFontSize(16);
        doc.text(`ORDEN DE ${nivel.toUpperCase()}`, 105, 55, {align:'center'});
        doc.text(`NÚMERO DE CASO: MP-${denuncia_id} / 2026`, 105, 63, {align:'center'});

        doc.setFont("times", "normal");
        doc.setFontSize(12);
        
        let citaText = `Dentro del proceso de seguimiento e investigación penal a cargo de este Despacho Fiscal, en estricto cumplimiento y ejercicio de las atribuciones conferidas por la Constitución Política del Estado, y la Ley Orgánica del Ministerio Público (Ley N° 260), la autoridad que suscribe:`;
        doc.text(citaText, 20, 80, {maxWidth:170, align:'justify', lineHeightFactor: 1.5});

        doc.setFont("times", "bold");
        doc.text(`I. AUTORIDAD REQUIRENTE (FISCALÍA):`, 20, 100);
        doc.setFont("times", "normal");
        doc.text(`FISCAL A CARGO: Abg. ${fiscal.toUpperCase()}`, 20, 110);
        
        doc.setFont("times", "bold");
        doc.text(`II. MANDATO DE LEY:`, 20, 125);
        doc.setFont("times", "normal");
        let mandato = `POR CUANTO: MANDA Y ORDENA a cualquier Autoridad Policial hábil, asignada al caso, Escuadrón Táctico Especial o Funcionario del Estado para que, con las formalidades de ley, se requiera y efectivice la COMPARECENCIA INMEDIATA Y OBLIGATORIA del (la) ciudadano (a):`;
        doc.text(mandato, 20, 135, {maxWidth:170, align:'justify', lineHeightFactor: 1.5});

        doc.setFont("times", "bold");
        doc.text(`NOMBRE DEL CITADO: ${nombre.toUpperCase()}`, 20, 158);
        
        doc.setFont("times", "normal");
        doc.text(`FECHA EXACTA DE PRESENTACIÓN: ${new Date(fecha).toLocaleString('es-BO')}`, 20, 168);
        doc.text(`LUGAR DE DECLARACIÓN: Instalaciones principales de la Fiscalía y Área Especial PD-8.`, 20, 178);

        doc.setFont("times", "bold");
        doc.text(`III. CONMINATORIAS Y APERCIBIMIENTOS DE LEY:`, 20, 195);
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        let advertencia = `ADVERTENCIA JURÍDICA SEVERA: El presente citatorio obedece a un mandato legal emitido por autoridad competente en materia penal. En el hipotético caso de incomparecencia injustificada en la fecha, hora y lugar señalados precedentemente, y al tratarse de un requerimiento legal formal, de conformidad con lo estatuido expresa y terminantemente por el Art. 224 y concordantes del Código de Procedimiento Penal Boliviano (Ley 1970), se expedirá de forma directa e incontestable MANDAMIENTO DE APREHENSIÓN en contra del sujeto renuente, a objeto de asegurar su presencia física ante esta misma autoridad, el Juez y el sistema de justicia.`;
        doc.text(advertencia, 20, 205, {maxWidth: 170, align:'justify', lineHeightFactor: 1.4});
        
        doc.line(70, 260, 140, 260);
        doc.setFontSize(10);
        doc.setFont("times", "bold");
        doc.text("F I R M A   Y   S E L L O   F I S C A L", 105, 265, {align:'center'});
        doc.setFont("times", "normal");
        doc.text("FISCALÍA DE MATERIA PENAL", 105, 270, {align:'center'});
        
        const qr = `https://quickchart.io/qr?text=CITA-FISCALIA-${nombre.replace(' ','_')}&size=100`;
        const qrImg = new Image(); 
        qrImg.crossOrigin = "Anonymous";
        qrImg.src = qr;
        qrImg.onload = () => { 
            try { doc.addImage(qrImg, 'PNG', 160, 240, 30, 30); } catch(e){} 
            doc.save(`CITACION_${nivel}_${nombre}.pdf`); 
            cerrarModal(); 
            cargarFiscalia(); // Actualizar colores y botones
        };
        qrImg.onerror = () => {
            doc.save(`CITACION_${nivel}_${nombre}.pdf`); 
            cerrarModal(); 
            cargarFiscalia();
        };
    };
    img.onerror = () => {
        doc.save(`CITACION_${nivel}_${nombre}.pdf`); 
        cerrarModal();
        cargarFiscalia();
    };
}

function generarPDFExpediente(nombre, ci, num) {
    const doc = new jsPDF('p', 'mm', 'letter');
    
    // Borde perimetral para hacerlo nivel PRO
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 196, 260);
    // Borde interno decorativo
    doc.setLineWidth(0.1);
    doc.rect(11, 11, 194, 258);

    const img = new Image(); img.src = 'citacion.png';
    img.onload = () => {
        doc.addImage(img, 'PNG', 15, 15, 25, 30);
        doc.setFontSize(22); doc.setFont("helvetica", "bold");
        doc.text("MINISTERIO PÚBLICO - ESTADO PLURINACIONAL", 105, 25, {align: 'center'});
        doc.setFontSize(16); doc.text("DIRECCIÓN DE REGISTRO JUDICIAL (SINCOJ)", 105, 35, {align: 'center'});
        doc.setFontSize(18); doc.setTextColor(30, 64, 175);
        
        // Caja de fondo para el título
        doc.setFillColor(240, 240, 240);
        doc.rect(15, 42, 186, 12, 'F');
        doc.text("CERTIFICADO OFICIAL DE EXPEDIENTE PENAL", 105, 50, {align: 'center'});
        
        doc.setTextColor(0, 0, 0); 
        doc.line(15, 58, 195, 58);
        
        doc.setFontSize(12); doc.setFont("helvetica", "normal");
        const f = new Date().toLocaleDateString('es-BO', { weekday: 'long', year:'numeric', month:'long', day:'numeric' });
        doc.text(`En estricto cumplimiento a las prerrogativas de transparencia e información dictadas por \nla Ley del Ministerio Público (Ley N° 260) y el Código de Procedimiento Penal Boliviano, \na la fecha ${f}, se expide el presente memorial de antecedentes.`, 15, 70);
        
        // Caja de Datos
        doc.setFillColor(250, 250, 250);
        doc.rect(15, 90, 186, 40, 'FD'); // Fill and Border
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); 
        doc.text(`I. DATOS DE IDENTIFICACIÓN DEL INVESTIGADO:`, 20, 100); 
        doc.setFontSize(12); doc.setFont("helvetica", "normal"); 
        doc.text(`NÚMERO DE CÉDULA DE IDENTIDAD: `, 20, 110);
        doc.setFont("helvetica", "bold"); doc.text(`${ci}`, 95, 110);
        doc.setFont("helvetica", "normal"); doc.text(`NOMBRE COMPLETO DECLARADO:`, 20, 120);
        doc.setFont("helvetica", "bold"); doc.text(`${nombre.toUpperCase()}`, 95, 120);
        
        // Caja de Situación
        doc.setFillColor(255, 250, 240);
        doc.rect(15, 140, 186, 35, 'FD');
        doc.setFontSize(14); doc.setFont("helvetica", "bold"); 
        doc.text(`II. SITUACIÓN LEGAL PROCEDIMENTAL:`, 20, 150); 
        doc.setFontSize(12); doc.setFont("helvetica", "normal"); 
        doc.text(`El individuo referido se encuentra en seguimiento oficial y cuenta con un total de:`, 20, 160);
        doc.setFont("helvetica", "bold"); doc.setTextColor(220, 38, 38);
        doc.text(`${num} CITACIONES PREVENTIVAS FORMALES EN SU CONTRA.`, 20, 170);
        doc.setTextColor(0, 0, 0);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        let advertenciaLegal = "NOTA DE VALIDEZ LEGAL: Este certificado consolida la información fidedigna que cursa en los registros del Sistema Nacional de Control Judicial (SINCOJ). La evasión reiterada de comparecencia habilitará mecanismos de coerción estatal.";
        doc.text(advertenciaLegal, 15, 195, {maxWidth: 186, align: 'justify'});
        
        doc.line(60, 235, 150, 235);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("SELLO Y VALIDACIÓN DEL SISTEMA", 105, 240, {align:'center'});

        const qr = "https://quickchart.io/qr?text=EXPEDIENTE-" + ci + "&size=100";
        const qrImg = new Image(); qrImg.crossOrigin = "Anonymous"; qrImg.src = qr;
        qrImg.onload = () => { try { doc.addImage(qrImg, 'PNG', 160, 235, 30, 30); } catch(e){} doc.save("EXPEDIENTE_COMPLETO_" + ci + ".pdf"); };
        qrImg.onerror = () => { doc.save("EXPEDIENTE_COMPLETO_" + ci + ".pdf"); };
    };
    img.onerror = () => { doc.save("EXPEDIENTE_COMPLETO_" + ci + ".pdf"); };
}

function generarReporteGralExtra(nombre, ci, numCitaciones) {
    generarPDFExpediente(nombre, ci, numCitaciones);
}

function descargarHistorialPDF(nombre, ci, numCitaciones) {
    generarPDFExpediente(nombre, ci, numCitaciones);
}

