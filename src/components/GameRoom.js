import React from 'react';
import './GameRoom.css';
import Card from './Card';

function GameRoom({ hand, playerId, currentPlayer, players, playCard }) {
  const isMyTurn = currentPlayer === playerId;
  
  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player ? player.username : 'Unknown Player';
  };
  
  return (
    <div className="game-room">
      <div className="game-info">
        <h2>ゲーム進行中</h2>
        <div className="turn-indicator">
          現在のプレイヤー: {getPlayerName(currentPlayer)}
          {isMyTurn && <span className="your-turn"> (あなたのターン!)</span>}
        </div>
      </div>
      
      <div className="opponents">
        {players.filter(player => player.id !== playerId).map(player => (
          <div key={player.id} className="opponent">
            <div className="player-info">
              <h3>{player.username}</h3>
              <div className="card-count">カード: {player.hand ? player.hand.length : 0}枚</div>
            </div>
            <div className="opponent-cards">
              {Array(player.hand ? player.hand.length : 0).fill(0).map((_, i) => (
                <div key={i} className="card card-back"></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="player-hand">
        <h3>あなたの手札</h3>
        <div className="cards">
          {hand.map((card, index) => (
            <Card
              key={index}
              card={card}
              onClick={() => isMyTurn ? playCard(index) : null}
              disabled={!isMyTurn}
            />
          ))}
        </div>
      </div>
      
      {isMyTurn && (
        <div className="turn-instructions">
          カードをクリックしてプレイしてください
        </div>
      )}
    </div>
  );
}

export default GameRoom;
