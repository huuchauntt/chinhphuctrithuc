import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BellRing, CheckCircle2, XCircle, Trophy, Clock, BrainCircuit, KeyRound } from 'lucide-react';
import { api } from '../services/api';
import { generateQuestions } from '../services/gemini';
import { Question, Session, Class } from '../types';
import { getDirectMediaUrl } from '../lib/utils';

export default function Player() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [deviceId] = useState(() => Math.random().toString(36).substring(2, 15));
  
  const [gameMode, setGameMode] = useState<'session' | 'ai' | 'preview'>('session');
  const [pin, setPin] = useState('');
  const [previewQuizId, setPreviewQuizId] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiTimeLimit, setAiTimeLimit] = useState(15);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(15);

  const [gameState, setGameState] = useState<'login' | 'select-name' | 'waiting' | 'playing' | 'result'>('login');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  
  const [timeLeft, setTimeLeft] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);

  // New states for new question types
  const [shortAnswerText, setShortAnswerText] = useState('');
  const [matchingPairs, setMatchingPairs] = useState<{left: string, right: string}[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [shuffledRight, setShuffledRight] = useState<string[]>([]);

  // Audio refs
  const correctSound = useRef<HTMLAudioElement | null>(null);
  const wrongSound = useRef<HTMLAudioElement | null>(null);
  const bellSound = useRef<HTMLAudioElement | null>(null);
  const bgMusic = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize sounds
    correctSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3');
    wrongSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3');
    bellSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
    
    // Fun background music
    bgMusic.current = new Audio('https://assets.mixkit.co/music/preview/mixkit-funny-times-654.mp3');
    bgMusic.current.loop = true;
    bgMusic.current.volume = 0.15; // Low volume

    // Check for PIN or Preview in URL
    const searchParams = new URLSearchParams(window.location.search);
    const urlPin = searchParams.get('pin');
    const urlPreview = searchParams.get('preview');
    
    if (urlPin) {
      setPin(urlPin);
      setGameMode('session');
    } else if (urlPreview) {
      setPreviewQuizId(urlPreview);
      setGameMode('preview');
      setPlayerName('Giáo viên (Xem trước)');
      // Auto join if it's a preview
      setTimeout(() => handleJoin(urlPreview), 500);
    }
  }, []);

  const handleJoin = async (overridePreviewId?: string) => {
    const currentPreviewId = overridePreviewId || previewQuizId;
    
    if (gameMode === 'ai' && !playerName.trim()) {
      alert('Vui lòng nhập tên của bạn!');
      return;
    }

    if (gameMode === 'ai' && !aiTopic.trim()) {
      alert('Vui lòng nhập chủ đề!');
      return;
    }

    if (gameMode === 'session' && !pin.trim()) {
      alert('Vui lòng nhập mã PIN!');
      return;
    }

    setIsLoadingSession(true);
    try {
      let data: Question[] = [];
      let limit = 15;
      
      if (gameMode === 'ai') {
        setGameState('waiting');
        data = await generateQuestions(aiTopic, aiCount);
        limit = aiTimeLimit;
      } else if (gameMode === 'preview' && currentPreviewId) {
        setGameState('waiting');
        const quiz = await api.getQuiz(currentPreviewId);
        data = quiz.questions;
        limit = quiz.timeLimit || 15;
      } else {
        const session = await api.getSessionByPin(pin);
        if (!session) {
          alert('Không tìm thấy phiên thi với mã PIN này, hoặc phiên thi đã kết thúc.');
          setIsLoadingSession(false);
          return;
        }
        
        // Check start time
        if (session.startTime) {
          const start = session.startTime.toDate ? session.startTime.toDate() : new Date(session.startTime.seconds * 1000);
          if (start > new Date()) {
            alert(`Phiên thi chưa bắt đầu. Thời gian bắt đầu: ${start.toLocaleString('vi-VN')}`);
            setIsLoadingSession(false);
            return;
          }
        }

        // Check end time
        if (session.endTime) {
          const end = session.endTime.toDate ? session.endTime.toDate() : new Date(session.endTime.seconds * 1000);
          if (end < new Date()) {
            alert(`Phiên thi đã kết thúc vào lúc: ${end.toLocaleString('vi-VN')}`);
            setIsLoadingSession(false);
            return;
          }
        }

        setCurrentSession(session);
        
        // Check if session has a class
        if (session.classId) {
          const cls = await api.getClass(session.classId);
          if (cls) {
            setSelectedClass(cls);
            setGameState('select-name');
            setIsLoadingSession(false);
            return;
          }
        }

        // If no class, but player name is empty, ask for it
        if (!playerName.trim()) {
          alert('Vui lòng nhập tên của bạn!');
          setIsLoadingSession(false);
          return;
        }

        setGameState('waiting');
        const quiz = await api.getQuiz(session.quizId);
        data = quiz.questions;
        limit = session.timeLimit || 15;
      }

      if (data && data.length > 0) {
        setQuestions(data);
        setGameState('playing');
        
        setQuestionTimeLimit(limit);
        setTimeLeft(limit);
        
        if (bellSound.current) bellSound.current.play().catch(e => console.log(e));
      } else {
        alert('Không có câu hỏi nào trong bộ đề này.');
        setGameState('login');
      }
    } catch (error: any) {
      alert(error.message);
      setGameState('login');
    } finally {
      setIsLoadingSession(false);
    }
  };

  const handleSelectStudent = async (name: string) => {
    setPlayerName(name);
    if (!currentSession) return;
    
    setGameState('waiting');
    setIsLoadingSession(true);
    try {
      const quiz = await api.getQuiz(currentSession.quizId);
      const data = quiz.questions;
      
      if (data && data.length > 0) {
        setQuestions(data);
        setGameState('playing');
        
        const limit = data[0].timeLimit || currentSession?.timeLimit || 15;
        setQuestionTimeLimit(limit);
        setTimeLeft(limit);
        
        if (data[0].type === 'matching' && data[0].matchingPairs) {
          setShuffledRight([...data[0].matchingPairs.map(p => p.right)].sort(() => Math.random() - 0.5));
        }
        
        if (bellSound.current) bellSound.current.play().catch(e => console.log(e));
      } else {
        alert('Không có câu hỏi nào trong bộ đề này.');
        setGameState('login');
      }
    } catch (error: any) {
      alert(error.message);
      setGameState('login');
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Background music control
  useEffect(() => {
    if (gameState === 'playing') {
      const currentQ = questions[currentQuestionIdx];
      const hasMedia = currentQ?.audioUrl || currentQ?.videoUrl;

      if (hasMedia) {
        bgMusic.current?.pause();
      } else {
        bgMusic.current?.play().catch(e => console.log("Autoplay blocked or error:", e));
      }
    } else {
      bgMusic.current?.pause();
      if (bgMusic.current) bgMusic.current.currentTime = 0;
    }

    return () => {
      bgMusic.current?.pause();
    };
  }, [gameState, currentQuestionIdx, questions]);

  // Timer logic
  useEffect(() => {
    if (gameState === 'playing' && !isAnswerChecked && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && !isAnswerChecked) {
      handleTimeUp();
    }
  }, [timeLeft, gameState, isAnswerChecked]);

  const handleTimeUp = () => {
    setIsAnswerChecked(true);
    if (wrongSound.current) wrongSound.current.play().catch(e => console.log(e));
    setTimeout(nextQuestion, 3000);
  };

  const handleAnswer = (answer: string) => {
    if (isAnswerChecked) return;
    
    setSelectedAnswer(answer);
    setIsAnswerChecked(true);
    
    const currentQ = questions[currentQuestionIdx];
    let isCorrect = false;

    if (!currentQ.type || currentQ.type === 'multiple_choice' || currentQ.type === 'true_false') {
      isCorrect = answer === currentQ.correctAnswer;
    } else if (currentQ.type === 'short_answer' || currentQ.type === 'fill_blank') {
      isCorrect = answer.trim().toLowerCase() === (currentQ.correctAnswer || '').trim().toLowerCase();
    } else if (currentQ.type === 'matching') {
      try {
        const pairs = JSON.parse(answer) as {left: string, right: string}[];
        isCorrect = pairs.length === currentQ.matchingPairs?.length && 
                    pairs.every(p => currentQ.matchingPairs?.find(mp => mp.left === p.left && mp.right === p.right));
      } catch (e) {
        isCorrect = false;
      }
    }
    
    if (isCorrect) {
      setScore(prev => prev + 10);
      if (correctSound.current) correctSound.current.play().catch(e => console.log(e));
    } else {
      if (wrongSound.current) wrongSound.current.play().catch(e => console.log(e));
    }

    setTimeout(nextQuestion, 3000);
  };

  const nextQuestion = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setIsAnswerChecked(false);
      setShortAnswerText('');
      setMatchingPairs([]);
      setSelectedLeft(null);
      
      const nextQ = questions[currentQuestionIdx + 1];
      const limit = nextQ.timeLimit || currentSession?.timeLimit || 15;
      setQuestionTimeLimit(limit);
      setTimeLeft(limit);
      
      if (nextQ.type === 'matching' && nextQ.matchingPairs) {
        setShuffledRight([...nextQ.matchingPairs.map(p => p.right)].sort(() => Math.random() - 0.5));
      }
    } else {
      finishGame();
    }
  };

  const finishGame = async () => {
    setGameState('result');
    const finalScore = score + (selectedAnswer === questions[currentQuestionIdx].correctAnswer ? 10 : 0);
    setScore(finalScore);
    
    if (gameMode === 'session' && currentSession) {
      try {
        await api.saveScore({
          sessionId: currentSession.id!,
          playerName,
          deviceId,
          score: finalScore,
        });
      } catch (error) {
        console.error("Failed to save score:", error);
      }
    }
  };

  if (gameState === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 flex flex-col items-center justify-center p-4">
        <button onClick={() => navigate('/')} className="absolute top-4 left-4 p-2 text-white/80 hover:text-white">
          <ArrowLeft size={24} />
        </button>
        
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-8 text-center border-t-8 border-rose-500">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            {gameMode === 'ai' ? <BrainCircuit size={40} className="text-amber-500" /> : <KeyRound size={40} className="text-amber-500" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            {gameMode === 'preview' ? 'Chế độ xem trước' : 'Tham gia thi đấu'}
          </h1>
          
          {gameMode === 'preview' ? (
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">Đang tải bộ đề để xem trước...</p>
              <button 
                onClick={() => handleJoin()}
                disabled={isLoadingSession}
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-lg transition-colors disabled:opacity-50"
              >
                {isLoadingSession ? 'ĐANG TẢI...' : 'BẮT ĐẦU XEM TRƯỚC'}
              </button>
            </div>
          ) : (
            <>
          <div className="space-y-4">
            {/* Player Name is always needed for Session (if class exists) */}
            {(gameMode === 'session' && !pin) && (
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Nhập họ và tên của bạn"
                className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-center text-lg font-semibold focus:border-amber-500 focus:ring-0 outline-none transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
            )}
            
            {gameMode === 'session' && (
              <input 
                type="text" 
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Mã PIN (VD: 123456)"
                className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-center text-lg font-semibold tracking-widest focus:border-amber-500 focus:ring-0 outline-none transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              />
            )}

            <button 
              onClick={() => handleJoin()}
              disabled={isLoadingSession}
              className="w-full py-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-xl font-bold text-lg shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              {isLoadingSession ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ĐANG TẢI...
                </>
              ) : (
                'BẮT ĐẦU'
              )}
            </button>
          </div>
          </>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'select-name') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border-t-8 border-rose-500">
          <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Chọn tên của bạn</h1>
          <p className="text-gray-500 text-center mb-6">Lớp: <span className="font-bold text-rose-600">{selectedClass?.name}</span></p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-rose-200">
            {selectedClass?.students.map(student => (
              <button
                key={student.id}
                onClick={() => handleSelectStudent(student.name)}
                className="p-4 bg-gray-50 hover:bg-rose-50 border-2 border-gray-100 hover:border-rose-500 rounded-xl text-left transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center font-bold text-sm group-hover:bg-rose-500 group-hover:text-white transition-colors">
                    {student.id}
                  </span>
                  <span className="font-medium text-gray-700 group-hover:text-gray-900">{student.name}</span>
                </div>
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setGameState('login')}
            className="w-full mt-6 py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-500 to-orange-500 flex flex-col items-center justify-center p-4 text-white">
        <div className="animate-spin mb-4">
          <Clock size={48} />
        </div>
        <h2 className="text-2xl font-bold animate-pulse">
          {gameMode === 'ai' ? 'AI đang tạo câu hỏi...' : 'Đang tải câu hỏi...'}
        </h2>
      </div>
    );
  }

  if (gameState === 'result') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 flex flex-col items-center justify-center p-4">
        <div className="w-full max-sm bg-white rounded-3xl shadow-2xl p-8 text-center border-t-8 border-rose-500">
          <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trophy size={48} className="text-rose-500" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Hoàn thành!</h1>
          <p className="text-gray-500 mb-8">Bạn đã xuất sắc vượt qua các câu hỏi</p>
          
          <div className="bg-rose-50 rounded-2xl p-6 mb-8">
            <p className="text-sm text-rose-500 font-medium mb-1">ĐIỂM CỦA BẠN</p>
            <p className="text-5xl font-black text-orange-500">{score}</p>
          </div>
          
          <button 
            onClick={() => {
              setGameState('login');
              setScore(0);
              setCurrentQuestionIdx(0);
            }}
            className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-lg transition-transform active:scale-95"
          >
            Chơi lại
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIdx];

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col font-sans selection:bg-amber-200">
      {/* Header */}
      <header className="bg-amber-100/80 backdrop-blur-md px-4 py-3 shadow-sm flex justify-between items-center sticky top-0 z-10 border-b border-amber-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-orange-500 rounded-xl flex items-center justify-center shadow-inner">
            <span className="font-black text-white text-sm">{currentQuestionIdx + 1}/{questions.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gradient-to-r from-amber-200 to-orange-200 px-4 py-2 rounded-xl shadow-sm border border-amber-300/50">
          <Trophy size={18} className="text-orange-700 drop-shadow-sm" />
          <span className="font-black text-orange-900 text-lg">{score}</span>
        </div>
      </header>

      {/* Timer Bar */}
      <div className="w-full h-2 bg-amber-100 relative overflow-hidden">
        <div 
          className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-linear rounded-r-full ${timeLeft > 5 ? 'bg-gradient-to-r from-orange-400 to-rose-500' : 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse'}`}
          style={{ width: `${(timeLeft / questionTimeLimit) * 100}%` }}
        />
      </div>

      {/* Question Area */}
      <main className="flex-1 flex flex-col p-4 max-w-2xl mx-auto w-full overflow-y-auto">
        <div className="flex-1 flex flex-col justify-center mb-6 space-y-6">
          <div className="bg-white rounded-3xl shadow-xl shadow-orange-200/50 p-6 sm:p-8 border border-amber-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500"></div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-800 text-center leading-snug">
              {currentQ.question}
            </h2>
          </div>
          
          {currentQ.imageUrl && (
            <div className="w-full rounded-3xl overflow-hidden shadow-lg border-4 border-white bg-white flex justify-center relative group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <img src={getDirectMediaUrl(currentQ.imageUrl, 'image')} alt="Question media" className="w-full h-auto object-contain max-h-64 sm:max-h-80 transition-transform duration-500 group-hover:scale-[1.02]" referrerPolicy="no-referrer" />
            </div>
          )}
          
          {currentQ.audioUrl && (
            <div className="w-full bg-white p-4 rounded-3xl shadow-lg border border-gray-100">
              <audio controls className="w-full h-12">
                <source src={getDirectMediaUrl(currentQ.audioUrl, 'audio')} />
                Trình duyệt của bạn không hỗ trợ thẻ audio.
              </audio>
            </div>
          )}
          
          {currentQ.videoUrl && (
            <div className="w-full rounded-3xl overflow-hidden shadow-lg border-4 border-gray-900 flex justify-center bg-gray-900">
              <video controls className="w-full h-auto max-h-64 sm:max-h-80 object-contain">
                <source src={getDirectMediaUrl(currentQ.videoUrl, 'video')} />
                Trình duyệt của bạn không hỗ trợ thẻ video.
              </video>
            </div>
          )}
        </div>

        {/* Options */}
        {(!currentQ.type || currentQ.type === 'multiple_choice') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-8">
            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
              const isSelected = selectedAnswer === opt;
              const isCorrect = currentQ.correctAnswer === opt;
              
              let btnClass = "relative p-4 sm:p-5 rounded-2xl border-b-4 text-left font-bold text-lg transition-all duration-200 transform ";
              
              if (!isAnswerChecked) {
                btnClass += "bg-white border-orange-200 text-gray-700 hover:-translate-y-1 hover:border-orange-400 hover:shadow-lg active:translate-y-0 active:border-b-0 active:mt-1";
              } else {
                if (isCorrect) {
                  btnClass += "bg-green-500 border-green-700 text-white shadow-lg scale-[1.02]";
                } else if (isSelected && !isCorrect) {
                  btnClass += "bg-rose-500 border-rose-700 text-white shadow-inner opacity-90";
                } else {
                  btnClass += "bg-orange-50 border-orange-100 text-gray-400 opacity-50 scale-95";
                }
              }

              return (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  disabled={isAnswerChecked}
                  className={btnClass}
                >
                  <div className="flex items-center">
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 font-black text-xl shadow-sm ${
                      isAnswerChecked && isCorrect ? 'bg-white/20 text-white' : 
                      isAnswerChecked && isSelected && !isCorrect ? 'bg-white/20 text-white' : 
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {opt}
                    </span>
                    <span className="flex-1 leading-tight">{currentQ[`option${opt}` as keyof Question]}</span>
                    
                    {isAnswerChecked && isCorrect && (
                      <div className="absolute right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm animate-bounce">
                        <CheckCircle2 className="text-green-500" size={24} />
                      </div>
                    )}
                    {isAnswerChecked && isSelected && !isCorrect && (
                      <div className="absolute right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <XCircle className="text-rose-500" size={24} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {currentQ.type === 'true_false' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pb-8">
            {(['A', 'B'] as const).map((opt) => {
              const isSelected = selectedAnswer === opt;
              const isCorrect = currentQ.correctAnswer === opt;
              
              let btnClass = "relative p-4 sm:p-5 rounded-2xl border-b-4 text-center font-bold text-xl transition-all duration-200 transform ";
              
              if (!isAnswerChecked) {
                btnClass += opt === 'A' ? "bg-orange-500 border-orange-700 text-white hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:border-b-0 active:mt-1" 
                                         : "bg-rose-500 border-rose-700 text-white hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:border-b-0 active:mt-1";
              } else {
                if (isCorrect) {
                  btnClass += "bg-green-500 border-green-700 text-white shadow-lg scale-[1.02]";
                } else if (isSelected && !isCorrect) {
                  btnClass += "bg-gray-500 border-gray-700 text-white shadow-inner opacity-90";
                } else {
                  btnClass += "bg-orange-100 border-orange-200 text-gray-400 opacity-50 scale-95";
                }
              }

              return (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  disabled={isAnswerChecked}
                  className={btnClass}
                >
                  {opt === 'A' ? 'Đúng' : 'Sai'}
                  {isAnswerChecked && isCorrect && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm animate-bounce">
                      <CheckCircle2 className="text-green-500" size={24} />
                    </div>
                  )}
                  {isAnswerChecked && isSelected && !isCorrect && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <XCircle className="text-rose-500" size={24} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {(currentQ.type === 'short_answer' || currentQ.type === 'fill_blank') && (
          <div className="flex flex-col gap-4 pb-8">
            <input
              type="text"
              value={shortAnswerText}
              onChange={e => setShortAnswerText(e.target.value)}
              disabled={isAnswerChecked}
              placeholder="Nhập câu trả lời của bạn..."
              className="w-full p-4 rounded-2xl border-2 border-orange-200 focus:border-rose-500 outline-none text-lg font-medium bg-white"
              onKeyDown={e => e.key === 'Enter' && handleAnswer(shortAnswerText)}
            />
            <button
              onClick={() => handleAnswer(shortAnswerText)}
              disabled={isAnswerChecked || !shortAnswerText.trim()}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-2xl font-bold text-lg transition-all shadow-lg active:scale-95"
            >
              Gửi câu trả lời
            </button>
            {isAnswerChecked && (
              <div className={`mt-4 p-4 rounded-xl border-2 ${
                shortAnswerText.trim().toLowerCase() === (currentQ.correctAnswer || '').trim().toLowerCase()
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <h4 className="font-bold mb-1">Đáp án đúng:</h4>
                <p className="text-lg">{currentQ.correctAnswer}</p>
              </div>
            )}
          </div>
        )}

        {currentQ.type === 'matching' && (
          <div className="flex flex-col gap-4 pb-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                {currentQ.matchingPairs?.map(pair => {
                  const isMatched = matchingPairs.find(p => p.left === pair.left);
                  return (
                    <button
                      key={`left-${pair.id}`}
                      disabled={isAnswerChecked || !!isMatched}
                      onClick={() => setSelectedLeft(pair.left)}
                      className={`w-full p-3 rounded-xl border-2 text-left font-medium transition-all ${
                        isMatched ? 'bg-green-50 border-green-200 text-green-700 opacity-50' :
                        selectedLeft === pair.left ? 'bg-rose-50 border-rose-500 text-rose-700' :
                        'bg-white border-orange-100 hover:border-orange-300'
                      }`}
                    >
                      {pair.left}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                {shuffledRight.map((rightText, idx) => {
                  const isMatched = matchingPairs.find(p => p.right === rightText);
                  return (
                    <button
                      key={`right-${idx}`}
                      disabled={isAnswerChecked || !!isMatched}
                      onClick={() => {
                        if (selectedLeft) {
                          const newPairs = [...matchingPairs, { left: selectedLeft, right: rightText }];
                          setMatchingPairs(newPairs);
                          setSelectedLeft(null);
                          if (newPairs.length === currentQ.matchingPairs?.length) {
                            handleAnswer(JSON.stringify(newPairs));
                          }
                        }
                      }}
                      className={`w-full p-3 rounded-xl border-2 text-left font-medium transition-all ${
                        isMatched ? 'bg-green-50 border-green-200 text-green-700 opacity-50' :
                        'bg-white border-orange-100 hover:border-orange-300'
                      }`}
                    >
                      {rightText}
                    </button>
                  );
                })}
              </div>
            </div>
            {isAnswerChecked && (
              <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-700 mb-2">Đáp án đúng:</h4>
                <ul className="space-y-1">
                  {currentQ.matchingPairs?.map(p => (
                    <li key={p.id} className="text-sm text-green-600 font-medium">{p.left} - {p.right}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
