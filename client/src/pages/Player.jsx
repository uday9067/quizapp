import React, { useState, useEffect, useRef } from 'react'
import socket from '../socket'
import styles from './Player.module.css'

export default function Player({ onBack }) {
  const [step, setStep] = useState('join') // join | waiting | question | result | finished | leaderboard
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const [question, setQuestion] = useState(null)
  const [totalQ, setTotalQ] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [answerResult, setAnswerResult] = useState(null)

  const [timeLeft, setTimeLeft] = useState(0)
  const [totalTime, setTotalTime] = useState(20)
  const timerRef = useRef(null)

  const [totalScore, setTotalScore] = useState(0)
  const [results, setResults] = useState([])
  const [myRank, setMyRank] = useState(null)

  const startTimer = (seconds) => {
    clearInterval(timerRef.current)
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  useEffect(() => {
    socket.on('joined_room', ({ code: c, totalQuestions }) => {
      setTotalQ(totalQuestions)
      setStep('waiting')
    })

    socket.on('quiz_started', ({ totalQuestions, timerSeconds }) => {
      setTotalQ(totalQuestions)
      setTotalTime(timerSeconds)
    })

    socket.on('question', (q) => {
      setQuestion(q)
      setSelected(null)
      setAnswered(false)
      setAnswerResult(null)
      setStep('question')
      startTimer(q.timerSeconds)
    })

    socket.on('answer_result', ({ correct, points, totalScore }) => {
      setAnswerResult({ correct, points })
      setTotalScore(totalScore)
      clearInterval(timerRef.current)
    })

    socket.on('quiz_complete', ({ score }) => {
      setTotalScore(score)
      setStep('finished')
    })

    socket.on('final_results', ({ results }) => {
      setResults(results)
      const me = results.find(r => r.name === name)
      setMyRank(me ? me.rank : null)
      setStep('leaderboard')
    })

    socket.on('error', ({ msg }) => {
      setError(msg)
    })

    return () => {
      socket.off('joined_room')
      socket.off('quiz_started')
      socket.off('question')
      socket.off('answer_result')
      socket.off('quiz_complete')
      socket.off('final_results')
      socket.off('error')
      clearInterval(timerRef.current)
    }
  }, [name])

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (timeLeft === 0 && step === 'question' && !answered && question) {
      socket.emit('time_up', { code, qIndex: question.index })
      setAnswered(true)
      setAnswerResult({ correct: false, points: 0 })
    }
  }, [timeLeft, step, answered, question, code])

  const joinRoom = () => {
    if (!code.trim()) return setError('Enter a room code')
    if (!name.trim()) return setError('Enter your name')
    setError('')
    socket.emit('join_room', { code: code.trim().toUpperCase(), name: name.trim() })
  }

  const submitAnswer = (optIndex) => {
    if (answered) return
    setSelected(optIndex)
    setAnswered(true)
    const timeTaken = totalTime - timeLeft
    socket.emit('submit_answer', { code, qIndex: question.index, answer: optIndex, timeTaken })
  }

  // ---- VIEWS ----

  if (step === 'join') {
    return (
      <div className={styles.center}>
        <div className={styles.joinCard}>
          <button className={`btn btn-ghost ${styles.back}`} onClick={onBack}>← Back</button>
          <h1>Join Quiz</h1>
          <p className={styles.sub}>Enter the room code from your host</p>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.field}>
            <label>Room Code</label>
            <input
              placeholder="e.g. AB12CD"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              style={{ textTransform: 'uppercase', letterSpacing: 4, fontSize: 22, fontWeight: 700, textAlign: 'center' }}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
            />
          </div>
          <div className={styles.field}>
            <label>Your Name</label>
            <input
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinRoom()}
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={joinRoom}>
            Join Room →
          </button>
        </div>
      </div>
    )
  }

  if (step === 'waiting') {
    return (
      <div className={styles.center}>
        <div className={styles.waitCard}>
          <div className={styles.spinner} />
          <h2>Waiting for host...</h2>
          <p className={styles.sub}>The quiz will start soon. Get ready!</p>
          <div className={styles.nameTag}>You're in as <strong>{name}</strong></div>
        </div>
      </div>
    )
  }

  if (step === 'question' && question) {
    const progress = ((question.index) / totalQ) * 100
    const timerPct = (timeLeft / totalTime) * 100
    const timerColor = timeLeft <= 5 ? '#ff6b6b' : timeLeft <= 10 ? '#ffd166' : '#43d98c'

    return (
      <div className={styles.qPage}>
        <div className={styles.qHeader}>
          <span className={styles.qCounter}>Q{question.index + 1} / {totalQ}</span>
          <div className={styles.timerWrap}>
            <svg viewBox="0 0 36 36" className={styles.timerSvg}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={timerColor}
                strokeWidth="3"
                strokeDasharray={`${timerPct} 100`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
                style={{ transition: 'stroke-dasharray 1s linear, stroke 0.3s' }}
              />
            </svg>
            <span className={styles.timerNum} style={{ color: timerColor }}>{timeLeft}</span>
          </div>
          <span className={styles.score}>{totalScore} pts</span>
        </div>

        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.qBody}>
          <h2 className={styles.qQuestion}>{question.question}</h2>

          <div className={styles.options}>
            {question.options.map((opt, i) => {
              let cls = styles.option
              if (answered) {
                if (i === selected && answerResult?.correct) cls += ' ' + styles.correct
                else if (i === selected && !answerResult?.correct) cls += ' ' + styles.wrong
                else cls += ' ' + styles.dimmed
              } else if (selected === i) {
                cls += ' ' + styles.selected
              }
              return (
                <button key={i} className={cls} onClick={() => submitAnswer(i)} disabled={answered}>
                  <span className={styles.optLabel}>{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              )
            })}
          </div>

          {answered && answerResult && (
            <div className={`${styles.feedback} ${answerResult.correct ? styles.feedbackGood : styles.feedbackBad}`}>
              {answerResult.correct ? `✓ Correct! +${answerResult.points} points` : '✗ Wrong! Next question coming...'}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 'finished') {
    return (
      <div className={styles.center}>
        <div className={styles.waitCard}>
          <div className={styles.spinner} />
          <h2>Quiz Complete!</h2>
          <p className={styles.sub}>Your score: <strong style={{ color: 'var(--accent)', fontSize: 24 }}>{totalScore} pts</strong></p>
          <p className={styles.sub} style={{ marginTop: 8 }}>Waiting for all players to finish...</p>
        </div>
      </div>
    )
  }

  if (step === 'leaderboard') {
    return (
      <div className={styles.leaderPage}>
        <h1>🏆 Leaderboard</h1>
        {myRank && (
          <div className={styles.myResult}>
            Your rank: <strong>#{myRank}</strong> · Score: <strong>{totalScore} pts</strong>
          </div>
        )}
        <div className={styles.lbList}>
          {results.map((r, i) => (
            <div key={i} className={`${styles.lbRow} ${r.name === name ? styles.lbMe : ''} ${i === 0 ? styles.gold : i === 1 ? styles.silver : i === 2 ? styles.bronze : ''}`}>
              <span className={styles.lbRank}>#{r.rank}</span>
              <span className={styles.lbName}>{r.name}{r.name === name ? ' (you)' : ''}</span>
              <span className={styles.lbScore}>{r.score} pts</span>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={onBack}>← Back to Home</button>
      </div>
    )
  }

  return null
}
