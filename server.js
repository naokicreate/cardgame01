const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { 
  GAME_PHASES,
  GAME_CONSTANTS,
  createGameState,
  shuffleArray,
  dealInitialCards
} = require('./server/gameState');

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'build')));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000
});

// ゲームルームを管理するオブジェクト
const gameRooms = new Map();
// プレイヤーのデッキを一時的に保存するオブジェクト
const playerDecks = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  // プレイヤーがデッキを準備（簡易版として省略可能に）
  socket.on('prepareDeck', ({ deck }) => {
    // デッキが省略された場合は、ダミーデッキを生成
    if (!deck || !Array.isArray(deck)) {
      const dummyDeck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1
      }));
      
      playerDecks.set(socket.id, shuffleArray(dummyDeck));
      socket.emit('deckPrepared', { success: true });
      return;
    }
    
    if (deck.length === GAME_CONSTANTS.DECK_SIZE) {
      playerDecks.set(socket.id, shuffleArray(deck));
      socket.emit('deckPrepared', { success: true });
    } else {
      socket.emit('deckPrepared', { 
        success: false, 
        error: `デッキは${GAME_CONSTANTS.DECK_SIZE}枚である必要があります。` 
      });
    }
  });  // 部屋を作成
  socket.on('createRoom', (username) => {
    console.log(`Creating room for user: ${username}`);
    
    // 自動的にダミーデッキを作成（まだデッキが準備されていない場合）
    if (!playerDecks.has(socket.id)) {
      const dummyDeck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1
      }));
      
      playerDecks.set(socket.id, shuffleArray(dummyDeck));
    }

    const roomId = Math.random().toString(36).substring(2, 8);
    socket.join(roomId);
    
    gameRooms.set(roomId, {
      id: roomId,
      players: [{
        id: socket.id,
        username,
        hand: []
      }],
      gameState: null,
      isStarted: false
    });
    
    socket.emit('roomCreated', { roomId, playerId: socket.id });
    console.log(`Room created: ${roomId} by ${username}`);
  });
  // 部屋に参加
  socket.on('joinRoom', ({ roomId, username }) => {
    if (!playerDecks.has(socket.id)) {
      // 自動的にダミーデッキを作成
      const dummyDeck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1
      }));
      
      playerDecks.set(socket.id, shuffleArray(dummyDeck));
    }

    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: '部屋が見つかりません。' });
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: '部屋が満員です。' });
      return;
    }    socket.join(roomId);
    room.players.push({
      id: socket.id,
      username,
      hand: []
    });

    socket.emit('roomJoined', { roomId, playerId: socket.id });
    io.in(roomId).emit('playerJoined', { 
      players: room.players
    });
    
    // プレイヤーが2人になったらゲームを開始可能（readyToStart）にする
    if (room.players.length === 2) {
      console.log(`Room ${roomId} now has 2 players, sending readyToStart`);
      io.in(roomId).emit('readyToStart', { roomId });
    }
    
    console.log(`${username} joined room: ${roomId}`);
  });// ゲームアクション
  socket.on('gameAction', ({ roomId, action, data }) => {
    const room = gameRooms.get(roomId);
    if (!room || !room.isStarted) {
      socket.emit('error', { message: 'ゲームがまだ開始されていないか、部屋が存在しません。' });
      return;
    }

    const gameState = room.gameState;
    // アクションによって条件を変える（フェーズ変更はカレントプレイヤーだけができる）
    if (gameState.currentPlayer !== socket.id && (action !== 'changePhase' || gameState.currentPlayer !== socket.id)) {
      socket.emit('error', { message: 'あなたのターンではありません。' });
      return;
    }

    let newGameState = { ...gameState };
    console.log(`Game action received: ${action}`, data);

    switch (action) {
      case 'playCard':
        // カードプレイの処理
        if (data && data.card) {
          console.log(`Card played by ${socket.id}:`, data.card);
          // ここにカードプレイのロジックを追加
        }
        break;
        
      case 'attack':
        // 攻撃の処理
        if (data && data.attacker && data.target) {
          console.log(`Attack from ${socket.id}:`, data);
          // ここに攻撃のロジックを追加
        }
        break;
        
      case 'changePhase':
        // フェーズ変更の処理
        if (data && data.phase) {
          newGameState.currentPhase = data.phase;
          console.log(`Phase changed to ${data.phase} by ${socket.id}`);
        }
        break;
        
      case 'endTurn':
        // ターン終了の処理
        const playerIds = room.players.map(p => p.id);
        const currentPlayerIndex = playerIds.indexOf(gameState.currentPlayer);
        const nextPlayerIndex = (currentPlayerIndex + 1) % playerIds.length;
        newGameState.currentPlayer = playerIds[nextPlayerIndex];
        newGameState.currentPhase = GAME_PHASES.START;
        console.log(`Turn ended by ${socket.id}. Next player: ${newGameState.currentPlayer}`);
        break;
        
      case 'selectCard':
        // カード選択の処理
        if (data && data.card) {
          newGameState.selectedCard = data.card;
          console.log(`Card selected by ${socket.id}:`, data.card);
        }
        break;
    }

    // 状態を更新して全員に通知
    room.gameState = newGameState;
    io.in(roomId).emit('gameStateUpdate', { gameState: newGameState });
  });
  // ゲーム開始リクエストに応答
  socket.on('startGame', (roomId) => {
    console.log(`Start game requested for room: ${roomId} by ${socket.id}`);
    const room = gameRooms.get(roomId);
    
    if (!room) {
      console.log(`Error: Room ${roomId} not found`);
      socket.emit('error', { message: '部屋が見つかりません。' });
      return;
    }
    
    console.log(`Room found: ${roomId}, players: ${room.players.length}`);
    
    if (room.players.length < 2) {
      console.log(`Error: Room ${roomId} needs 2 players, has ${room.players.length}`);
      socket.emit('error', { message: 'ゲームを開始するには2人のプレイヤーが必要です。' });
      return;
    }
    
    if (room.isStarted) {
      console.log(`Room ${roomId} already started, resending game state`);
      // すでにゲームが開始されている場合は、ゲーム状態を再送信
      io.in(roomId).emit('gameStart', {
        gameState: room.gameState,
        players: room.players
      });
      return;
    }
    
    // ゲーム状態を初期化
    const [player1, player2] = room.players;
    const gameState = createGameState(player1.id, player2.id);
    
    // 各プレイヤーのデッキを設定（すでにデッキがあるかを確認）
    if (playerDecks.has(player1.id)) {
      gameState.players[player1.id].deck = playerDecks.get(player1.id);
    } else {
      // ダミーデッキを作成（テスト用）
      gameState.players[player1.id].deck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1
      }));
    }
    
    if (playerDecks.has(player2.id)) {
      gameState.players[player2.id].deck = playerDecks.get(player2.id);
    } else {
      // ダミーデッキを作成（テスト用）
      gameState.players[player2.id].deck = Array(GAME_CONSTANTS.DECK_SIZE).fill().map((_, i) => ({
        id: `card-${i}`,
        name: `カード${i}`,
        type: 'UNIT',
        attack: Math.floor(Math.random() * 5) + 1,
        health: Math.floor(Math.random() * 5) + 1,
        cost: Math.floor(Math.random() * 3) + 1
      }));
    }
      // 初期手札を配る
    room.gameState = dealInitialCards(gameState);
    room.isStarted = true;

    console.log(`Game initialization complete for room: ${roomId}`);
    console.log(`Player 1: ${player1.id}, Player 2: ${player2.id}`);
    console.log(`Current player: ${room.gameState.currentPlayer}`);

    // 各プレイヤーに初期状態を送信
    io.in(roomId).emit('gameStart', {
      gameState: room.gameState,
      players: room.players
    });
    
    console.log(`Game started in room: ${roomId}, gameStart event emitted`);
  });

  // 切断時の処理
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    playerDecks.delete(socket.id);

    // プレイヤーが参加していた部屋を検索して更新
    for (const [roomId, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        io.in(roomId).emit('playerLeft', { 
          playerId: socket.id,
          username: room.players[playerIndex].username
        });
        gameRooms.delete(roomId);
        break;
      }
    }  });
});
io.engine.on("connection_error", (err) => {  console.log("接続エラー:", err.req, err.code, err.message, err.context);
});

// ビルドフォルダがある場合のみstaticフォルダとしてサーブする
if (fs.existsSync(path.join(__dirname, 'build'))) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
