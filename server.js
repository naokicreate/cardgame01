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

  // プレイヤーがデッキを準備
  socket.on('prepareDeck', ({ deck }) => {
    if (deck.length === GAME_CONSTANTS.DECK_SIZE) {
      playerDecks.set(socket.id, shuffleArray(deck));
      socket.emit('deckPrepared', { success: true });
    } else {
      socket.emit('deckPrepared', { 
        success: false, 
        error: `デッキは${GAME_CONSTANTS.DECK_SIZE}枚である必要があります。` 
      });
    }
  });

  // 部屋を作成
  socket.on('createRoom', ({ username }) => {
    if (!playerDecks.has(socket.id)) {
      socket.emit('error', { message: 'デッキを準備してください。' });
      return;
    }

    const roomId = Math.random().toString(36).substring(2, 8);
    socket.join(roomId);
    
    gameRooms.set(roomId, {
      id: roomId,
      players: [{
        id: socket.id,
        username,
      }],
      gameState: null,
      isStarted: false
    });
    
    socket.emit('roomCreated', { roomId, playerId: socket.id });
  });

  // 部屋に参加
  socket.on('joinRoom', ({ roomId, username }) => {
    if (!playerDecks.has(socket.id)) {
      socket.emit('error', { message: 'デッキを準備してください。' });
      return;
    }

    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: '部屋が見つかりません。' });
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: '部屋が満員です。' });
      return;
    }

    socket.join(roomId);
    room.players.push({
      id: socket.id,
      username
    });

    // ゲーム状態を初期化
    if (room.players.length === 2) {
      const [player1, player2] = room.players;
      const gameState = createGameState(player1.id, player2.id);
      
      // 各プレイヤーのデッキを設定
      gameState.players[player1.id].deck = playerDecks.get(player1.id);
      gameState.players[player2.id].deck = playerDecks.get(player2.id);
      
      // 初期手札を配る
      room.gameState = dealInitialCards(gameState);
      room.isStarted = true;

      // 各プレイヤーに初期状態を送信
      io.in(roomId).emit('gameStart', {
        gameState: room.gameState,
        players: room.players
      });
    }

    io.in(roomId).emit('playerJoined', { 
      players: room.players
    });
  });  // ゲームアクション
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
    }
  });
});
io.engine.on("connection_error", (err) => {
  console.log("接続エラー:", err.req, err.code, err.message, err.context);
});

// ゲームルームを管理するオブジェクト
const rooms = {};

// トランプのデッキを作成する関数
function createDeck() {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  
  for (let suit of suits) {
    for (let value of values) {
      deck.push({ suit, value });
    }
  }
  
  return shuffleDeck(deck);
}

// デッキをシャッフルする関数
function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

io.on('connection', (socket) => {
  console.log('New client connected');
  
  // 新しい部屋を作成する
  socket.on('createRoom', (username) => {
    const roomId = Math.random().toString(36).substring(2, 8);
    
    rooms[roomId] = {
      id: roomId,
      players: [{
        id: socket.id,
        username,
        hand: []
      }],
      deck: createDeck(),
      gameStarted: false
    };
    
    socket.join(roomId);
    socket.emit('roomCreated', { roomId, playerId: socket.id });
    console.log(`Room created: ${roomId} by ${username}`);
  });
  
  // 既存の部屋に参加する
  socket.on('joinRoom', ({ roomId, username }) => {
    const room = rooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: '部屋が見つかりません' });
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: '部屋が満員です' });
      return;
    }
    
    room.players.push({
      id: socket.id,
      username,
      hand: []
    });
    
    socket.join(roomId);
    socket.emit('roomJoined', { roomId, playerId: socket.id });
    io.to(roomId).emit('playerJoined', { players: room.players });
    
    // プレイヤーが2人になったらゲームを開始可能にする
    if (room.players.length === 2) {
      io.to(roomId).emit('readyToStart', { roomId });
    }
    
    console.log(`${username} joined room: ${roomId}`);
  });
  
  // ゲームを開始する
  socket.on('startGame', (roomId) => {
    const room = rooms[roomId];
    
    if (!room) {
      socket.emit('error', { message: '部屋が見つかりません' });
      return;
    }
    
    // 各プレイヤーに5枚ずつカードを配る
    room.players.forEach(player => {
      player.hand = room.deck.splice(0, 5);
    });
    
    room.gameStarted = true;
    room.currentPlayer = 0; // 最初のプレイヤーから開始
    
    // 各プレイヤーに自分の手札を送信
    room.players.forEach(player => {
      io.to(player.id).emit('dealCards', { 
        hand: player.hand,
        currentPlayer: room.currentPlayer
      });
    });
    
    io.to(roomId).emit('gameStarted', { 
      currentPlayer: room.players[room.currentPlayer].id
    });
    
    console.log(`Game started in room: ${roomId}`);
  });
  
  // カードをプレイする
  socket.on('playCard', ({ roomId, cardIndex }) => {
    const room = rooms[roomId];
    
    if (!room || !room.gameStarted) {
      socket.emit('error', { message: 'ゲームがまだ開始されていません' });
      return;
    }
    
    const playerIndex = room.players.findIndex(player => player.id === socket.id);
    
    if (playerIndex === -1) {
      socket.emit('error', { message: 'プレイヤーが見つかりません' });
      return;
    }
    
    if (playerIndex !== room.currentPlayer) {
      socket.emit('error', { message: 'あなたのターンではありません' });
      return;
    }
    
    const player = room.players[playerIndex];
    const playedCard = player.hand.splice(cardIndex, 1)[0];
    
    // 次のプレイヤーに順番を回す
    room.currentPlayer = (room.currentPlayer + 1) % room.players.length;
    
    // 山札からカードを引く
    if (room.deck.length > 0) {
      const newCard = room.deck.pop();
      player.hand.push(newCard);
      socket.emit('cardDrawn', { card: newCard });
    }
    
    // 全プレイヤーにカードがプレイされたことを通知
    io.to(roomId).emit('cardPlayed', { 
      playerId: socket.id,
      card: playedCard,
      nextPlayer: room.players[room.currentPlayer].id
    });
    
    // 手札が0になったらゲーム終了
    if (player.hand.length === 0) {
      io.to(roomId).emit('gameOver', { winner: player });
      delete rooms[roomId]; // ゲーム終了後、部屋を削除
    }
    
    console.log(`Card played in room ${roomId} by ${player.username}`);
  });
  
  // 切断時の処理
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    
    // プレイヤーが参加していた部屋を探す
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(player => player.id === socket.id);
      
      if (playerIndex !== -1) {
        // プレイヤーを部屋から削除
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          // プレイヤーがいなくなったら部屋を削除
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted (no players left)`);
        } else {
          // 残りのプレイヤーに通知
          io.to(roomId).emit('playerLeft', { 
            playerId: socket.id,
            players: room.players
          });
          
          if (room.gameStarted && room.currentPlayer === playerIndex) {
            // 切断したプレイヤーが現在のプレイヤーだった場合、次のプレイヤーに順番を回す
            room.currentPlayer = 0;
            io.to(roomId).emit('playerTurn', { 
              currentPlayer: room.players[room.currentPlayer].id
            });
          }
        }
        
        break;
      }
    }
  });
});

// ビルドフォルダがある場合のみstaticフォルダとしてサーブする
if (fs.existsSync(path.join(__dirname, 'build'))) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
