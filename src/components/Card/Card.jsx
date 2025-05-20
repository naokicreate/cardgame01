import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './Card.css';

const Card = ({ card, onClick, onAttack, isPlayable }) => {
  const [showDetails, setShowDetails] = useState(false);
  const handleClick = (e) => {
    e.preventDefault();
    if (isPlayable) {
      onClick();
    }
  };

  const handleAttack = (e) => {
    e.preventDefault();
    if (isPlayable && card.type === 'UNIT' && !card.hasAttacked) {
      onAttack();
    }
  };

  return (
    <div 
      className={`card ${card.type.toLowerCase()} ${isPlayable ? 'playable' : ''}`}
      onClick={handleClick}
      onContextMenu={handleAttack}
    >
      <div className="card-header">
        <span className="card-name">{card.name}</span>
        <span className="card-cost">{card.cost}</span>
      </div>
      
      <div className="card-image">
        {/* カードイメージの表示部分 */}
      </div>
      
      <div className="card-stats">
        {card.type === 'UNIT' && (
          <>
            <span className="attack">{card.attack}</span>
            <span className="defense">{card.defense}</span>
          </>
        )}
      </div>
      
      <div className="card-text">
        {card.effect}
      </div>
      
      {card.hasEffect && (
        <div className="card-effects">
          {Object.entries(card.effects).map(([effect, value], index) => (
            <span key={index} className="effect-badge">
              {effect}: {value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default Card;
