const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();

app.use(express.json());

// Crear cliente axios con soporte para cookies
const axiosInstance = axios.create({
  timeout: 30000,
  withCredentials: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Mobile Safari/537.36 Edg/144.0.0.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  }
});

// Almacenar cookies de sesión
let cookies = {};

app.get('/api/consulta/:dni', async (req, res) => {
  const dni = req.params.dni;

  // Validar DNI
  if (!dni || !/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: 'DNI inválido. Debe contener 8 dígitos' });
  }

  try {
    console.log(`\n📍 Consultando DNI: ${dni}`);
    
    console.log('1️⃣ Obteniendo página inicial y token XSRF...');
    // Obtener página inicial para obtener token XSRF y cookies
    let response = await axiosInstance.get('https://eldni.com/pe/buscar-datos-por-dni');
    
    // Guardar cookies
    const setCookieHeaders = response.headers['set-cookie'];
    if (setCookieHeaders) {
      console.log('✓ Cookies obtenidas');
      axiosInstance.defaults.headers.Cookie = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    }

    // Extraer token XSRF
    const $ = cheerio.load(response.data);
    let xsrfToken = $('meta[name="csrf-token"]').attr('content');
    
    if (!xsrfToken) {
      // Buscar en input hidden
      xsrfToken = $('input[name="csrf_token"], input[name="_token"]').val();
    }

    console.log(`✓ Token XSRF: ${xsrfToken ? 'Encontrado' : 'No encontrado'}`);

    console.log('2️⃣ Enviando datos de búsqueda por POST...');
    // Preparar datos para POST
    const formData = new URLSearchParams();
    formData.append('dni', dni);
    if (xsrfToken) {
      formData.append('_token', xsrfToken);
    }

    // Enviar POST con los datos
    response = await axiosInstance.post(
      'https://eldni.com/pe/buscar-datos-por-dni',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://eldni.com',
          'Referer': 'https://eldni.com/pe/buscar-datos-por-dni'
        }
      }
    );

    console.log('✓ Respuesta recibida');

    console.log('3️⃣ Extrayendo datos de la respuesta...');
    const cheerioInstance = cheerio.load(response.data);

    // Extraer información del HTML
    const datosExtraidos = extraerDatos(cheerioInstance, dni);

    if (datosExtraidos && Object.keys(datosExtraidos).length > 0) {
      console.log(`✓ Datos encontrados para DNI ${dni}`);
      console.log('Datos:', datosExtraidos);
      res.json({ 
        valido: true, 
        dni, 
        ...datosExtraidos 
      });
    } else {
      console.log(`✗ DNI ${dni} no encontrado o sin datos`);
      res.status(404).json({ 
        valido: false, 
        error: 'DNI no encontrado en la base de datos',
        dni: dni
      });
    }

  } catch (error) {
    console.error(`✗ Error consultando DNI:`, error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
    }
    res.status(500).json({ 
      error: 'Error consultando eldni.com',
      detalles: error.message,
      mensaje: 'El sitio puede estar bloqueado o temporalmente no disponible desde esta red'
    });
  }
});

// Función para extraer datos del HTML
function extraerDatos($, dni) {
  const datos = {};

  console.log('   Buscando datos en tablas...');
  // Estrategia 1: Buscar en tablas (estructura más común)
  const filas = $('table tr, .registro-row, [class*="row"], .data-row, .resultado');
  
  if (filas.length > 0) {
    console.log(`   ℹ️ Encontradas ${filas.length} filas`);
    filas.each((i, row) => {
      const celdas = $(row).find('td, th, .col, [class*="cell"]');
      if (celdas.length >= 2) {
        const etiqueta = $(celdas[0]).text().trim().toLowerCase();
        const valor = $(celdas[1]).text().trim();
        
        if (etiqueta && valor) {
          mapearCampo(datos, etiqueta, valor);
        }
      } else if (celdas.length === 1) {
        // Caso donde hay una sola celda con formato "Etiqueta: Valor"
        const texto = $(celdas[0]).text().trim();
        if (texto.includes(':')) {
          const [etiqueta, valor] = texto.split(':').map(s => s.trim());
          if (etiqueta && valor) {
            mapearCampo(datos, etiqueta.toLowerCase(), valor);
          }
        }
      }
    });
  }

  console.log('   Buscando datos en labels...');
  // Estrategia 2: Buscar por labels e inputs (formularios)
  $('label, .field-label, [class*="label"], dt').each((i, el) => {
    const etiqueta = $(el).text().trim().toLowerCase();
    const siguienteElemento = $(el).next();
    let valor = siguienteElemento.text().trim() || 
                siguienteElemento.val() ||
                $(el).parent().find('span, div, dd').text().trim();
    
    if (valor && valor.length > 0 && valor.length < 300) {
      mapearCampo(datos, etiqueta, valor);
    }
  });

  console.log('   Buscando datos en atributos data-*...');
  // Estrategia 3: Buscar por data-attributes
  $('[data-field], [data-value], [data-content], [data-label]').each((i, el) => {
    const campo = $(el).attr('data-field') || 
                  $(el).attr('data-label') || 
                  $(el).attr('class') || '';
    const valor = $(el).attr('data-value') || 
                  $(el).text().trim() || 
                  $(el).val();
    
    if (valor && campo && valor.length > 0 && valor.length < 300) {
      mapearCampo(datos, campo.toLowerCase(), valor);
    }
  });

  console.log('   Buscando datos en divs/spans con formato "etiqueta: valor"...');
  // Estrategia 4: Buscar contenido de divs y spans con patrón "etiqueta: valor"
  $('div.resultado, .resultado-item, .info-row, div[class*="info"], div[class*="result"]').each((i, el) => {
    const texto = $(el).text().trim();
    
    if (texto.includes(':') && texto.length < 300) {
      const [etiqueta, ...valorParts] = texto.split(':');
      const valor = valorParts.join(':').trim();
      
      if (etiqueta && valor && valor.length > 0) {
        mapearCampo(datos, etiqueta.trim().toLowerCase(), valor);
      }
    }
  });

  console.log('   Buscando datos en atributos aria-label...');
  // Estrategia 5: Buscar por aria-label
  $('[aria-label]').each((i, el) => {
    const label = $(el).attr('aria-label').toLowerCase();
    const valor = $(el).text().trim() || $(el).val();
    
    if (valor && valor.length > 0 && valor.length < 300) {
      mapearCampo(datos, label, valor);
    }
  });

  console.log('   Buscando en toda la página...');
  // Estrategia 6: Búsqueda general en toda la página
  const textoCompleto = $.text();
  const patrones = [
    /(?:Nombres?|Full Name)[\s:]*([^\n:,]+)/i,
    /(?:Apellido\s+Paterno)[\s:]*([^\n:,]+)/i,
    /(?:Apellido\s+Materno)[\s:]*([^\n:,]+)/i,
    /(?:Departamento|State)[\s:]*([^\n:,]+)/i,
    /(?:Provincia|Province)[\s:]*([^\n:,]+)/i,
    /(?:Distrito|District)[\s:]*([^\n:,]+)/i,
    /(?:Dirección|Address)[\s:]*([^\n:,]+)/i,
    /(?:Ocupación|Occupation)[\s:]*([^\n:,]+)/i,
    /(?:Edad|Age)[\s:]*(\d+)/i,
    /(?:Sexo|Género|Sex)[\s:]*([MFOtro]+)/i
  ];

  return datos;
}

// Función auxiliar para mapear campos comunes
function mapearCampo(datos, etiqueta, valor) {
  if (!valor || valor.length === 0 || valor.length > 300) return;
  
  // Limpiar valor
  valor = valor.replace(/\s+/g, ' ').trim();
  
  const etiquetaNorm = etiqueta.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Mapear campos
  if (etiquetaNorm.includes('nombre') && !etiquetaNorm.includes('apellido')) {
    if (!datos.nombre) datos.nombre = valor;
  } else if (etiquetaNorm.includes('apellido') && etiquetaNorm.includes('paterno')) {
    if (!datos.apellidoPaterno) datos.apellidoPaterno = valor;
  } else if (etiquetaNorm.includes('apellido') && etiquetaNorm.includes('materno')) {
    if (!datos.apellidoMaterno) datos.apellidoMaterno = valor;
  } else if (etiquetaNorm.includes('estado')) {
    if (!datos.estado) datos.estado = valor;
  } else if (etiquetaNorm.includes('departamento')) {
    if (!datos.departamento) datos.departamento = valor;
  } else if (etiquetaNorm.includes('provincia')) {
    if (!datos.provincia) datos.provincia = valor;
  } else if (etiquetaNorm.includes('distrito')) {
    if (!datos.distrito) datos.distrito = valor;
  } else if (etiquetaNorm.includes('dirección') || etiquetaNorm.includes('direccion') || etiquetaNorm.includes('address')) {
    if (!datos.direccion) datos.direccion = valor;
  } else if (etiquetaNorm.includes('ocupación') || etiquetaNorm.includes('ocupacion') || etiquetaNorm.includes('occupation')) {
    if (!datos.ocupacion) datos.ocupacion = valor;
  } else if (etiquetaNorm.includes('fecha') && etiquetaNorm.includes('nacimiento')) {
    if (!datos.fechaNacimiento) datos.fechaNacimiento = valor;
  } else if (etiquetaNorm.includes('edad') || etiquetaNorm.includes('age')) {
    if (!datos.edad) datos.edad = valor;
  } else if (etiquetaNorm.includes('sexo') || etiquetaNorm.includes('género') || etiquetaNorm.includes('sex')) {
    if (!datos.sexo) datos.sexo = valor;
  }
}

const PORT = 3000;

// Arrancar servidor directamente
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log('📍 Endpoint: GET /api/consulta/:dni');
});
