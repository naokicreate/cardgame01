import React from 'react';
import Card from '../Card/Card';
import './GameField.css';

import { PHASES } from '../../context/GameContext';

const GameField = ({ socket, gameState, playerId, onCardPlay, onAttack }) => {
  // IDベースのプレイヤー構造を従来のplayer1/player2形式に変換
  const getFormattedGameState = () => {
    const defaultState = {
      players: {
        player1: { hand: [], field: [], deck: [], lifePoints: 8000, cores: 0 },
        player2: { hand: [], field: [], deck: [], lifePoints: 8000, cores: 0 }
      },
      currentPlayer: null,
      currentPhase: PHASES.START,
      selectedCard: null
    };

    // ゲーム状態がない場合はデフォルト状態を返す
    if (!gameState || !gameState.players) {
      console.log('Game state or players is undefined, using default state');
      return defaultState;
    }

    // プレイヤーIDを取得
    const playerIds = Object.keys(gameState.players);
    if (playerIds.length < 2) {
      console.log('Not enough players in game state, using default state', playerIds);
      return defaultState;
    }

    // 自分と相手を識別
    const myIndex = playerIds.indexOf(playerId);
    if (myIndex === -1) {
      console.log('Player ID not found in game state, using default state', playerId, playerIds);
      return defaultState;
    }
    
    const myPlayerId = playerIds[myIndex];
    const opponentPlayerId = playerIds[myIndex === 0 ? 1 : 0];

    // プレイヤーのデータが存在するか確認
    if (!gameState.players[myPlayerId] || !gameState.players[opponentPlayerId]) {
      console.log('Player data is missing, using default state');
      return defaultState;
    }

    // フォーマット済みの状態を作成（null/undefinedチェックを追加）
    const myPlayer = gameState.players[myPlayerId] || {};
    const opponentPlayer = gameState.players[opponentPlayerId] || {};

    return {
      ...gameState,
      players: {
        player1: {
          ...myPlayer,
          hand: myPlayer.hand || [],
          field: myPlayer.unitZone || [],
          deck: myPlayer.deck || [],
          lifePoints: myPlayer.lp !== undefined ? myPlayer.lp : 8000,
          cores: myPlayer.core !== undefined ? myPlayer.core : 0,
          trapCard: myPlayer.trapZone && myPlayer.trapZone[0] ? myPlayer.trapZone[0] : null,
          resourceCard: myPlayer.resourceZone && myPlayer.resourceZone[0] ? myPlayer.resourceZone[0] : null
        },
        player2: {
          ...opponentPlayer,
          hand: opponentPlayer.hand || [],
          field: opponentPlayer.unitZone || [],
          deck: opponentPlayer.deck || [],
          lifePoints: opponentPlayer.lp !== undefined ? opponentPlayer.lp : 8000,
          cores: opponentPlayer.core !== undefined ? opponentPlayer.core : 0,
          trapCard: opponentPlayer.trapZone && opponentPlayer.trapZone[0] ? opponentPlayer.trapZone[0] : null,
          resourceCard: opponentPlayer.resourceZone && opponentPlayer.resourceZone[0] ? opponentPlayer.resourceZone[0] : null
        }
      }
    };
  };

  const formattedGameState = getFormattedGameState();
  const { players, currentPlayer, currentPhase, selectedCard } = formattedGameState;
  
  // 安全なプレイヤーデータへのアクセスを保証するヘルパー関数
  const getPlayerDataSafely = (playerKey) => {
    return players && players[playerKey] ? players[playerKey] : {
      hand: [],
      field: [],
      deck: [],
      lifePoints: 8000,
      cores: 0,
      trapCard: null,
      resourceCard: null
    };
  };
  
  const renderCards = (cards = [], zone, player) => {
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
            <div className="life-points">LP: {getPlayerDataSafely('player2').lifePoints}</div>
            <div className="cores">コア: {getPlayerDataSafely('player2').cores}</div>
          </div>
        </div>

        <div className="field-zones">
          <div className="zone deck-zone">
            <div className="deck-count">{getPlayerDataSafely('player2').deck.length || 0}枚</div>
          </div>
          
          <div className="zone resource-zone">
            {getPlayerDataSafely('player2').resourceCard && (
              <Card 
                card={getPlayerDataSafely('player2').resourceCard}
                onClick={() => handleCardClick(getPlayerDataSafely('player2').resourceCard, 'resource', 'player2')}
              />
            )}
          </div>

          <div className="zone trap-zone">
            {getPlayerDataSafely('player2').trapCard && (
              <div className="trap-card-back" />
            )}
          </div>

          <div className="zone monster-zone">
            {renderCards(getPlayerDataSafely('player2').field, 'field', 'player2')}
          </div>
        </div>

        <div className="hand-zone">
          {renderCards(getPlayerDataSafely('player2').hand, 'hand', 'player2')}
        </div>
      </div>
      
      <div className="middle-field">
        <div className="player-info">
          <span>LP: {getPlayerDataSafely('player2').lifePoints}</span>
          <span>コア: {getPlayerDataSafely('player2').cores}</span>
        </div>
        <div className="player-info">
          <span>LP: {getPlayerDataSafely('player1').lifePoints}</span>
          <span>コア: {getPlayerDataSafely('player1').cores}</span>
        </div>
      </div>
      
      <div className="field-separator">
        <div className="current-phase">
          {currentPhase} - {currentPlayer === playerId ? 'あなたのターン' : '相手のターン'}
        </div>
      </div>

      <div className="player-area">
        <div className="field-zones">
          <div className="zone monster-zone">
            {renderCards(getPlayerDataSafely('player1').field, 'field', 'player1')}
          </div>

          <div className="zone trap-zone">
            {getPlayerDataSafely('player1').trapCard && (
              <div className="trap-card-back" />
            )}
          </div>

          <div className="zone resource-zone">
            {getPlayerDataSafely('player1').resourceCard && (
              <Card 
                card={getPlayerDataSafely('player1').resourceCard}
                onClick={() => handleCardClick(getPlayerDataSafely('player1').resourceCard, 'resource', 'player1')}
              />
            )}
          </div>

          <div className="zone deck-zone">
            <div className="deck-count">{getPlayerDataSafely('player1').deck.length || 0}枚</div>
          </div>
        </div>

        <div className="hand-zone">
          {renderCards(getPlayerDataSafely('player1').hand, 'hand', 'player1')}
        </div>

        <div className="player-stats">
          <div className="player-info">
            <div className="life-points">LP: {getPlayerDataSafely('player1').lifePoints}</div>
            <div className="cores">コア: {getPlayerDataSafely('player1').cores}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameField;
