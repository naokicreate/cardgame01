import React from 'react';
import './Lobby.css';

function Lobby({ username, setUsername, roomId, setRoomId, createRoom, joinRoom }) {
  return (
    <div className="lobby">
      <h1>カードゲームロビー</h1>
      <div className="form-group">
        <label htmlFor="username">ユーザー名:</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="ユーザー名を入力"
        />
      </div>
      
      <div className="lobby-actions">
        <div className="create-room">
          <h2>新しい部屋を作成</h2>
          <button onClick={createRoom} className="create-button">部屋を作成</button>
        </div>
        
        <div className="join-room">
          <h2>既存の部屋に参加</h2>
          <div className="form-group">
            <label htmlFor="roomId">部屋ID:</label>
            <input
              type="text"
              id="roomId"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="部屋IDを入力"
            />
          </div>
          <button onClick={joinRoom} className="join-button">部屋に参加</button>
        </div>
      </div>
      
      <div className="game-info">
        <h2>ゲームの説明</h2>
        <p>
          このゲームは2人プレイヤーで遊ぶカードゲームです。
          各プレイヤーは5枚のカードを持ち、交互にカードをプレイします。
          手札が先になくなったプレイヤーが勝者です。
        </p>
      </div>
    </div>
  );
}

export default Lobby;
