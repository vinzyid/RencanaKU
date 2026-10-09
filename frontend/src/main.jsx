import './app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from './react/app/AppProviders.jsx';
import App from './react/app/App.jsx';

const container = document.getElementById('app');

createRoot(container).render(
    <StrictMode>
        <BrowserRouter>
            <AppProviders>
                <App />
            </AppProviders>
        </BrowserRouter>
    </StrictMode>,
);
