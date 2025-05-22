import React from 'react';
import './PhaseControl.css';

// フェーズの定数定義を直接含める
const PHASES = {
  START: 'START',
  DRAW: 'DRAW',
  MAIN: 'MAIN', 
  BATTLE: 'BATTLE',
  END: 'END'
};

const PhaseControl = ({ currentPhase = 'START', onPhaseChange, onEndTurn }) => {
  // propsから渡された現在のフェーズとイベントハンドラを使用
  const phase = currentPhase;

  const handlePhaseChange = (newPhase) => {
    if (onPhaseChange) {
      onPhaseChange(newPhase);
    }
  };

  const handleEndTurn = () => {
    if (onEndTurn) {
      onEndTurn();
    }
  };

  return (
    <div className="phase-control">
      <div className="current-phase">
        {(() => {
          switch (phase) {
            case PHASES.START:
              return '開始フェーズ';
            case PHASES.DRAW:
              return 'ドローフェーズ';
            case PHASES.MAIN:
              return 'メインフェーズ';
            case PHASES.BATTLE:
              return 'バトルフェーズ';
            case PHASES.END:
              return '終了フェーズ';
            default:
              return '';
          }
        })()}
      </div>

      <div className="phase-buttons">
        {phase === PHASES.START && (
          <button onClick={() => handlePhaseChange(PHASES.DRAW)}>
            ドローフェーズへ
          </button>
        )}

        {phase === PHASES.DRAW && (
          <button onClick={() => handlePhaseChange(PHASES.MAIN)}>
            メインフェーズへ
          </button>
        )}

        {phase === PHASES.MAIN && (
          <button onClick={() => handlePhaseChange(PHASES.BATTLE)}>
            バトルフェーズへ
          </button>
        )}

        {phase === PHASES.BATTLE && (
          <button onClick={() => handlePhaseChange(PHASES.END)}>
            終了フェーズへ
          </button>
        )}

        {phase === PHASES.END && (
          <button onClick={handleEndTurn}>
            ターン終了
          </button>
        )}
      </div>      <div className="turn-indicator">
        あなたのターン
      </div>
    </div>
  );
};

export default PhaseControl;
