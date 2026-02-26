import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/themes.css'
import App from './App.tsx'
import { useUserStore } from './store/useUserStore'

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUserStore();
  
  useEffect(() => {
    // Appliquer le thème au chargement et à chaque changement
    document.documentElement.setAttribute('data-theme', user.theme);
  }, [user.theme]);
  
  return <>{children}</>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
