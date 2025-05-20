const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

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

// ソケット接続のデバッグログ
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
