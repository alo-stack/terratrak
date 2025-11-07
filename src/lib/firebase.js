import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAbGnz-lsTwWFRbcNeYOX_Z5eb2XGcm7xk",
  authDomain: "terratrak-f252a.firebaseapp.com",
  projectId: "terratrak-f252a",
  storageBucket: "terratrak-f252a.firebasestorage.app",
  messagingSenderId: "675405963427",
  appId: "1:675405963427:web:cd0568bfb02abc167c1f16"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);