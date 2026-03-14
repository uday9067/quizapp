import React from 'react'
import styles from './Home.module.css'

export default function Home({ onHost, onJoin }) {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div className={styles.badge}>Live Quiz Platform</div>
        <h1 className={styles.title}>Quiz<span>Sync</span></h1>
        <p className={styles.sub}>Host live quizzes. Compete in real-time. See who's the fastest.</p>
        <div className={styles.cards}>
          <button className={styles.card} onClick={onHost}>
            <div className={styles.icon}>🎯</div>
            <h2>Host a Quiz</h2>
            <p>Create questions, manage players, and control the game</p>
            <span className={styles.arrow}>Get Started →</span>
          </button>
          <button className={styles.card} onClick={onJoin}>
            <div className={styles.icon}>⚡</div>
            <h2>Join a Quiz</h2>
            <p>Enter a room code and compete with others in real-time</p>
            <span className={styles.arrow}>Join Now →</span>
          </button>
        </div>
      </div>
      <div className={styles.dots} />
    </div>
  )
}
