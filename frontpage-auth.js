import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getFirebaseConfig } from './config.js';

let auth, db;

async function initialize() {
  const firebaseConfig = await getFirebaseConfig();
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  setupAuthUI();

}

async function logoutUser() {
  try {
    await signOut(auth);
    window.location.href = 'loginPage.html';
  } catch {
    alert('Error signing out. Please try again.');
  }
}

function setupAuthUI() {
  const profileDropdown = document.getElementById('profileDropdown');
  const dropdownContent = document.getElementById('dropdownContent');
  const usernameDisplay = document.getElementById('usernameDisplay');
  const logoutBtn = document.getElementById('logoutBtn');

  if (profileDropdown && dropdownContent) {
    profileDropdown.addEventListener('click', e => {
      e.stopPropagation();
      dropdownContent.classList.toggle('show');
    });

    document.addEventListener('click', () => dropdownContent.classList.remove('show'));
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', e => {
      e.preventDefault();
      logoutUser();
    });
  }

  onAuthStateChanged(auth, async user => {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (usernameDisplay) usernameDisplay.textContent = userData.username || user.email;
      } else {
        if (usernameDisplay) usernameDisplay.textContent = user.email;
      }
    } else {
      if (usernameDisplay) usernameDisplay.textContent = 'Guest';
      if (
        !window.location.href.includes('loginPage.html') &&
        !window.location.href.includes('signup.html')
      ) {
        window.location.href = 'loginPage.html';
      }
    }
  });
}

initialize().then(() => {
  console.log("hiu");
  import("./friend-recommendations.js");
});


export { auth, db };


