const API_BASE_URL =
  window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : 'https://fiction-folder.onrender.com/api';

export async function getFirebaseConfig() {
  try {
    const response = await fetch(`${API_BASE_URL}/config/firebase`);
    if (!response.ok) throw new Error(`Fail: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch Firebase config:', error);
    alert('Failed to load Firebase config');
    throw error;
  }
}

export { API_BASE_URL };

