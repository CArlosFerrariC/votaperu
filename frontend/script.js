document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let userDNI = '';

    // --- DOM ELEMENTS ---
    const dniModal = document.getElementById('dni-modal');
    const appContainer = document.getElementById('app-container');
    const dniInput = document.getElementById('dni-input');
    const dniSubmitBtn = document.getElementById('dni-submit');
    const dniMessage = document.getElementById('dni-message');
    const userDniSpan = document.getElementById('user-dni');
    const candidatesGrid = document.getElementById('candidates-grid');
    const voteMessage = document.getElementById('vote-message');
    const viewResultsBtn = document.getElementById('view-results-btn');
    const resultsModal = document.getElementById('results-modal');
    const resultsContainer = document.getElementById('results-container');
    const closeResultsBtn = document.getElementById('close-results-btn');

    // --- API Configuration ---
    const API_BASE_URL = 'http://localhost:3000/api';

    // --- EVENT LISTENERS ---
    dniSubmitBtn.addEventListener('click', handleDniSubmit);
    dniInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleDniSubmit();
    });
    viewResultsBtn.addEventListener('click', fetchAndShowResults);
    closeResultsBtn.addEventListener('click', () => resultsModal.classList.remove('active'));

    // --- FUNCTIONS ---

    /**
     * Handles the DNI submission and validation.
     */
    async function handleDniSubmit() {
        const dni = dniInput.value.trim();
        dniMessage.textContent = '';

        if (!/^\d{8}$/.test(dni)) {
            dniMessage.textContent = 'Formato de DNI inválido. Debe contener 8 dígitos.';
            dniMessage.style.color = 'red';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/check-dni`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni }),
            });

            const data = await response.json();

            if (response.ok) {
                userDNI = dni;
                initVotingApp();
            } else {
                dniMessage.textContent = data.message || 'Este DNI no está habilitado para votar.';
                dniMessage.style.color = 'orange';
            }
        } catch (error) {
            console.error('Error al verificar DNI:', error);
            dniMessage.textContent = 'No se pudo conectar con el servidor. Inténtalo de nuevo.';
            dniMessage.style.color = 'red';
        }
    }

    /**
     * Initializes the main voting application after successful DNI validation.
     */
    function initVotingApp() {
        dniModal.classList.remove('active');
        appContainer.style.display = 'block';
        userDniSpan.textContent = userDNI;
        fetchAndRenderCandidates();
    }

    /**
     * Fetches candidates from the backend and renders them in the grid.
     */
    async function fetchAndRenderCandidates() {
        try {
            const response = await fetch(`${API_BASE_URL}/candidates`);
            const candidates = await response.json();

            candidatesGrid.innerHTML = ''; // Clear existing grid
            candidates.forEach(candidate => {
                const card = document.createElement('div');
                card.className = 'candidate-card';
                card.dataset.id = candidate.id;

                card.innerHTML = `
                    <img src="${candidate.photo}" alt="Foto de ${candidate.name}">
                    <div class="candidate-name">${candidate.name}</div>
                    <div class="candidate-partido">${candidate.partido}</div>
                    <button class="vote-btn">Votar</button>
                `;
                
                card.querySelector('.vote-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent card click event if button is clicked
                    handleVote(candidate.id, card);
                });

                candidatesGrid.appendChild(card);
            });
        } catch (error) {
            console.error('Error al cargar candidatos:', error);
            candidatesGrid.innerHTML = '<p>Error al cargar los candidatos. Por favor, recarga la página.</p>';
        }
    }

    /**
     * Handles the vote submission process.
     * @param {string} candidateId - The ID of the candidate being voted for.
     * @param {HTMLElement} selectedCard - The card element of the selected candidate.
     */
    async function handleVote(candidateId, selectedCard) {
        // Disable all buttons to prevent multiple votes
        document.querySelectorAll('.vote-btn').forEach(btn => btn.disabled = true);

        try {
            const response = await fetch(`${API_BASE_URL}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni: userDNI, candidateId }),
            });

            const data = await response.json();

            if (response.ok) {
                voteMessage.textContent = '¡Gracias por tu voto! Voto registrado exitosamente.';
                voteMessage.style.color = 'green';
                
                // Highlight the voted card and disable the grid
                selectedCard.classList.add('voted');
                candidatesGrid.style.pointerEvents = 'none'; // Disable further interaction

            } else {
                 voteMessage.textContent = data.message || 'Ocurrió un error al registrar tu voto.';
                 voteMessage.style.color = 'red';
                 // Re-enable buttons if vote failed
                 document.querySelectorAll('.vote-btn').forEach(btn => btn.disabled = false);
            }
        } catch (error) {
            console.error('Error al emitir el voto:', error);
            voteMessage.textContent = 'No se pudo conectar con el servidor para emitir el voto.';
            voteMessage.style.color = 'red';
            document.querySelectorAll('.vote-btn').forEach(btn => btn.disabled = false);
        }
    }

    /**
     * Fetches and displays the current election results in a modal.
     */
    async function fetchAndShowResults() {
        try {
            const response = await fetch(`${API_BASE_URL}/results`);
            const results = await response.json();

            resultsContainer.innerHTML = ''; // Clear previous results
            results.forEach(item => {
                const resultItem = document.createElement('div');
                resultItem.className = 'result-item';
                resultItem.innerHTML = `
                    <span class="name">${item.name}</span>
                    <span class="votes">${item.votes} votos</span>
                `;
                resultsContainer.appendChild(resultItem);
            });

            resultsModal.classList.add('active');

        } catch (error) {
            console.error('Error al cargar resultados:', error);
            alert('No se pudieron cargar los resultados. Intenta de nuevo más tarde.');
        }
    }
});
