import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Save, Plus, Database, Play, Trophy, Users, CheckCircle2, Trash2, Filter, History, Image as ImageIcon, Music, Video, Camera, Download, Upload, ScanLine, Settings, Share2, Copy, X, Edit3, PlusCircle, Paperclip, HelpCircle, CheckSquare, ArrowRight, List, Clock } from 'lucide-react';
import { api } from '../services/api';
import { generateQuestions, generateQuestionsFromImage } from '../services/gemini';
import { Question, Quiz, Session, PlayerScore, Class } from '../types';
import { useAuth } from '../App';
import * as XLSX from 'xlsx';
import { QRCodeSVG } from 'qrcode.react';
import { getDirectMediaUrl } from '../lib/utils';
import { logOut } from '../services/firebase';

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const isAdmin = (user?.email === 'huuchauntt@gmail.com' || user?.email === 'nttkiemtra@gmail.com') && user?.emailVerified;
  console.log("Admin check:", { email: user?.email, verified: user?.emailVerified, isAdmin });
  const [activeTab, setActiveTab] = useState<'create' | 'quizzes' | 'sessions' | 'history' | 'classes' | 'teachers'>('create');
  
  // Create Quiz state
  const [quizTitle, setQuizTitle] = useState('');
  const [quizTopic, setQuizTopic] = useState('');
  const [topic, setTopic] = useState('');
  const [count, setCount] = useState(5);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [gasUrl, setGasUrl] = useState(localStorage.getItem('GAS_URL') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  // Classes state
  const [myClasses, setMyClasses] = useState<Class[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassStudents, setNewClassStudents] = useState('');

  useEffect(() => {
    const draftStr = localStorage.getItem('quiz_draft');
    if (draftStr) {
      setHasDraft(true);
    }
  }, []);

  const loadDraft = () => {
    const draftStr = localStorage.getItem('quiz_draft');
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        setQuizTitle(draft.title || '');
        setQuizTopic(draft.topic || '');
        setQuestions(draft.questions || []);
        setSelectedIndices(new Set(draft.selectedIndices || []));
        setHasDraft(false);
        alert('Đã tải bản nháp!');
      } catch (e) {
        console.error(e);
      }
    }
  };

  const clearDraft = () => {
    confirmAction('Xóa bản nháp', 'Bạn có chắc chắn muốn xóa bản nháp này?', () => {
      localStorage.removeItem('quiz_draft');
      setHasDraft(false);
    });
  };

  const handleSaveDraft = () => {
    const draft = {
      title: quizTitle,
      topic: quizTopic,
      questions: questions,
      selectedIndices: Array.from(selectedIndices)
    };
    localStorage.setItem('quiz_draft', JSON.stringify(draft));
    setHasDraft(true);
    alert('Đã lưu bản nháp thành công!');
  };

  const handleDeleteQuestion = (indexToRemove: number) => {
    confirmAction('Xóa câu hỏi', 'Bạn có chắc chắn muốn xóa câu hỏi này?', () => {
      setQuestions(prev => prev.filter((_, i) => i !== indexToRemove));
      
      setSelectedIndices(prev => {
        const newSet = new Set<number>();
        prev.forEach(idx => {
          if (idx < indexToRemove) {
            newSet.add(idx);
          } else if (idx > indexToRemove) {
            newSet.add(idx - 1);
          }
        });
        return newSet;
      });
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Manual Question state
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [manualQuestion, setManualQuestion] = useState<Partial<Question>>({
    type: 'multiple_choice',
    timeLimit: 15,
    topic: '',
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: 'A',
    matchingPairs: [{ id: '1', left: '', right: '' }]
  });

  // Quizzes state
  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);

  // Sessions state
  const [mySessions, setMySessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionScores, setSessionScores] = useState<PlayerScore[]>([]);
  const [sessionFilter, setSessionFilter] = useState<'all' | 'waiting' | 'active' | 'finished'>('all');
  const [sessionSearch, setSessionSearch] = useState<string>('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const confirmAction = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm
    });
  };

  // History state
  const [historySessions, setHistorySessions] = useState<(Session & { participantCount?: number })[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Teachers state
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [allowedTeachers, setAllowedTeachers] = useState<{id: string, email: string}[]>([]);
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user) return;
      if (isAdmin) {
        setIsAllowed(true);
        return;
      }
      try {
        const teachers = await api.getAllowedTeachers();
        const isTeacher = teachers.some(t => t.email === user.email);
        setIsAllowed(isTeacher);
      } catch (error) {
        console.error(error);
        setIsAllowed(false);
      }
    };
    if (!loading) {
      checkPermission();
    }
  }, [user, loading]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.sessionId && mySessions.length > 0) {
      const session = mySessions.find(s => s.id === location.state.sessionId);
      if (session) {
        setSelectedSession(session);
      }
    }
  }, [location.state, mySessions]);

  useEffect(() => {
    // Give it a little time to resolve auth state before redirecting
    const timer = setTimeout(() => {
      if (!loading && !user) {
        navigate('/');
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [user, loading, navigate]);

  useEffect(() => {
    if (activeTab === 'quizzes') loadQuizzes();
    if (activeTab === 'sessions') loadSessions();
    if (activeTab === 'history') loadHistory();
    if (activeTab === 'classes') loadClasses();
    if (activeTab === 'teachers' && isAdmin) loadAllowedTeachers();
  }, [activeTab, user, isAdmin]);

  const loadAllowedTeachers = async () => {
    setIsLoadingTeachers(true);
    try {
      const teachers = await api.getAllowedTeachers();
      setAllowedTeachers(teachers);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoadingTeachers(false);
    }
  };

  const handleAddTeacher = async () => {
    if (!newTeacherEmail.trim()) {
      alert('Vui lòng nhập email!');
      return;
    }
    try {
      await api.addAllowedTeacher(newTeacherEmail.trim());
      setNewTeacherEmail('');
      loadAllowedTeachers();
      alert('Đã thêm giáo viên thành công!');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleRemoveTeacher = async (email: string) => {
    confirmAction('Xóa giáo viên', `Bạn có chắc chắn muốn xóa quyền của ${email}?`, async () => {
      try {
        await api.removeAllowedTeacher(email);
        loadAllowedTeachers();
      } catch (error: any) {
        alert(error.message);
      }
    });
  };

  const loadClasses = async () => {
    setIsLoadingClasses(true);
    try {
      const data = await api.getMyClasses();
      setMyClasses(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoadingClasses(false);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (selectedSession) {
      setSessionScores([]);
      unsubscribe = api.subscribeToSessionScores(selectedSession.id!, (scores) => {
        setSessionScores(scores.sort((a, b) => b.score - a.score));
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedSession]);

  const loadQuizzes = async () => {
    setIsLoadingQuizzes(true);
    try {
      const data = await api.getMyQuizzes();
      setMyQuizzes(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoadingQuizzes(false);
    }
  };

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await api.getMySessions();
      setMySessions(data.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await api.getMySessions();
      const finishedSessions = data.filter(s => s.status === 'finished');
      
      const historyWithCounts = await Promise.all(finishedSessions.map(async (session) => {
        const scores = await api.getSessionScores(session.id!);
        return { ...session, participantCount: scores.length };
      }));
      
      const sorted = historyWithCounts.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      });
      
      setHistorySessions(sorted);
    } catch (error: any) {
      console.error(error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic) {
      alert('Vui lòng nhập chủ đề!');
      return;
    }
    setIsGenerating(true);
    try {
      const generated = await generateQuestions(topic, count);
      setQuestions(prev => [...prev, ...generated]);
      setSelectedIndices(new Set([...Array.from(selectedIndices), ...generated.map((_, i) => questions.length + i)]));
      if (!quizTopic) setQuizTopic(topic);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      "Chủ đề,Loại câu hỏi (multiple_choice/true_false/short_answer/fill_blank/matching),Thời gian (giây),Nội dung câu hỏi,Đáp án A,Đáp án B,Đáp án C,Đáp án D,Đáp án đúng (A/B/C/D hoặc Text),Các cặp ghép nối (Trái 1=Phải 1|Trái 2=Phải 2)\n" +
      "Địa lý,multiple_choice,15,Thủ đô của Việt Nam là gì?,Hà Nội,Hồ Chí Minh,Đà Nẵng,Huế,A,\n" +
      "Toán học,true_false,10,2 + 2 = 4 đúng hay sai?,,,,A,\n" +
      "Lịch sử,short_answer,20,Vị vua cuối cùng của Việt Nam là ai?,,,,,Bảo Đại,\n" +
      "Ngữ văn,fill_blank,15,Nam Quốc Sơn Hà Nam Đế ___,,,,,Cư,\n" +
      "Ngoại ngữ,matching,30,Ghép từ tiếng Anh với nghĩa tiếng Việt,,,,,,Dog=Chó|Cat=Mèo|Bird=Chim";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Mau_Cau_Hoi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        
        const header = data[0] || [];
        const isNewFormat = header.length > 7 && header[1]?.toString().includes('Loại câu hỏi');

        const parsedQuestions: Question[] = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (isNewFormat) {
            if (row.length >= 4 && row[3]) {
              const type = (row[1] as string)?.trim() || 'multiple_choice';
              const timeLimit = parseInt(row[2]) || 15;
              const q: Partial<Question> = {
                topic: row[0] || 'Chung',
                type: type as any,
                timeLimit: timeLimit,
                question: row[3],
                optionA: row[4] || '',
                optionB: row[5] || '',
                optionC: row[6] || '',
                optionD: row[7] || '',
                correctAnswer: row[8] || 'A',
              };

              if (type === 'matching' && row[9]) {
                const pairsStr = row[9] as string;
                const pairs = pairsStr.split('|').map((p, idx) => {
                  const [left, right] = p.split('=');
                  return { id: Date.now().toString() + idx, left: left?.trim() || '', right: right?.trim() || '' };
                });
                q.matchingPairs = pairs;
              }

              parsedQuestions.push(q as Question);
            }
          } else {
            if (row.length >= 7 && row[1]) {
              parsedQuestions.push({
                topic: row[0] || 'Chung',
                type: 'multiple_choice',
                timeLimit: 15,
                question: row[1],
                optionA: row[2] || '',
                optionB: row[3] || '',
                optionC: row[4] || '',
                optionD: row[5] || '',
                correctAnswer: row[6] || 'A',
              });
            }
          }
        }
        setQuestions(prev => [...prev, ...parsedQuestions]);
        setSelectedIndices(new Set([...Array.from(selectedIndices), ...parsedQuestions.map((_, idx) => questions.length + idx)]));
        alert(`Đã tải lên ${parsedQuestions.length} câu hỏi!`);
      } catch (error) {
        alert('Lỗi đọc file. Vui lòng đảm bảo file đúng định dạng mẫu.');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      setIsGenerating(true);
      try {
        const base64Data = reader.result as string;
        const generated = await generateQuestionsFromImage(base64Data);
        setQuestions(prev => [...prev, ...generated]);
        setSelectedIndices(new Set([...Array.from(selectedIndices), ...generated.map((_, i) => questions.length + i)]));
        alert(`Đã trích xuất ${generated.length} câu hỏi từ ảnh!`);
      } catch (error: any) {
        alert(error.message);
      } finally {
        setIsGenerating(false);
      }
    };
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const uploadMediaToGAS = async (file: File, maxRetries = 3): Promise<string> => {
    if (!gasUrl) {
      alert('Vui lòng cấu hình Google Apps Script URL (nút Cài đặt góc trên phải) trước khi tải file lên Drive!');
      setShowSettings(true);
      throw new Error('GAS URL not configured');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result as string;
        
        const attemptUpload = async (retriesLeft: number) => {
          try {
            const response = await fetch(gasUrl, {
              method: 'POST',
              body: JSON.stringify({
                action: 'uploadMedia',
                payload: {
                  base64Data,
                  fileName: file.name
                }
              })
            });
            const result = await response.json();
            if (result.url) {
              resolve(result.url);
            } else {
              throw new Error(result.error || 'Unknown error');
            }
          } catch (error: any) {
            if (retriesLeft > 0) {
              console.warn(`Upload failed, retrying... (${retriesLeft} retries left)`, error);
              setTimeout(() => attemptUpload(retriesLeft - 1), 1000);
            } else {
              reject(new Error('Lỗi kết nối đến Google Apps Script sau nhiều lần thử: ' + error.message));
            }
          }
        };

        attemptUpload(maxRetries);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const handleMediaUpload = async (file: File, questionIndex: number, type: 'image' | 'audio' | 'video') => {
    try {
      const url = await uploadMediaToGAS(file);
      const newQuestions = [...questions];
      if (type === 'image') newQuestions[questionIndex].imageUrl = url;
      if (type === 'audio') newQuestions[questionIndex].audioUrl = url;
      if (type === 'video') newQuestions[questionIndex].videoUrl = url;
      setQuestions(newQuestions);
      alert('Tải lên thành công!');
    } catch (error: any) {
      if (error.message !== 'GAS URL not configured') {
        alert('Lỗi: ' + error.message);
      }
    }
  };

  const handleManualMediaUpload = async (file: File, type: 'image' | 'audio' | 'video') => {
    try {
      const url = await uploadMediaToGAS(file);
      setManualQuestion(prev => ({
        ...prev,
        [type === 'image' ? 'imageUrl' : type === 'audio' ? 'audioUrl' : 'videoUrl']: url
      }));
      alert('Tải lên thành công!');
    } catch (error: any) {
      if (error.message !== 'GAS URL not configured') {
        alert('Lỗi: ' + error.message);
      }
    }
  };

  const handleAddManual = () => {
    if (!manualQuestion.question || !manualQuestion.topic) {
      alert('Vui lòng điền chủ đề và nội dung câu hỏi!');
      return;
    }

    if (manualQuestion.type === 'multiple_choice') {
      if (!manualQuestion.optionA || !manualQuestion.optionB || !manualQuestion.optionC || !manualQuestion.optionD) {
        alert('Vui lòng điền đầy đủ 4 đáp án!');
        return;
      }
    } else if (manualQuestion.type === 'true_false') {
      manualQuestion.optionA = 'Đúng';
      manualQuestion.optionB = 'Sai';
      if (!manualQuestion.correctAnswer) manualQuestion.correctAnswer = 'A';
    } else if (manualQuestion.type === 'short_answer' || manualQuestion.type === 'fill_blank') {
      if (!manualQuestion.correctAnswer) {
        alert('Vui lòng nhập đáp án đúng!');
        return;
      }
    } else if (manualQuestion.type === 'matching') {
      if (!manualQuestion.matchingPairs || manualQuestion.matchingPairs.length < 2) {
        alert('Vui lòng tạo ít nhất 2 cặp ghép nối!');
        return;
      }
      for (const pair of manualQuestion.matchingPairs) {
        if (!pair.left || !pair.right) {
          alert('Vui lòng điền đầy đủ thông tin các cặp ghép nối!');
          return;
        }
      }
    }

    if (editingIndex !== null) {
      setQuestions(prev => {
        const newQuestions = [...prev];
        newQuestions[editingIndex] = manualQuestion as Question;
        return newQuestions;
      });
      setEditingIndex(null);
    } else {
      setQuestions(prev => [...prev, manualQuestion as Question]);
      setSelectedIndices(prev => new Set(prev).add(questions.length));
    }
    setShowManualForm(false);
    setManualQuestion({
      type: 'multiple_choice',
      timeLimit: 15,
      topic: topic || '',
      question: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      matchingPairs: [{ id: '1', left: '', right: '' }],
      imageUrl: '',
      audioUrl: '',
      videoUrl: ''
    });
  };

  const handleEditQuestion = (index: number) => {
    setEditingIndex(index);
    setManualQuestion(questions[index]);
    setShowManualForm(true);
  };

  const handleSaveToBank = async () => {
    const questionsToSave = questions.filter((_, idx) => selectedIndices.has(idx));
    if (questionsToSave.length === 0) {
      alert('Vui lòng chọn ít nhất 1 câu hỏi để lưu vào kho!');
      return;
    }
    
    if (!gasUrl) {
      alert('Vui lòng cấu hình Google Apps Script URL trong phần Cài đặt!');
      setShowSettings(true);
      return;
    }

    setIsSaving(true);
    try {
      await api.saveQuestionsToBank(questionsToSave);
      alert(`Đã lưu ${questionsToSave.length} câu hỏi vào kho trên Google Sheets thành công!`);
    } catch (error: any) {
      alert('Lỗi: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadFromBank = async () => {
    if (!gasUrl) {
      alert('Vui lòng cấu hình Google Apps Script URL trong phần Cài đặt!');
      setShowSettings(true);
      return;
    }

    setIsGenerating(true);
    try {
      const bankQuestions = await api.getQuestionsFromBank();
      if (bankQuestions.length === 0) {
        alert('Kho câu hỏi hiện đang trống!');
        return;
      }
      setQuestions(prev => [...prev, ...bankQuestions]);
      setSelectedIndices(new Set([...Array.from(selectedIndices), ...bankQuestions.map((_, i) => questions.length + i)]));
      alert(`Đã tải ${bankQuestions.length} câu hỏi từ kho!`);
    } catch (error: any) {
      alert('Lỗi: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveQuiz = async () => {
    if (!quizTitle) {
      alert('Vui lòng nhập tên bộ đề!');
      return;
    }
    const questionsToSave = questions.filter((_, idx) => selectedIndices.has(idx));
    if (questionsToSave.length === 0) {
      alert('Vui lòng chọn ít nhất 1 câu hỏi để lưu!');
      return;
    }
    setIsSaving(true);
    try {
      // 1. Save to Firebase for real-time play
      if (editingQuizId) {
        await api.updateQuiz(editingQuizId, quizTitle, quizTopic || 'Chung', questionsToSave, 15);
      } else {
        await api.saveQuiz(quizTitle, quizTopic || 'Chung', questionsToSave, 15);
      }
      
      // 2. Save to Google Sheets via GAS if configured
      if (gasUrl) {
        try {
          await fetch(gasUrl, {
            method: 'POST',
            body: JSON.stringify({
              action: 'saveToBank',
              payload: questionsToSave
            })
          });
        } catch (e) {
          console.error("Failed to save to GAS", e);
          // Don't block the UI if GAS fails, just log it
        }
      }

      alert(`Đã ${editingQuizId ? 'cập nhật' : 'lưu'} bộ đề "${quizTitle}" với ${questionsToSave.length} câu hỏi!`);
      localStorage.removeItem('quiz_draft');
      setHasDraft(false);
      setQuizTitle('');
      setQuizTopic('');
      setQuestions([]);
      setSelectedIndices(new Set());
      setEditingQuizId(null);
      setActiveTab('quizzes');
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const [sessionStartTime, setSessionStartTime] = useState<string>('');
  const [sessionEndTime, setSessionEndTime] = useState<string>('');
  const [sessionName, setSessionName] = useState<string>('');
  const [showEditTimesModal, setShowEditTimesModal] = useState(false);

  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [selectedQuizForSession, setSelectedQuizForSession] = useState<Quiz | null>(null);
  const [selectedClassForSession, setSelectedClassForSession] = useState<string>('');

  const handleStartSessionClick = (quiz: Quiz) => {
    setSelectedQuizForSession(quiz);
    setSelectedClassForSession('');
    setSessionStartTime('');
    setSessionEndTime('');
    setSessionName('');
    loadClasses(); // Ensure classes are loaded
    setShowStartSessionModal(true);
  };

  const handleStartSession = async () => {
    if (!selectedQuizForSession) return;
    try {
      const start = sessionStartTime ? new Date(sessionStartTime) : undefined;
      const end = sessionEndTime ? new Date(sessionEndTime) : undefined;
      const sessionId = await api.createSession(
        selectedQuizForSession.id!, 
        selectedQuizForSession.title, 
        selectedQuizForSession.timeLimit || 15, 
        selectedClassForSession,
        start,
        end,
        sessionName
      );
      alert(`Đã tạo phiên thi! Mã PIN của bạn là: ${sessionId}`);
      setShowStartSessionModal(false);
      setActiveTab('sessions');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleUpdateSessionDetails = async () => {
    if (!selectedSession) return;
    try {
      const start = sessionStartTime ? new Date(sessionStartTime) : null;
      const end = sessionEndTime ? new Date(sessionEndTime) : null;
      
      // If reopening a finished session
      let status = selectedSession.status;
      if (status === 'finished' && (!end || end > new Date())) {
        status = 'active';
      }

      await api.updateSessionDetails(selectedSession.id!, start, end, status, sessionName);
      alert('Đã cập nhật thông tin phiên thi!');
      setShowEditTimesModal(false);
      loadSessions();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    confirmAction('Xóa phiên thi', 'Bạn có chắc chắn muốn xóa phiên thi này? Toàn bộ kết quả sẽ bị xóa vĩnh viễn.', async () => {
      try {
        await api.deleteSession(sessionId);
        if (selectedSession?.id === sessionId) setSelectedSession(null);
        loadSessions();
      } catch (error: any) {
        alert(error.message);
      }
    });
  };

  const handleDeleteHistorySession = async (sessionId: string) => {
    confirmAction('Xóa lịch sử', 'Bạn có chắc chắn muốn xóa phiên thi này khỏi lịch sử?', async () => {
      try {
        await api.deleteSession(sessionId);
        setHistorySessions(prev => prev.filter(s => s.id !== sessionId));
        setMySessions(prev => prev.filter(s => s.id !== sessionId));
      } catch (error: any) {
        alert(error.message);
      }
    });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    confirmAction('Xóa bộ đề', 'Bạn có chắc chắn muốn xóa bộ đề này?', async () => {
      try {
        await api.deleteQuiz(quizId);
        loadQuizzes();
      } catch (error: any) {
        alert(error.message);
      }
    });
  };

  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuizId(quiz.id!);
    setQuizTitle(quiz.title);
    setQuizTopic(quiz.topic || '');
    setQuestions(quiz.questions);
    setSelectedIndices(new Set(quiz.questions.map((_, i) => i)));
    setActiveTab('create');
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
      await api.saveClass(newClassName, students);
      await loadClasses();
      setShowCreateClassModal(false);
      setNewClassName('');
      setNewClassStudents('');
      alert('Đã tạo lớp thành công!');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    confirmAction('Xóa lớp học', 'Bạn có chắc chắn muốn xóa lớp học này?', async () => {
      try {
        await api.deleteClass(classId);
        loadClasses();
      } catch (error: any) {
        alert(error.message);
      }
    });
  };

  const filteredSessions = mySessions.filter(s => {
    const matchesFilter = sessionFilter === 'all' || s.status === sessionFilter;
    const matchesSearch = !sessionSearch || 
      (s.name?.toLowerCase().includes(sessionSearch.toLowerCase())) || 
      (s.quizTitle.toLowerCase().includes(sessionSearch.toLowerCase())) ||
      (s.pin.includes(sessionSearch));
    return matchesFilter && matchesSearch;
  });

  if (loading || !user || isAllowed === null) return <div className="min-h-screen flex items-center justify-center">Đang tải...</div>;

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center border border-gray-200">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <X size={40} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Không có quyền truy cập</h2>
          <p className="text-gray-600 mb-2">
            Tài khoản <strong className="text-gray-900">{user.email}</strong> không có quyền truy cập trang quản trị.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Vui lòng liên hệ quản trị viên để được cấp quyền giáo viên.
          </p>
          <div className="flex flex-col gap-3 justify-center">
            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => navigate('/')}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Về trang chủ
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl font-medium transition-colors"
              >
                Thử lại
              </button>
            </div>
            <button 
              onClick={async () => {
                await logOut();
                navigate('/');
              }}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors w-full"
            >
              Đăng xuất & Đăng nhập tài khoản khác
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/')}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <h1 className="text-xl font-bold text-gray-900">Bảng điều khiển Giáo viên</h1>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <span className="hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                  Quản trị viên
                </span>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                title="Cài đặt hệ thống"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={() => navigate('/printables')}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Camera size={16} />
                In thẻ Paper Mode
              </button>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setActiveTab('create')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'create' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Tạo bộ đề
                </button>
                <button
                  onClick={() => setActiveTab('quizzes')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'quizzes' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Bộ đề của tôi
                </button>
                <button
                  onClick={() => setActiveTab('classes')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'classes' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Lớp học
                </button>
                <button
                  onClick={() => setActiveTab('sessions')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'sessions' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Phiên thi & BXH
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Lịch sử
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('teachers')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'teachers' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Giáo viên
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Controls */}
            <div className="lg:col-span-1 space-y-6">
              {hasDraft && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-blue-800 font-medium">
                    <Save size={20} />
                    <span>Bạn có một bản nháp chưa lưu</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={loadDraft} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                      Tiếp tục chỉnh sửa
                    </button>
                    <button onClick={clearDraft} className="flex-1 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium transition-colors">
                      Xóa nháp
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Upload className="text-amber-500" />
                  Nhập từ File / Ảnh
                </h2>
                <div className="space-y-3">
                  <button 
                    onClick={handleDownloadTemplate}
                    className="w-full py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    Tải File Mẫu (Excel/CSV)
                  </button>
                  
                  <input 
                    type="file" 
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Upload size={18} />
                    Chọn file đã soạn
                  </button>

                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={imageInputRef}
                    onChange={handleImageScan}
                  />
                  <button 
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isGenerating}
                    className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <ScanLine size={18} />
                    {isGenerating ? 'Đang quét...' : 'Quét ảnh bộ đề (AI)'}
                  </button>

                  <button 
                    onClick={handleLoadFromBank}
                    disabled={isGenerating}
                    className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Database size={18} />
                    {isGenerating ? 'Đang tải...' : 'Tải từ kho câu hỏi (Sheets)'}
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BrainCircuit className="text-amber-500" />
                  Tạo câu hỏi bằng AI
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề / Môn học</label>
                    <input 
                      type="text" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="VD: Lịch sử Việt Nam..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng câu hỏi</label>
                    <input 
                      type="number" 
                      min="1" max="20"
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value) || 5)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <button 
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50"
                  >
                    {isGenerating ? 'Đang tạo...' : 'Tạo câu hỏi'}
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Save className="text-amber-500" />
                  Lưu thành Bộ đề
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên bộ đề</label>
                    <input 
                      type="text" 
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      placeholder="VD: Bài kiểm tra 15p..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chủ đề (Tùy chọn)</label>
                    <input 
                      type="text" 
                      value={quizTopic}
                      onChange={(e) => setQuizTopic(e.target.value)}
                      placeholder="VD: Lịch sử, Toán học..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button 
                        onClick={handleSaveDraft}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                      >
                        <Save size={20} />
                        Lưu nháp
                      </button>
                      <button 
                        onClick={handleSaveQuiz}
                        disabled={isSaving || questions.length === 0}
                        className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={20} />
                        {isSaving ? 'Đang lưu...' : `Lưu (${selectedIndices.size})`}
                      </button>
                    </div>
                    <button 
                      onClick={handleSaveToBank}
                      disabled={isSaving || questions.length === 0}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Database size={20} />
                      {isSaving ? 'Đang lưu...' : 'Lưu vào kho câu hỏi (Sheets)'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Questions List */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h2 className="font-bold text-gray-900">Danh sách câu hỏi ({questions.length})</h2>
                    {questions.length > 0 && (
                      <button
                        onClick={() => {
                          if (selectedIndices.size === questions.length) {
                            setSelectedIndices(new Set());
                          } else {
                            setSelectedIndices(new Set(questions.map((_, i) => i)));
                          }
                        }}
                        className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                      >
                        {selectedIndices.size === questions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowManualForm(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Plus size={16} /> Thêm thủ công
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {questions.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                      <Database size={48} className="mb-4 opacity-20" />
                      <p>Chưa có câu hỏi nào.</p>
                      <p className="text-sm">Hãy tạo bằng AI hoặc thêm thủ công.</p>
                    </div>
                  ) : (
                    questions.map((q, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border-2 transition-colors ${selectedIndices.has(idx) ? 'border-amber-400 bg-amber-50/30' : 'border-gray-100 bg-white'}`}>
                        <div className="flex gap-3">
                          <div className="pt-1">
                            <input 
                              type="checkbox" 
                              checked={selectedIndices.has(idx)}
                              onChange={(e) => {
                                const newSet = new Set(selectedIndices);
                                if (e.target.checked) newSet.add(idx);
                                else newSet.delete(idx);
                                setSelectedIndices(newSet);
                              }}
                              className="w-5 h-5 text-amber-500 rounded focus:ring-amber-500 border-gray-300"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h3 className="font-bold text-gray-900">Câu {idx + 1}: {q.question}</h3>
                                <div className="flex gap-2 mt-1">
                                  {q.imageUrl && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"><ImageIcon size={12}/> Hình ảnh</span>}
                                  {q.audioUrl && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800"><Music size={12}/> Âm thanh</span>}
                                  {q.videoUrl && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800"><Video size={12}/> Video</span>}
                                </div>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {q.topic || 'Chung'}
                              </span>
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                {q.type === 'true_false' ? 'Đúng/Sai' : q.type === 'short_answer' ? 'Trả lời ngắn' : q.type === 'fill_blank' ? 'Điền khuyết' : q.type === 'matching' ? 'Ghép nối' : 'Trắc nghiệm'}
                              </span>
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                {q.timeLimit || 15}s
                              </span>
                              <button
                                onClick={() => handleEditQuestion(idx)}
                                className="ml-2 p-1 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"
                                title="Sửa câu hỏi này"
                              >
                                <Settings size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteQuestion(idx)}
                                className="ml-1 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Xóa câu hỏi này"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="mt-3">
                              {(!q.type || q.type === 'multiple_choice') && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {['A', 'B', 'C', 'D'].map((opt) => {
                                    const isCorrect = q.correctAnswer === opt;
                                    return (
                                      <div key={opt} className={`p-2 rounded-lg text-sm border ${isCorrect ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                        <span className="font-bold mr-2">{opt}.</span>
                                        {q[`option${opt}` as keyof Question]}
                                        {isCorrect && <CheckCircle2 size={16} className="inline ml-2 text-green-600" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {q.type === 'true_false' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {['A', 'B'].map((opt) => {
                                    const isCorrect = q.correctAnswer === opt;
                                    return (
                                      <div key={opt} className={`p-2 rounded-lg text-sm border ${isCorrect ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                                        <span className="font-bold mr-2">{opt}.</span>
                                        {opt === 'A' ? 'Đúng' : 'Sai'}
                                        {isCorrect && <CheckCircle2 size={16} className="inline ml-2 text-green-600" />}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              {(q.type === 'short_answer' || q.type === 'fill_blank') && (
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm font-medium">
                                  <span className="font-bold mr-2">Đáp án:</span>
                                  {q.correctAnswer}
                                </div>
                              )}
                              {q.type === 'matching' && (
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-gray-700 mb-2">Các cặp ghép nối:</p>
                                  {q.matchingPairs?.map(pair => (
                                    <div key={pair.id} className="p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm flex gap-2">
                                      <span className="flex-1 font-medium text-gray-800">{pair.left}</span>
                                      <span className="text-gray-400">-</span>
                                      <span className="flex-1 text-gray-600">{pair.right}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            {/* Media Upload Buttons */}
                            <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                              <label className="cursor-pointer text-xs font-medium text-gray-600 hover:text-purple-600 flex items-center gap-1 bg-gray-50 hover:bg-purple-50 px-2 py-1 rounded transition-colors">
                                <ImageIcon size={14} /> Thêm ảnh
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                  if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], idx, 'image');
                                }} />
                              </label>
                              <label className="cursor-pointer text-xs font-medium text-gray-600 hover:text-indigo-600 flex items-center gap-1 bg-gray-50 hover:bg-indigo-50 px-2 py-1 rounded transition-colors">
                                <Music size={14} /> Thêm âm thanh
                                <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                                  if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], idx, 'audio');
                                }} />
                              </label>
                              <label className="cursor-pointer text-xs font-medium text-gray-600 hover:text-pink-600 flex items-center gap-1 bg-gray-50 hover:bg-pink-50 px-2 py-1 rounded transition-colors">
                                <Video size={14} /> Thêm video
                                <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                                  if (e.target.files?.[0]) handleMediaUpload(e.target.files[0], idx, 'video');
                                }} />
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quizzes' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Database className="text-amber-500" />
                Bộ đề của tôi
              </h2>
              <button
                onClick={async () => {
                  if (!gasUrl) {
                    alert('Vui lòng cấu hình Google Apps Script URL (nút Cài đặt góc trên phải) trước!');
                    setShowSettings(true);
                    return;
                  }
                  setIsLoadingQuizzes(true);
                  try {
                    const res = await fetch(`${gasUrl}?action=getQuestions`);
                    const data = await res.json();
                    if (data && data.length > 0) {
                      // Save these questions as a new quiz in Firebase so it can be played
                      await api.saveQuiz('Bộ đề từ Google Sheets', 'Tổng hợp', data, 15);
                      alert(`Đã tải và tạo bộ đề mới với ${data.length} câu hỏi từ Google Sheets!`);
                      loadQuizzes();
                    } else {
                      alert('Không tìm thấy câu hỏi nào trong Google Sheets.');
                    }
                  } catch (e: any) {
                    alert('Lỗi tải từ Google Sheets: ' + e.message);
                  } finally {
                    setIsLoadingQuizzes(false);
                  }
                }}
                className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Download size={16} />
                Tải từ Google Sheets
              </button>
            </div>
            {isLoadingQuizzes ? (
              <p>Đang tải...</p>
            ) : myQuizzes.length === 0 ? (
              <p className="text-gray-500">Bạn chưa có bộ đề nào.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myQuizzes.map(quiz => (
                  <div key={quiz.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow relative">
                    <button 
                      onClick={() => handleDeleteQuiz(quiz.id!)}
                      className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                      title="Xóa bộ đề"
                    >
                      <Trash2 size={18} />
                    </button>
                    <h3 className="font-bold text-lg text-gray-900 mb-1 pr-8">{quiz.title}</h3>
                    <p className="text-sm text-gray-500 mb-4">{quiz.questions.length} câu hỏi • {quiz.topic || 'Chung'}</p>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStartSessionClick(quiz)}
                          className="flex-1 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                          title="Tổ chức thi trực tuyến (Học sinh dùng thiết bị)"
                        >
                          <Play size={18} />
                          Online
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const sessionId = await api.createSession(quiz.id!, quiz.title, quiz.timeLimit || 15);
                              navigate(`/paper-mode/${sessionId}`);
                            } catch (error: any) {
                              alert(error.message);
                            }
                          }}
                          className="flex-1 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                          title="Tổ chức thi bằng thẻ giấy (Giáo viên quét mã)"
                        >
                          <Camera size={18} />
                          Paper Mode
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditQuiz(quiz)}
                          className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                          title="Chỉnh sửa bộ đề"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => window.open(`/player?preview=${quiz.id}`, '_blank')}
                          className="flex-1 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                          title="Chạy thử bộ đề với tư cách học sinh"
                        >
                          Chạy thử
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'classes' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="text-amber-500" />
                Lớp học của tôi
              </h2>
              <button 
                onClick={() => setShowCreateClassModal(true)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                Tạo lớp mới
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoadingClasses ? (
                <div className="col-span-full py-12 text-center text-gray-500">Đang tải danh sách lớp...</div>
              ) : myClasses.length === 0 ? (
                <div className="col-span-full py-12 text-center text-gray-500">
                  <Users size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Bạn chưa tạo lớp học nào.</p>
                </div>
              ) : (
                myClasses.map(cls => (
                  <div key={cls.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{cls.name}</h3>
                        <p className="text-sm text-gray-500 mt-1">{cls.students.length} học sinh</p>
                      </div>
                      <button 
                        onClick={() => handleDeleteClass(cls.id!)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa lớp học"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="h-32 overflow-y-auto bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <ul className="space-y-1">
                        {cls.students.map((s: any) => (
                          <li key={s.id} className="text-sm flex gap-2">
                            <span className="font-mono text-gray-400 w-6">{s.id}.</span>
                            <span className="text-gray-700">{s.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'sessions' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col h-[calc(100vh-8rem)]">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="text-amber-500" />
                Phiên thi của tôi
              </h2>
              
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                <button onClick={() => setSessionFilter('all')} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${sessionFilter === 'all' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>Tất cả</button>
                <button onClick={() => setSessionFilter('waiting')} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${sessionFilter === 'waiting' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>Đang chờ</button>
                <button onClick={() => setSessionFilter('active')} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${sessionFilter === 'active' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>Đang diễn ra</button>
                <button onClick={() => setSessionFilter('finished')} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${sessionFilter === 'finished' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>Đã kết thúc</button>
              </div>

              <div className="relative mb-4">
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Tìm theo tên hoặc PIN..."
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                />
                <Filter className="absolute left-3 top-2.5 text-gray-400" size={16} />
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {isLoadingSessions ? (
                  <p>Đang tải...</p>
                ) : filteredSessions.length === 0 ? (
                  <p className="text-gray-500">Không có phiên thi nào.</p>
                ) : (
                  filteredSessions.map(session => (
                    <button
                      key={session.id}
                      onClick={() => setSelectedSession(session)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${selectedSession?.id === session.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300'}`}
                    >
                      <div className="flex gap-3">
                        <div className="p-1 bg-white rounded border border-gray-100 shadow-sm shrink-0">
                          <QRCodeSVG 
                            value={`${window.location.origin}/?pin=${session.pin}`} 
                            size={44}
                            level="L"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-gray-900">PIN: {session.pin}</span>
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${session.status === 'active' ? 'bg-green-100 text-green-800' : session.status === 'finished' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}`}>
                              {session.status === 'waiting' ? 'Đang chờ' : session.status === 'active' ? 'Đang diễn ra' : 'Đã kết thúc'}
                            </span>
                          </div>
                          {session.name && <p className="text-sm font-bold text-amber-600 truncate">{session.name}</p>}
                          <p className="text-sm text-gray-600 truncate">{session.quizTitle}</p>
                          {(session.startTime || session.endTime) && (
                            <div className="mt-2 flex flex-col gap-1">
                              {session.startTime && (
                                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                  <Clock size={10} />
                                  Bắt đầu: {new Date(session.startTime.seconds * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </div>
                              )}
                              {session.endTime && (
                                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                  <Clock size={10} />
                                  Kết thúc: {new Date(session.endTime.seconds * 1000).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 h-[calc(100vh-8rem)] flex flex-col">
              {selectedSession ? (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                          <Trophy className="text-amber-500" />
                          {selectedSession.name ? `${selectedSession.name} - ` : ''}Bảng xếp hạng - PIN: {selectedSession.pin}
                        </h2>
                        {(selectedSession.startTime || selectedSession.endTime) && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                            {selectedSession.startTime && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={12} />
                                Bắt đầu: {new Date(selectedSession.startTime.seconds * 1000).toLocaleString('vi-VN')}
                              </span>
                            )}
                            {selectedSession.endTime && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock size={12} />
                                Kết thúc: {new Date(selectedSession.endTime.seconds * 1000).toLocaleString('vi-VN')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm hidden md:block">
                        <QRCodeSVG 
                          value={`${window.location.origin}/?pin=${selectedSession.pin}`} 
                          size={64}
                          level="M"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          const start = selectedSession.startTime ? 
                            (selectedSession.startTime.toDate ? selectedSession.startTime.toDate() : new Date(selectedSession.startTime.seconds * 1000)) : null;
                          const end = selectedSession.endTime ? 
                            (selectedSession.endTime.toDate ? selectedSession.endTime.toDate() : new Date(selectedSession.endTime.seconds * 1000)) : null;
                          
                          setSessionStartTime(start ? new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
                          setSessionEndTime(end ? new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
                          setSessionName(selectedSession.name || '');
                          setShowEditTimesModal(true);
                        }}
                        className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg font-medium text-sm flex items-center gap-2"
                      >
                        <Settings size={16} />
                        Thời gian
                      </button>
                      <button 
                        onClick={() => setShowShareModal(true)}
                        className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium text-sm flex items-center gap-2"
                      >
                        <Share2 size={16} />
                        Chia sẻ
                      </button>
                      {selectedSession.status === 'waiting' && (
                        <button 
                          onClick={() => api.updateSessionStatus(selectedSession.id!, 'active').then(loadSessions)}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm"
                        >
                          Bắt đầu thi
                        </button>
                      )}
                      {selectedSession.status === 'active' && (
                        <button 
                          onClick={() => api.updateSessionStatus(selectedSession.id!, 'finished').then(loadSessions)}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm"
                        >
                          Kết thúc
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteSession(selectedSession.id!)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium text-sm flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Xóa
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 sticky top-0">
                          <th className="p-4 font-semibold text-gray-600">Hạng</th>
                          <th className="p-4 font-semibold text-gray-600">Học sinh</th>
                          <th className="p-4 font-semibold text-gray-600">Điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessionScores.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="p-8 text-center text-gray-500">Chưa có học sinh nào nộp bài.</td>
                          </tr>
                        ) : (
                          sessionScores.map((score, idx) => (
                            <tr key={score.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                              <td className="p-4">
                                {idx === 0 ? <Trophy size={20} className="text-yellow-500" /> :
                                 idx === 1 ? <Trophy size={20} className="text-gray-400" /> :
                                 idx === 2 ? <Trophy size={20} className="text-amber-700" /> :
                                 <span className="font-medium text-gray-500 pl-1">{idx + 1}</span>}
                              </td>
                              <td className="p-4 font-medium text-gray-900">{score.playerName}</td>
                              <td className="p-4 font-bold text-amber-600">{score.score}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                  <Trophy size={48} className="mb-4 opacity-20" />
                  <p>Chọn một phiên thi để xem bảng xếp hạng.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <History className="text-amber-500" />
                Lịch sử phiên thi
              </h2>
              <button 
                onClick={() => {
                  const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
                  setSortOrder(newOrder);
                  setHistorySessions(prev => [...prev].reverse());
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors"
              >
                <Filter size={16} />
                Sắp xếp: {sortOrder === 'desc' ? 'Mới nhất' : 'Cũ nhất'}
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 font-semibold text-gray-600">Ngày tạo</th>
                    <th className="p-4 font-semibold text-gray-600">Tên phiên / Bộ đề</th>
                    <th className="p-4 font-semibold text-gray-600">Mã PIN</th>
                    <th className="p-4 font-semibold text-gray-600">Số người tham gia</th>
                    <th className="p-4 font-semibold text-gray-600 w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingHistory ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">Đang tải lịch sử...</td>
                    </tr>
                  ) : historySessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">Chưa có phiên thi nào đã kết thúc.</td>
                    </tr>
                  ) : (
                    historySessions.map(session => (
                      <tr key={session.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-gray-600">
                          {session.createdAt ? new Date(session.createdAt.toMillis()).toLocaleString('vi-VN') : 'N/A'}
                        </td>
                        <td className="p-4">
                          {session.name && <div className="font-bold text-amber-600 text-sm">{session.name}</div>}
                          <div className="font-medium text-gray-900">{session.quizTitle}</div>
                        </td>
                        <td className="p-4 font-mono text-gray-600">{session.pin}</td>
                        <td className="p-4 text-gray-900 font-medium">{session.participantCount} học sinh</td>
                        <td className="p-4">
                          <button 
                            onClick={() => handleDeleteHistorySession(session.id!)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa phiên thi"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'teachers' && isAdmin && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="text-amber-500" />
                Quản lý Giáo viên
              </h2>
            </div>
            
            <div className="flex gap-4 mb-8">
              <input
                type="email"
                value={newTeacherEmail}
                onChange={(e) => setNewTeacherEmail(e.target.value)}
                placeholder="Nhập email giáo viên cần thêm..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <button
                onClick={handleAddTeacher}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                <Plus size={20} />
                Thêm giáo viên
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 font-semibold text-gray-600">Email</th>
                    <th className="p-4 font-semibold text-gray-600 w-24">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingTeachers ? (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-gray-500">Đang tải danh sách...</td>
                    </tr>
                  ) : allowedTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="p-8 text-center text-gray-500">Chưa có giáo viên nào được thêm.</td>
                    </tr>
                  ) : (
                    allowedTeachers.map(teacher => (
                      <tr key={teacher.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium text-gray-900">{teacher.email}</td>
                        <td className="p-4">
                          <button 
                            onClick={() => handleRemoveTeacher(teacher.email)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa quyền"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* Share Modal */}
      {showShareModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Share2 size={20} className="text-blue-500" />
                Chia sẻ phiên thi
              </h3>
              <button onClick={() => setShowShareModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center text-center">
              <p className="text-gray-600 mb-6">Học sinh có thể quét mã QR hoặc nhập mã PIN để tham gia.</p>
              
              <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-sm mb-6">
                <QRCodeSVG 
                  value={`${window.location.origin}/?pin=${selectedSession.pin}`} 
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              
              <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-200 mb-4">
                <p className="text-sm text-gray-500 mb-1 font-medium">Mã PIN tham gia</p>
                <p className="text-4xl font-black text-gray-900 tracking-widest">{selectedSession.pin}</p>
              </div>

              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/?pin=${selectedSession.pin}`);
                  alert('Đã sao chép đường dẫn!');
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Copy size={20} />
                Sao chép đường dẫn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Cài đặt hệ thống</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <ArrowLeft size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Google Apps Script URL</label>
                <p className="text-xs text-gray-500 mb-2">Dùng để tải ảnh/video lên Google Drive tự động.</p>
                <input 
                  type="text" 
                  value={gasUrl}
                  onChange={(e) => setGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => {
                  localStorage.setItem('GAS_URL', gasUrl);
                  setShowSettings(false);
                  alert('Đã lưu cài đặt!');
                }}
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition-colors"
              >
                Lưu cài đặt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Question Modal */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-5 bg-white border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {editingIndex !== null ? <Edit3 className="text-amber-500"/> : <PlusCircle className="text-amber-500"/>}
                {editingIndex !== null ? 'Sửa câu hỏi' : 'Thêm câu hỏi mới'}
              </h3>
              <button onClick={() => { setShowManualForm(false); setEditingIndex(null); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Settings & Media */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Settings Card */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Settings size={18} className="text-gray-500"/> Cài đặt chung
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Loại câu hỏi</label>
                        <select
                          value={manualQuestion.type || 'multiple_choice'}
                          onChange={(e) => setManualQuestion({...manualQuestion, type: e.target.value as any})}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none text-sm transition-all"
                        >
                          <option value="multiple_choice">Trắc nghiệm (4 đáp án)</option>
                          <option value="true_false">Đúng / Sai</option>
                          <option value="short_answer">Trả lời ngắn</option>
                          <option value="fill_blank">Điền khuyết</option>
                          <option value="matching">Ghép nối</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Thời gian (giây)</label>
                          <input 
                            type="number" 
                            min="5" max="300"
                            value={manualQuestion.timeLimit || 15}
                            onChange={(e) => setManualQuestion({...manualQuestion, timeLimit: parseInt(e.target.value) || 15})}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none text-sm transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Chủ đề / Môn</label>
                          <input 
                            type="text" 
                            value={manualQuestion.topic}
                            onChange={(e) => setManualQuestion({...manualQuestion, topic: e.target.value})}
                            placeholder="VD: Toán học"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none text-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Media Card */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Paperclip size={18} className="text-gray-500"/> Đính kèm (Tùy chọn)
                    </h4>
                    <div className="space-y-4">
                      {/* Image */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><ImageIcon size={14} className="text-purple-500"/> Hình ảnh</label>
                          <label className="cursor-pointer text-xs font-medium text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors">
                            Tải lên
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              if (e.target.files?.[0]) handleManualMediaUpload(e.target.files[0], 'image');
                            }} />
                          </label>
                        </div>
                        <input 
                          type="text" 
                          value={manualQuestion.imageUrl || ''}
                          onChange={(e) => setManualQuestion({...manualQuestion, imageUrl: e.target.value})}
                          placeholder="Hoặc dán URL ảnh..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none text-sm transition-all"
                        />
                        {manualQuestion.imageUrl && (
                          <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                            <img src={getDirectMediaUrl(manualQuestion.imageUrl, 'image')} alt="Preview" className="w-full h-24 object-contain" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>

                      {/* Audio */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Music size={14} className="text-indigo-500"/> Âm thanh</label>
                          <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors">
                            Tải lên
                            <input type="file" accept="audio/*" className="hidden" onChange={(e) => {
                              if (e.target.files?.[0]) handleManualMediaUpload(e.target.files[0], 'audio');
                            }} />
                          </label>
                        </div>
                        <input 
                          type="text" 
                          value={manualQuestion.audioUrl || ''}
                          onChange={(e) => setManualQuestion({...manualQuestion, audioUrl: e.target.value})}
                          placeholder="Hoặc dán URL âm thanh..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-sm transition-all"
                        />
                        {manualQuestion.audioUrl && (
                          <div className="mt-2">
                            <audio src={getDirectMediaUrl(manualQuestion.audioUrl, 'audio')} controls className="w-full h-8" />
                          </div>
                        )}
                      </div>

                      {/* Video */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Video size={14} className="text-pink-500"/> Video</label>
                          <label className="cursor-pointer text-xs font-medium text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 px-2 py-1 rounded transition-colors">
                            Tải lên
                            <input type="file" accept="video/*" className="hidden" onChange={(e) => {
                              if (e.target.files?.[0]) handleManualMediaUpload(e.target.files[0], 'video');
                            }} />
                          </label>
                        </div>
                        <input 
                          type="text" 
                          value={manualQuestion.videoUrl || ''}
                          onChange={(e) => setManualQuestion({...manualQuestion, videoUrl: e.target.value})}
                          placeholder="Hoặc dán URL video..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:bg-white outline-none text-sm transition-all"
                        />
                        {manualQuestion.videoUrl && (
                          <div className="mt-2 relative rounded-lg overflow-hidden border border-gray-200 bg-black">
                            <video src={getDirectMediaUrl(manualQuestion.videoUrl, 'video')} controls className="w-full h-24 object-contain" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Question & Answers */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Question Content Card */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <HelpCircle size={18} className="text-blue-500"/> Nội dung câu hỏi
                    </h4>
                    <div>
                      <textarea 
                        value={manualQuestion.question}
                        onChange={(e) => setManualQuestion({...manualQuestion, question: e.target.value})}
                        placeholder={manualQuestion.type === 'fill_blank' ? "Nhập câu hỏi, dùng ___ để tạo chỗ trống..." : "Nhập nội dung câu hỏi..."}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none min-h-[100px] text-base resize-y transition-all"
                      />
                      {manualQuestion.type === 'fill_blank' && (
                        <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                          <BrainCircuit size={14}/> Mẹo: Gõ 3 dấu gạch dưới (___) để tạo ô điền khuyết.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Answers Card */}
                  <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <CheckSquare size={18} className="text-green-500"/> Đáp án
                    </h4>
                    
                    {/* Multiple Choice */}
                    {(!manualQuestion.type || manualQuestion.type === 'multiple_choice') && (
                      <div className="space-y-3">
                        {['A', 'B', 'C', 'D'].map((opt) => {
                          const isCorrect = manualQuestion.correctAnswer === opt;
                          return (
                            <div key={opt} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isCorrect ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-amber-300'}`}>
                              <button
                                type="button"
                                onClick={() => setManualQuestion({...manualQuestion, correctAnswer: opt as any})}
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 transition-colors ${isCorrect ? 'bg-green-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                              >
                                {opt}
                              </button>
                              <input 
                                type="text" 
                                placeholder={`Nhập đáp án ${opt}...`}
                                value={manualQuestion[`option${opt}` as keyof Question] as string}
                                onChange={(e) => setManualQuestion({...manualQuestion, [`option${opt}`]: e.target.value})}
                                className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400 font-medium"
                              />
                              {isCorrect && <CheckCircle2 className="text-green-500 shrink-0" size={20} />}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* True/False */}
                    {manualQuestion.type === 'true_false' && (
                      <div className="grid grid-cols-2 gap-4">
                        {['A', 'B'].map((opt) => {
                          const isCorrect = manualQuestion.correctAnswer === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setManualQuestion({...manualQuestion, correctAnswer: opt as any})}
                              className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 transition-all ${isCorrect ? 'border-green-500 bg-green-50 text-green-700 shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-amber-300 hover:bg-amber-50'}`}
                            >
                              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl ${isCorrect ? 'bg-green-500 text-white' : 'bg-gray-100'}`}>
                                {opt}
                              </div>
                              <span className="font-bold text-lg">{opt === 'A' ? 'Đúng' : 'Sai'}</span>
                              {isCorrect && <CheckCircle2 className="text-green-500 absolute top-4 right-4" size={24} />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Short Answer / Fill Blank */}
                    {(manualQuestion.type === 'short_answer' || manualQuestion.type === 'fill_blank') && (
                      <div className="bg-green-50/50 p-5 rounded-xl border border-green-100">
                        <label className="block text-sm font-bold text-green-800 mb-2">Đáp án chính xác</label>
                        <input 
                          type="text" 
                          value={manualQuestion.correctAnswer || ''}
                          onChange={(e) => setManualQuestion({...manualQuestion, correctAnswer: e.target.value})}
                          placeholder="Nhập câu trả lời đúng..."
                          className="w-full px-4 py-3 bg-white border-2 border-green-200 rounded-xl focus:ring-0 focus:border-green-500 outline-none text-base font-medium text-gray-900 transition-colors shadow-sm"
                        />
                        <p className="text-sm text-green-700 mt-2 flex items-center gap-1.5">
                          <CheckCircle2 size={16}/> Học sinh cần nhập chính xác cụm từ này (không phân biệt hoa thường).
                        </p>
                      </div>
                    )}

                    {/* Matching */}
                    {manualQuestion.type === 'matching' && (
                      <div className="space-y-3">
                        {manualQuestion.matchingPairs?.map((pair, idx) => (
                          <div key={pair.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200 group hover:border-amber-300 transition-colors">
                            <div className="flex-1 flex items-center gap-3">
                              <span className="text-gray-400 font-bold w-6 text-center">{idx + 1}.</span>
                              <input 
                                type="text" 
                                value={pair.left}
                                onChange={(e) => {
                                  const newPairs = [...(manualQuestion.matchingPairs || [])];
                                  newPairs[idx].left = e.target.value;
                                  setManualQuestion({...manualQuestion, matchingPairs: newPairs});
                                }}
                                placeholder="Vế trái..."
                                className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-all"
                              />
                            </div>
                            <ArrowRight className="text-gray-400 shrink-0" size={16} />
                            <div className="flex-1">
                              <input 
                                type="text" 
                                value={pair.right}
                                onChange={(e) => {
                                  const newPairs = [...(manualQuestion.matchingPairs || [])];
                                  newPairs[idx].right = e.target.value;
                                  setManualQuestion({...manualQuestion, matchingPairs: newPairs});
                                }}
                                placeholder="Vế phải..."
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-all"
                              />
                            </div>
                            <button 
                              onClick={() => {
                                const newPairs = manualQuestion.matchingPairs?.filter((_, i) => i !== idx);
                                setManualQuestion({...manualQuestion, matchingPairs: newPairs});
                              }}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Xóa cặp này"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}
                        <button 
                          onClick={() => {
                            const newPairs = [...(manualQuestion.matchingPairs || []), { id: Date.now().toString(), left: '', right: '' }];
                            setManualQuestion({...manualQuestion, matchingPairs: newPairs});
                          }}
                          className="w-full py-3 border-2 border-dashed border-amber-300 text-amber-600 font-bold rounded-xl hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus size={20} /> Thêm cặp ghép nối
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-gray-200 bg-white flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => { setShowManualForm(false); setEditingIndex(null); }}
                className="px-6 py-2.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
              >
                Hủy
              </button>
              <button 
                onClick={handleAddManual}
                className="px-8 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                {editingIndex !== null ? <Save size={20}/> : <Plus size={20}/>}
                {editingIndex !== null ? 'Lưu thay đổi' : 'Thêm vào danh sách'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Create Class Modal */}
      {showCreateClassModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Users size={20} className="text-amber-500" />
                Tạo lớp học mới
              </h3>
              <button onClick={() => setShowCreateClassModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Danh sách học sinh</label>
                <p className="text-xs text-gray-500 mb-2">Dán danh sách theo định dạng: "Số_thứ_tự Họ_và_tên" trên mỗi dòng. VD:<br/>1 Nguyễn Văn A<br/>2 Trần Thị B</p>
                <textarea 
                  value={newClassStudents}
                  onChange={(e) => setNewClassStudents(e.target.value)}
                  placeholder="1 Nguyễn Văn A&#10;2 Trần Thị B"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none h-48 resize-none font-mono text-sm"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowCreateClassModal(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                Hủy
              </button>
              <button 
                onClick={handleCreateClass}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
              >
                Lưu lớp học
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start Session Modal */}
      {showStartSessionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Play size={20} className="text-amber-500" />
                Bắt đầu phiên thi
              </h3>
              <button onClick={() => setShowStartSessionModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">Bộ đề: <strong>{selectedQuizForSession?.title}</strong></p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên phiên thi (Tùy chọn)</label>
                <input 
                  type="text" 
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="VD: Kiểm tra 15p Lớp 10A1..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn lớp học (Tùy chọn)</label>
                <select 
                  value={selectedClassForSession}
                  onChange={(e) => setSelectedClassForSession(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">-- Thi tự do (Không chọn lớp) --</option>
                  {myClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">Nếu chọn lớp, điểm số sẽ được lưu theo danh sách học sinh của lớp đó.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bắt đầu (Tùy chọn)</label>
                  <input 
                    type="datetime-local" 
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kết thúc (Tùy chọn)</label>
                  <input 
                    type="datetime-local" 
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowStartSessionModal(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                Hủy
              </button>
              <button 
                onClick={handleStartSession}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
              >
                <Play size={16} />
                Bắt đầu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Times Modal */}
      {showEditTimesModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Settings size={20} className="text-amber-500" />
                Chỉnh sửa thời gian phiên thi
              </h3>
              <button onClick={() => setShowEditTimesModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-700">Phiên thi: <strong>{selectedSession.name || selectedSession.quizTitle}</strong> (PIN: {selectedSession.pin})</p>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên phiên thi (Tùy chọn)</label>
                  <input 
                    type="text" 
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    placeholder="VD: Kiểm tra 15p Lớp 10A1..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian bắt đầu (Tùy chọn)</label>
                  <input 
                    type="datetime-local" 
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian kết thúc (Tùy chọn)</label>
                  <input 
                    type="datetime-local" 
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>
              
              <p className="text-xs text-gray-500">
                Lưu ý: Nếu bạn đặt thời gian kết thúc trong tương lai, phiên thi sẽ tự động được mở lại (chuyển sang trạng thái "Đang diễn ra") nếu nó đã kết thúc.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowEditTimesModal(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                Hủy
              </button>
              <button 
                onClick={handleUpdateSessionDetails}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg shadow-sm transition-colors text-sm flex items-center gap-2"
              >
                <Save size={16} />
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-2">{confirmDialog.title}</h3>
              <p className="text-gray-600">{confirmDialog.message}</p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors text-sm"
              >
                Hủy
              </button>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
