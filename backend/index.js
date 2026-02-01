const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- In-Memory Database ---
// Generate 36 candidates
// --- In-Memory Database ---
const candidatesData = require('./xls/Candidatos.json');

const candidates = candidatesData.map((c, i) => ({
  id: c.ID, // o `c${i + 1}` si prefieres tu propio ID
  name: c.NOMBRE || `Candidato ${i + 1}`,
  partido: c.PARTIDO || `Partido ${i + 1}`,
  photo: `/img/Candidatos/${c.ID}.jpg` // mejor usar el ID para que coincida con el nombre del archivo
}));

module.exports = candidates;

// const candidatesData = require('./xls/Candidatos.json');

// const candidates = candidatesData.map((c, i) => ({
//   id: `c${i + 1}`,
//   name: c.NOMBRE || `Candidato ${i + 1}`, // Ajusta 'NOMBRE' según la cabecera de tu Excel
//   photo: `/img/Candidatos/${i + 1}.jpg`
// }));
// const candidates = Array.from({ length: 36 }, (_, i) => ({
//   id: `c${i + 1}`,
//   name: `Candidato ${i + 1}`,
//   photo: `/img/Candidatos/
// ${i + 1}.jpg`
//   // In a real app, you might have party, photo, etc.
// }));

// Initialize vote counts for each candidate
const voteCounts = candidates.reduce((acc, candidate) => {
  acc[candidate.id] = 0;
  return acc;
}, {});

// Set to store DNIs that have already voted
const votedDNIs = new Set();
// --- End of In-Memory Database ---


// Middleware
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // To parse JSON bodies
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve static files from frontend

// --- API Endpoints ---

// 1. Get the list of all candidates
app.get('/api/candidates', (req, res) => {
  res.json(candidates);
});

// 2. Check if a DNI is eligible to vote
app.post('/api/check-dni', (req, res) => {
  const { dni } = req.body;
  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: 'Formato de DNI inválido. Debe contener 8 dígitos.' });
  }
  if (votedDNIs.has(dni)) {
    return res.status(409).json({ message: 'Este DNI ya ha emitido un voto.' });
  }
  // For this simulation, any valid DNI format that hasn't voted is considered valid.
  res.status(200).json({ message: 'DNI habilitado para votar.' });
});

// 3. Submit a vote
app.post('/api/vote', (req, res) => {
  const { dni, candidateId } = req.body;

  // Basic validation
  if (!dni || !/^\d{8}$/.test(dni)) {
    return res.status(400).json({ error: 'DNI inválido.' });
  }
  if (!candidateId || voteCounts[candidateId] === undefined) {
    return res.status(400).json({ error: 'ID de candidato inválido.' });
  }

  // Check if DNI has already voted
  if (votedDNIs.has(dni)) {
    return res.status(409).json({ message: 'Este DNI ya ha emitido un voto.' });
  }

  // Record the vote
  votedDNIs.add(dni);
  voteCounts[candidateId]++;

  console.log(`Voto registrado para DNI: ${dni}, Candidato: ${candidateId}`);
  res.status(201).json({ message: 'Voto registrado exitosamente.' });
});

// 4. Get current election results
app.get('/api/results', (req, res) => {
  // We can combine candidate info with vote counts for a more useful response
  const results = candidates.map(c => ({
    ...c,
    votes: voteCounts[c.id]
  })).sort((a, b) => b.votes - a.votes); // Sort by most votes

  res.json(results);
});

// --- Server Start ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor de simulación de voto corriendo en http://localhost:${PORT}`);
});


//asegurar que escuche a todos
//app.listen(3000, '0.0.0.0', () => { console.log('Servidor corriendo en puerto 3000'); });