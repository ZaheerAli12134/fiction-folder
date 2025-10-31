import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, query, where,
  doc, getDoc, updateDoc, setDoc, onSnapshot,
  serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getFirebaseConfig } from "./config.js";

const config = await getFirebaseConfig();
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let allFictions = [];
let showingTop10 = false;
let friendRequestsListener = null;

function showNotification(message, type = "success") {
  const el = document.getElementById("notification");
  el.textContent = message;
  el.className = `notification ${type} show`;
  setTimeout(() => el.classList.remove("show"), 3000);
}

function renderEmpty(container, message) {
  container.innerHTML = `<div class="empty-state"><p>${message}</p></div>`;
}

function displayFictions(fictions) {
  const container = document.getElementById("fictionsContainer");
  if (!fictions.length) {
    renderEmpty(container, "No fictions found matching your search");
    return;
  }
  container.innerHTML = fictions.map((f, i) => `
    <div class="fiction-item">
      <img src="${f.cover || 'https://via.placeholder.com/60x80/007ACC/FFFFFF?text=Cover'}"
           alt="${f.title}" class="fiction-cover">
      <div class="fiction-info">
        <h3>${f.title}${showingTop10 ? `<span class="badge">#${i + 1}</span>` : ""}</h3>
        <p>${f.author ? `Author: ${f.author} | ` : ""}Type: ${f.type || "Unknown"} | Rating: <span>${f.rating || "N/A"}</span></p>
      </div>
    </div>
  `).join("");
}

document.getElementById("searchInput").addEventListener("keyup", e => {
  if (e.key === "Enter") searchFiction();
});

window.searchFiction = function () {
  const term = document.getElementById("searchInput").value.trim().toLowerCase();
  const title = document.getElementById("sectionTitle");
  showingTop10 = false;
  if (!term) {
    title.textContent = "Your Fiction Collection";
    displayFictions(allFictions);
    return;
  }
  const results = allFictions.filter(f =>
    [f.title, f.author, f.type].some(v => v?.toLowerCase().includes(term))
  );
  title.textContent = "Search Results";
  displayFictions(results);
};

window.showTop10 = function () {
  if (!allFictions.length) {
    showNotification("No fictions found", "error");
    return;
  }
  const top10 = [...allFictions]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 10);
  showingTop10 = true;
  document.getElementById("sectionTitle").textContent = "Your Top 10 Fictions";
  document.getElementById("searchInput").value = "";
  displayFictions(top10);
};

function listenForFriendRequests() {
  if (!currentUser) return;
  const container = document.getElementById("friendRequestsContainer");
  renderEmpty(container, "Loading friend requests...");
  const q = query(
    collection(db, "friendRequests"),
    where("to", "==", currentUser.uid),
    where("status", "==", "pending")
  );
  friendRequestsListener = onSnapshot(q, snapshot => {
    container.innerHTML = "";
    if (snapshot.empty) {
      renderEmpty(container, "No pending friend requests");
      return;
    }
    snapshot.forEach(docSnap => {
      const req = docSnap.data();
      container.innerHTML += `
        <div class="friend-request">
          <p><strong>${req.fromUsername}</strong> wants to be friends</p>
          <div class="friend-request-buttons">
            <button onclick="acceptFriendRequest('${docSnap.id}', '${req.from}', '${req.fromUsername}')">Accept</button>
            <button onclick="declineFriendRequest('${docSnap.id}')">Decline</button>
          </div>
        </div>`;
    });
  });
}

window.acceptFriendRequest = async (reqId, friendUid, friendName) => {
  if (!currentUser) return;
  try {
    await updateDoc(doc(db, "friendRequests", reqId), { status: "accepted" });
    const currentUserSnap = await getDoc(doc(db, "users", currentUser.uid));
    const currentData = currentUserSnap.data();
    await Promise.all([
      setDoc(doc(db, "users", currentUser.uid, "friends", friendUid), {
        uid: friendUid,
        username: friendName,
        addedAt: serverTimestamp()
      }),
      setDoc(doc(db, "users", friendUid, "friends", currentUser.uid), {
        uid: currentUser.uid,
        username: currentData.username || currentUser.email,
        addedAt: serverTimestamp()
      })
    ]);
    showNotification("Friend request accepted!");
  } catch {
    showNotification("Error accepting friend request", "error");
  }
};

window.declineFriendRequest = async reqId => {
  if (!currentUser) return;
  try {
    await updateDoc(doc(db, "friendRequests", reqId), { status: "rejected" });
    showNotification("Friend request declined");
  } catch {
    showNotification("Error declining friend request", "error");
  }
};

window.checkFriendRequests = function () {
  const requests = document.getElementById("friendRequestsSection");
  const friends = document.getElementById("friendsListSection");
  const visible = requests.style.display !== "none";
  requests.style.display = visible ? "none" : "block";
  friends.style.display = "none";
  if (visible && friendRequestsListener) friendRequestsListener();
  else listenForFriendRequests();
};

async function loadFriendsList() {
  if (!currentUser) return;
  const container = document.getElementById("friendsListContainer");
  renderEmpty(container, "Loading friends...");
  try {
    const snap = await getDocs(collection(db, "users", currentUser.uid, "friends"));
    container.innerHTML = "";
    if (snap.empty) {
      renderEmpty(container, "You have no friends yet");
      return;
    }
    snap.forEach(docSnap => {
      const friend = docSnap.data();
      container.innerHTML += `
        <div class="friend-request">
          <p><strong>${friend.username}</strong></p>
          <div class="friend-request-buttons">
            <button class="decline-btn" onclick="removeFriend('${friend.uid}', '${friend.username}')">Remove Friend</button>
          </div>
        </div>`;
    });
  } catch {
    showNotification("Error loading friends list", "error");
  }
}

window.viewFriends = function () {
  const list = document.getElementById("friendsListSection");
  const requests = document.getElementById("friendRequestsSection");
  const visible = list.style.display !== "none";
  list.style.display = visible ? "none" : "block";
  requests.style.display = "none";
  if (!visible) loadFriendsList();
};

window.removeFriend = async (friendUid, friendName) => {
  if (!currentUser) return;
  if (!confirm(`Remove ${friendName} from your friends?`)) return;
  try {
    await Promise.all([
      deleteDoc(doc(db, "users", currentUser.uid, "friends", friendUid)),
      deleteDoc(doc(db, "users", friendUid, "friends", currentUser.uid))
    ]);
    showNotification("Friend removed");
    loadFriendsList();
  } catch {
    showNotification("Error removing friend", "error");
  }
};

onAuthStateChanged(auth, async user => {
  const nameEl = document.getElementById("userName");
  const container = document.getElementById("fictionsContainer");
  if (!user) {
    currentUser = null;
    nameEl.textContent = "Please log in";
    renderEmpty(container, "Please log in to view your fictions");
    return;
  }
  currentUser = user;
  nameEl.textContent = user.displayName || user.email;
  try {
    const listSnap = await getDocs(collection(db, "users", user.uid, "list"));
    if (listSnap.empty) {
      renderEmpty(container, "Your list is empty. Start adding some fictions!");
      allFictions = [];
      return;
    }
    allFictions = listSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    displayFictions(allFictions);
  } catch {
    renderEmpty(container, "Error loading your fictions");
  }
});
