let listaCobrasGlobal = [];

async function carregarDados() {
  try {
    const response = await fetch("./data/cobras-ceara.json");
    listaCobrasGlobal = await response.json();
    renderizarCobras(listaCobrasGlobal);
  } catch (error) {
    console.error("Erro ao carregar ficheiros JSON:", error);
  }
}

function renderizarCobras(cobras) {
  const container = document.getElementById("cobras-container");
  if (!container) return;
  container.innerHTML = "";

  cobras.forEach((cobra) => {
    const card = document.createElement("div");
    card.className = "card";

    const ehPeconhenta = cobra.risco && !cobra.risco.includes("nao_peconhenta");
    const classeBadge = ehPeconhenta
      ? "badge-peconhenta"
      : "badge-nao-peconhenta";
    const textoRisco = ehPeconhenta ? "Peçonhenta" : "Não Peçonhenta";

    card.innerHTML = `
      <img src="./images/${cobra.foto}" alt="${cobra.nome}" onerror="this.src='https://via.placeholder.com/300x200?text=Sem+Foto'">
      <div class="card-content">
        <h3>${cobra.nome}</h3>
        <p class="cientifico">${cobra.nomeCientifico}</p>
        <p><strong>Família:</strong> ${cobra.familia}</p>
        <span class="badge ${classeBadge}">${textoRisco}</span>
      </div>
    `;

    container.appendChild(card);
  });
}

carregarDados();
