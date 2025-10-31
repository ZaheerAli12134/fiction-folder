import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/api/config/firebase', (req, res) => {
  res.json({
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  });
});

app.get('/api/films', async (req, res) => {
  const searchTerm = req.query.search;
  
  if (!searchTerm) {
    return res.json({ Response: "False", Search: [] });
  }

  if (!process.env.OMDB_API_KEY) {
    return res.status(500).json({ 
      Response: "False",
      Error: "API key fail" 
    });
  }

  try {
    const url = `https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&s=${encodeURIComponent(searchTerm)}&type=movie`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      Response: "False",
      Error: 'Film fail' 
    });
  }
});

app.get('/api/films/:imdbId', async (req, res) => {
  const { imdbId } = req.params;
  
  if (!process.env.OMDB_API_KEY) {
    return res.status(500).json({ 
      Response: "False",
      Error: "api fail" 
    });
  }

  try {
    const url = `https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&i=${imdbId}&plot=full`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      Response: "False",
      Error: 'Failed to fetch film ' 
    });
  }
});

app.use((err, req, res, next) => {
  res.status(500).json({ 
    error: 'Something went wrong!'
  });
});

app.listen(PORT, () => {
  console.log(`Server running  ${PORT}`);
});