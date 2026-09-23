// Variable globais
let listaCobrasGlobal = [];
let listaHospitaisGlobal = [];

// 1. Carregamento inicial dos dados JSON
async function carregarDados() {
  try {
    const [resCobras, resHospitais] = await Promise.all([
      fetch("./data/cobras-ceara.json"),
      fetch("./data/hospitais-ceara.json"),
    ]);

    listaCobrasGlobal = await resCobras.json();
    listaHospitaisGlobal = await resHospitais.json();

    renderizarCobras(listaCobrasGlobal);
    renderizarHospitais(listaHospitaisGlobal);
  } catch (error) {
    console.error("Erro ao carregar dados JSON:", error);
  }
}

// 2. Renderização dos cards das cobras
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

    const btnEmergencia =
      ehPeconhenta && cobra.tipoSoro
        ? `<button onclick="filtrarHospitaisPorCobra('${cobra.id}')" class="btn-socorro">Fui picado por esta cobra</button>`
        : `<p class="sem-risco-texto">Nenhum soro necessário</p>`;

    card.innerHTML = `
      <img src="./images/${cobra.foto}" alt="${cobra.nome}" onerror="this.src='https://via.placeholder.com/300x200?text=Sem+Foto'">
      <div class="card-content">
        <h3>${cobra.nome}</h3>
        <p class="cientifico">${cobra.nomeCientifico}</p>
        <p><strong>Família:</strong> ${cobra.familia}</p>
        <span class="badge ${classeBadge}">${textoRisco}</span>
        ${btnEmergencia}
      </div>
    `;

    container.appendChild(card);
  });
}

// 3. Consulta a malha rodoviária real via OSRM (OpenStreetMap)
async function obterRotaRodoviariaReal(userLat, userLon, hospLat, hospLon) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${userLon},${userLat};${hospLon},${hospLat}?overview=false`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const metros = data.routes[0].distance;
      const segundos = data.routes[0].duration;
      return {
        distanciaKm: parseFloat((metros / 1000).toFixed(1)),
        tempoMinutos: Math.round(segundos / 60),
      };
    }
  } catch (error) {
    console.warn("Falha ao consultar OSRM, usando cálculo reserva:", error);
  }

  // Fallback: caso a API de rotas falhe, calcula via Haversine com fator de curva
  const distDireta = calcularDistanciaHaversine(
    userLat,
    userLon,
    hospLat,
    hospLon,
  );
  return {
    distanciaKm: parseFloat((distDireta * 1.25).toFixed(1)),
    tempoMinutos: Math.round(((distDireta * 1.25) / 60) * 60),
  };
}

// 4. Filtragem e busca de emergência com GPS de Alta Precisão
function filtrarHospitaisPorCobra(cobraId) {
  const cobra = listaCobrasGlobal.find((c) => c.id === cobraId);
  if (!cobra) return;

  const soroNecessario = cobra.tipoSoro.toLowerCase();

  let hospitaisComSoro = listaHospitaisGlobal.filter((hospital) => {
    return (
      hospital.soros &&
      hospital.soros.some((soro) => soro.toLowerCase().includes(soroNecessario))
    );
  });

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        // Processa as rotas de todos os hospitais em paralelo
        const promessasRotas = hospitaisComSoro.map(async (hospital) => {
          if (hospital.latitude && hospital.longitude) {
            const rota = await obterRotaRodoviariaReal(
              userLat,
              userLon,
              hospital.latitude,
              hospital.longitude,
            );

            if (rota) {
              hospital.distanciaKm = rota.distanciaKm;
              hospital.tempoMinutos = rota.tempoMinutos;
            } else {
              hospital.distanciaKm = Infinity;
            }
          } else {
            hospital.distanciaKm = Infinity;
          }
        });

        await Promise.all(promessasRotas);

        // Ordena do hospital mais próximo ao mais distante por estrada
        hospitaisComSoro.sort(
          (a, b) => (a.distanciaKm || Infinity) - (b.distanciaKm || Infinity),
        );

        exibirResultadoFiltrado(hospitaisComSoro, cobra, userLat, userLon);
      },
      (error) => {
        console.warn("Geolocalização não concedida ou indisponível:", error);
        exibirResultadoFiltrado(hospitaisComSoro, cobra);
      },
      {
        enableHighAccuracy: true, // Liga o chip GPS de alta precisão
        timeout: 12000, // Limite de 12 segundos
        maximumAge: 0, // Não utiliza posições velhas em cache
      },
    );
  } else {
    exibirResultadoFiltrado(hospitaisComSoro, cobra);
  }
}

// 5. Exibição do topo de filtro e scroll suave
function exibirResultadoFiltrado(
  hospitais,
  cobra,
  userLat = null,
  userLon = null,
) {
  const statusDiv = document.getElementById("status-filtro");
  const textoFiltro = document.getElementById("texto-filtro");

  if (textoFiltro) {
    textoFiltro.innerHTML = `Mostrando hospitais com <strong>${cobra.tipoSoro}</strong> para envenenamento por <strong>${cobra.nome}</strong>.`;
  }
  if (statusDiv) {
    statusDiv.style.display = "flex";
  }

  renderizarHospitais(hospitais, userLat, userLon);

  const containerHospitais = document.getElementById("hospitais-container");
  if (containerHospitais) {
    containerHospitais.scrollIntoView({ behavior: "smooth" });
  }
}

// 6. Limpeza do filtro
function limparFiltro() {
  const statusDiv = document.getElementById("status-filtro");
  if (statusDiv) {
    statusDiv.style.display = "none";
  }

  // Limpa distâncias calculadas anteriormente
  listaHospitaisGlobal.forEach((h) => {
    delete h.distanciaKm;
    delete h.tempoMinutos;
  });

  renderizarHospitais(listaHospitaisGlobal);
}

// 7. Renderização dos hospitais no DOM
function renderizarHospitais(hospitais, userLat = null, userLon = null) {
  const container = document.getElementById("hospitais-container");
  if (!container) return;
  container.innerHTML = "";

  if (hospitais.length === 0) {
    container.innerHTML = `<p class="alerta-vazio">Nenhum hospital encontrado com o soro necessário para esta espécie.</p>`;
    return;
  }

  hospitais.forEach((hospital) => {
    const card = document.createElement("div");
    card.className = "card-hospital";

    const listaSoros = hospital.soros
      ? hospital.soros.map((soro) => `<li>${soro}</li>`).join("")
      : "";

    // Gera o link de GPS: com rota ponto-a-ponto se o GPS estiver ativo, ou busca padrão
    let linkMaps = "";
    if (userLat && userLon && hospital.latitude && hospital.longitude) {
      linkMaps = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${hospital.latitude},${hospital.longitude}&travelmode=driving`;
    } else if (hospital.placeId) {
      linkMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.nome)}&query_place_id=${hospital.placeId}`;
    } else {
      const termoBusca = `${hospital.nome}, ${hospital.cidade} - ${hospital.estado}`;
      linkMaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(termoBusca)}`;
    }

    // Tag com a distância rodoviária real e tempo estimado de condução
    const temDistanciaValida =
      typeof hospital.distanciaKm === "number" &&
      hospital.distanciaKm !== Infinity;

    const htmlDistancia = temDistanciaValida
      ? `<div class="distancia-tag"><strong>${hospital.distanciaKm} km</strong> por estrada (${hospital.tempoMinutos} min de viagem)</div>`
      : "";

    card.innerHTML = `
      ${htmlDistancia}
      <h3>${hospital.nome}</h3>
      <p><strong>Cidade:</strong> ${hospital.cidade} - ${hospital.estado}</p>
      <p><strong>Endereço:</strong> ${hospital.endereco}</p>
      <p><strong>Telefone:</strong> ${hospital.telefone}</p>

      <div class="soros-container">
        <strong>Soros Disponíveis:</strong>
        <ul>${listaSoros}</ul>
      </div>

      <a href="${linkMaps}" target="_blank" rel="noopener noreferrer" class="btn-maps">
        Iniciar Navegação GPS até ao Hospital
      </a>
    `;

    container.appendChild(card);
  });
}

// 8. Cálculo Haversine (linha reta) como reserva de emergência
function calcularDistanciaHaversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Raio da Terra em KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Inicializa o carregamento dos dados
carregarDados();
