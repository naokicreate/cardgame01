import React from 'react';
import { useGame, PHASES } from '../../context/GameContext';
import './PhaseControl.css';

const PhaseControl = () => {
  const { state, dispatch } = useGame();
  const { phase, currentPlayer } = state;

  const handlePhaseChange = (newPhase) => {
    dispatch({ type: 'CHANGE_PHASE', payload: newPhase });
  };

  const handleEndTurn = () => {
    dispatch({ type: 'END_TURN' });
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
      </div>

      <div className="turn-indicator">
        {currentPlayer === 'player1' ? 'あなたのターン' : '相手のターン'}
      </div>
    </div>
  );
};

export default PhaseControl;
