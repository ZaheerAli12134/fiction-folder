import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getFirebaseConfig, API_BASE_URL } from "./config.js";

const config = await getFirebaseConfig();
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const type = params.get("type");
const container = document.getElementById("details");

async function fetchMangaDetails(id) {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: MANGA) {
        id
        title { romaji english }
        description(asHtml: false)
        coverImage { large }
        genres
        averageScore
        status
      }
    }
  `;
  const response = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { id: Number(id) } })
  });
  const json = await response.json();
  return json.data.Media;
}

async function fetchFilmDetails(id) {
  const url = `${API_BASE_URL}/films/${id}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.Response === "False") throw new Error(data.Error || "Film not found");
  return data;
}

async function fetchTVShowDetails(id) {
  const url = `https://api.tvmaze.com/shows/${id}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("TV show not found");
  const show = await response.json();
  return {
    id: show.id,
    title: show.name,
    description: show.summary ? show.summary.replace(/<[^>]*>/g, "") : "No description available.",
    cover: show.image?.original || show.image?.medium || "",
    premiered: show.premiered,
    rating: show.rating?.average,
    genres: show.genres || [],
    status: show.status,
    network: show.network?.name || show.webChannel?.name || "Unknown"
  };
}

async function renderDetails() {
  try {
    if (type === "MANGA") {
      const manga = await fetchMangaDetails(id);
      const genres = manga.genres?.length ? `<p><strong>Genres:</strong> ${manga.genres.join(", ")}</p>` : "";
      const score = manga.averageScore ? `<p><strong>Score:</strong> ${manga.averageScore}/100</p>` : "";
      const status = manga.status ? `<p><strong>Status:</strong> ${manga.status}</p>` : "";
      container.innerHTML = `
        <img src="${manga.coverImage.large}" alt="${manga.title.english || manga.title.romaji}">
        <h2>${manga.title.english || manga.title.romaji}</h2>
        ${genres}
        ${score}
        ${status}
        <p>${manga.description || "No description available."}</p>
        <button id="addBtn">➕ Add to List</button>
      `;
      document.getElementById("addBtn").onclick = () =>
        addToList(manga.id, "MANGA", manga.title.english || manga.title.romaji, manga.coverImage.large);
    } else if (type === "FILM") {
      const film = await fetchFilmDetails(id);
      const director = film.Director && film.Director !== "N/A" ? `<p><strong>Director:</strong> ${film.Director}</p>` : "";
      const actors = film.Actors && film.Actors !== "N/A" ? `<p><strong>Actors:</strong> ${film.Actors}</p>` : "";
      const genre = film.Genre && film.Genre !== "N/A" ? `<p><strong>Genre:</strong> ${film.Genre}</p>` : "";
      const rating = film.imdbRating && film.imdbRating !== "N/A" ? `<p><strong>Rating:</strong> ${film.imdbRating}/10</p>` : "";
      container.innerHTML = `
        <img src="${film.Poster !== "N/A" ? film.Poster : "https://via.placeholder.com/300x450/333/fff?text=No+Poster"}" alt="${film.Title}">
        <h2>${film.Title} (${film.Year})</h2>
        ${genre}
        ${rating}
        ${director}
        ${actors}
        <p>${film.Plot !== "N/A" ? film.Plot : "No plot available."}</p>
        <button id="addBtn">➕ Add to List</button>
      `;
      document.getElementById("addBtn").onclick = () =>
        addToList(film.imdbID, "FILM", film.Title, film.Poster !== "N/A" ? film.Poster : "");
    } else if (type === "TV_SHOW") {
      const tvShow = await fetchTVShowDetails(id);
      const yearInfo = tvShow.premiered ? ` (${new Date(tvShow.premiered).getFullYear()})` : "";
      const ratingInfo = tvShow.rating ? `<p><strong>Rating:</strong> ${tvShow.rating}/10</p>` : "";
      const statusInfo = tvShow.status ? `<p><strong>Status:</strong> ${tvShow.status}</p>` : "";
      const networkInfo = tvShow.network ? `<p><strong>Network:</strong> ${tvShow.network}</p>` : "";
      const genresInfo = tvShow.genres.length ? `<p><strong>Genres:</strong> ${tvShow.genres.join(", ")}</p>` : "";
      container.innerHTML = `
        <img src="${tvShow.cover || "https://via.placeholder.com/300x450/333/fff?text=No+Image"}" alt="${tvShow.title}">
        <h2>${tvShow.title}${yearInfo}</h2>
        ${genresInfo}
        ${ratingInfo}
        ${statusInfo}
        ${networkInfo}
        <p>${tvShow.description}</p>
        <button id="addBtn">➕ Add to List</button>
      `;
      document.getElementById("addBtn").onclick = () =>
        addToList(tvShow.id, "TV_SHOW", tvShow.title, tvShow.cover);
    } else {
      container.innerHTML = "<p>Invalid type.</p>";
    }
  } catch (err) {
    container.innerHTML = `<p>Error loading details: ${err.message}</p>`;
  }
}

function addToList(id, type, title, cover) {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert("Please log in to add items to your list.");
      return;
    }
    const rating = prompt("Enter your rating (1-10):");
    if (!rating || isNaN(rating) || rating < 1 || rating > 10) {
      alert("Invalid rating. Please enter a number between 1 and 10.");
      return;
    }
    await setDoc(doc(db, "users", user.uid, "list", String(id)), {
      id,
      type,
      title,
      cover,
      rating: Number(rating),
      addedAt: serverTimestamp()
    });
    alert(`${title} added to your list with rating ${rating}!`);
  });
}

renderDetails();
