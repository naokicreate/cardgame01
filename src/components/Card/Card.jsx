import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KEYWORDS } from '../../data/cards';
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
        <img src={card.illust_url} alt={card.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </div>
      
      {card.type === 'UNIT' && (
        <div className="card-stats">
          <span className="attack">⚔️ {card.attack}</span>
          <span className="health">❤️ {card.health}</span>
        </div>
      )}
      
      <div className="card-text">
        {card.description}
      </div>
        <div className="card-effects">
        {card.effects.map((effect, index) => {
          if (effect.type === 'KEYWORD') {
            return (
              <span key={index} className="effect-badge keyword">
                {KEYWORDS[effect.name]}
              </span>
            );
          }
          return (
            <span key={index} className="effect-badge">
              {effect.type === 'ON_PLAY' ? '⭐' : 
               effect.type === 'ON_ATTACK' ? '⚔️' :
               effect.type === 'ON_DESTROYED' ? '💔' :
               effect.type === 'CONTINUOUS' ? '🔄' : ''} 
              {effect.action === 'DRAW' ? `ドロー ${effect.value}` :
               effect.action === 'DAMAGE_UNIT' ? `${effect.value} ダメージ` :
               effect.action === 'HEAL_PLAYER' ? `${effect.value} 回復` :
               effect.action === 'BUFF_ATTACK' ? `攻撃力+${effect.value}` :
               effect.action === 'ADD_CORE' ? `${effect.value} コア獲得` :
               effect.action}
            </span>
          );
        })}
      </div>
    </div>
  );
};

export default Card;
