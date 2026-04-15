import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { ArrowLeft, Camera, CheckCircle2, XCircle, Users, ChevronRight, Save } from 'lucide-react';
import { api } from '../services/api';
import { Session, Quiz, Question, Class } from '../types';
import { getDirectMediaUrl } from '../lib/utils';

export default function PaperMode() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  
  const [session, setSession] = useState<Session | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [isScanning, setIsScanning] = useState(true);
  
  // Map of studentId -> answer (A, B, C, D)
  const [scannedAnswers, setScannedAnswers] = useState<Record<string, string>>({});
  const [totalScores, setTotalScores] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Class management
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showClassModal, setShowClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassStudents, setNewClassStudents] = useState('');

  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (sessionId) {
      loadData(sessionId);
      loadClasses();
      unsubscribe = api.subscribeToSession(sessionId, (s) => {
        if (s) {
          setSession(s);
          if (s.currentQuestionIdx !== undefined) setCurrentQuestionIdx(s.currentQuestionIdx);
          if (s.scannedAnswers !== undefined) setScannedAnswers(s.scannedAnswers);
        }
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionId]);

  const loadData = async (id: string) => {
    try {
      const s = await api.getSession(id);
      if (s) {
        setSession(s);
        const q = await api.getQuiz(s.quizId);
        setQuiz(q);
        if (s.currentQuestionIdx !== undefined) setCurrentQuestionIdx(s.currentQuestionIdx);
        if (s.scannedAnswers !== undefined) setScannedAnswers(s.scannedAnswers);
        if (s.classId) setSelectedClassId(s.classId);
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const loadClasses = async () => {
    try {
      const data = await api.getMyClasses();
      setClasses(data);
    } catch (error) {
      console.error("Failed to load classes", error);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim() || !newClassStudents.trim()) {
      alert('Vui lòng nhập tên lớp và danh sách học sinh!');
      return;
    }

    const lines = newClassStudents.split('\n');
    const students = lines.map(line => {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match) {
        return { id: match[1], name: match[2].trim() };
      }
      return null;
    }).filter(s => s !== null) as {id: string, name: string}[];

    if (students.length === 0) {
      alert('Danh sách học sinh không hợp lệ. Vui lòng nhập theo định dạng: "Số_thứ_tự Họ_và_tên" trên mỗi dòng.');
      return;
    }

    try {
      const classId = await api.saveClass(newClassName, students);
      await loadClasses();
      setSelectedClassId(classId);
      setShowClassModal(false);
      setNewClassName('');
      setNewClassStudents('');
      alert('Đã tạo lớp thành công!');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const processFrame = useCallback(() => {
    if (!isScanning) return;

    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;

    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data.startsWith('student:')) {
          const studentId = code.data.split(':')[1];
          
          // Calculate orientation
          const { topLeftCorner, topRightCorner } = code.location;
          const dx = topRightCorner.x - topLeftCorner.x;
          const dy = topRightCorner.y - topLeftCorner.y;
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          
          let answer = '';
          if (angle >= -45 && angle < 45) answer = 'A';
          else if (angle >= -135 && angle < -45) answer = 'B';
          else if (angle >= 45 && angle < 135) answer = 'D';
          else answer = 'C'; // 135 to 180 or -180 to -135

          setScannedAnswers(prev => {
            if (prev[studentId] !== answer) {
              // Play a tiny beep sound for feedback
              const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3');
              audio.volume = 0.2;
              audio.play().catch(() => {});
              
              const newAnswers = { ...prev, [studentId]: answer };
              if (sessionId) {
                api.updateSessionPaperModeState(sessionId, currentQuestionIdx, newAnswers).catch(console.error);
              }
              return newAnswers;
            }
            return prev;
          });
        }
      }
    }
    
    if (isScanning) {
      requestAnimationFrame(processFrame);
    }
  }, [isScanning, sessionId, currentQuestionIdx]);

  useEffect(() => {
    if (isScanning) {
      const animationId = requestAnimationFrame(processFrame);
      return () => cancelAnimationFrame(animationId);
    }
  }, [isScanning, processFrame]);

  const handleNextQuestion = async () => {
    // Calculate scores for current question
    if (!quiz || !sessionId) return;
    const currentQ = quiz.questions[currentQuestionIdx];
    
    const newScores = { ...totalScores };
    Object.entries(scannedAnswers).forEach(([studentId, answer]) => {
      if (answer === currentQ.correctAnswer) {
        newScores[studentId] = (newScores[studentId] || 0) + 10;
      } else if (!newScores[studentId]) {
        newScores[studentId] = 0; // Initialize if they answered wrong but haven't scored before
      }
    });
    setTotalScores(newScores);
    
    // Reset for next question
    setScannedAnswers({});
    // setIsScanning(false); // We want to keep scanning active if they are using the phone

    if (currentQuestionIdx < quiz.questions.length - 1) {
      const nextIdx = currentQuestionIdx + 1;
      setCurrentQuestionIdx(nextIdx);
      try {
        await api.updateSessionPaperModeState(sessionId, nextIdx, {});
      } catch (error) {
        console.error("Failed to sync next question state", error);
      }
    } else {
      finishSession(newScores);
    }
  };

  const finishSession = async (finalScores: Record<string, number>) => {
    if (!sessionId) return;
    setIsSaving(true);
    try {
      const selectedClass = classes.find(c => c.id === selectedClassId);
      
      // Map scores to include actual student names if a class is selected
      const scoresToSave: Record<string, number> = {};
      const finalScoresWithNames: Record<string, number> = {};
      
      Object.entries(finalScores).forEach(([studentId, score]) => {
        let name = `Học sinh ${studentId}`;
        if (selectedClass) {
          const student = selectedClass.students.find(s => s.id === studentId);
          if (student) name = student.name;
        }
        // We pass the mapped name to api.savePaperModeScores by modifying the api or just passing it.
        // Wait, api.savePaperModeScores currently hardcodes "Học sinh ${studentId}".
        // Let's update api.ts to accept a map of studentId -> { name, score } instead, or we can just save it here directly.
        // For now, let's just use the existing api, but we need to update api.ts to accept names.
      });

      await api.savePaperModeScores(sessionId, finalScores, selectedClass);
      await api.updateSessionStatus(sessionId, 'finished');
      alert('Đã hoàn thành phiên thi và lưu điểm!');
      setIsSaving(false);
    } catch (error: any) {
      alert(error.message);
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (session?.status === 'finished') {
      setIsScanning(false);
    }
  }, [session?.status]);

  if (!session || !quiz) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;

  const currentQ = quiz.questions[currentQuestionIdx];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white px-4 py-3 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Paper Mode: {quiz.title}</h1>
            <p className="text-sm text-gray-500">
              {session.status === 'finished' ? 'Đã kết thúc' : `Câu ${currentQuestionIdx + 1} / ${quiz.questions.length}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-amber-100 px-3 py-1.5 rounded-full text-amber-800 font-medium">
            <Users size={18} />
            {Object.keys(scannedAnswers).length} đã quét
          </div>
          {session.status === 'finished' ? (
            <button 
              onClick={() => navigate('/admin', { state: { tab: 'sessions', sessionId: session.id } })}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition-colors"
            >
              Xem kết quả
            </button>
          ) : (
            <button 
              onClick={handleNextQuestion}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              {currentQuestionIdx < quiz.questions.length - 1 ? (
                <>Câu tiếp theo <ChevronRight size={20} /></>
              ) : (
                <>{isSaving ? 'Đang lưu...' : 'Kết thúc & Lưu'} <Save size={20} /></>
              )}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-4 gap-4 max-w-7xl mx-auto w-full h-[calc(100vh-4rem)]">
        {session.status === 'finished' ? (
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Phiên thi đã kết thúc!</h2>
            <p className="text-gray-600 mb-8 max-w-md">
              Tất cả điểm số đã được lưu thành công. Bạn có thể xem bảng xếp hạng và chi tiết điểm số của học sinh trong phần quản trị.
            </p>
            <button 
              onClick={() => navigate('/admin', { state: { tab: 'sessions', sessionId: session.id } })}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors text-lg shadow-md"
            >
              Xem bảng xếp hạng
            </button>
          </div>
        ) : (
          <>
            {/* Left: Question Display */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col overflow-y-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
                {currentQ.question}
              </h2>
              
              {currentQ.imageUrl && (
                <div className="w-full rounded-xl overflow-hidden mb-4 max-h-48 flex justify-center">
                  <img src={getDirectMediaUrl(currentQ.imageUrl, 'image')} alt="Question media" className="h-full object-contain" referrerPolicy="no-referrer" />
                </div>
              )}

              {currentQ.audioUrl && (
                <div className="w-full bg-white p-2 rounded-xl shadow-sm border border-gray-200 mb-4">
                  <audio controls className="w-full h-10">
                    <source src={getDirectMediaUrl(currentQ.audioUrl, 'audio')} />
                  </audio>
                </div>
              )}
              
              {currentQ.videoUrl && (
                <div className="w-full rounded-xl overflow-hidden shadow-sm border border-gray-200 mb-4 flex justify-center bg-black">
                  <video controls className="h-full max-h-48 object-contain">
                    <source src={getDirectMediaUrl(currentQ.videoUrl, 'video')} />
                  </video>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-auto">
                {(!currentQ.type || currentQ.type === 'multiple_choice') && (['A', 'B', 'C', 'D'] as const).map((opt) => (
                  <div key={opt} className="p-4 rounded-xl border-2 border-gray-200 text-lg font-semibold flex items-center bg-gray-50">
                    <span className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center mr-3 text-xl shrink-0">
                      {opt}
                    </span>
                    <span className="break-words line-clamp-3">{currentQ[`option${opt}` as keyof Question]}</span>
                  </div>
                ))}
                {currentQ.type === 'true_false' && (['A', 'B'] as const).map((opt) => (
                  <div key={opt} className="p-4 rounded-xl border-2 border-gray-200 text-lg font-semibold flex items-center bg-gray-50">
                    <span className="w-10 h-10 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center mr-3 text-xl shrink-0">
                      {opt}
                    </span>
                    <span className="break-words line-clamp-3">{opt === 'A' ? 'Đúng' : 'Sai'}</span>
                  </div>
                ))}
              </div>
              
              {(currentQ.type === 'short_answer' || currentQ.type === 'fill_blank' || currentQ.type === 'matching') && (
                <div className="mt-auto p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
                  <p className="font-bold">Lưu ý:</p>
                  <p>Dạng câu hỏi này ({currentQ.type === 'short_answer' ? 'Trả lời ngắn' : currentQ.type === 'fill_blank' ? 'Điền khuyết' : 'Ghép nối'}) không được hỗ trợ trong chế độ quét thẻ giấy. Vui lòng bỏ qua câu này.</p>
                </div>
              )}
            </div>

            {/* Right: Scanner & Status */}
            <div className="w-full lg:w-96 flex flex-col gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Camera size={20} className="text-amber-500" />
                    Máy quét
                  </h3>
                  <button
                    onClick={() => setIsScanning(!isScanning)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                      isScanning ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-amber-500 text-white hover:bg-amber-600'
                    }`}
                  >
                    {isScanning ? 'Dừng quét' : 'Bắt đầu quét'}
                  </button>
                </div>
                <div className="relative aspect-video bg-black">
                  {isScanning ? (
                    <>
                      {/* @ts-ignore */}
                      <Webcam
                        ref={webcamRef}
                        audio={false}
                        videoConstraints={{ facingMode: "environment" }}
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="absolute inset-0 border-4 border-amber-500/50 m-4 rounded-xl pointer-events-none"></div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 flex-col gap-2">
                      <Camera size={48} className="opacity-20" />
                      <p>Camera đang tắt</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 flex-1 overflow-y-auto flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Trạng thái học sinh</h3>
                  <div className="flex gap-2">
                    <select 
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1 outline-none focus:border-amber-500"
                    >
                      <option value="">-- Chọn lớp --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button 
                      onClick={() => setShowClassModal(true)}
                      className="text-sm bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-100 font-medium"
                    >
                      + Lớp mới
                    </button>
                  </div>
                </div>
                
                {selectedClassId ? (
                  <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                    {classes.find(c => c.id === selectedClassId)?.students.map(student => {
                      const answer = scannedAnswers[student.id];
                      return (
                        <div key={student.id} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${answer ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-red-50 border-red-200 border-dashed opacity-80'}`}>
                          <div className="flex items-center gap-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${answer ? 'bg-green-500 text-white' : 'bg-red-200 text-red-700'}`}>
                              {student.id}
                            </span>
                            <span className={`font-bold text-sm ${answer ? 'text-green-800' : 'text-red-700'}`}>{student.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {answer ? (
                              <>
                                <span className="font-bold text-green-800 bg-green-200 w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-lg">{answer}</span>
                                <CheckCircle2 className="text-green-500" size={24} />
                              </>
                            ) : (
                              <span className="text-xs font-medium text-red-500 bg-red-100 px-2 py-1 rounded-md flex items-center gap-1">
                                <XCircle size={14} /> Chưa quét
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2">
                    {Array.from({ length: 40 }).map((_, i) => {
                      const id = String(i + 1);
                      const answer = scannedAnswers[id];
                      return (
                        <div 
                          key={id} 
                          className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold border-2 transition-all ${
                            answer 
                              ? 'bg-green-50 border-green-500 text-green-700 shadow-sm scale-105' 
                              : 'bg-red-50 border-red-200 border-dashed text-red-400 opacity-70'
                          }`}
                        >
                          <span className={answer ? 'text-xs opacity-70' : 'text-lg'}>{id}</span>
                          {answer && <span className="text-xl">{answer}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Create Class Modal */}
      {showClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users size={20} className="text-indigo-500" />
                Tạo lớp học mới
              </h3>
              <button onClick={() => setShowClassModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên lớp</label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="VD: Lớp 10A1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Danh sách học sinh</label>
                <p className="text-xs text-gray-500 mb-2">Dán danh sách theo định dạng: "Số_thứ_tự Họ_và_tên" trên mỗi dòng. VD:<br/>1 Nguyễn Văn A<br/>2 Trần Thị B</p>
                <textarea 
                  value={newClassStudents}
                  onChange={(e) => setNewClassStudents(e.target.value)}
                  placeholder="1 Nguyễn Văn A&#10;2 Trần Thị B"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-48 resize-none font-mono text-sm"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowClassModal(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                Hủy
              </button>
              <button 
                onClick={handleCreateClass}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
              >
                Lưu lớp học
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
