import React, { useState, useEffect } from 'react';
import GameField from './GameField/GameField';
import './Game.css';

const Game = ({ socket, playerId, gameState: externalGameState, players, roomId }) => {
  const [gameState, setGameState] = useState(externalGameState || {
    currentPhase: 'WAITING',
    players: {},
    currentPlayer: null
  });

  useEffect(() => {
    if (externalGameState) {
      setGameState(externalGameState);
    }
  }, [externalGameState]);  const getRoomId = () => {
    // App.jsから受け取ったroomIdを使用
    console.log('Using roomId:', roomId);
    return roomId || '';
  };

  const handleCardPlay = (card, zone) => {
    if (socket) {
      socket.emit('gameAction', {
        roomId: getRoomId(),
        action: 'playCard',
        data: { card, zone }
      });
    }
  };

  const handlePhaseChange = (newPhase) => {
    if (socket) {
      console.log('Emitting phase change:', newPhase);
      socket.emit('gameAction', {
        roomId: getRoomId(),
        action: 'changePhase',
        data: { phase: newPhase }
      });
    }
  };

  const handleEndTurn = () => {
    if (socket) {
      console.log('Emitting end turn');
      socket.emit('gameAction', {
        roomId: getRoomId(),
        action: 'endTurn'
      });
    }
  };

  const handleAttack = (attacker, target) => {
    if (socket) {
      socket.emit('gameAction', {
        roomId: getRoomId(),
        action: 'attack',
        data: { attacker, target }
      });
    }
  };
  // 自分のプレイヤーIDを識別する処理
  const isMyTurn = gameState?.currentPlayer === playerId;

  return (
    <div className="game">
      <div className="game-header">
        <h2>カードバトル</h2>
        <div className="phase-indicator">
          フェーズ: {gameState?.currentPhase || 'WAITING'}
          {isMyTurn && <span className="your-turn"> (あなたのターン)</span>}
          {!isMyTurn && <span className="opponent-turn"> (相手のターン)</span>}
        </div>
      </div>
      <GameField
        gameState={gameState}
        socket={socket}
        playerId={playerId}
        onCardPlay={handleCardPlay}
        onAttack={handleAttack}
      />      <div className="game-controls">
        {isMyTurn && (
          <>
            <button
              onClick={() => handlePhaseChange('DRAW')}
              disabled={gameState?.currentPhase !== 'START'}
              className={`phase-button ${gameState?.currentPhase === 'START' ? 'next-phase' : ''}`}
            >
              ドローフェーズ
            </button>
            <button
              onClick={() => handlePhaseChange('MAIN')}
              disabled={gameState?.currentPhase !== 'DRAW'}
              className={`phase-button ${gameState?.currentPhase === 'DRAW' ? 'next-phase' : ''}`}
            >
              メインフェーズ
            </button>
            <button
              onClick={() => handlePhaseChange('BATTLE')}
              disabled={gameState?.currentPhase !== 'MAIN'}
              className={`phase-button ${gameState?.currentPhase === 'MAIN' ? 'next-phase' : ''}`}
            >
              バトルフェーズ
            </button>
            <button
              onClick={() => handlePhaseChange('END')}
              disabled={gameState?.currentPhase !== 'BATTLE'}
              className={`phase-button ${gameState?.currentPhase === 'BATTLE' ? 'next-phase' : ''}`}
            >
              エンドフェーズ
            </button>
            <button
              onClick={handleEndTurn}
              disabled={gameState?.currentPhase !== 'END'}
              className={`end-turn-button ${gameState?.currentPhase === 'END' ? 'active' : ''}`}
            >
              ターン終了
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Game;
