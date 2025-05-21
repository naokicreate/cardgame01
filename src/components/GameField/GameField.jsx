import React from 'react';
import Card from '../Card/Card';
import './GameField.css';

import { PHASES } from '../../context/GameContext';

const GameField = ({ socket, gameState, playerId, onCardPlay, onAttack }) => {
  const { players, currentPlayer, currentPhase, selectedCard } = gameState || {
    players: {
      player1: { hand: [], field: [], deck: [], lifePoints: 0, cores: 0 },
      player2: { hand: [], field: [], deck: [], lifePoints: 0, cores: 0 }
    },
    currentPlayer: null,
    currentPhase: PHASES.START,
    selectedCard: null
  };  const renderCards = (cards = [], zone, player) => {
    return (cards || []).map((card, index) => (
      <Card
        key={`${player}-${zone}-${index}`}
        card={card}
        onClick={() => handleCardClick(card, zone, player)}
        isPlayable={currentPlayer === playerId && currentPhase === PHASES.MAIN}
      />
    ));
  };
  
  const handleCardClick = (card, zone, player) => {
    if (player === currentPlayer && currentPhase === PHASES.MAIN) {
      onCardPlay(card, zone);
    } else if (currentPhase === PHASES.BATTLE && player === currentPlayer) {
      // カードを選択
      socket?.emit('gameAction', { 
        action: 'selectCard', 
        data: { card } 
      });
    } else if (currentPhase === PHASES.BATTLE && selectedCard && player !== currentPlayer) {
      // 攻撃実行
      onAttack(selectedCard, card);
    }
  };
  return (
    <div className="game-field">
      <div className="opponent-area">
        <div className="player-stats">
          <div className="player-info">
            <div className="life-points">LP: {players.player2.lifePoints}</div>
            <div className="cores">コア: {players.player2.cores}</div>
          </div>
        </div>

        <div className="field-zones">
          <div className="zone deck-zone">
            <div className="deck-count">{players.player2.deck.length}枚</div>
          </div>
          
          <div className="zone resource-zone">
            {players.player2.resourceCard && (
              <Card 
                card={players.player2.resourceCard}
                onClick={() => handleCardClick(players.player2.resourceCard, 'resource', 'player2')}
              />
            )}
          </div>

          <div className="zone trap-zone">
            {players.player2.trapCard && (
              <div className="trap-card-back" />
            )}
          </div>

          <div className="zone monster-zone">
            {renderCards(players.player2.field, 'field', 'player2')}
          </div>
        </div>

        <div className="hand-zone">
          {renderCards(players.player2.hand, 'hand', 'player2')}
        </div>
      </div>
      
      <div className="middle-field">
        <div className="player-info">
          <span>LP: {players.player2?.lifePoints || 8000}</span>
          <span>コア: {players.player2?.cores || 0}</span>
        </div>
        <div className="player-info">
          <span>LP: {players.player1?.lifePoints || 8000}</span>
          <span>コア: {players.player1?.cores || 0}</span>
        </div>
      </div>      <div className="field-separator">
        <div className="current-phase">
          {currentPhase} - {currentPlayer === playerId ? 'あなたのターン' : '相手のターン'}
        </div>
      </div>

      <div className="player-area">
        <div className="field-zones">
          <div className="zone monster-zone">
            {renderCards(players.player1.field, 'field', 'player1')}
          </div>

          <div className="zone trap-zone">
            {players.player1.trapCard && (
              <div className="trap-card-back" />
            )}
          </div>

          <div className="zone resource-zone">
            {players.player1.resourceCard && (
              <Card 
                card={players.player1.resourceCard}
                onClick={() => handleCardClick(players.player1.resourceCard, 'resource', 'player1')}
              />
            )}
          </div>

          <div className="zone deck-zone">
            <div className="deck-count">{players.player1.deck.length}枚</div>
          </div>
        </div>

        <div className="hand-zone">
          {renderCards(players.player1.hand, 'hand', 'player1')}
        </div>

        <div className="player-stats">
          <div className="player-info">
            <div className="life-points">LP: {players.player1.lifePoints}</div>
            <div className="cores">コア: {players.player1.cores}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameField;
