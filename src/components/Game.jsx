import React, { useState, useEffect } from 'react';
import GameField from './GameField/GameField';
import PhaseControl from './PhaseControl/PhaseControl'; // PhaseControlをインポート
import BattleResult from './BattleResult/BattleResult'; // バトル結果コンポーネントをインポート
import './Game.css';

const Game = ({ socket, playerId, gameState: externalGameState, players, roomId }) => {
  const [gameState, setGameState] = useState(externalGameState || {
    currentPhase: 'WAITING',
    players: {},
    currentPlayer: null
  });
  
  // バトル結果表示用の状態
  const [battleResult, setBattleResult] = useState(null);
  const [showBattleResult, setShowBattleResult] = useState(false);
  useEffect(() => {
    if (externalGameState) {
      setGameState(externalGameState);
    }
  }, [externalGameState]);
  
  // ソケットイベントのエラーハンドリング
  useEffect(() => {
    if (!socket) return;
    
    // エラーハンドリング関数
    const handleSocketError = (error) => {
      console.error('Socket error:', error);
    };
    
    socket.on('connect_error', handleSocketError);
    socket.on('connect_timeout', handleSocketError);
      // ゲーム状態更新のハンドリング
    socket.on('gameStateUpdate', ({ gameState }) => {
      console.log('Received gameStateUpdate:', gameState);
      if (gameState) {
        setGameState(gameState);
      }
    });
    
    // カード選択イベントのハンドリング
    socket.on('cardSelected', ({ playerId, cardId }) => {
      console.log('Card selected by player:', playerId, 'card:', cardId);
    });
      // 戦闘解決イベントのハンドリング
    socket.on('battleResolved', (battleData) => {
      console.log('Battle resolved:', battleData);
      
      // UIにバトル結果を表示する - コンポーネントを使用
      setBattleResult(battleData);
      setShowBattleResult(true);
    });
      // ユニット破壊イベントのハンドリング
    socket.on('unitDestroyed', ({ unit, playerId: destroyedPlayerId }) => {
      console.log('Unit destroyed:', unit, 'owned by:', destroyedPlayerId);
      
      // UIに破壊されたユニットを表示 - 通知のみ（バトル結果は別で表示）
      const isMyUnit = destroyedPlayerId === playerId;
      // 通知をログに記録
      console.log(`${isMyUnit ? 'あなた' : '相手'}のユニット ${unit.name} が破壊されました！`);
    });
    
    // プレイヤー攻撃結果イベントのハンドリング
    socket.on('attackResolved', (attackData) => {
      console.log('Attack resolved:', attackData);
      
      // UIにプレイヤー攻撃結果を表示する
      setBattleResult(attackData);
      setShowBattleResult(true);
    });
    
    return () => {
      socket.off('connect_error', handleSocketError);
      socket.off('connect_timeout', handleSocketError);
      socket.off('gameStateUpdate');
      socket.off('cardSelected');
      socket.off('battleResolved');
      socket.off('unitDestroyed');
    };
  }, [socket]);const getRoomId = () => {
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
  };  const handleAttack = (attacker, target) => {
    if (socket) {
      console.log('Attack request:', { attacker, target, roomId: getRoomId() });
      
      // typeプロパティを設定（サーバー側の条件と合わせる）
      const targetWithType = {
        ...target,
        type: 'UNIT' // ユニットへの攻撃として設定
      };
      
      socket.emit('gameAction', {
        roomId: getRoomId(),
        action: 'attack',
        data: { attacker, target: targetWithType }
      });
      
      // デバッグ用：攻撃アクションを送信したことをコンソールに出力
      console.log(`攻撃アクション送信: ${attacker.name} → ${target.name}`);
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
      
      {/* バトル結果表示 */}
      <BattleResult 
        battleData={battleResult} 
        visible={showBattleResult}
        onClose={() => setShowBattleResult(false)} 
      />{/* GameFieldコンポーネントが存在し、必要なpropsがあるときのみレンダリング */}
      {GameField && gameState && (
        <GameField
          gameState={gameState}
          socket={socket}
          playerId={playerId || ''}
          onCardPlay={handleCardPlay}
          onAttack={handleAttack}
          currentPhase={gameState?.currentPhase || 'WAITING'} 
          currentPlayer={gameState?.currentPlayer || ''}
        />
      )}{/* デバッグログ */}
      {console.log('Game passing props:', {
        playerId,
        currentPlayer: gameState?.currentPlayer,
        currentPhase: gameState?.currentPhase,
        isMyTurn
      })}
      
      {/* フェーズコントロールコンポーネントを追加 */}
      {isMyTurn && (
        <PhaseControl 
          currentPhase={gameState?.currentPhase} 
          onPhaseChange={handlePhaseChange} 
          onEndTurn={handleEndTurn}
        />
      )}
      
      {/* 
      // フェーズコントロールはPhaseControlコンポーネントで一元管理するためコメントアウト
      <PhaseControl
        gameState={gameState}
        onPhaseChange={handlePhaseChange}
        onEndTurn={handleEndTurn}
        isMyTurn={isMyTurn}
      />
      */}
    </div>
  );
};

export default Game;
