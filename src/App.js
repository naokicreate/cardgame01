import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import GameRoom from './components/GameRoom';
import Lobby from './components/Lobby';
import { GameProvider } from './context/GameContext';
import Game from './components/Game';

function App() {
  const [socket, setSocket] = useState(null);
  const [screen, setScreen] = useState('lobby');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [players, setPlayers] = useState([]);
  const [hand, setHand] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState('');
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // ソケット接続を初期化
    const newSocket = io('http://localhost:3001', {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });
    
    // 接続エラーハンドリング
    newSocket.on('connect_error', (err) => {
      console.error('接続エラー:', err);
      setError('サーバーに接続できません。サーバーが起動しているか確認してください。');
    });
    
    newSocket.on('connect', () => {
      console.log('サーバーに接続しました');
      setError(''); // エラーメッセージをクリア
    });
    
    setSocket(newSocket);    // イベントリスナーを設定
    newSocket.on('roomCreated', ({ roomId, playerId }) => {
      console.log('Room created event received:', { roomId, playerId });
      setRoomId(roomId);
      setPlayerId(playerId);
      setScreen('waitingRoom');
    });

    newSocket.on('roomJoined', ({ roomId, playerId }) => {
      console.log('Room joined event received:', { roomId, playerId });
      setRoomId(roomId);
      setPlayerId(playerId);
      setScreen('waitingRoom');
    });

    newSocket.on('playerJoined', ({ players }) => {
      console.log('Player joined event received:', players);
      setPlayers(players);
    });newSocket.on('readyToStart', ({ roomId }) => {
      console.log('Ready to start game event received for room:', roomId);
      setScreen('readyToStart');
    });newSocket.on('gameStart', ({ gameState, players }) => {
      console.log('Game start event received:', { gameState, players });
      setGameState(gameState);
      setPlayers(players);
      setScreen('gameRoom');
    });    newSocket.on('gameStateUpdate', ({ gameState }) => {
      console.log('Game state update received:', gameState);
      setGameState(gameState);
    });

    // 新しいイベントを追加
    newSocket.on('cardDrawn', ({ card }) => {
      console.log('Card drawn:', card);
      setHand(prevHand => [...prevHand, card]);
    });

    newSocket.on('cardPlayed', ({ playerId, card, zone, index, nextPlayer }) => {
      console.log(`${playerId} played ${card.name}`);
      setCurrentPlayer(nextPlayer);
    });

    newSocket.on('attackResolved', ({ attacker, target, damage, remainingLp }) => {
      console.log(`Attack: ${attacker.name} dealt ${damage} damage to player`, target);
    });

    newSocket.on('battleResolved', ({ attacker, target }) => {
      console.log(`Battle: ${attacker.name} vs ${target.name}`);
    });

    newSocket.on('unitDestroyed', ({ unit, playerId }) => {
      console.log(`Unit destroyed: ${unit.name} of player ${playerId}`);
    });

    newSocket.on('gameOver', ({ winner }) => {
      alert(`ゲーム終了! 勝者: ${winner.username}`);
      setScreen('lobby');
      setHand([]);
      setPlayers([]);
    });

    newSocket.on('playerLeft', ({ players }) => {
      setPlayers(players);
      if (players.length < 2) {
        alert('相手プレイヤーが切断しました。ロビーに戻ります。');
        setScreen('lobby');
      }
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(''), 3000);
    });

    // コンポーネントのクリーンアップ時にソケット接続を閉じる
    return () => {
      newSocket.disconnect();
    };
  }, []);
  const createRoom = () => {
    if (!username) {
      setError('ユーザー名を入力してください');
      return;
    }
    console.log(`Creating room with username: ${username}`);
    socket.emit('createRoom', username);
  };

  const joinRoom = () => {
    if (!username || !roomId) {
      setError('ユーザー名と部屋IDを入力してください');
      return;
    }
    socket.emit('joinRoom', { roomId, username });
  };  const startGame = () => {
    console.log(`Starting game in room: ${roomId} with player ID: ${playerId}`);
    console.log(`Current players:`, players);
    socket.emit('startGame', roomId);
  };

  const playCard = (cardIndex) => {
    socket.emit('playCard', { roomId, cardIndex });
  };
  return (
    <div className="App">
      {error && <div className="error-message">{error}</div>}
      
      {screen === 'lobby' && (
        <Lobby
          username={username}
          setUsername={setUsername}
          roomId={roomId}
          setRoomId={setRoomId}
          createRoom={createRoom}
          joinRoom={joinRoom}
        />
      )}
      
      {screen === 'waitingRoom' && (
        <div className="waiting-room">
          <h2>部屋ID: {roomId}</h2>
          <p>プレイヤーが参加するのを待っています...</p>
          <div className="players-list">
            <h3>プレイヤー:</h3>
            <ul>
              {players.map(player => (
                <li key={player.id}>{player.username} {player.id === playerId ? '(あなた)' : ''}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {screen === 'readyToStart' && (
        <div className="ready-screen">
          <h2>全プレイヤーが揃いました!</h2>
          <button onClick={startGame} className="start-button">ゲームを開始</button>
          <div className="players-list">
            <h3>プレイヤー:</h3>
            <ul>
              {players.map(player => (
                <li key={player.id}>{player.username} {player.id === playerId ? '(あなた)' : ''}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
        {screen === 'gameRoom' && gameState && (
        <Game
          socket={socket}
          playerId={playerId}
          gameState={gameState}
          players={players}
          roomId={roomId}
        />
      )}
    </div>
  );
}

export default App;
