import React from 'react';
import { motion } from 'framer-motion';
import './CardDetails.css';
import { KEYWORDS } from '../../data/cards';

const CardDetails = ({ card, onClose }) => {
  const renderEffects = () => {
    return card.effects.map((effect, index) => {
      if (effect.type === 'KEYWORD') {
        return (
          <div key={index} className="keyword-effect">
            {KEYWORDS[effect.name]}
          </div>
        );
      }
      
      const effectText = `${effect.type === 'ON_PLAY' ? '場に出た時' : 
        effect.type === 'ON_ATTACK' ? '攻撃時' :
        effect.type === 'ON_DESTROYED' ? '破壊された時' :
        effect.type === 'CONTINUOUS' ? '継続効果' : ''}: `;

      return (
        <div key={index} className="effect">
          {effectText}
          {effect.action} ({effect.value})
        </div>
      );
    });
  };

  return (
    <motion.div
      className="card-details-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="card-details"
        initial={{ scale: 0.8, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.8, y: 50 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="card-details-header">
          <h3>{card.name}</h3>
          <div className="card-cost">{card.cost}</div>
        </div>
        
        <div className="card-image-large">
          <img src={card.illust_url} alt={card.name} />
        </div>
        
        {card.type === 'UNIT' && (
          <div className="card-stats-large">
            <span className="attack">攻撃力: {card.attack}</span>
            <span className="health">体力: {card.health}</span>
          </div>
        )}
        
        <div className="card-description">
          {card.description}
        </div>
        
        <div className="card-effects-list">
          {renderEffects()}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CardDetails;
