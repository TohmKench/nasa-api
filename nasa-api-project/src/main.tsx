import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from './nasaHomePage'
import LoginPage from './LoginPage'
import MyFavourites from './MyFavourites';
import MarsRoverPage from './MarsRoverPage';
import AsteroidWatchPage from './AsteroidWatchPage';
import IssGlobePage from './IssGlobePage';

import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:4000/', // Your Apollo Server URL
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
    },
    query: {
      errorPolicy: 'all',
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/favourites" element={<MyFavourites />} />
          <Route path="/mars-rover" element={<MarsRoverPage />} />
          <Route path="/asteroid-watch" element={<AsteroidWatchPage />} />
        </Routes>
      </BrowserRouter>
    </ApolloProvider>
  </React.StrictMode>,
)
