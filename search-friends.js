import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { 
  getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, 
  doc, getDoc 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getFirebaseConfig } from './config.js';

const config = await getFirebaseConfig();
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

async function searchUser(username) {
  const q = query(collection(db, "users"), where("username", "==", username));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0];
}

async function sendFriendRequest(fromUid, fromUsername, toUid, toUsername) {
  await addDoc(collection(db, "friendRequests"), {
    from: fromUid,
    fromUsername,
    to: toUid,
    toUsername,
    status: "pending",
    createdAt: serverTimestamp()
  });
}

document.getElementById("searchBtn").onclick = async () => {
  const username = document.getElementById("usernameInput").value.trim();
  const resultDiv = document.getElementById("result");
  
  if (!username) {
    resultDiv.innerHTML = "<p class='error-message'>Please enter a username</p>";
    return;
  }
  
  const userDoc = await searchUser(username);
  
  if (!userDoc) {
    resultDiv.innerHTML = "<p class='error-message'>User not found</p>";
    return;
  }
  
  const friendUid = userDoc.id;
  const friendData = userDoc.data();
  
  resultDiv.innerHTML = `
    <div class="user-found">
      <p>Found user: <strong>${friendData.username}</strong></p>
      <button id="addBtn" class="add-friend-btn">Add Friend</button>
    </div>
  `;
  
  document.getElementById("addBtn").onclick = () => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        alert("Please log in to send friend requests");
        return;
      }
      
      const userSnap = await getDoc(doc(db, "users", user.uid));
      
      if (!userSnap.exists()) {
        alert("Your profile does not exist in Firestore");
        return;
      }
      
      const fromData = userSnap.data();
      await sendFriendRequest(user.uid, fromData.username, friendUid, friendData.username);
      
      resultDiv.innerHTML = `
        <div class="success-message">
          <p>Friend request sent to <strong>${friendData.username}</strong>!</p>
          <button id="searchAgain" class="search-again-btn">Search Again</button>
        </div>
      `;
      
      document.getElementById("searchAgain").onclick = () => {
        document.getElementById("usernameInput").value = '';
        resultDiv.innerHTML = '';
      };
    });
  };
};

document.getElementById("usernameInput").addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    document.getElementById("searchBtn").click();
  }
});

