async function validarDNI(dni) {
  try {
    const response = await fetch(`http://localhost:3000/api/consulta/${dni}`);
    const data = await response.json();
    return data.valido;
  } catch (error) {
    console.error("Error consultando API:", error);
    return false;
  }
}

async function emitirVoto() {
  const dni = document.getElementById("dni").value.trim();
  const opcion = document.getElementById("opcion").value;
  const mensaje = document.getElementById("mensaje");

  const autorizado = await validarDNI(dni);
  if (!autorizado) {
    mensaje.textContent = "❌ DNI no válido.";
    mensaje.style.color = "red";
    return;
  }

  let votos = JSON.parse(localStorage.getItem("votos")) || {};
  if (votos[dni]) {
    mensaje.textContent = "⚠️ Este DNI ya emitió su voto.";
    mensaje.style.color = "orange";
    return;
  }

  votos[dni] = opcion;
  localStorage.setItem("votos", JSON.stringify(votos));

  mensaje.textContent = "✅ Voto registrado correctamente.";
  mensaje.style.color = "green";

  actualizarDashboard();
}

function actualizarDashboard() {
  const resultadosDiv = document.getElementById("resultados");
  resultadosDiv.innerHTML = "";

  let votos = JSON.parse(localStorage.getItem("votos")) || {};
  const conteo = {};
  const total = Object.keys(votos).length;

  Object.values(votos).forEach(opcion => {
    conteo[opcion] = (conteo[opcion] || 0) + 1;
  });

  for (let opcion of ["A", "B", "C"]) {
    const cantidad = conteo[opcion] || 0;
    const porcentaje = total ? ((cantidad / total) * 100).toFixed(2) : 0;

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = porcentaje + "%";
    bar.textContent = `${opcion}: ${porcentaje}% (${cantidad} votos)`;

    resultadosDiv.appendChild(bar);
  }
}

actualizarDashboard();
