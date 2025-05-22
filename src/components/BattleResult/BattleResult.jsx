import React, { useEffect, useState } from 'react';
import './BattleResult.css';

/**
 * バトル結果を視覚的に表示するコンポーネント
 * @param {Object} props バトル結果のプロパティ
 * @param {Object} props.battleData バトル結果データ (attacker, target, damage情報など)
 * @param {Function} props.onClose 閉じるボタンが押されたときのコールバック
 * @param {Boolean} props.visible 表示/非表示の状態
 */
const BattleResult = ({ battleData, onClose, visible }) => {
  const [animation, setAnimation] = useState('');
  
  useEffect(() => {
    if (visible) {
      setAnimation('battle-result-enter');
      const timer = setTimeout(() => {
        setAnimation('battle-result-active');
      }, 300);
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      setAnimation('battle-result-exit');
    }
  }, [visible]);
  
  // バトルデータがない場合は何も表示しない
  if (!battleData || !visible) return null;
  
  const { attacker, target } = battleData;
  const isUnitAttack = target.type === 'UNIT';
  
  const handleClose = () => {
    setAnimation('battle-result-exit');
    setTimeout(() => {
      if (onClose) onClose();
    }, 300);
  };
  
  // ダメージ計算用の値
  const attackerDamage = attacker.attack || 0;
  const targetDamage = isUnitAttack ? (target.attack || 0) : 0;
  const attackerNewHealth = isUnitAttack ? (attacker.newHealth !== undefined ? attacker.newHealth : (attacker.health - targetDamage)) : attacker.health;
  const targetNewHealth = isUnitAttack ? (target.newHealth !== undefined ? target.newHealth : (target.health - attackerDamage)) : 'N/A';
  
  // ユニットが倒されたかどうか
  const isAttackerDefeated = attackerNewHealth <= 0;
  const isTargetDefeated = isUnitAttack && targetNewHealth <= 0;
  
  return (
    <div className={`battle-result ${animation}`}>
      <div className="battle-result-header">
        <h3>戦闘結果</h3>
        <button className="close-button" onClick={handleClose}>×</button>
      </div>
      
      <div className="battle-result-content">
        <div className={`battler attacker ${isAttackerDefeated ? 'defeated' : ''}`}>
          <div className="battler-name">{attacker.name}</div>
          <div className="battler-stats">
            <div className="battler-attack">攻: {attackerDamage}</div>
            <div className="battler-health">
              体力: {attacker.health} → {attackerNewHealth}
              {isAttackerDefeated && <span className="defeated-text">撃破!</span>}
            </div>
          </div>
        </div>
        
        <div className="battle-vs">VS</div>
        
        <div className={`battler target ${isTargetDefeated ? 'defeated' : ''}`}>
          <div className="battler-name">
            {isUnitAttack ? target.name : '相手プレイヤー'}
          </div>
          <div className="battler-stats">
            {isUnitAttack ? (
              <>
                <div className="battler-attack">攻: {targetDamage}</div>
                <div className="battler-health">
                  体力: {target.health} → {targetNewHealth}
                  {isTargetDefeated && <span className="defeated-text">撃破!</span>}
                </div>
              </>
            ) : (
              <div className="battler-health">
                LP: {target.remainingLp !== undefined ? target.remainingLp : 'N/A'}
                <span className="damage-text">(-{attackerDamage})</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="battle-result-footer">
        <button onClick={handleClose}>確認</button>
      </div>
    </div>
  );
};

export default BattleResult;
