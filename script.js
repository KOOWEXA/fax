const KoowexaFactura = (() => {
  // Elementos DOM
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  
  // Variables de estado
  const steps = ['step1', 'step2', 'step3'];
  let currentStep = 0;
  const alertBox = $('#alert');
  const montoBase = $('#montoBase');
  const aplicarDescuento = $('#aplicarDescuento');
  const montoFinal = $('#montoFinal');
  const mesesExpiracion = $('#mesesExpiracion');
  const numFactura = $('#numFactura');
  const fechaEmision = $('#clienteFecha');
  const fechaVencimiento = $('#clienteVencimiento');
  const clienteGmail = $('#clienteGmail');
  const sugerenciasCorreo = $('#sugerenciasCorreo');
  const themeToggle = $('#themeToggle');
  const STORAGE_KEY = 'koowexa_facturas_v4';
  let facturasEnviadas = [];

  // Funciones de utilidad
  const formatearFecha = (date) => {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  const generarNumFactura = () => {
    const d = String(new Date().getDate()).padStart(2, '0');
    const m = String(new Date().getMonth() + 1).padStart(2, '0');
    const a = new Date().getFullYear().toString().slice(-2);
    const r = Math.floor(Math.random() * 900 + 100);
    return `KWX-${a}${m}${d}-${r}`;
  };

  const calcularVencimiento = (meses) => {
    const hoy = new Date();
    hoy.setMonth(hoy.getMonth() + meses);
    return hoy;
  };

  const validarEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
  };

  const sugerirDominio = (email) => {
    const dominios = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];
    const base = email.split('@')[0];
    if (email.includes('@')) return [];
    return dominios.map(d => `${base}@${d}`);
  };

  // Funciones de UI
  const mostrarAlerta = (mensaje, tipo = 'error') => {
    const iconMap = {
      'error': 'exclamation-circle',
      'success': 'check-circle',
      'warning': 'exclamation-triangle'
    };
    
    alertBox.innerHTML = `<i class="fas fa-${iconMap[tipo]}"></i> ${mensaje}`;
    alertBox.className = `alert ${tipo}`;
    alertBox.classList.add('show');
    setTimeout(() => alertBox.classList.remove('show'), 5000);
  };

  const actualizarMontoFinal = () => {
    const base = parseFloat(montoBase.value) || 0;
    const descuento = aplicarDescuento.value === 'si' ? 0.1 : 0;
    const final = base * (1 - descuento);
    montoFinal.value = new Intl.NumberFormat('es-CU', {
      style: 'currency',
      currency: 'CUP'
    }).format(final);
  };

  const actualizarFechas = () => {
    const meses = parseInt(mesesExpiracion.value) || 3;
    const hoy = new Date();
    const venc = calcularVencimiento(meses);
    fechaEmision.value = formatearFecha(hoy);
    fechaVencimiento.value = formatearFecha(venc);
  };

  const siguiente = () => {
    if (currentStep === 1 && !validarCliente()) return;
    currentStep++;
    actualizarVistas();
  };

  const anterior = () => {
    currentStep--;
    actualizarVistas();
  };

  const actualizarVistas = () => {
    steps.forEach((id, i) => {
      const el = $(`#${id}`);
      const label = $(`#${id}Label`);
      el.classList.toggle('active', i === currentStep);
      label.classList.toggle('active', i === currentStep);
      label.classList.toggle('done', i < currentStep);
    });
    if (currentStep === 2) resumenFactura();
  };

  const validarCliente = () => {
    const email = $('#clienteGmail').value.trim();
    $('#clienteGmail').classList.remove('error-field', 'valid-field');
    if (!email || !validarEmail(email)) {
      $('#clienteGmail').classList.add('error-field');
      mostrarAlerta('⚠️ Por favor, ingresa un correo electrónico válido.', 'error');
      return false;
    } else {
      $('#clienteGmail').classList.add('valid-field');
    }
    return true;
  };

  // Gestión de facturas
  const cargarFacturasEnviadas = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        facturasEnviadas = JSON.parse(saved);
        renderizarFacturas();
      } catch (e) {
        facturasEnviadas = [];
        console.error('Error al cargar facturas:', e);
      }
    }
  };

  const renderizarFacturas = () => {
    const cont = $('#facturasEnviadas');
    if (facturasEnviadas.length === 0) {
      cont.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-file-invoice-dollar"></i>
          <p>No hay facturas enviadas aún.</p>
          <p class="pulse">¡Crea tu primera factura hoy!</p>
        </div>`;
      return;
    }

    const tablaHTML = `
      <table class="resumen-table">
        <thead>
          <tr>
            <th>Factura</th>
            <th>Correo</th>
            <th>Monto</th>
            <th>Vence</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${facturasEnviadas.map((f, i) => `
            <tr>
              <td><strong>${f.numFactura}</strong></td>
              <td>${f.gmail}</td>
              <td><strong style="color:var(--primary);">${f.montoFinal}</strong></td>
              <td>${f.vencimiento}</td>
              <td class="actions">
                <button data-action="notify" data-index="${i}" title="Notificar" class="btn-icon">
                  <i class="fas fa-bell"></i>
                </button>
                <button data-action="delete" data-index="${i}" title="Eliminar" class="btn-icon danger">
                  <i class="fas fa-trash"></i>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

    cont.innerHTML = tablaHTML;
    
    // Agregar event listeners a los botones de acción
    cont.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      const index = parseInt(btn.dataset.index);
      if (action === 'delete') eliminarFactura(index);
      if (action === 'notify') notificarVencimiento(index);
    });
  };

  const guardarFacturaEnviada = (datos) => {
    facturasEnviadas.unshift({ 
      ...datos, 
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    });
    
    // Mantener solo las últimas 50 facturas
    if (facturasEnviadas.length > 50) {
      facturasEnviadas = facturasEnviadas.slice(0, 50);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(facturasEnviadas));
    renderizarFacturas();
  };

  const eliminarFactura = (index) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta factura?')) {
      facturasEnviadas.splice(index, 1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(facturasEnviadas));
      renderizarFacturas();
      mostrarAlerta('🗑️ Factura eliminada correctamente.', 'success');
    }
  };

  const resumenFactura = () => {
    const gmail = $('#clienteGmail').value;
    $('#resumenFactura').innerHTML = `
      <tr><td><strong>Número de Factura</strong></td><td>${numFactura.value}</td></tr>
      <tr><td><strong>Correo del Cliente</strong></td><td>${gmail}</td></tr>
      <tr><td><strong>Monto Base</strong></td><td>${montoBase.value} CUP</td></tr>
      <tr><td><strong>Descuento Aplicado</strong></td><td>${aplicarDescuento.value === 'si' ? '10%' : '0%'}</td></tr>
      <tr><td><strong>Total a Pagar</strong></td><td><strong style="color:var(--primary);">${montoFinal.value}</strong></td></tr>
      <tr><td><strong>Fecha de Emisión</strong></td><td>${fechaEmision.value}</td></tr>
      <tr><td><strong>Fecha de Vencimiento</strong></td><td>${fechaVencimiento.value}</td></tr>
    `;
  };

  const enviarFacturaCompleta = () => {
    if (!validarCliente()) return;
    
    const datos = {
      numFactura: numFactura.value,
      montoBase: montoBase.value,
      montoFinal: montoFinal.value,
      descuento: aplicarDescuento.value === 'si' ? '10%' : '0%',
      gmail: $('#clienteGmail').value.trim(),
      fecha: fechaEmision.value,
      vencimiento: fechaVencimiento.value
    };
    
    const cuerpo = `
Hola,

🧾 **FACTURA ELECTRÓNICA - KOOWEXA**
------------------------------
🔹 Número: ${datos.numFactura}
🔹 Fecha Emisión: ${datos.fecha}
🔹 Vence: ${datos.vencimiento}
🔹 Monto Base: ${datos.montoBase} CUP
🔹 Descuento: ${datos.descuento}
🔹 Total: ${datos.montoFinal}

Gracias por confiar en KOOWEXA.
¡Saludos!

Equipo KOOWEXA
    `.trim();
    
    const subject = encodeURIComponent(`Factura KOOWEXA - ${datos.numFactura}`);
    const body = encodeURIComponent(cuerpo);
    const mailto = `mailto:${encodeURIComponent(datos.gmail)}?subject=${subject}&body=${body}`;
    
    window.open(mailto, '_blank', 'noopener,noreferrer');
    guardarFacturaEnviada(datos);
    mostrarAlerta('✅ Factura enviada y guardada correctamente.', 'success');
    
    setTimeout(() => {
      limpiarFormulario();
      actualizarVistas();
    }, 1500);
  };

  const limpiarFormulario = () => {
    montoBase.value = '2000';
    mesesExpiracion.value = '3';
    aplicarDescuento.value = 'no';
    $('#clienteGmail').value = '';
    $('#clienteGmail').classList.remove('error-field', 'valid-field');
    inicializarFormulario();
  };

  const notificarVencimiento = (index) => {
    const factura = facturasEnviadas[index];
    if (!("Notification" in window)) {
      mostrarAlerta("🔔 Las notificaciones no están soportadas en este navegador.", 'warning');
      return;
    }
    
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        const venc = new Date(factura.vencimiento);
        const ahora = new Date();
        
        if (venc <= ahora) {
          new Notification("Factura Vencida", { 
            body: `La factura ${factura.numFactura} ha vencido.`,
            icon: '/favicon.ico'
          });
        } else {
          const diff = venc - ahora;
          setTimeout(() => {
            new Notification("Próximo Vencimiento", { 
              body: `La factura ${factura.numFactura} vence hoy.`,
              icon: '/favicon.ico'
            });
          }, diff);
        }
        mostrarAlerta('🔔 Notificación programada correctamente.', 'success');
      } else {
        mostrarAlerta('🔔 Permisos de notificación no concedidos.', 'warning');
      }
    });
  };

  // Gestión de temas
  const toggleTema = () => {
    const html = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    const icon = themeToggle.querySelector('i');
    
    html.setAttribute('data-theme', newTheme);
    icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('koowexa_theme', newTheme);
  };

  const cargarTema = () => {
    const saved = localStorage.getItem('koowexa_theme') || 'light';
    const html = document.documentElement;
    const icon = themeToggle.querySelector('i');
    
    html.setAttribute('data-theme', saved);
    icon.className = saved === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  };

  // Inicialización
  const inicializarFormulario = () => {
    numFactura.value = generarNumFactura();
    actualizarMontoFinal();
    actualizarFechas();
  };

  const inicializarEventos = () => {
    // Eventos de formulario
    montoBase.addEventListener('input', actualizarMontoFinal);
    aplicarDescuento.addEventListener('change', actualizarMontoFinal);
    mesesExpiracion.addEventListener('input', actualizarFechas);
    
    // Sugerencias de correo
    clienteGmail.addEventListener('input', (e) => {
      const email = e.target.value;
      const sugerencias = sugerirDominio(email);
      
      if (sugerencias.length > 0) {
        sugerenciasCorreo.innerHTML = sugerencias.map(s => 
          `<div class="suggestion-item">${s}</div>`
        ).join('');
        sugerenciasCorreo.style.display = 'block';
      } else {
        sugerenciasCorreo.style.display = 'none';
      }
    });
    
    // Seleccionar sugerencia
    sugerenciasCorreo.addEventListener('click', (e) => {
      if (e.target.classList.contains('suggestion-item')) {
        clienteGmail.value = e.target.textContent;
        sugerenciasCorreo.style.display = 'none';
        clienteGmail.focus();
      }
    });
    
    // Cerrar sugerencias al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.input-with-suggestions')) {
        sugerenciasCorreo.style.display = 'none';
      }
    });
    
    // Tema
    themeToggle.addEventListener('click', toggleTema);
    
    // Validación en tiempo real
    clienteGmail.addEventListener('blur', () => {
      if (clienteGmail.value.trim()) {
        validarCliente();
      }
    });
  };

  const inicializar = () => {
    inicializarFormulario();
    inicializarEventos();
    cargarTema();
    cargarFacturasEnviadas();
  };

  // API pública
  return {
    siguiente,
    anterior,
    enviarFacturaCompleta,
    inicializar
  };
})();

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  KoowexaFactura.inicializar();
});