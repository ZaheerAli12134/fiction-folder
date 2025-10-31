import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot, doc, getDoc, getDocs
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getFirebaseConfig } from "./config.js";

const config = await getFirebaseConfig();
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let unsubscribeMessages = null;
let selectedFriendUid = null;

function getConversationId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

async function sendMessage(toUid, text) {
  if (!currentUser || !toUid || !text.trim()) return;
  const conversationId = getConversationId(currentUser.uid, toUid);
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  await addDoc(messagesRef, {
    from: currentUser.uid,
    to: toUid,
    text: text.trim(),
    createdAt: serverTimestamp(),
    expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });
  document.getElementById("msgInput").value = "";
}

async function loadMessages(toUid, friendName) {
  if (unsubscribeMessages) unsubscribeMessages();
  const conversationId = getConversationId(currentUser.uid, toUid);
  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const msgQuery = query(messagesRef, orderBy("createdAt", "asc"));
  unsubscribeMessages = onSnapshot(msgQuery, async snapshot => {
    const container = document.getElementById("messages");
    container.innerHTML = "";
    for (const docSnap of snapshot.docs) {
      const msg = docSnap.data();
      let senderName = "Unknown";
      if (msg.from) {
        try {
          const senderDoc = await getDoc(doc(db, "users", msg.from));
          if (senderDoc.exists()) senderName = senderDoc.data().username || msg.from;
          else senderName = msg.from === currentUser.uid ? "You" : friendName;
        } catch {
          senderName = msg.from === currentUser.uid ? "You" : friendName;
        }
      }
      const messageDiv = document.createElement("div");
      messageDiv.className = `message ${msg.from === currentUser.uid ? "own-message" : ""}`;
      const timestamp = msg.createdAt ? new Date(msg.createdAt.toDate()).toLocaleTimeString() : "Sending...";
      messageDiv.innerHTML = `
        <strong>${senderName}</strong>
        ${msg.text}
        <small>${timestamp}</small>
      `;
      container.appendChild(messageDiv);
    }
    container.scrollTop = container.scrollHeight;
  });
}

async function loadFriends(userId) {
  const friendsRef = collection(db, "users", userId, "friends");
  const snapshot = await getDocs(friendsRef);
  const friendsList = document.getElementById("friendsList");
  friendsList.innerHTML = "";
  for (const docSnap of snapshot.docs) {
    const friendData = docSnap.data();
    if (friendData.uid && friendData.username) {
      const friendItem = document.createElement("div");
      friendItem.className = "friend-item";
      friendItem.setAttribute("data-uid", friendData.uid);
      friendItem.setAttribute("data-username", friendData.username);
      friendItem.innerHTML = `
        <span class="friend-name">${friendData.username}</span>
        <span class="friend-preview">Click to open conversation</span>
      `;
      friendItem.addEventListener("click", () => {
        selectFriend(friendData.uid, friendData.username);
      });
      friendsList.appendChild(friendItem);
    }
  }
}

function selectFriend(uid, username) {
  selectedFriendUid = uid;
  document.querySelectorAll(".friend-item").forEach(item => {
    item.classList.remove("active");
    if (item.getAttribute("data-uid") === uid) item.classList.add("active");
  });
  document.getElementById("messagesContainer").style.display = "flex";
  document.getElementById("emptyChat").style.display = "none";
  document.getElementById("friendName").textContent = username;
  loadMessages(uid, username);
}

onAuthStateChanged(auth, async user => {
  const usernameDisplay = document.getElementById("usernameDisplay");
  const app = document.getElementById("app");
  const loginPrompt = document.getElementById("loginPrompt");
  if (user) {
    currentUser = user;
    const displayName = user.displayName || user.email;
    usernameDisplay.textContent = displayName;
    app.style.display = "flex";
    loginPrompt.style.display = "none";
    await loadFriends(user.uid);
    setupEventListeners();
  } else {
    currentUser = null;
    usernameDisplay.textContent = "Not logged in";
    app.style.display = "none";
    loginPrompt.style.display = "block";
    if (unsubscribeMessages) {
      unsubscribeMessages();
      unsubscribeMessages = null;
    }
  }
});

function setupEventListeners() {
  document.getElementById("sendBtn").onclick = () => {
    const text = document.getElementById("msgInput").value.trim();
    if (selectedFriendUid && text) sendMessage(selectedFriendUid, text);
  };
  document.getElementById("msgInput").addEventListener("keypress", e => {
    if (e.key === "Enter") {
      const text = document.getElementById("msgInput").value.trim();
      if (selectedFriendUid && text) sendMessage(selectedFriendUid, text);
    }
  });
}

