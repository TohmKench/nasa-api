import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from './nasaHomePage'
import LoginPage from './LoginPage'
import MyFavourites from './MyFavourites';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/favourites" element={<MyFavourites />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
