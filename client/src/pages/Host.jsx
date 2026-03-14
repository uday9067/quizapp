import React, { useState, useEffect, useCallback } from 'react'
import socket from '../socket'
import styles from './Host.module.css'

const DEFAULTS = { timerSeconds: 20, topN: 10 }

export default function Host({ onBack }) {
  const [step, setStep] = useState('setup') // setup | lobby | running | results
  const [questions, setQuestions] = useState([])
  const [settings, setSettings] = useState(DEFAULTS)
  const [roomCode, setRoomCode] = useState('')
  const [players, setPlayers] = useState([])
  const [results, setResults] = useState([])
  const [error, setError] = useState('')

  // Question form state
  const [qText, setQText] = useState('')
  const [opts, setOpts] = useState(['', '', '', ''])
  const [correct, setCorrect] = useState(0)
  const [editIdx, setEditIdx] = useState(null)

  useEffect(() => {
    socket.on('room_created', ({ code }) => {
      setRoomCode(code)
      setStep('lobby')
    })
    socket.on('player_joined', (summary) => {
      setPlayers(summary.players)
    })
    socket.on('score_update', (summary) => {
      setPlayers(summary.players)
    })
    socket.on('final_results', ({ results }) => {
      setResults(results)
      setStep('results')
    })
    socket.on('error', ({ msg }) => setError(msg))

    return () => {
      socket.off('room_created')
      socket.off('player_joined')
      socket.off('score_update')
      socket.off('final_results')
      socket.off('error')
    }
  }, [])

  const createRoom = () => {
    if (questions.length === 0) return setError('Add at least one question')
    setError('')
    socket.emit('create_room', { questions, settings })
  }

  const addQuestion = () => {
    if (!qText.trim()) return setError('Enter a question')
    if (opts.some(o => !o.trim())) return setError('Fill all 4 options')
    setError('')
    const q = { question: qText.trim(), options: opts.map(o => o.trim()), correct }
    if (editIdx !== null) {
      setQuestions(prev => prev.map((item, i) => i === editIdx ? q : item))
      setEditIdx(null)
    } else {
      setQuestions(prev => [...prev, q])
    }
    setQText('')
    setOpts(['', '', '', ''])
    setCorrect(0)
  }

  const removeQuestion = (i) => setQuestions(prev => prev.filter((_, idx) => idx !== i))

  const editQuestion = (i) => {
    const q = questions[i]
    setQText(q.question)
    setOpts([...q.options])
    setCorrect(q.correct)
    setEditIdx(i)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const startQuiz = () => {
    socket.emit('start_quiz', { code: roomCode })
    setStep('running')
  }

  const endQuiz = () => {
    socket.emit('end_quiz', { code: roomCode })
  }

  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return (a.finishedAt || Infinity) - (b.finishedAt || Infinity)
  })

  if (step === 'results') {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button className="btn btn-ghost" onClick={onBack}>← Back to Home</button>
          <h1>Final Results 🏆</h1>
        </div>
        <div className={styles.resultsList}>
          {results.map((r, i) => (
            <div key={i} className={`${styles.resultRow} ${i === 0 ? styles.gold : i === 1 ? styles.silver : i === 2 ? styles.bronze : ''}`}>
              <span className={styles.rank}>#{r.rank}</span>
              <span className={styles.rname}>{r.name}</span>
              <span className={styles.rscore}>{r.score} pts</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (step === 'running' || step === 'lobby') {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h2>Room Code</h2>
            <div className={styles.codeBox}>{roomCode}</div>
            <p className={styles.hint}>Share this code with players</p>
          </div>
          <div className={styles.headerActions}>
            {step === 'lobby' && (
              <button className="btn btn-green" onClick={startQuiz} disabled={players.length === 0}>
                ▶ Start Quiz
              </button>
            )}
            {step === 'running' && (
              <button className="btn btn-danger" onClick={endQuiz}>End Quiz</button>
            )}
          </div>
        </div>

        <div className={styles.status}>
          <span className={`${styles.dot} ${step === 'running' ? styles.dotGreen : styles.dotYellow}`} />
          {step === 'lobby' ? `Waiting for players... (${players.length} joined)` : 'Quiz in progress'}
        </div>

        <div className={styles.scoreboard}>
          <div className={styles.scoreHeader}>
            <h3>Scoreboard</h3>
            <div className={styles.topSelect}>
              Show top:
              <select value={settings.topN} onChange={e => setSettings(s => ({ ...s, topN: +e.target.value }))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
              </select>
            </div>
          </div>
          {players.length === 0 ? (
            <p className={styles.empty}>No players yet. Share the room code!</p>
          ) : (
            <div className={styles.playerList}>
              {sortedPlayers.slice(0, settings.topN).map((p, i) => (
                <div key={p.id} className={styles.playerRow}>
                  <span className={styles.prank}>#{i + 1}</span>
                  <span className={styles.pname}>{p.name}</span>
                  <span className={styles.pscore}>{p.score} pts</span>
                  {p.finishedAt && <span className={styles.done}>✓ Done</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Setup step
  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <h1>Create Quiz</h1>
        <button className="btn btn-primary" onClick={createRoom}>Create Room →</button>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.layout}>
        <div className={styles.left}>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>{editIdx !== null ? '✏️ Edit Question' : '➕ Add Question'}</h3>
            <div className={styles.field}>
              <label>Question</label>
              <textarea
                rows={2}
                placeholder="Type your question..."
                value={qText}
                onChange={e => setQText(e.target.value)}
              />
            </div>
            {opts.map((o, i) => (
              <div key={i} className={styles.optRow}>
                <input
                  type="radio"
                  name="correct"
                  checked={correct === i}
                  onChange={() => setCorrect(i)}
                  className={styles.radio}
                />
                <input
                  placeholder={`Option ${i + 1}${correct === i ? ' ✓ correct' : ''}`}
                  value={o}
                  onChange={e => setOpts(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                />
              </div>
            ))}
            <p className={styles.hint2}>Select the radio button next to the correct answer</p>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={addQuestion}>
              {editIdx !== null ? 'Update Question' : 'Add Question'}
            </button>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 16 }}>⚙️ Settings</h3>
            <div className={styles.settingsGrid}>
              <div className={styles.field}>
                <label>Timer (seconds)</label>
                <select value={settings.timerSeconds} onChange={e => setSettings(s => ({ ...s, timerSeconds: +e.target.value }))}>
                  <option value={10}>10s</option>
                  <option value={15}>15s</option>
                  <option value={20}>20s</option>
                  <option value={30}>30s</option>
                  <option value={45}>45s</option>
                  <option value={60}>60s</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Show top players</label>
                <select value={settings.topN} onChange={e => setSettings(s => ({ ...s, topN: +e.target.value }))}>
                  <option value={10}>Top 10</option>
                  <option value={20}>Top 20</option>
                  <option value={30}>Top 30</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.right}>
          <div className="card" style={{ height: '100%' }}>
            <h3 style={{ marginBottom: 16 }}>Questions ({questions.length})</h3>
            {questions.length === 0 ? (
              <p className={styles.empty}>No questions yet. Add some on the left!</p>
            ) : (
              <div className={`${styles.qList} scrollable`}>
                {questions.map((q, i) => (
                  <div key={i} className={styles.qItem}>
                    <div className={styles.qTop}>
                      <span className={styles.qNum}>Q{i + 1}</span>
                      <span className={styles.qText}>{q.question}</span>
                      <div className={styles.qActions}>
                        <button className={styles.iconBtn} onClick={() => editQuestion(i)}>✏️</button>
                        <button className={styles.iconBtn} onClick={() => removeQuestion(i)}>🗑️</button>
                      </div>
                    </div>
                    <div className={styles.qOpts}>
                      {q.options.map((o, j) => (
                        <span key={j} className={`${styles.opt} ${j === q.correct ? styles.optCorrect : ''}`}>{o}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
