import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, Pause, Download, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const CallAnalyzerPro = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scriptChecks, setScriptChecks] = useState([]);
  const [selectedScript, setSelectedScript] = useState('vente');
  
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);

  // Scripts prédéfinis à vérifier
  const scripts = {
    vente: [
      "Bonjour, je m'appelle",
      "Comment allez-vous",
      "Je vous appelle concernant",
      "Auriez-vous quelques minutes",
      "Puis-je vous poser quelques questions",
      "Merci pour votre temps"
    ],
    support: [
      "Bonjour",
      "Puis-je avoir votre numéro de dossier",
      "Je comprends votre situation",
      "Je vais faire le nécessaire",
      "Y a-t-il autre chose",
      "Bonne journée"
    ],
    satisfaction: [
      "Bonjour",
      "Êtes-vous satisfait",
      "Pouvez-vous évaluer",
      "Qu'est-ce qui pourrait être amélioré",
      "Merci pour votre retour"
    ]
  };

  useEffect(() => {
    // Initialiser la reconnaissance vocale
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'fr-FR';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart + ' ';
          } else {
            interimTranscript += transcriptPart;
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
          checkScript(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Erreur de reconnaissance:', event.error);
      };
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  const checkScript = (text) => {
    const currentScript = scripts[selectedScript];
    const lowerText = text.toLowerCase();
    
    currentScript.forEach((phrase, index) => {
      if (lowerText.includes(phrase.toLowerCase())) {
        setScriptChecks(prev => {
          if (!prev.includes(index)) {
            return [...prev, index];
          }
          return prev;
        });
      }
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialiser l'analyseur audio pour le niveau sonore
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAudioLevel = () => {
        if (analyserRef.current && !isPaused) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / bufferLength;
          setAudioLevel(average);
        }
        if (isRecording) {
          requestAnimationFrame(updateAudioLevel);
        }
      };
      updateAudioLevel();

      // Démarrer la reconnaissance vocale
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      // Démarrer le timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      setIsRecording(true);
      setTranscript('');
      setScriptChecks([]);
      setAnalysis(null);
    } catch (error) {
      alert('Erreur: Impossible d\'accéder au microphone. Vérifiez les permissions.');
    }
  };

  const pauseRecording = () => {
    if (recognitionRef.current) {
      if (isPaused) {
        recognitionRef.current.start();
      } else {
        recognitionRef.current.stop();
      }
    }
    setIsPaused(!isPaused);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsRecording(false);
    setIsPaused(false);
    generateAnalysis();
  };

  const generateAnalysis = () => {
    const currentScript = scripts[selectedScript];
    const completionRate = (scriptChecks.length / currentScript.length) * 100;
    const wordCount = transcript.trim().split(/\s+/).length;
    const avgWordsPerMin = Math.round((wordCount / duration) * 60);

    setAnalysis({
      duration: formatDuration(duration),
      wordCount,
      avgWordsPerMin,
      completionRate: completionRate.toFixed(0),
      missingPhrases: currentScript.filter((_, index) => !scriptChecks.includes(index)),
      sentiment: analyzeSentiment(transcript)
    });
  };

  const analyzeSentiment = (text) => {
    const positiveWords = ['merci', 'excellent', 'parfait', 'super', 'génial', 'bien', 'content', 'satisfait'];
    const negativeWords = ['problème', 'désolé', 'erreur', 'mauvais', 'insatisfait', 'difficile'];
    
    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;
    
    if (positiveCount > negativeCount) return 'Positif';
    if (negativeCount > positiveCount) return 'Négatif';
    return 'Neutre';
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadReport = () => {
    const report = `
=== RAPPORT D'ANALYSE D'APPEL ===

Date: ${new Date().toLocaleDateString('fr-FR')}
Durée: ${analysis.duration}
Nombre de mots: ${analysis.wordCount}
Mots par minute: ${analysis.avgWordsPerMin}
Taux de complétion du script: ${analysis.completionRate}%
Sentiment: ${analysis.sentiment}

=== TRANSCRIPTION ===
${transcript}

=== PHRASES MANQUANTES ===
${analysis.missingPhrases.join('\n')}
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-appel-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">CallAnalyzer Pro</h1>
            <p className="text-gray-600">Analyse d'appels en temps réel avec détection de script</p>
          </div>

          {/* Script Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de script à vérifier</label>
            <select 
              value={selectedScript} 
              onChange={(e) => setSelectedScript(e.target.value)}
              disabled={isRecording}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="vente">Script de vente</option>
              <option value="support">Script support client</option>
              <option value="satisfaction">Enquête satisfaction</option>
            </select>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mb-8">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-full font-semibold transition shadow-lg"
              >
                <Mic className="w-6 h-6" />
                Démarrer l'enregistrement
              </button>
            ) : (
              <>
                <button
                  onClick={pauseRecording}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-4 rounded-full font-semibold transition"
                >
                  {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  {isPaused ? 'Reprendre' : 'Pause'}
                </button>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-full font-semibold transition"
                >
                  <MicOff className="w-5 h-5" />
                  Arrêter
                </button>
              </>
            )}
          </div>

          {/* Audio Level & Duration */}
          {isRecording && (
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Niveau audio</span>
                <span className="text-lg font-bold text-indigo-600">{formatDuration(duration)}</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-100"
                  style={{ width: `${Math.min(100, audioLevel)}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Script Checklist */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-indigo-600" />
                Vérification du script
              </h3>
              <div className="space-y-3">
                {scripts[selectedScript].map((phrase, index) => (
                  <div 
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg transition ${
                      scriptChecks.includes(index) ? 'bg-green-100' : 'bg-white'
                    }`}
                  >
                    {scriptChecks.includes(index) ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0 mt-0.5" />
                    )}
                    <span className={`text-sm ${scriptChecks.includes(index) ? 'text-green-800 font-medium' : 'text-gray-600'}`}>
                      {phrase}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Progression: <span className="font-bold text-indigo-600">
                    {scriptChecks.length}/{scripts[selectedScript].length}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Transcript */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Transcription en direct
              </h3>
              <div className="bg-white rounded-lg p-4 h-80 overflow-y-auto text-sm text-gray-700 leading-relaxed">
                {transcript || (
                  <span className="text-gray-400 italic">
                    La transcription apparaîtra ici pendant l'enregistrement...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Analysis Results */}
          {analysis && (
            <div className="mt-8 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Synthèse de l'appel</h3>
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </button>
              </div>

              <div className="grid md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-indigo-600">{analysis.duration}</div>
                  <div className="text-sm text-gray-600 mt-1">Durée</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-indigo-600">{analysis.wordCount}</div>
                  <div className="text-sm text-gray-600 mt-1">Mots prononcés</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-indigo-600">{analysis.avgWordsPerMin}</div>
                  <div className="text-sm text-gray-600 mt-1">Mots/minute</div>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-indigo-600">{analysis.completionRate}%</div>
                  <div className="text-sm text-gray-600 mt-1">Complétion</div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    Phrases manquantes
                  </h4>
                  {analysis.missingPhrases.length > 0 ? (
                    <ul className="space-y-2">
                      {analysis.missingPhrases.map((phrase, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                          {phrase}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-green-600 text-sm">Toutes les phrases ont été prononcées !</p>
                  )}
                </div>

                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Sentiment général</h4>
                  <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${
                    analysis.sentiment === 'Positif' ? 'bg-green-100 text-green-800' :
                    analysis.sentiment === 'Négatif' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {analysis.sentiment}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Note */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>Note:</strong> Cette application utilise la Web Speech API de votre navigateur (gratuite). 
            Vos données restent privées et ne sont pas envoyées à des serveurs externes.
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallAnalyzerPro;
