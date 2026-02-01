const xlsx = require('xlsx');
const fs = require('fs');

// Leer archivo Excel
const workbook = xlsx.readFile('./xls/CANDIDATOS.xls');

// Seleccionar la primera hoja
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Convertir a JSON
const data = xlsx.utils.sheet_to_json(sheet);

// Guardar en archivo JSON
fs.writeFileSync('./xls/Candidatos.json', JSON.stringify(data, null, 2));

console.log('Conversión completa. Datos guardados en archivo.json');
