import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('Index.js is running');
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);