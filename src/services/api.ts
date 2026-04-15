import { collection, doc, setDoc, getDocs, getDoc, query, where, orderBy, serverTimestamp, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { PlayerScore, Question, Quiz, Session, Class } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const api = {
  // --- Classes ---
  async saveClass(name: string, students: {id: string, name: string}[]): Promise<string> {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("Chưa đăng nhập");
    
    const path = 'classes';
    try {
      const docRef = await addDoc(collection(db, path), {
        name,
        students,
        teacherId,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async getMyClasses(): Promise<Class[]> {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("Chưa đăng nhập");
    
    const path = 'classes';
    try {
      const q = query(collection(db, path), where("teacherId", "==", teacherId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async getClass(classId: string): Promise<Class | null> {
    const path = `classes/${classId}`;
    try {
      const docSnap = await getDoc(doc(db, 'classes', classId));
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Class;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  async deleteClass(classId: string): Promise<void> {
    const path = `classes/${classId}`;
    try {
      await deleteDoc(doc(db, 'classes', classId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // --- Quizzes ---
  async saveQuiz(title: string, topic: string, questions: Question[], timeLimit: number = 15): Promise<string> {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("Chưa đăng nhập");
    
    const path = 'quizzes';
    try {
      const docRef = await addDoc(collection(db, path), {
        title,
        topic,
        questions,
        teacherId,
        timeLimit,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async getMyQuizzes(): Promise<Quiz[]> {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("Chưa đăng nhập");
    
    const path = 'quizzes';
    try {
      const q = query(collection(db, path), where("teacherId", "==", teacherId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quiz));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async getQuiz(quizId: string): Promise<Quiz> {
    const path = `quizzes/${quizId}`;
    try {
      const docSnap = await getDoc(doc(db, 'quizzes', quizId));
      if (!docSnap.exists()) throw new Error("Quiz not found");
      return { id: docSnap.id, ...docSnap.data() } as Quiz;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  async updateQuiz(quizId: string, title: string, topic: string, questions: Question[], timeLimit: number = 15): Promise<void> {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("Chưa đăng nhập");
    
    const path = `quizzes/${quizId}`;
    try {
      await setDoc(doc(db, 'quizzes', quizId), {
        title,
        topic,
        questions,
        teacherId,
        timeLimit,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async deleteQuiz(quizId: string): Promise<void> {
    const path = `quizzes/${quizId}`;
    try {
      await deleteDoc(doc(db, 'quizzes', quizId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // --- Sessions ---
  async createSession(quizId: string, quizTitle: string, timeLimit: number = 15, classId?: string, startTime?: Date, endTime?: Date, sessionName?: string): Promise<string> {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("Chưa đăng nhập");
    
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const path = 'sessions';
    try {
      const docRef = await addDoc(collection(db, path), {
        name: sessionName || null,
        pin,
        quizId,
        quizTitle,
        teacherId,
        status: 'waiting',
        timeLimit,
        classId: classId || null,
        startTime: startTime || null,
        endTime: endTime || null,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async updateSessionDetails(sessionId: string, startTime: Date | null, endTime: Date | null, status?: 'waiting' | 'active' | 'finished', name?: string): Promise<void> {
    const path = `sessions/${sessionId}`;
    try {
      const updateData: any = {
        startTime,
        endTime,
        name: name || null
      };
      if (status) updateData.status = status;
      await setDoc(doc(db, 'sessions', sessionId), updateData, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async getMySessions(): Promise<Session[]> {
    const teacherId = auth.currentUser?.uid;
    if (!teacherId) throw new Error("Chưa đăng nhập");
    
    const path = 'sessions';
    try {
      const q = query(collection(db, path), where("teacherId", "==", teacherId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async getSessionByPin(pin: string): Promise<Session | null> {
    const path = 'sessions';
    try {
      const q = query(collection(db, path), where("pin", "==", pin), where("status", "in", ["waiting", "active"]));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      const docSnap = snapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Session;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async getSession(sessionId: string): Promise<Session | null> {
    const path = `sessions/${sessionId}`;
    try {
      const docSnap = await getDoc(doc(db, 'sessions', sessionId));
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as Session;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      throw error;
    }
  },

  subscribeToSession(sessionId: string, callback: (session: Session | null) => void): () => void {
    const path = `sessions/${sessionId}`;
    return onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as Session);
      } else {
        callback(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });
  },

  async updateSessionPaperModeState(sessionId: string, currentQuestionIdx: number, scannedAnswers: Record<string, string>): Promise<void> {
    const path = `sessions/${sessionId}`;
    try {
      await setDoc(doc(db, 'sessions', sessionId), { 
        currentQuestionIdx,
        scannedAnswers
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async updateSessionStatus(sessionId: string, status: 'waiting' | 'active' | 'finished'): Promise<void> {
    const path = `sessions/${sessionId}`;
    try {
      await setDoc(doc(db, 'sessions', sessionId), { status }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
      throw error;
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    const path = `sessions/${sessionId}`;
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // --- Scores ---
  async saveScore(data: PlayerScore): Promise<void> {
    const path = `sessions/${data.sessionId}/scores`;
    try {
      await addDoc(collection(db, path), {
        ...data,
        timestamp: serverTimestamp()
      });
      
      // Save to GAS if configured
      const gasUrl = localStorage.getItem('GAS_URL');
      if (gasUrl) {
        try {
          await fetch(gasUrl, {
            method: 'POST',
            body: JSON.stringify({
              action: 'saveScore',
              payload: {
                playerName: data.playerName,
                deviceId: data.deviceId || 'web',
                score: data.score
              }
            })
          });
        } catch (e) {
          console.error("Failed to save score to GAS", e);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async getSessionScores(sessionId: string): Promise<PlayerScore[]> {
    const path = `sessions/${sessionId}/scores`;
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerScore));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  subscribeToSessionScores(sessionId: string, callback: (scores: PlayerScore[]) => void): () => void {
    const path = `sessions/${sessionId}/scores`;
    const q = query(collection(db, path), orderBy("score", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const scores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerScore));
      callback(scores);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
    return unsubscribe;
  },

  async savePaperModeScores(sessionId: string, scores: Record<string, number>, selectedClass?: Class): Promise<void> {
    const path = `sessions/${sessionId}/scores`;
    try {
      const promises = Object.entries(scores).map(([studentId, score]) => {
        let studentName = `Học sinh ${studentId}`;
        if (selectedClass) {
          const student = selectedClass.students.find(s => s.id === studentId);
          if (student) studentName = student.name;
        }

        return addDoc(collection(db, path), {
          sessionId,
          playerName: studentName,
          deviceId: `paper_${studentId}`,
          score,
          timestamp: serverTimestamp()
        });
      });
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  // --- Allowed Teachers ---
  async getAllowedTeachers(): Promise<{id: string, email: string}[]> {
    const path = 'allowed_teachers';
    try {
      const snapshot = await getDocs(collection(db, path));
      return snapshot.docs.map(doc => ({ id: doc.id, email: doc.data().email }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      throw error;
    }
  },

  async addAllowedTeacher(email: string): Promise<void> {
    const path = `allowed_teachers/${email}`;
    try {
      await setDoc(doc(db, 'allowed_teachers', email), { email, addedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
      throw error;
    }
  },

  async removeAllowedTeacher(email: string): Promise<void> {
    const path = `allowed_teachers/${email}`;
    try {
      await deleteDoc(doc(db, 'allowed_teachers', email));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
      throw error;
    }
  },

  // --- GAS Question Bank ---
  async saveQuestionsToBank(questions: Question[]): Promise<void> {
    const gasUrl = localStorage.getItem('GAS_URL');
    if (!gasUrl) throw new Error("Chưa cấu hình URL Google Apps Script");

    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'saveToBank',
          payload: questions
        })
      });
      const result = await response.json();
      if (result.error) throw new Error(result.error);
    } catch (error) {
      console.error("Failed to save questions to bank", error);
      throw error;
    }
  },

  async getQuestionsFromBank(): Promise<Question[]> {
    const gasUrl = localStorage.getItem('GAS_URL');
    if (!gasUrl) throw new Error("Chưa cấu hình URL Google Apps Script");

    try {
      const response = await fetch(`${gasUrl}?action=getBankQuestions`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      return result as Question[];
    } catch (error) {
      console.error("Failed to fetch questions from bank", error);
      throw error;
    }
  }
};

