const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// CORSの設定
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// 静的ファイルの提供
app.use(express.static(path.join(__dirname)));

// ゲームルームの管理
const rooms = new Map();

// WebSocket接続の管理
const clients = new Map();

// カードの定義
const CARD_TYPES = {
    MONSTER: 'monster',
    SPELL: 'spell',
    TRAP: 'trap'
};

// カードデータベース
const CARD_DATABASE = [
    { id: 1, name: 'ドラゴンナイト', type: CARD_TYPES.MONSTER, attack: 2000, defense: 1500, effect: 'このカードは1ターンに1度、相手モンスター1体を破壊できる' },
    { id: 2, name: 'マジックウィザード', type: CARD_TYPES.MONSTER, attack: 1500, defense: 1000, effect: 'このカードが場に出た時、デッキからカードを1枚ドローする' },
    { id: 3, name: '魔法の剣', type: CARD_TYPES.SPELL, effect: '自分フィールドのモンスター1体の攻撃力を1000アップする' },
    { id: 4, name: '罠の落とし穴', type: CARD_TYPES.TRAP, effect: '相手のモンスターが召喚された時、そのモンスターを破壊する' }
    // 必要に応じてカードを追加
];

// デッキ生成関数
function generateDeck() {
    const deck = [];
    // 各カードを3枚ずつデッキに追加
    CARD_DATABASE.forEach(card => {
        for (let i = 0; i < 3; i++) {
            deck.push({ ...card });
        }
    });
    return shuffleDeck(deck);
}

// デッキシャッフル関数
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

// ルーム一覧の取得用のHTTPエンドポイント
app.get('/api/rooms', (req, res) => {
    try {
        console.log('Rooms API called - Current rooms:', rooms.size);
        const roomList = Array.from(rooms.values()).map(room => {
            console.log('Processing room:', room);
            return {
                id: room.id,
                name: room.name,
                players: room.players.length,
                maxPlayers: 2,
                status: room.players.length >= 2 ? 'フル' : '参加可能'
            };
        });
        console.log('Sending room list:', roomList);
        res.json(roomList);
    } catch (error) {
        console.error('Error in /api/rooms endpoint:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

// クライアント初期化処理
function handleClientInit(ws, data) {
    console.log(`クライアント初期化: ${data.clientId}`);
    ws.clientId = data.clientId;
    clients.set(data.clientId, ws);
}

// ゲームルームの作成
function createRoom(roomName, creator) {
    const roomId = uuidv4();
    console.log(`ルーム作成: ${roomName} (ID: ${roomId}) 作成者: ${creator}`);
    
    // ゲームの初期状態を設定
    const gameState = {
        players: [],
        currentPlayerIndex: 0,
        turnCount: 1,
        phase: 'waiting',
        lastAction: null
    };

    // ルームを作成
    const room = {
        id: roomId,
        name: roomName,
        players: [creator],
        gameState: gameState,
        created: Date.now()
    };

    rooms.set(roomId, room);
    console.log(`ルーム作成完了。現在のルーム数: ${rooms.size}`);
    
    // 全クライアントにルームリストの更新を通知
    broadcastToAll({
        type: 'room_list_update',
        rooms: getRoomList()
    });

    return roomId;
}

// ルーム一覧の取得
function getRoomList() {
    return Array.from(rooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        players: room.players.length,
        maxPlayers: 2,
        status: room.players.length >= 2 ? 'フル' : '参加可能'
    }));
}

// プレイヤーのルーム参加処理
function handleJoinRoom(ws, roomId) {
    const room = rooms.get(roomId);
    if (!room) {
        sendTo(ws, {
            type: 'error',
            message: 'ルームが見つかりません'
        });
        return;
    }

    if (room.players.length >= 2) {
        sendTo(ws, {
            type: 'error',
            message: 'ルームが満員です'
        });
        return;
    }

    // プレイヤーをルームに追加
    room.players.push(ws.clientId);
    console.log(`プレイヤー ${ws.clientId} がルーム ${roomId} に参加しました`);

    // ルーム参加を通知
    broadcastToRoom(roomId, {
        type: 'player_joined',
        playerId: ws.clientId,
        playerCount: room.players.length
    });

    // 両プレイヤーが揃った場合、ゲームを開始
    if (room.players.length === 2) {
        initializeGame(roomId);
    }

    // ルームリストの更新を全体に通知
    broadcastToAll({
        type: 'room_list_update',
        rooms: getRoomList()
    });
}

// ゲーム初期化
function initializeGame(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;

    // デッキの生成とシャッフル
    const player1Deck = generateDeck();
    const player2Deck = generateDeck();

    // ゲームの初期状態を設定
    room.gameState = {
        players: room.players.map((playerId, index) => ({
            id: playerId,
            name: `プレイヤー${index + 1}`,
            lp: 8000,
            deck: index === 0 ? player1Deck : player2Deck,
            hand: [],
            field: {
                monsters: Array(5).fill(null),
                spells: Array(5).fill(null)
            },
            graveyard: []
        })),
        currentPlayerIndex: 0,
        turnCount: 1,
        phase: 'draw',
        lastAction: null
    };

    // 初期手札を配る
    room.gameState.players.forEach(player => {
        for (let i = 0; i < 5; i++) {
            drawCard(player);
        }
    });

    // ゲーム開始を通知
    broadcastToRoom(roomId, {
        type: 'game_start',
        gameState: getPublicGameState(room.gameState)
    });
}

// カードをドローする関数
function drawCard(player) {
    if (player.deck.length > 0) {
        const card = player.deck.pop();
        player.hand.push(card);
    }
}

// 公開用のゲームステート作成
function getPublicGameState(gameState) {
    // 相手の手札情報を隠した状態でゲームステートを返す
    return {
        ...gameState,
        players: gameState.players.map(player => ({
            ...player,
            deck: player.deck.length, // デッキの枚数のみ公開
            hand: player.hand.map(card => ({ hidden: true })) // 手札は非公開
        }))
    };
}

// ゲームアクションハンドラー
function handleGameAction(ws, data) {
    const room = getRoomByPlayerId(ws.clientId);
    if (!room) {
        sendTo(ws, { type: 'error', message: 'ルームが見つかりません' });
        return;
    }

    const player = room.gameState.players.find(p => p.id === ws.clientId);
    if (!player) {
        sendTo(ws, { type: 'error', message: 'プレイヤーが見つかりません' });
        return;
    }

    if (room.gameState.currentPlayerIndex !== room.gameState.players.findIndex(p => p.id === ws.clientId)) {
        sendTo(ws, { type: 'error', message: 'あなたのターンではありません' });
        return;
    }

    switch (data.action) {
        case 'summon':
            handleSummon(room, player, data);
            break;
        case 'attack':
            handleAttack(room, player, data);
            break;
        case 'activate_spell':
            handleSpell(room, player, data);
            break;
        case 'set_trap':
            handleTrap(room, player, data);
            break;
        case 'end_turn':
            handleEndTurn(room);
            break;
        default:
            sendTo(ws, { type: 'error', message: '無効なアクション' });
    }
}

// モンスター召喚処理
function handleSummon(room, player, data) {
    const { handIndex, fieldIndex } = data;
    if (handIndex < 0 || handIndex >= player.hand.length || fieldIndex < 0 || fieldIndex >= 5) {
        sendTo(clients.get(player.id), { type: 'error', message: '無効な位置' });
        return;
    }

    const card = player.hand[handIndex];
    if (card.type !== CARD_TYPES.MONSTER) {
        sendTo(clients.get(player.id), { type: 'error', message: 'このカードはモンスターではありません' });
        return;
    }

    if (player.field.monsters[fieldIndex]) {
        sendTo(clients.get(player.id), { type: 'error', message: 'その場所は既に使用されています' });
        return;
    }

    // モンスターを場に出す
    player.field.monsters[fieldIndex] = card;
    player.hand.splice(handIndex, 1);

    broadcastToRoom(room.id, {
        type: 'monster_summoned',
        playerId: player.id,
        monster: card,
        fieldIndex: fieldIndex,
        gameState: getPublicGameState(room.gameState)
    });
}

// 攻撃処理
function handleAttack(room, player, data) {
    const { attackerIndex, targetIndex } = data;
    const opponent = room.gameState.players.find(p => p.id !== player.id);

    if (!player.field.monsters[attackerIndex]) {
        sendTo(clients.get(player.id), { type: 'error', message: '攻撃するモンスターが存在しません' });
        return;
    }

    const attacker = player.field.monsters[attackerIndex];
    const target = opponent.field.monsters[targetIndex];

    let damage;
    if (target) {
        // モンスター対モンスターの戦闘
        damage = attacker.attack - target.defense;
        if (damage > 0) {
            opponent.field.monsters[targetIndex] = null;
            opponent.graveyard.push(target);
            opponent.lp -= damage;
        } else {
            player.field.monsters[attackerIndex] = null;
            player.graveyard.push(attacker);
            player.lp += damage;
        }
    } else {
        // 直接攻撃
        opponent.lp -= attacker.attack;
    }

    broadcastToRoom(room.id, {
        type: 'attack_executed',
        attackerId: player.id,
        attackerIndex: attackerIndex,
        targetIndex: targetIndex,
        damage: damage,
        gameState: getPublicGameState(room.gameState)
    });

    // 勝敗判定
    checkWinCondition(room);
}

// ターン終了処理
function handleEndTurn(room) {
    room.gameState.currentPlayerIndex = (room.gameState.currentPlayerIndex + 1) % 2;
    room.gameState.turnCount++;
    
    // 次のプレイヤーのドロー処理
    const nextPlayer = room.gameState.players[room.gameState.currentPlayerIndex];
    drawCard(nextPlayer);

    broadcastToRoom(room.id, {
        type: 'turn_changed',
        currentPlayerId: nextPlayer.id,
        turnCount: room.gameState.turnCount,
        gameState: getPublicGameState(room.gameState)
    });
}

// 勝敗判定
function checkWinCondition(room) {
    const loser = room.gameState.players.find(player => player.lp <= 0);
    if (loser) {
        const winner = room.gameState.players.find(player => player.id !== loser.id);
        broadcastToRoom(room.id, {
            type: 'game_over',
            winnerId: winner.id,
            gameState: getPublicGameState(room.gameState)
        });
    }
}

// プレイヤーIDからルームを取得
function getRoomByPlayerId(playerId) {
    for (const [roomId, room] of rooms) {
        if (room.players.includes(playerId)) {
            return room;
        }
    }
    return null;
}

// 切断処理
function handleDisconnect(ws) {
    const clientId = ws.clientId;
    clients.delete(clientId);

    // ルームからプレイヤーを削除
    rooms.forEach((room, roomId) => {
        const playerIndex = room.players.indexOf(clientId);
        if (playerIndex !== -1) {
            room.players.splice(playerIndex, 1);
            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                broadcastToRoom(roomId, {
                    type: 'player_disconnected',
                    playerId: clientId
                });
            }
        }
    });
}

// 全クライアントへのブロードキャスト
function broadcastToAll(message) {
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    });
}

// クライアントへのメッセージ送信
function sendTo(client, message) {
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
    }
}

// ルーム内の全プレイヤーへのメッセージ送信
function broadcastToRoom(roomId, message, excludeClient = null) {
    const room = rooms.get(roomId);
    if (!room) return;

    room.players.forEach(playerId => {
        const client = clients.get(playerId);
        if (client && client !== excludeClient) {
            sendTo(client, message);
        }
    });
}

// WebSocket接続ハンドラ
wss.on('connection', (ws) => {
    const clientId = uuidv4();
    clients.set(clientId, ws);
    ws.clientId = clientId;

    console.log(`Client connected: ${clientId}`);

    // メッセージ受信ハンドラ
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    // 切断ハンドラ
    ws.on('close', () => {
        handleDisconnect(ws);
    });
});

// メッセージハンドラ
function handleMessage(ws, data) {
    console.log('受信メッセージ:', data);

    switch (data.type) {
        case 'client_init':
            handleClientInit(ws, data);
            break;

        case 'create_room':
            const roomId = createRoom(data.roomName, data.clientId);
            sendTo(ws, {
                type: 'room_created',
                roomId: roomId,
                roomName: data.roomName
            });
            break;

        case 'join_room':
            handleJoinRoom(ws, data.roomId);
            break;

        case 'game_action':
            handleGameAction(ws, data);
            break;

        default:
            console.log('未知のメッセージタイプ:', data.type);
            sendTo(ws, {
                type: 'error',
                message: '無効なメッセージタイプです'
            });
    }
}

// サーバーの起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
