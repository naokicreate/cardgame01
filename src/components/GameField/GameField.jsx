import React from 'react';
import Card from '../Card/Card';
import './GameField.css';

const GameField = ({ gameState, onCardPlay, onAttack }) => {
  const { players, gameField, currentPlayer } = gameState;

  const renderZone = (zone, player) => {
    return (
      <div className={`zone ${zone}-zone`}>
        {gameField[player][zone].map((card, index) => (
          <Card
            key={`${player}-${zone}-${index}`}
            card={card}
            onClick={() => onCardPlay(card, zone)}
            onAttack={(target) => onAttack(card, target)}
            isPlayable={currentPlayer === player}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="game-field">
      <div className="player player-2">
        {renderZone('hand', 'player2')}
        <div className="battlefield">
          {renderZone('field', 'player2')}
        </div>
        <div className="resources">
          <div className="deck">{gameField.player2.deck.length}</div>
          <div className="graveyard">
            {gameField.player2.graveyard.length}
          </div>
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
      </div>

      <div className="player player-1">
        <div className="resources">
          <div className="deck">{gameField.player1.deck.length}</div>
          <div className="graveyard">
            {gameField.player1.graveyard.length}
          </div>
        </div>
        <div className="battlefield">
          {renderZone('field', 'player1')}
        </div>
        {renderZone('hand', 'player1')}
      </div>
    </div>
  );
};

export default GameField;
