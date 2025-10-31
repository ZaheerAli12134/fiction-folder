import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, query, where,
  doc, getDoc, updateDoc, arrayUnion
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getFirebaseConfig } from "./config.js";

const config = await getFirebaseConfig();
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
let currentUser = null;

window.searchUsers = async function () {
  if (!currentUser) {
    alert("Please log in to search for friends.");
    return;
  }

  const searchTerm = document.getElementById("searchInput").value.trim();
  if (!searchTerm) {
    alert("Please enter a username or email to search.");
    return;
  }

  const usersRef = collection(db, "users");
  const q = query(
    usersRef,
    where("username", ">=", searchTerm),
    where("username", "<=", searchTerm + "\uf8ff")
  );

  const snapshot = await getDocs(q);
  const resultsContainer = document.getElementById("searchResults");
  resultsContainer.innerHTML = "";

  if (snapshot.empty) {
    resultsContainer.innerHTML = '<p class="no-results">No users found.</p>';
    return;
  }

  snapshot.forEach(userDoc => {
    const userData = userDoc.data();
    if (userDoc.id === currentUser.uid) return;
    const userDiv = document.createElement("div");
    userDiv.className = "user-result";
    userDiv.innerHTML = `
      <div class="user-info">
        <div class="user-icon">👤</div>
        <div>
          <strong>${userData.username || userData.email}</strong>
          <br>
          <small>${userData.email}</small>
        </div>
      </div>
      <button class="add-friend-btn" onclick="sendFriendRequest('${userDoc.id}', '${userData.username || userData.email}')">
        Add Friend
      </button>
    `;
    resultsContainer.appendChild(userDiv);
  });
};

window.sendFriendRequest = async function (friendUid, friendUsername) {
  if (!currentUser) return;
  const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
  const currentUserData = currentUserDoc.data();
  await updateDoc(doc(db, "users", friendUid), {
    friendRequests: arrayUnion({
      uid: currentUser.uid,
      username: currentUserData.username || currentUser.email,
      sentAt: new Date()
    })
  });
  alert(`Friend request sent to ${friendUsername}!`);
};

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (!user) {
    document.getElementById("searchResults").innerHTML =
      '<p class="no-results">Please log in to add friends.</p>';
  }
});
