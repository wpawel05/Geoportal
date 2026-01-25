// MAPA
const map = L.map('map').setView([52.2375, 21.0131], 13);

// MAPY BAZOWE
const osm = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { attribution: '&copy; OpenStreetMap contributors' }
);

const esri = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { attribution: 'Tiles © Esri' }
);

const dark = L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', 
  {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }
);

osm.addTo(map);

//Warstwa Heatmapy
let heatLayer = L.heatLayer([], {
    radius: 80,
    blur: 50,
    maxZoom: 15,
    max: 2,
    gradient: {
        0.2: 'blue', 
        0.4: 'cyan', 
        0.6: 'lime', 
        0.8: 'yellow', 
        1.0: 'red'
    }
});

// Kontrolka warstw
L.control.layers(
  {
    'OpenStreetMap': osm,
    'Satelita': esri,
    'Tryb Nocny': dark
  },
  {
    'Heatmapa (Gęstość)': heatLayer
  },
  { position: 'topleft' }
).addTo(map);

// KONFIGURACJA KOLORÓW
const typeColors = {
  light: {
    'dzielnica': '#4CAF50',
    'Lokal Gastronomiczny': '#F44336',
    'Klub': '#9C27B0',
    'park': '#2E7D32',
    'plac': '#FF9800',
    'inne': '#2196F3',
    'ulica': '#0062ff'
  },
  dark: {
    'dzielnica': '#1b5e20',
    'Lokal Gastronomiczny': '#b71c1c',
    'Klub': '#4a148c',
    'park': '#1b5e20',
    'plac': '#e65100',
    'inne': '#0d47a1',
    'ulica': '#001d4d'
  }
};

let currentMode = 'light';
const allLayers = [];
const searchLayer = L.layerGroup().addTo(map);

// FUNKCJE POMOCNICZE

function createColoredIcon(type) {
  const color = typeColors[currentMode][type] || typeColors[currentMode]['inne'];
  const size = type === 'dzielnica' ? 40 : 32;
  
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        border: 3px solid ${currentMode === 'dark' ? '#444' : 'white'};
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${type === 'dzielnica' ? '18px' : '14px'};
        color: white;
        filter: ${currentMode === 'dark' ? 'brightness(0.8)' : 'none'};
      ">
        ${type === 'dzielnica' ? '🏢' : 
          type === 'Lokal Gastronomiczny' ? '🍽️' :
          type === 'Klub' ? '🎵' :
          type === 'park' ? '🌳' :
          type === 'plac' ? '⬛' : '📍'}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [size, size],
    iconAnchor: [size/2, size/2]
  });
}

function updateStyles() {
  allLayers.forEach(layer => {
      const type = layer.featureData.type;
      const color = typeColors[currentMode][type] || typeColors[currentMode]['inne'];

      if (layer.featureData.geometryType === 'Point') {
          layer.setIcon(createColoredIcon(type)); 
      } else if (layer.featureData.geometryType === 'LineString') {
          layer.setStyle({ color: color });
      }
  });
}

function updatePlacesList() {
    const listEl = document.getElementById('places-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    allLayers.forEach(layer => {
        if (map.hasLayer(layer) && layer.featureData.geometryType === 'Point' && layer.featureData.type !== 'dzielnica') {
            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.style.padding = '5px 0';
            li.innerText = layer.featureData.name;
            
            li.onclick = () => {
                map.flyTo(layer.getLatLng(), 16);
                layer.openPopup();
            };
            listEl.appendChild(li);
        }
    });
}

// WCZYTANIE GEOJSON
fetch('places.geojson')
  .then(r => r.json())
  .then(data => {
    // Przygotowanie punktów dla Heatmapy
    const heatPoints = data.features
        .filter(f => f.geometry.type === 'Point')
        .map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0], 0.5]);
    heatLayer.setLatLngs(heatPoints);

    data.features.forEach(feature => {
      let layer;
      const type = feature.properties.type || 'inne';

      if (feature.geometry.type === 'Point') {
        const icon = createColoredIcon(type);
        layer = L.marker([
          feature.geometry.coordinates[1],
          feature.geometry.coordinates[0]
        ], { 
            icon: icon,
            title: feature.properties.name 
        });
      }

      if (feature.geometry.type === 'LineString') {
        // Kolory z typeColors
        const color = typeColors[currentMode]['ulica'] || '#0062ff';
        layer = L.geoJSON(feature, {
          style: { color: color, weight: 7 }
        });
      }

      if (!layer) return;

      layer.bindPopup(`
        <strong>${feature.properties.name}</strong><br>
        <em>Album:</em> ${feature.properties.album}<br>
        <em>Piosenka:</em> ${feature.properties.song}<br>
        <blockquote>${feature.properties.quote}</blockquote>
        <br>
        ${feature.properties.image ? `<img src="${feature.properties.image}" width="300"><br>` : ''}
        ${feature.properties.audio ? `<audio controls><source src="${feature.properties.audio}" type="audio/mpeg"></audio>` : ''}
      `);

      layer.featureData = {
        name: feature.properties.name,
        geometryType: feature.geometry.type,
        category: feature.properties.type,
        album: feature.properties.album,
        type: type
      };

      layer.addTo(map);
      if (feature.geometry.type === 'Point') layer.addTo(searchLayer);
      allLayers.push(layer);
    });

    applyFilters();
    updatePlacesList();
  });

// FILTROWANIE
function applyFilters() {
  const showPoints = document.getElementById('filter-points').checked;
  const showLines  = document.getElementById('filter-lines').checked;
  const showDistricts = document.getElementById('filter-districts').checked;
  const enabledAlbums = Array.from(document.querySelectorAll('.filter-album:checked')).map(cb => cb.value);

  allLayers.forEach(layer => {
    const { geometryType, category, album, type } = layer.featureData;
    let typeOk = false;

    if (category === 'ulica' && showLines) typeOk = true;
    else if (type === 'dzielnica' && showDistricts) typeOk = true;
    else if (geometryType === 'Point' && type !== 'dzielnica' && showPoints) typeOk = true;

    const albumOk = enabledAlbums.includes(album);

    if (typeOk && albumOk) {
      if (!map.hasLayer(layer)) {
        layer.addTo(map);
        if (geometryType === 'Point') layer.addTo(searchLayer);
      }
    } else {
      if (map.hasLayer(layer)) {
        map.removeLayer(layer);
        if (geometryType === 'Point') searchLayer.removeLayer(layer);
      }
    }
  });
  updatePlacesList();
}

// DODATKI I LISTENERY

// Losowanie miejsca
const randomBtn = document.getElementById('random-place');
if (randomBtn) {
    randomBtn.addEventListener('click', () => {
        const points = allLayers.filter(l => 
            l.featureData.geometryType === 'Point' && 
            l.featureData.type !== 'dzielnica' &&
            map.hasLayer(l)
        );

        if (points.length > 0) {
            const randomMarker = points[Math.floor(Math.random() * points.length)];
            map.flyTo(randomMarker.getLatLng(), 16);
            randomMarker.openPopup();
        }
    });
}

document.querySelectorAll('#filters input').forEach(el => el.addEventListener('change', applyFilters));

// Startowa głośność
map.on('popupopen', function(e) {
    const audio = e.popup.getElement().querySelector('audio');
    if (audio) { audio.volume = 0.3; }
});

//  Zapamiętywanie lokalizacji
const hash = new L.Hash(map);

// Wyszukiwarka miejsc
const searchControl = new L.Control.Search({
    layer: searchLayer,
    propertyName: 'title',
    marker: false,
    moveToLocation: function(latlng, title, map) {
        map.setView(latlng, 16);
    }
});

searchControl.on('search:locationfound', function(e) {
    e.layer.openPopup();
});
map.addControl(searchControl);

// Tryb nocny
map.on('baselayerchange', function(e) {
  if (e.name === 'Tryb Nocny') {
      currentMode = 'dark';
      document.body.classList.add('dark-mode');
  } else {
      currentMode = 'light';
      document.body.classList.remove('dark-mode');
  }
  updateStyles();
});
