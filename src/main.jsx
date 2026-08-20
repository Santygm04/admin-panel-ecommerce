import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './components/ui/ui.css';
import 'react-toastify/dist/ReactToastify.css';
import App from './App.jsx';
import { ThemeProvider } from './theme/ThemeContext';
import { ToastContainer } from 'react-toastify';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
    <ToastContainer
      position="top-right"
      autoClose={8000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick={false}
      closeButton
      draggable={false}
      pauseOnFocusLoss
      pauseOnHover
      theme="dark"
    />
  </StrictMode>
);
