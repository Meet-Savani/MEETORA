import React from 'react';
import './NotFound.scss';

const NotFound = () => {
  return (
    <div className="not-found-container">
      <div className="starfield">
        {/* decorative stars */}
        {[...Array(50)].map((_, i) => (
          <div key={i} className="star" style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`
          }} />
        ))}
      </div>
      <div className="message-box">
        <h1>404</h1>
        <p>Oops! The page you're looking for slipped into the void.</p>
        <a href="/" className="home-link">Take me back home</a>
      </div>
    </div>
  );
};

export default NotFound;
