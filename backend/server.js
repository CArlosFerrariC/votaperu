const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio'); // para parsear HTML
const app = express();

app.use(express.json());

app.get('/api/consulta/:dni', async (req, res) => {
  const dni = req.params.dni;
  try {
    const response = await axios.get(`https://eldni.com/pe/buscar-datos-por-dni/${dni}`);
    const $ = cheerio.load(response.data);

    // Ejemplo: extraer nombre y apellidos del HTML
    const nombre = $('td:contains("Nombres")').next().text().trim();
    const apellidoPaterno = $('td:contains("Apellido Paterno")').next().text().trim();
    const apellidoMaterno = $('td:contains("Apellido Materno")').next().text().trim();

    if (nombre) {
      res.json({ valido: true, dni, nombre, apellidoPaterno, apellidoMaterno });
    } else {
      res.json({ valido: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error consultando eldni.com' });
  }
});

app.listen(3000, () => console.log('Servidor corriendo en http://localhost:3000'));
