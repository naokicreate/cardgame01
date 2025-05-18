import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { WebSocket, WebSocketServer } from 'ws'
import { v4 as uuidv4 } from 'uuid'
import { createServer } from 'node:http'

// ゲームの部屋管理
interface Room {
  id: string
  name: string
  host: {
    id: string
    name: string
  }
  guest: {
    id: string
    name: string
  } | null
  status: 'waiting' | 'playing' | 'finished'
  gameState?: GameState // ゲーム状態を追加
}

// WebSocket接続クライアント
interface Client {
  id: string
  name: string
  ws: WebSocket
  roomId: string | null
}

// ゲーム状態の型定義 (仮)
// クライアント側の`players`配列やその他のゲーム情報に合わせて調整が必要
interface PlayerState {
  id: string;
  name: string;
  lp: number;
  hand: any[]; // カード情報の型を定義する必要がある
  fieldUnits: any[];
  fieldTrap: any | null;
  fieldResource: any | null;
  deckSize: number; // デッキ枚数も管理
  isTurnPlayer: boolean;
}

interface GameState {
  players: PlayerState[];
  currentTurnPlayerId: string | null;
  gamePhase: string; // 'main', 'battle', 'gameOver'など
  // その他、ゲームに必要な状態 (例: ログ、選択中のカードなど)
  gameLog: string[];
}

// ゲーム状態
const rooms: Record<string, Room> = {}
const clients: Record<string, Client> = {}

// Honoアプリ
const app = new Hono()

// CORSを有効化
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  exposeHeaders: ['Content-Type']
}))

// 基本的なAPI
app.get('/', (c) => {
  return c.text('CardGame Server is running!')
})

// 部屋一覧を取得するエンドポイント
app.get('/api/rooms', (c) => {
  const roomList = Object.values(rooms)
    .filter(room => room.status === 'waiting')
    .map(room => ({
      id: room.id,
      name: room.name,
      hostName: room.host.name
    }))
  return c.json(roomList)
})

// HTTPサーバー作成
const httpServer = createServer()
const port = 3000

// WebSocketサーバー
const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws: WebSocket) => {
  const clientId = uuidv4()
  console.log(`クライアント接続: ID=${clientId}`)
  
  // クライアント登録（初期状態）
  clients[clientId] = {
    id: clientId,
    name: `Player_${clientId.substring(0, 6)}`,
    ws,
    roomId: null
  }
  
  // 初期化メッセージ送信
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    message: 'Connected to game server'
  }))
  
  // メッセージ受信処理
  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString())
      handleClientMessage(clientId, data)
    } catch (error) {
      console.error('Invalid message format:', error)
    }
  })
  
  // 切断処理
  ws.on('close', () => {
    const client = clients[clientId]
    
    // プレイヤーが部屋にいる場合、部屋から退出
    if (client && client.roomId) {
      const room = rooms[client.roomId]
      if (room) {
        // ホストが退出した場合、部屋を削除
        if (room.host.id === clientId) {
          // ゲストがいる場合、ゲストにも通知
          if (room.guest) {
            const guestClient = clients[room.guest.id]
            if (guestClient && guestClient.ws) {
              guestClient.ws.send(JSON.stringify({
                type: 'roomClosed',
                message: 'Host left the room'
              }))
              guestClient.roomId = null
            }
          }
          delete rooms[client.roomId]
        } 
        // ゲストが退出した場合
        else if (room.guest && room.guest.id === clientId) {
          room.guest = null
          room.status = 'waiting'
          
          // ホストに通知
          const hostClient = clients[room.host.id]
          if (hostClient && hostClient.ws) {
            hostClient.ws.send(JSON.stringify({
              type: 'playerLeft',
              message: 'Guest left the room'
            }))
          }
        }
      }
    }
    
    // クライアント登録削除
    delete clients[clientId]
    console.log(`Client ${clientId} disconnected`)
  })
})

// クライアントメッセージの処理
function handleClientMessage(clientId: string, data: any) {
  const client = clients[clientId]
  if (!client) return
  
  console.log(`Received message from ${clientId}:`, data)
  
  switch (data.type) {
    case 'setName':
      // プレイヤー名設定
      client.name = data.name || client.name
      client.ws.send(JSON.stringify({
        type: 'nameUpdated',
        name: client.name
      }))
      break
      
    // クライアントからroomIdのみが送信された場合、joinRoomとして処理
    case undefined:
      if (data.roomId) {
        console.log(`Client ${clientId} sent roomId directly, treating as joinRoom`)
        data.type = 'joinRoom'
        // 処理を継続（下のjoinRoomケースにフォールスルー）
      } else {
        console.log(`Client ${clientId} sent message without type or roomId:`, data)
        break
      }
      
    case 'joinRoom':
      // 部屋に参加
      const roomToJoin = rooms[data.roomId]
      if (!roomToJoin) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Room not found'
        }))
        return
      }
      
      if (roomToJoin.status !== 'waiting') {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Room is not available'
        }))
        return
      }
      
      if (roomToJoin.host.id === clientId) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'You are already in this room as host'
        }))
        return
      }
      
      // ゲストとして参加
      roomToJoin.guest = {
        id: clientId,
        name: client.name
      }
      roomToJoin.status = 'playing'
      client.roomId = data.roomId
      
      // ホストに通知
      const hostClientForJoin = clients[roomToJoin.host.id]
      if (hostClientForJoin && hostClientForJoin.ws) {
        hostClientForJoin.ws.send(JSON.stringify({
          type: 'playerJoined',
          player: {
            id: clientId,
            name: client.name
          }
        }))
      }
      
      // ゲストに通知
      client.ws.send(JSON.stringify({
        type: 'joinedRoom',
        room: {
          id: roomToJoin.id,
          name: roomToJoin.name,
          host: {
            id: roomToJoin.host.id,
            name: roomToJoin.host.name
          }
        }
      }))
      
      // ゲーム開始通知
      setTimeout(() => {
        // ゲーム状態の初期化
        const hostPlayerId = roomToJoin.host.id;
        const guestPlayerId = roomToJoin.guest!.id;

        const initialGameState: GameState = {
          players: [
            {
              id: hostPlayerId, // ホストをプレイヤー1とする
              name: roomToJoin.host.name,
              lp: 20, // 初期LPなど、ゲームのルールに合わせて設定
              hand: [],
              fieldUnits: [],
              fieldTrap: null,
              fieldResource: null,
              deckSize: 40, // 仮のデッキ枚数
              isTurnPlayer: true, // ホストが先行
            },
            {
              id: guestPlayerId, // ゲストをプレイヤー2とする
              name: roomToJoin.guest!.name,
              lp: 20,
              hand: [],
              fieldUnits: [],
              fieldTrap: null,
              fieldResource: null,
              deckSize: 40,
              isTurnPlayer: false,
            }
          ],
          currentTurnPlayerId: hostPlayerId,
          gamePhase: 'initial', // または 'main'
          gameLog: [`Game started between ${roomToJoin.host.name} and ${roomToJoin.guest!.name}`],
        };
        roomToJoin.gameState = initialGameState;

        broadcastToRoom(roomToJoin.id, {
          type: 'gameStart',
          gameState: initialGameState, // 初期ゲーム状態を送信
          hostPlayerId: hostPlayerId, // クライアント側で自分がどちらか判断するため
          guestPlayerId: guestPlayerId
        })
      }, 1000)
      break
      
    case 'createRoom':
      // 部屋作成
      const roomId = uuidv4()
      const roomName = data.roomName || `Room_${roomId.substring(0, 6)}`
      
      rooms[roomId] = {
        id: roomId,
        name: roomName,
        host: {
          id: clientId,
          name: client.name
        },
        guest: null,
        status: 'waiting'
      }
      
      client.roomId = roomId
      
      // 部屋作成完了通知
      client.ws.send(JSON.stringify({
        type: 'roomCreated',
        roomId,
        roomName
      }))
      break
      
    case 'joinRoom':
      // 部屋に参加
      const room = rooms[data.roomId]
      if (!room) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Room not found'
        }))
        return
      }
      
      if (room.status !== 'waiting') {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Room is not available'
        }))
        return
      }
      
      if (room.host.id === clientId) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'You are already in this room as host'
        }))
        return
      }
      
      // ゲストとして参加
      room.guest = {
        id: clientId,
        name: client.name
      }
      room.status = 'playing'
      client.roomId = data.roomId
      
      // ホストに通知
      const hostClient = clients[room.host.id]
      if (hostClient && hostClient.ws) {
        hostClient.ws.send(JSON.stringify({
          type: 'playerJoined',
          player: {
            id: clientId,
            name: client.name
          }
        }))
      }
      
      // ゲストに通知
      client.ws.send(JSON.stringify({
        type: 'joinedRoom',
        room: {
          id: room.id,
          name: room.name,
          host: {
            id: room.host.id,
            name: room.host.name
          }
        }
      }))
      
      // ゲーム開始通知
      setTimeout(() => {
        // ゲーム状態の初期化 (createRoom -> joinRoom の流れでも gameState が必要)
        const hostPlayerId = room.host.id;
        const guestPlayerId = room.guest!.id; // joinRoom の時点で guest は存在するはず

        const initialGameState: GameState = {
           players: [
            {
              id: hostPlayerId,
              name: room.host.name,
              lp: 20,
              hand: [],
              fieldUnits: [],
              fieldTrap: null,
              fieldResource: null,
              deckSize: 40,
              isTurnPlayer: true,
            },
            {
              id: guestPlayerId,
              name: room.guest!.name,
              lp: 20,
              hand: [],
              fieldUnits: [],
              fieldTrap: null,
              fieldResource: null,
              deckSize: 40,
              isTurnPlayer: false,
            }
          ],
          currentTurnPlayerId: hostPlayerId,
          gamePhase: 'initial',
          gameLog: [`Game started between ${room.host.name} and ${room.guest!.name}`],
        };
        room.gameState = initialGameState;


        broadcastToRoom(room.id, {
          type: 'gameStart',
          gameState: initialGameState, // 初期ゲーム状態を送信
          hostPlayerId: hostPlayerId,
          guestPlayerId: guestPlayerId
        })
      }, 1000)
      break
    
    case 'gameAction':
      // ゲームアクション処理
      const currentRoom = rooms[client.roomId!]
      if (!client.roomId || !currentRoom || !currentRoom.gameState) {
        client.ws.send(JSON.stringify({
          type: 'error',
          message: 'Not in a valid room'
        }))
        return
      }
      
      // 部屋の相手プレイヤーにアクションを転送
      const targetRoom = rooms[client.roomId]
      const isHost = targetRoom.host.id === clientId
      const targetId = isHost 
        ? (targetRoom.guest ? targetRoom.guest.id : null) 
        : targetRoom.host.id
      
      if (targetId) {
        const targetClient = clients[targetId]
        if (targetClient && targetClient.ws) {
          // gameState を更新するロジックをここに追加
          // 例: data.action に応じて currentRoom.gameState を変更
          // この例では、単純に相手にアクションを転送するだけでなく、
          // サーバーで状態を更新し、更新後の gameState をブロードキャストする
          
          // TODO: data.action と data.data に基づいて gameState を更新する
          // 例: カードプレイ、攻撃、ターン終了など
          // if (data.action === 'playCard') {
          //   // gameState.players の手札やフィールドを更新
          // } else if (data.action === 'endTurn') {
          //   // gameState.currentTurnPlayerId を更新
          // }
          // currentRoom.gameState.gameLog.push(`${client.name} performed ${data.action}`);

          // 更新されたゲーム状態を部屋の全員にブロードキャスト
          broadcastToRoom(client.roomId, {
            type: 'gameStateUpdate', // 新しいメッセージタイプ
            gameState: currentRoom.gameState,
            actionOriginClientId: clientId, // どのアクションによる更新か
            originalAction: data.action,
            originalData: data.data
          });
        }
      }
      break
  }
}

// 部屋の全プレイヤーにメッセージをブロードキャスト
function broadcastToRoom(roomId: string, message: any) {
  const room = rooms[roomId]
  if (!room) return
  
  // ホストに送信
  const hostClient = clients[room.host.id]
  if (hostClient && hostClient.ws) {
    hostClient.ws.send(JSON.stringify(message))
  }
  
  // ゲストに送信
  if (room.guest) {
    const guestClient = clients[room.guest.id]
    if (guestClient && guestClient.ws) {
      guestClient.ws.send(JSON.stringify(message))
    }
  }
}

// Honoのルートハンドラーを設定
httpServer.on('request', (req, res) => {
  // Honoのfetchハンドラを呼び出し
  (app.fetch(new Request(`http://${req.headers.host}${req.url}`, {
    method: req.method,
    headers: req.headers as any,
  })) as Promise<Response>).then((honoResponse: Response) => {
    res.statusCode = honoResponse.status
    honoResponse.headers.forEach((value: string, key: string) => {
      res.setHeader(key, value)
    })
    return honoResponse.text()
  }).then((body: string) => {
    res.end(body)
  }).catch((err: Error) => {
    console.error('Error in Hono handler:', err)
    res.statusCode = 500
    res.end('Internal Server Error')
  })
})

// サーバー起動
httpServer.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
  console.log(`WebSocket server is ready`)
})
