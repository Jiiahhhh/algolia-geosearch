document.addEventListener("DOMContentLoaded", function () {
  // Algolia Client Configuration
  const searchClient = window.algoliasearch(
    "YV15KK59I0",
    "a3bc634718a9e613b4c7ac9d3633609c"
  );

  // Map Setup Leaflet
  const map = L.map("map").setView([-2.5, 118.0], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  let isMapInteraction = false;
  let isSearchBoxInteraction = false;
  let isInitialLoad = true;

  function customSearchFunction(helper) {
    const pageState = helper.state;
    const searchBoxQuery =
      document.querySelector('#search-box input[type="search"]')?.value || "";
    if (searchBoxQuery && searchBoxQuery.trim().length > 0) {
      helper.setQueryParameter("insideBoundingBox", undefined);
    }
    helper.search();
  }

  const search = instantsearch({
    indexName: "university_indonesia_geoloc",
    searchClient,
    routing: true,
    searchFunction: customSearchFunction,
  });

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const renderGeoSearch = (renderOptions, isFirstRender) => {
    const { items, refine } = renderOptions;

    markerLayer.clearLayers();
    const bounds = L.latLngBounds();

    items.forEach((item) => {
      if (
        item._geoloc &&
        item._geoloc.lat != null &&
        item._geoloc.lng != null
      ) {
        const lat = item._geoloc.lat;
        const lng = item._geoloc.lng;
        const title = item.University;
        const town = item.Town;
        const marker = L.marker([lat, lng]).bindPopup(
          `<b>${title}</b><br>${town}`
        );
        markerLayer.addLayer(marker);
        bounds.extend([lat, lng]);
      } else {
        console.warn("Item skipped, missing _geoloc:", item.University);
      }
    });

    console.log(
      `Checking fitBounds: isInitialLoad=${isInitialLoad}, isSearchBoxInteraction=${isSearchBoxInteraction}, isMapInteraction=${isMapInteraction}, boundsValid=${bounds.isValid()}, markers=${
        markerLayer.getLayers().length
      }`
    ); // <-- Tambahkan log ini untuk debug

    if (
      (isInitialLoad || isSearchBoxInteraction) && // Hanya jalan jika render pertama ATAU dipicu search box
      bounds.isValid() && // Pastikan ada batas valid dari marker
      markerLayer.getLayers().length > 0 // Pastikan ada marker untuk ditampilkan
    ) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
      isInitialLoad = false; // Reset flag initial load setelah pemanggilan pertama
    }
    isMapInteraction = false;
    isSearchBoxInteraction = false;
    if (isFirstRender) {
      const debouncedRefineOnMove = debounce(() => {
        const currentMapBounds = map.getBounds();
        const ne = currentMapBounds.getNorthEast();
        const sw = currentMapBounds.getSouthWest();
        console.log(
          "Map interaction detected, setting flag and calling refine..."
        );
        isMapInteraction = true;
        refine({
          northEast: { lat: ne.lat, lng: ne.lng },
          southWest: { lat: sw.lat, lng: sw.lng },
        });
      }, 200);

      map.on("moveend", debouncedRefineOnMove);
    }
  };

  const customGeoSearch =
    instantsearch.connectors.connectGeoSearch(renderGeoSearch);

  search.addWidgets([
    instantsearch.widgets.configure({
      hitsPerPage: 25,
      attributesToHighlight: ["University", "Town"],
    }),

    instantsearch.widgets.searchBox({
      container: "#search-box",
      placeholder: "Cari universitas atau kota...",
      queryHook(query, search) {
        if (!isMapInteraction) {
          isSearchBoxInteraction = true;
        }
        search(query); // Lanjutkan pencarian
      },
    }),

    instantsearch.widgets.stats({
      container: "#stats-container",
      templates: {
        text(data, { html }) {
          const nbHits = data.nbHits;
          const page = data.page;
          const currentHitsCount = Array.isArray(data.hits)
            ? data.hits.length
            : 0;

          if (nbHits === 0) {
            if (data.query) {
              return "Universitas tidak ditemukan.";
            }
            return "Universitas tidak ditemukan.";
          }

          if (currentHitsCount === 0 && nbHits > 0) {
            const formattedNbHits = nbHits.toLocaleString("id-ID");
            return `${formattedNbHits} universitas ditemukan`;
          }
          const formattedNbHits = nbHits.toLocaleString("id-ID");
          return `${formattedNbHits} universitas ditemukan`;
        },
      },
    }),

    instantsearch.widgets.hits({
      container: "#hits",
      templates: {
        item: `
          <div class="ais-Hits-item hit-card card">
            <div class="card-body">
              <h5 class="card-title">{{#helpers.highlight}}{ "attribute": "University" }{{/helpers.highlight}}</h5>
              <p class="card-text">{{#helpers.highlight}}{ "attribute": "Town" }{{/helpers.highlight}}</p>
              <p class="card-text rank">Rank: {{Rank}}</p>
            </div>
          </div>
        `,
        empty(results, { html }) {
          document.getElementById("no-results").style.display =
            results.nbHits === 0 ? "block" : "none";
          return "";
        },
      },
      transformItems(items, { results }) {
        return items;
      },
    }),

    instantsearch.widgets.pagination({
      container: "#pagination",
      totalPages: 20,
      padding: 2,
      showFirst: false,
      showLast: false,
      showPrevious: true,
      showNext: true,
    }),
    customGeoSearch({}),
  ]);

  search.start();
});
