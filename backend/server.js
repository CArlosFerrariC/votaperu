const axios = require('axios');
const cheerio = require('cheerio');
const mysql = require('mysql2/promise');

// Configuración de la conexión a MySQL
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'tu_password',
  database: 'mibasedatos'
});

// Función para validar DNI en ONPE (ejemplo didáctico)
async function validarDNI(dni) {
  const url = "https://consultaelectoral.onpe.gob.pe/";
  try {
    const response = await axios.post(url, { dni: dni }, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const $ = cheerio.load(response.data);
    const textoPagina = $("body").text();

    if (textoPagina.includes("DNI no existe") || textoPagina.toLowerCase().includes("no se encontró")) {
      return false; // DNI no existe
    } else {
      return true;  // DNI existe (miembro o no miembro)
    }
  } catch (error) {
    console.error("Error al consultar ONPE:", error.message);
    throw error;
  }
}

// Función principal: validar y registrar en MySQL
async function procesarDNI(dni) {
  const existe = await validarDNI(dni);

  if (!existe) {
    return "DNI no existe en la base de datos electoral";
  }

  // Buscar en la base de datos
  const [rows] = await pool.query("SELECT * FROM encuesta_votos WHERE dni = ?", [dni]);

  if (rows.length > 0) {
    return "El DNI ya votó en la encuesta";
  } else {
    await pool.query("INSERT INTO encuesta_votos (dni, fecha) VALUES (?, NOW())", [dni]);
    return "DNI registrado como nuevo voto en la encuesta";
  }
}

// Ejemplo de uso
(async () => {
  const resultado = await procesarDNI("12345678");
  console.log(resultado);
})();

const PORT = 3000;

// Arrancar servidor directamente
app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log('📍 Endpoint: GET /api/consulta/:dni');
});
