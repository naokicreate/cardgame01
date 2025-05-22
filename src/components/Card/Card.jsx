import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KEYWORDS } from '../../data/cards';
import './Card.css';

const Card = ({ 
  card, 
  onClick, 
  onAttack, 
  isPlayable, 
  isOpponent = false, 
  inHand = false,
  className = '' 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // cardがnullまたはundefinedの場合は空のdivを返す
  if (!card) {
    return <div className="card-placeholder"></div>;
  }

  // 相手の手札の場合は裏向きのカードを表示
  if (isOpponent && inHand) {
    return (
      <div className="card card-back">
        <div className="card-back-design"></div>
      </div>
    );
  }

  // card.typeがない場合のフォールバックオブジェクト
  const safeCard = {
    name: card.name || 'カード',
    type: card.type || 'UNIT',
    cost: card.cost !== undefined ? card.cost : 0,
    attack: card.attack !== undefined ? card.attack : 0,
    health: card.health !== undefined ? card.health : 0,
    illust_url: card.illust_url || '',
    description: card.description || '',
    effects: card.effects || [],
    hasAttacked: card.hasAttacked || false,
    ...card  // 元のカードデータで上書き
  };

  const handleClick = (e) => {
    e.preventDefault();
    if (onClick) {
      onClick();
    }
  };

  const handleAttack = (e) => {
    e.preventDefault();
    if (safeCard.type === 'UNIT' && onAttack) {
      onAttack();
    }
  };

  // フィールド上のカードは常に正面（プレイヤー側）を向くように
  const cardClass = `card ${safeCard.type.toLowerCase()} 
    ${isPlayable ? 'playable' : ''} 
    ${className} 
    ${isOpponent ? 'opponent-card' : ''}`;

  return (
    <div 
      className={cardClass}
      onClick={handleClick}
      onContextMenu={handleAttack}
    >
      <div className="card-header">
        <span className="card-name">{safeCard.name}</span>
        <span className="card-cost">{safeCard.cost}</span>
      </div>
      
      <div className="card-image">
        {safeCard.illust_url && <img src={safeCard.illust_url} alt={safeCard.name} style={{width: '100%', height: '100%', objectFit: 'cover'}} />}
      </div>
      
      {safeCard.type === 'UNIT' && (
        <div className="card-stats">
          <span className="attack">⚔️ {safeCard.attack}</span>
          <span className="health">❤️ {safeCard.health}</span>
        </div>
      )}
      
      <div className="card-text">
        {safeCard.description}
      </div>
      
      <div className="card-effects">
        {safeCard.effects.map((effect, index) => {
          if (!effect || !effect.type) return null;
          
          if (effect.type === 'KEYWORD') {
            return (
              <span key={index} className="effect-badge keyword">
                {KEYWORDS[effect.name] || effect.name}
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
               effect.action || ''}
            </span>
          );
        })}
      </div>
    </div>  
  );
};

export default Card;
