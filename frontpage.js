async function fetchManga(searchTerm = "", page = 1, perPage = 60) {
  const query = `
  query ($page: Int, $perPage: Int, $search: String, $type: MediaType, $sort: [MediaSort]) {
    Page(page: $page, perPage: $perPage) {
      media(type: $type, search: $search, isAdult: false, sort: $sort) {
        id
        type
        title {
          romaji
          english
        }
        coverImage {
          large
          medium
        }
      }
    }
  }
`;

  const variables = {
    page,
    perPage,
    type: "MANGA",
    ...(searchTerm && { search: searchTerm }),
    ...(!searchTerm && { sort: ["POPULARITY_DESC"] })
  };

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ query, variables })
    });

    const json = await response.json();

    if (json.errors) {
      console.error("AniList API errors:", json.errors);
      return [];
    }

    return json.data.Page.media || [];
  } catch (err) {
    console.error("Fetch error (AniList):", err);
    return [];
  }
}

async function fetchFilms(searchTerm = "") {
  const apiKey = "e897e075";
  if (!apiKey || !searchTerm) return [];

  const encodedSearch = encodeURIComponent(searchTerm);
  const url = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodedSearch}&type=movie`;

  try {
    const response = await fetch(url);
    const json = await response.json();

    if (json.Response === "False" || !json.Search) return [];

    return json.Search.map(movie => ({
      id: movie.imdbID,
      title: movie.Title,
      coverImage: {
        large: movie.Poster !== "N/A" ? movie.Poster : "",
        medium: movie.Poster !== "N/A" ? movie.Poster : ""
      },
      type: "FILM"
    }));
  } catch (err) {
    console.error("Fetch error (OMDb):", err);
    return [];
  }
}

async function fetchTVShows(searchTerm = "") {
  let url;
  
  if (searchTerm) {
    const encodedSearch = encodeURIComponent(searchTerm);
    url = `https://api.tvmaze.com/search/shows?q=${encodedSearch}`;
  } else {
    url = `https://api.tvmaze.com/shows`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data || data.length === 0) return [];

    const shows = searchTerm ? data.map(item => item.show) : data;
    
    return shows
      .sort((a, b) => (b.rating?.average || 0) - (a.rating?.average || 0))
      .slice(0, 24)
      .map(show => ({
        id: show.id,
        title: show.name,
        coverImage: {
          large: show.image?.original || show.image?.medium || "",
          medium: show.image?.medium || show.image?.original || ""
        },
        type: "TV_SHOW",
        year: show.premiered ? new Date(show.premiered).getFullYear() : null,
        rating: show.rating?.average || null
      }));
  } catch (err) {
    console.error("Fetch error (TVMaze):", err);
    return [];
  }
}

async function fetchAllMedia(searchTerm = "") {
  try {
    const [mangaList, filmList, tvShowList] = await Promise.allSettled([
      fetchManga(searchTerm),
      fetchFilms(searchTerm),
      fetchTVShows(searchTerm)
    ]);

    return {
      mangaList: mangaList.status === "fulfilled" ? mangaList.value : [],
      filmList: filmList.status === "fulfilled" ? filmList.value : [],
      tvShowList: tvShowList.status === "fulfilled" ? tvShowList.value : []
    };
  } catch (err) {
    console.error("Error combining media:", err);
    return { mangaList: [], filmList: [], tvShowList: [] };
  }
}

function createMediaCard(item, type) {
  const title = item.title?.english || item.title?.romaji || item.title || "No title";
  const image = item.coverImage?.large || item.coverImage?.medium || "";
  const yearInfo = item.year ? ` (${item.year})` : '';
  
  const typeLabels = {
    MANGA: "Manga/Manhwa",
    FILM: "Film",
    TV_SHOW: "TV Show"
  };
  
  const figure = document.createElement("figure");
  figure.innerHTML = `
    <a href="detail.html?id=${item.id}&type=${type}">
      <img src="${image}" alt="${title}" loading="lazy" />
      <figcaption title="${title}">${title}${yearInfo} <br/><small>${typeLabels[type]}</small></figcaption>
    </a>
  `;
  return figure;
}

function renderMedia({ mangaList = [], filmList = [], tvShowList = [] }) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  if (mangaList.length === 0 && filmList.length === 0 && tvShowList.length === 0) {
    container.innerHTML = "<p style='text-align:center;'>No results found.</p>";
    return;
  }

  mangaList.forEach(item => {
    container.appendChild(createMediaCard(item, "MANGA"));
  });

  filmList.forEach(item => {
    container.appendChild(createMediaCard(item, "FILM"));
  });

  tvShowList.forEach(item => {
    container.appendChild(createMediaCard(item, "TV_SHOW"));
  });
}

document.querySelector(".search-bar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = document.getElementById("searchInput").value.trim();

  renderMedia({ mangaList: [], filmList: [], tvShowList: [] });

  const results = await fetchAllMedia(query);
  renderMedia(results);
});

window.addEventListener("DOMContentLoaded", async () => {
  const [popularManga, popularTVShows] = await Promise.all([
    fetchManga("", 1, 24),
    fetchTVShows("")
  ]);
  
  renderMedia({ 
    mangaList: popularManga, 
    filmList: [], 
    tvShowList: popularTVShows 
  });
});