import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './firebase'
import { SocialProvider } from './context/SocialContext'
import { db, auth } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'

const Root = () => {
  const [userId, setUserId] = useState<string>(localStorage.getItem('multi_battle_userid') || '');
  const [username, setUsername] = useState<string>(localStorage.getItem('multi_battle_username') || 'Operator');

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        localStorage.setItem('multi_battle_userid', user.uid);

        // Fetch username
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const name = docSnap.data().displayName || 'Operator';
          setUsername(name);
          localStorage.setItem('multi_battle_username', name);
        }
      } else {
        setUserId('');
        setUsername('Operator');
      }
    });
  }, []);

  return (
    <StrictMode>
      <SocialProvider currentUserId={userId} currentUsername={username}>
        <App />
      </SocialProvider>
    </StrictMode>
  );
};

createRoot(document.getElementById('root')!).render(<Root />)
