import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './App.css';
import GameRoom from './components/GameRoom';
import Lobby from './components/Lobby';

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
    
    setSocket(newSocket);

    // イベントリスナーを設定
    newSocket.on('roomCreated', ({ roomId, playerId }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      setScreen('waitingRoom');
    });

    newSocket.on('roomJoined', ({ roomId, playerId }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      setScreen('waitingRoom');
    });

    newSocket.on('playerJoined', ({ players }) => {
      setPlayers(players);
    });

    newSocket.on('readyToStart', () => {
      setScreen('readyToStart');
    });

    newSocket.on('gameStarted', ({ currentPlayer }) => {
      setCurrentPlayer(currentPlayer);
      setScreen('gameRoom');
    });

    newSocket.on('dealCards', ({ hand, currentPlayer }) => {
      setHand(hand);
      setCurrentPlayer(currentPlayer);
    });

    newSocket.on('cardPlayed', ({ playerId, card, nextPlayer }) => {
      console.log(`${playerId} played ${card.value} of ${card.suit}`);
      setCurrentPlayer(nextPlayer);
    });

    newSocket.on('cardDrawn', ({ card }) => {
      setHand(prevHand => [...prevHand, card]);
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
    socket.emit('createRoom', username);
  };

  const joinRoom = () => {
    if (!username || !roomId) {
      setError('ユーザー名と部屋IDを入力してください');
      return;
    }
    socket.emit('joinRoom', { roomId, username });
  };

  const startGame = () => {
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
      
      {screen === 'gameRoom' && (
        <GameRoom
          hand={hand}
          playerId={playerId}
          currentPlayer={currentPlayer}
          players={players}
          playCard={playCard}
        />
      )}
    </div>
  );
}

export default App;
