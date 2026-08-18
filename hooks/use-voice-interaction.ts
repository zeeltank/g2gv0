'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor
    SpeechRecognition?: SpeechRecognitionConstructor
  }

  interface SpeechRecognitionConstructor {
    new (): SpeechRecognition
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    start(): void
    stop(): void
    abort(): void
    onresult: ((event: SpeechRecognitionEvent) => void) | null
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
    onend: (() => void) | null
  }

  interface SpeechRecognitionResult {
    readonly isFinal: boolean
    0: {
      transcript: string
    }
  }

  interface SpeechRecognitionEvent {
    resultIndex: number
    results: ArrayLike<SpeechRecognitionResult>
  }

  interface SpeechRecognitionErrorEvent {
    error: string
  }
}

const SUPPORTED_LANGUAGES = [
  { label: 'English', value: 'en-IN' },
  { label: 'Hindi', value: 'hi-IN' },
  { label: 'Gujarati', value: 'gu-IN' },
]

export function useVoiceInteraction() {
  const [language, setLanguage] = useState('en-IN')
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const isSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  )

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const startRecording = useCallback(() => {
    if (!isSupported || typeof window === 'undefined') {
      setError('Voice recognition is not supported in this browser.')
      return
    }

    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!Recognition) {
      setError('Voice recognition is not available.')
      return
    }

    setError(null)
    setTranscript('')
    const recognition = new Recognition()
    recognition.lang = language
    recognition.continuous = false
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let nextTranscript = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        nextTranscript += event.results[index][0].transcript
      }
      setTranscript(nextTranscript.trim())
    }

    recognition.onerror = (event) => {
      setError(`Voice recognition error: ${event.error}`)
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
  }, [isSupported, language])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setIsRecording(false)
  }, [])

  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setError('Text-to-speech is not supported in this browser.')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => {
      setError('Text-to-speech playback failed.')
      setIsSpeaking(false)
    }

    setError(null)
    setIsSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [language])

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }, [])

  return {
    supportedLanguages: SUPPORTED_LANGUAGES,
    isSupported,
    language,
    setLanguage,
    transcript,
    setTranscript,
    isRecording,
    startRecording,
    stopRecording,
    isSpeaking,
    speakText,
    stopSpeaking,
    error,
    clearError: () => setError(null),
  }
}
