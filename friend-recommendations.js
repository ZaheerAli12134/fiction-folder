import { getApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, getDoc, setDoc,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";


const app = getApp(); 
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupRecommendations);
} else {
  setupRecommendations();
}

function setupRecommendations() {

  const recBtn = document.getElementById("friendRecBtn");
  const container = document.getElementById("friendRecContainer");
  const list = document.getElementById("friendRecList");

  if (!recBtn) {
    console.warn("⚠️ friendRecBtn not found in DOM");
    return;
  }

  recBtn.disabled = true;
  recBtn.textContent = "Checking login...";

  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user) {
      recBtn.disabled = false;
      recBtn.style.opacity = "1";
      recBtn.textContent = "Get Friend Recommendations";
    } else {
      recBtn.disabled = true;
      recBtn.style.opacity = "0.6";
      recBtn.textContent = "Please log in for recommendations";
    }
  });

  recBtn.addEventListener("click", async () => {
    if (!currentUser) {
      alert("Please log in to see recommendations.");
      return;
    }
    await displayFriendRecommendations(container, list);
  });
}

async function getFriendRecommendations() {
  if (!currentUser) return [];

  const userFictionsSnap = await getDocs(collection(db, "users", currentUser.uid, "list"));
  const userFictions = new Set();
  userFictionsSnap.forEach(d => userFictions.add(d.id));
  if (userFictions.size === 0) return [];

  const allUsersSnap = await getDocs(collection(db, "users"));
  const matches = [];

  for (const userDoc of allUsersSnap.docs) {
    if (userDoc.id === currentUser.uid) continue;

    const friendCheck = await getDoc(doc(db, "users", currentUser.uid, "friends", userDoc.id));
    if (friendCheck.exists()) continue;

    const reqQuery = query(
      collection(db, "friendRequests"),
      where("from", "==", currentUser.uid),
      where("to", "==", userDoc.id),
      where("status", "==", "pending")
    );
    const reqSnap = await getDocs(reqQuery);
    if (!reqSnap.empty) continue;

    const theirFictionsSnap = await getDocs(collection(db, "users", userDoc.id, "list"));
    const shared = [];
    theirFictionsSnap.forEach(d => {
      if (userFictions.has(d.id)) {
        const f = d.data();
        shared.push(f.title || "Untitled");
      }
    });

    if (shared.length > 0) {
      matches.push({
        uid: userDoc.id,
        username: userDoc.data().username || userDoc.data().email,
        sharedCount: shared.length,
        sharedTitles: shared.slice(0, 3)
      });
    }
  }

  matches.sort((a, b) => b.sharedCount - a.sharedCount);
  return matches.slice(0, 5);
}

async function displayFriendRecommendations(container, list) {
  list.innerHTML = `<div class="loading">Finding users with similar fictions...</div>`;
  container.style.display = "block";

  const recs = await getFriendRecommendations();

  if (recs.length === 0) {
    list.innerHTML = `<div class="empty-state"><p>No users found with similar fictions. Rate more fictions to get recommendations!</p></div>`;
    return;
  }

  list.innerHTML = "";
  recs.forEach(friend => {
    const card = document.createElement("div");
    card.className = "friend-card";
    const avatar = friend.username ? friend.username[0].toUpperCase() : "U";
    card.innerHTML = `
      <div class="friend-avatar">${avatar}</div>
      <div class="friend-info">
        <div class="friend-name">${friend.username}</div>
        <div class="shared-fictions">
          <strong>${friend.sharedCount} fictions in common</strong>
          ${friend.sharedTitles.map(t => `<div>"${t}"</div>`).join("")}
        </div>
      </div>
      <button class="add-friend-btn" data-uid="${friend.uid}" data-name="${friend.username}">
        Add Friend
      </button>
    `;
    list.appendChild(card);
  });

  list.querySelectorAll(".add-friend-btn").forEach(btn => {
    btn.addEventListener("click", async e => {
      const uid = e.target.getAttribute("data-uid");
      const name = e.target.getAttribute("data-name");
      await sendFriendRequest(uid, name, e.target);
    });
  });
}

async function sendFriendRequest(friendUid, friendUsername, button) {
  if (!currentUser) return;

  const userDoc = await getDoc(doc(db, "users", currentUser.uid));
  const userData = userDoc.data();

  await setDoc(doc(db, "friendRequests", `${currentUser.uid}_${friendUid}`), {
    from: currentUser.uid,
    to: friendUid,
    fromUsername: userData.username || userData.email,
    toUsername: friendUsername,
    status: "pending",
    timestamp: serverTimestamp()
  });

  alert(`Friend request sent to ${friendUsername}!`);
  button.textContent = "Request Sent";
  button.disabled = true;
  button.style.background = "#6c757d";
}




