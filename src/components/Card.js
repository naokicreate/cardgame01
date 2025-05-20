import React from 'react';
import './Card.css';

function Card({ card, onClick, disabled }) {
  const { suit, value } = card;
  
  const getColor = () => {
    return suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
  };
  
  const getSuitSymbol = () => {
    switch (suit) {
      case 'hearts':
        return '♥';
      case 'diamonds':
        return '♦';
      case 'clubs':
        return '♣';
      case 'spades':
        return '♠';
      default:
        return '';
    }
  };
  
  return (
    <div 
      className={`card ${disabled ? 'disabled' : ''}`}
      onClick={disabled ? null : onClick}
    >
      <div className={`card-content ${getColor()}`}>
        <div className="card-corner top-left">
          <div className="card-value">{value}</div>
          <div className="card-suit">{getSuitSymbol()}</div>
        </div>
        
        <div className="card-center">
          {getSuitSymbol()}
        </div>
        
        <div className="card-corner bottom-right">
          <div className="card-value">{value}</div>
          <div className="card-suit">{getSuitSymbol()}</div>
        </div>
      </div>
    </div>
  );
}

export default Card;
