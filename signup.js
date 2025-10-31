import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { getFirebaseConfig } from './config.js';

const config = await getFirebaseConfig();
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

document.getElementById('password').addEventListener('input', function() {
  const passw = this.value;
  const indicator = document.getElementById('passwordStrength');
  
  let strength = 'weak';
  if (passw.length >= 8) strength = 'medium';
  if (passw.length >= 8 && /[A-Z]/.test(passw) && /[0-9]/.test(passw)) strength = 'strong';
  
  indicator.textContent = `Password strength: ${strength}`;
  indicator.className = `password-strength strength-${strength}`;
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorMsg = document.getElementById('errorMessage');
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    await setDoc(doc(db, "users", userCredential.user.uid), {
      username,
      email,
      createdAt: new Date(),
      friendRequests: []
    });
    
    window.location.href = 'frontPage.html';
  } catch (error) {
    errorMsg.textContent = error.message;
    errorMsg.style.display = 'block';
  }
});