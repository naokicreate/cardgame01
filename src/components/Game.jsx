import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import GameField from './GameField/GameField';
import Card from './Card/Card';
import './Game.css';

const Game = () => {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({
    phase: 'WAITING',
    players: {},
    currentPlayer: null,
    gameField: {
      player1: {
        hand: [],
        field: [],
        deck: [],
        graveyard: []
      },
      player2: {
        hand: [],
        field: [],
        deck: [],
        graveyard: []
      }
    }
  });

  useEffect(() => {
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('gameState', (newGameState) => {
      setGameState(newGameState);
    });

    return () => newSocket.close();
  }, []);

  const handleCardPlay = (card, zone) => {
    socket.emit('playCard', { card, zone });
  };

  const handlePhaseChange = (newPhase) => {
    socket.emit('changePhase', { phase: newPhase });
  };

  const handleAttack = (attacker, target) => {
    socket.emit('attack', { attacker, target });
  };

  return (
    <div className="game">
      <div className="game-header">
        <h2>カードバトル</h2>
        <div className="phase-indicator">
          フェーズ: {gameState.phase}
        </div>
      </div>
      <GameField
        gameState={gameState}
        onCardPlay={handleCardPlay}
        onAttack={handleAttack}
      />
      <div className="game-controls">
        <button onClick={() => handlePhaseChange('次のフェーズ')}>
          次のフェーズへ
        </button>
      </div>
    </div>
  );
};

export default Game;
