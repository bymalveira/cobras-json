// Função para carregar os dados do JSON e renderizar no HTML
async function carregarCobras() {
  try {
    // 1. Procura o ficheiro JSON na pasta data/
    const response = await fetch("./data/cobras-ceara.json");
    const cobras = await response.json();

    const container = document.getElementById("cobras-container");

    // 2. Percorre a lista de cobras e cria os cards HTML
    cobras.forEach((cobra) => {
      const card = document.createElement("div");
      card.classList.add("card");

      // Monta o caminho da imagem usando a pasta images/ e a propriedade foto do JSON
      const caminhoImagem = `./images/${cobra.foto}`;

      card.innerHTML = `
        <img src="${caminhoImagem}" alt="${cobra.nome}" onerror="this.src='https://via.placeholder.com/250x180?text=Sem+Imagem'">
        <h3>${cobra.nome}</h3>
        <p><em>${cobra.nomeCientifico}</em></p>
        <p><strong>Família:</strong> ${cobra.familia}</p>
        <p><strong>Risco:</strong> ${cobra.risco}</p>
      `;

      container.appendChild(card);
    });
  } catch (error) {
    console.error("Erro ao carregar o ficheiro JSON:", error);
  }
}

// Executa a função ao carregar a página
carregarCobras();
