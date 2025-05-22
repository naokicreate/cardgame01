import React from 'react';
import Card from '../Card/Card';
import './GameField.css';

// PHASESをContextからインポートするのではなく、直接定義または渡されたものを使う
const PHASES = {
  START: 'START',
  DRAW: 'DRAW',
  MAIN: 'MAIN',
  BATTLE: 'BATTLE',
  END: 'END'
};

const GameField = ({ socket, gameState, playerId, onCardPlay, onAttack, currentPhase: propCurrentPhase, currentPlayer: propCurrentPlayer }) => {
  // IDベースのプレイヤー構造を従来のplayer1/player2形式に変換
  const getFormattedGameState = () => {
    const defaultState = {
      players: {
        player1: { hand: [], field: [], deck: [], lifePoints: 8000, cores: 0 },
        player2: { hand: [], field: [], deck: [], lifePoints: 8000, cores: 0 }
      },
      currentPlayer: propCurrentPlayer || null,
      currentPhase: propCurrentPhase || PHASES.START,
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
  };  const formattedGameState = getFormattedGameState();
  const { players } = formattedGameState;
  // propsから渡された値を優先して使用
  const currentPhase = propCurrentPhase || formattedGameState.currentPhase;
  const currentPlayer = propCurrentPlayer || formattedGameState.currentPlayer;
    // selectedCardの状態を管理するための状態変数
  const [selectedCard, setSelectedCard] = React.useState(null);
  // 選択状態をユーザーに示すためのメッセージ
  const [statusMessage, setStatusMessage] = React.useState('');
  
  // デバッグログ
  console.log('GameField state:', {
    propCurrentPhase,
    propCurrentPlayer,
    currentPhase,
    currentPlayer,
    playerId
  });
  
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
    };  };
  
  const renderCards = (cards, zone, player) => {
    // カードがundefinedまたはnullの場合、空の配列を使用
    const safeCards = Array.isArray(cards) ? cards : [];
      // カードがプレイ可能かどうかの判定を詳細化
    const isHandCard = zone === 'hand';
    const isMyCard = player === 'player1';
    
    // 文字列または型が異なる場合を考慮して比較
    console.log('Current player check:', {currentPlayer, playerId});
    const isMyTurn = String(currentPlayer || '') === String(playerId || '');
    
    // PHASESオブジェクトからの参照を確実にする
    const isMainPhase = currentPhase === PHASES.MAIN || currentPhase === 'MAIN';
    
    // 手札のカードの場合のみ、自分のターンのメインフェーズでプレイ可能
    const isCardPlayable = isHandCard && isMyCard && isMyTurn && isMainPhase;
      console.log('Cards render:', {
      zone,
      player,
      cardsCount: safeCards.length,
      isMyTurn,
      currentPhase,
      isMainPhase,
      isCardPlayable,
      playerId,
      currentPlayer
    });      return safeCards.map((card, index) => {
        // カードがnullの場合は空のプレースホルダーを表示
        if (!card) {
          return <div key={`${player}-${zone}-${index}-empty`} className="card-placeholder"></div>;
        }
        
        // バトルフェーズで、カードが選択されているかどうかをチェック
        const isSelected = selectedCard && card && selectedCard.id === card.id;
        const isBattlePhase = currentPhase === PHASES.BATTLE || currentPhase === 'BATTLE';
        
        return (
          <Card
            key={`${player}-${zone}-${index}`}
            card={card}
            onClick={() => handleCardClick(card, zone, player)}
            isPlayable={isCardPlayable || (isBattlePhase && isMyTurn && isMyCard && zone === 'field' && card && !card.hasAttacked && !card.summoningSickness)}
            // クラス名に選択状態を追加
            className={isSelected ? 'selected' : ''}
            // 追加のデバッグ情報をdata属性に含める
            data-playable={isCardPlayable}
            data-zone={zone}
            data-phase={currentPhase}
            data-selected={isSelected}
          />
        );
      });};
    const handleCardClick = (card, zone, player) => {
    console.log('Card click:', { 
      card, 
      zone, 
      player, 
      currentPhase,
      currentPlayer, 
      playerId
    });
    
    // ステータスメッセージをクリア
    setStatusMessage('');
    
    // MAIN/メインフェーズでのカードプレイ処理
    // PHASESオブジェクトを確実に使用し、文字列比較も考慮
    const isMainPhase = currentPhase === PHASES.MAIN || currentPhase === 'MAIN';
    const isBattlePhase = currentPhase === PHASES.BATTLE || currentPhase === 'BATTLE';
    
    // 文字列変換して比較（型の不一致を防ぐ）
    const isMyTurn = String(currentPlayer) === String(playerId);
    const isMyCard = player === 'player1';
    
    if (!isMyTurn) {
      setStatusMessage('あなたのターンではありません');
      return;
    }
    
    console.log('Card playability check:', {
      isMyTurn, 
      isMyCard, 
      isMainPhase,
      isBattlePhase, 
      zone, 
      player, 
      currentPlayer, 
      playerId
    });      // メインフェーズ処理
    if (isMyTurn && isMyCard && isMainPhase && zone === 'hand') {
      // カードがnullでないことを確認
      if (!card) {
        console.log('❌ Cannot play null card');
        setStatusMessage('エラー: 無効なカードです');
        return;
      }
      
      console.log('✅ Playing card:', card);
      // カードのコスト確認をクライアント側でも行う
      const playerCores = getPlayerDataSafely('player1').cores;
      if (card.cost > playerCores) {
        setStatusMessage(`コストが足りません：${card.cost}コスト > ${playerCores}コア`);
        return;
      }
      
      setStatusMessage(`${card.name}を場に出します！`);
      
      // カード使用時のイベントを発火
      if (onCardPlay) {
        onCardPlay(card, zone);
      }
    }// バトルフェーズ処理
    else if ((currentPhase === PHASES.BATTLE || currentPhase === 'BATTLE') && isMyTurn) {
      if (isMyCard && zone === 'field') {        // カードがnullでないか確認
        if (!card) {
          console.log('❌ Card is null or undefined');
          setStatusMessage('無効なカードです');
          return;
        }

        // 召喚酔いや攻撃済みのユニットはチェック
        if (card.summoningSickness) {
          console.log('❌ Unit has summoning sickness:', card.name);
          setStatusMessage(`${card.name || 'このユニット'}は召喚酔いのため、このターンは攻撃できません`);
          return;
        }
        
        if (card.hasAttacked) {
          console.log('❌ Unit has already attacked:', card.name);
          setStatusMessage(`${card.name || 'このユニット'}はすでにこのターンに攻撃しています`);
          return;
        }
        
        // 自分のユニットを選択（攻撃元）
        console.log('✅ Selecting attacker card:', card);
        setSelectedCard(card); // カードを選択状態に設定
        setStatusMessage(`${card.name}で攻撃します - 相手のユニットを選択してください`);
      } else if (!isMyCard) {
        if (selectedCard) {
          // 相手のカードが選択された場合（攻撃先）
          console.log('✅ Attacking with:', selectedCard, 'target:', card);
          setStatusMessage(`${selectedCard.name}が${card.name}に攻撃します！`);
          
          // 攻撃処理を実行
          if (onAttack) {
            onAttack(selectedCard, card);
          }
          
          // 選択をリセット
          setSelectedCard(null);
        } else {
          // 攻撃元が選択されていない
          console.log('❌ No attacker selected yet');
          setStatusMessage('先に自分のユニットを選択してください');
        }
      }    } else if (!isMainPhase && !isBattlePhase) {
      console.log('❌ Card cannot be played in current phase:', { currentPhase });
      setStatusMessage(`現在の${currentPhase}フェーズではカードの操作ができません`);
    } else if (!isMyCard && isBattlePhase && zone !== 'field') {
      console.log('❌ Cannot select this card type in battle phase:', { zone });
      setStatusMessage('バトルフェーズでは場のカードのみ選択できます');
    } else {
      console.log('❌ Card cannot be played in current phase/condition:', {
        isMainPhase, 
        isMyTurn, 
        isMyCard, 
        zone, 
        currentPhase
      });
      setStatusMessage('この操作は現在実行できません');
    }
  };  return (
    <div className="game-field">
      {/* バトルフェーズ中または状態メッセージがある場合、メッセージを表示 */}
      {((currentPhase === PHASES.BATTLE || currentPhase === 'BATTLE') || statusMessage) && (
        <div className={`status-message ${currentPhase === PHASES.BATTLE || currentPhase === 'BATTLE' ? 'battle-status-message' : ''}`}>
          {statusMessage || (
            selectedCard ? 
              `攻撃ユニット：${selectedCard.name} (攻撃力: ${selectedCard.attack}) - 相手のユニットを選んで攻撃してください` : 
              '攻撃に使うユニットを選択してください'
          )}
        </div>
      )}
      
      <div className="opponent-area">
        <div className="player-stats">
          <div className="player-info">
            <div className="life-points">LP: {getPlayerDataSafely('player2').lifePoints}</div>
            <div className="cores">コア: {getPlayerDataSafely('player2').cores}</div>
          </div>
        </div>

        <div className="field-zones">          <div className="zone deck-zone">
            <div className="deck-count">
              <span className="deck-count-label">デッキ:</span>
              <span className="deck-count-value">{getPlayerDataSafely('player2').deck.length || 0}枚</span>
            </div>
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
          </div>          <div className="zone deck-zone">
            <div className="deck-count">
              <span className="deck-count-label">デッキ:</span>
              <span className="deck-count-value">{getPlayerDataSafely('player1').deck.length || 0}枚</span>
            </div>
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
