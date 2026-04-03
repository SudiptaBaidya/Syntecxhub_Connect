import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCp2QURNnWzJazK6yyAUWot_hmslXVF8cM",
  authDomain: "connect-dffeb.firebaseapp.com",
  projectId: "connect-dffeb",
  storageBucket: "connect-dffeb.firebasestorage.app",
  messagingSenderId: "603451604534",
  appId: "1:603451604534:web:2891e216caafe727a0a297",
  measurementId: "G-MMCM538MJX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export { auth, provider, signInWithPopup };
