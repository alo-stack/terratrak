// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase, Database } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB7fkCB8iptAn8WoVShtzQkrc5_mNT00PE",
  authDomain: "esp-project-8ff39.firebaseapp.com",
  databaseURL: "https://esp-project-8ff39-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "esp-project-8ff39",
  storageBucket: "esp-project-8ff39.firebasestorage.app",
  messagingSenderId: "1027460221683",
  appId: "1:1027460221683:web:29a06b24b859240c334586"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export {db};