const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

async function analizarPagina() {
  let browser;
  
  try {
    console.log('🔍 Iniciando análisis de https://eldni.com/pe/buscar-datos-por-dni\n');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(30000);
    page.setDefaultTimeout(30000);

    // Interceptar requests para ver qué endpoints se llaman
    const requests = [];
    page.on('request', (request) => {
      if (!request.url().includes('google') && !request.url().includes('ads')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          type: request.resourceType()
        });
      }
    });

    console.log('📱 Navegando a la página...');
    await page.goto('https://eldni.com/pe/buscar-datos-por-dni', {
      waitUntil: 'networkidle2'
    });

    console.log('\n📋 Estructura de la página:\n');

    // Analizar estructura
    const estructura = await page.evaluate(() => {
      const analisis = {
        titulo: document.title,
        formularios: [],
        inputs: [],
        botones: [],
        tablas: [],
        estructuraDOM: ''
      };

      // Formularios
      document.querySelectorAll('form').forEach((form, i) => {
        analisis.formularios.push({
          id: form.id || `form-${i}`,
          action: form.action,
          method: form.method,
          campos: Array.from(form.querySelectorAll('input, select, textarea')).map(f => ({
            name: f.name,
            type: f.type,
            placeholder: f.placeholder,
            id: f.id,
            class: f.className
          }))
        });
      });

      // Inputs
      document.querySelectorAll('input[type="text"], input[type="search"], input[type="number"]').forEach((input, i) => {
        analisis.inputs.push({
          name: input.name,
          id: input.id,
          placeholder: input.placeholder,
          class: input.className,
          type: input.type
        });
      });

      // Botones
      document.querySelectorAll('button, input[type="submit"], a[class*="btn"]').forEach((btn, i) => {
        analisis.botones.push({
          text: btn.textContent.trim().substring(0, 50),
          type: btn.type,
          class: btn.className,
          id: btn.id,
          onclick: btn.onclick ? 'Sí' : 'No',
          href: btn.href || 'N/A'
        });
      });

      // Tablas
      document.querySelectorAll('table').forEach((table, i) => {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
        analisis.tablas.push({
          id: table.id || `table-${i}`,
          class: table.className,
          headers: headers,
          rows: table.querySelectorAll('tr').length
        });
      });

      return analisis;
    });

    console.log('Título:', estructura.titulo);
    console.log('\n📝 FORMULARIOS ENCONTRADOS:');
    estructura.formularios.forEach((form, i) => {
      console.log(`\n  Formulario ${i + 1}:`);
      console.log(`    - ID: ${form.id}`);
      console.log(`    - Action: ${form.action}`);
      console.log(`    - Method: ${form.method}`);
      console.log(`    - Campos:`);
      form.campos.forEach(campo => {
        console.log(`      • ${campo.name || campo.id} (${campo.type}): "${campo.placeholder}"`);
      });
    });

    console.log('\n🔘 INPUTS ENCONTRADOS:');
    estructura.inputs.forEach(input => {
      console.log(`  • ${input.name || input.id} (${input.type}): "${input.placeholder}"`);
    });

    console.log('\n🔘 BOTONES ENCONTRADOS:');
    estructura.botones.forEach(btn => {
      console.log(`  • ${btn.text} | Clase: ${btn.class}`);
    });

    console.log('\n📊 TABLAS ENCONTRADAS:', estructura.tablas.length);
    estructura.tablas.forEach(table => {
      console.log(`  • Tabla: ${table.id}`);
      console.log(`    - Headers: ${table.headers.join(', ')}`);
      console.log(`    - Filas: ${table.rows}`);
    });

    // Buscar event listeners
    console.log('\n🔗 SCRIPTS Y EVENT LISTENERS:');
    const scripts = await page.evaluate(() => {
      const scriptSrcs = Array.from(document.scripts).map(s => s.src).filter(s => s && !s.includes('google'));
      return {
        scripts: scriptSrcs,
        totalScripts: document.scripts.length
      };
    });

    console.log(`  Total scripts: ${scripts.totalScripts}`);
    console.log(`  Scripts no-Google detectados:`);
    scripts.scripts.slice(0, 10).forEach(src => {
      console.log(`    • ${src}`);
    });

    // Obtener HTML
    const htmlContent = await page.content();
    fs.writeFileSync('/tmp/pagina_analisis.html', htmlContent);
    console.log('\n💾 HTML guardado en /tmp/pagina_analisis.html');

    // Analizar con Cheerio
    const $ = cheerio.load(htmlContent);
    console.log('\n🔍 ANÁLISIS CON CHEERIO:');
    
    // Buscar campos de entrada
    const camposEntrada = $('input[type="text"], input[name*="dni"], input[name*="DNI"], input[placeholder*="DNI"]');
    console.log(`  • Campos de entrada encontrados: ${camposEntrada.length}`);
    camposEntrada.each((i, el) => {
      console.log(`    - ${$(el).attr('name')} (id: ${$(el).attr('id')})`);
    });

    // Buscar dónde se muestran resultados
    const resultDivs = $('[class*="result"], [class*="resulta"], [id*="result"], .tabla-resultado, .resultado, #resultado');
    console.log(`  • Contenedores de resultados encontrados: ${resultDivs.length}`);

    // Buscar tablas de datos
    const tablas = $('table');
    console.log(`  • Tablas HTML encontradas: ${tablas.length}`);
    tablas.each((i, table) => {
      const headers = $(table).find('thead th, tr:first th, tr:first td').map((i, el) => $(el).text().trim()).get();
      console.log(`    - Tabla ${i + 1}: ${headers.join(' | ')}`);
    });

    // Llamadas AJAX/Fetch
    console.log('\n📡 POTENCIALES ENDPOINTS DE API:');
    const pageSource = await page.content();
    
    // Buscar fetch o XMLHttpRequest
    const fetchMatches = pageSource.match(/fetch\s*\(\s*['"`]([^'"`]+)/g) || [];
    const ajaxMatches = pageSource.match(/url:\s*['"`]([^'"`]+)/g) || [];
    
    if (fetchMatches.length > 0) {
      console.log('  Fetch calls encontradas:');
      fetchMatches.slice(0, 5).forEach(match => console.log(`    • ${match}`));
    }
    
    if (ajaxMatches.length > 0) {
      console.log('  AJAX URLs encontradas:');
      ajaxMatches.slice(0, 5).forEach(match => console.log(`    • ${match}`));
    }

    console.log('\n✅ Análisis completado');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

analizarPagina();
