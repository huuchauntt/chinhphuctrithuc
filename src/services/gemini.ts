import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';
import { Question } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
const genAI = new GoogleGenerativeAI(apiKey || '');

const responseSchema: Schema = {
  type: SchemaType.ARRAY,
  description: "Danh sách các câu hỏi",
  items: {
    type: SchemaType.OBJECT,
    properties: {
      type: {
        type: SchemaType.STRING,
        description: "Loại câu hỏi: multiple_choice (trắc nghiệm), true_false (đúng/sai), short_answer (trả lời ngắn), fill_blank (điền khuyết), matching (ghép nối)",
      },
      timeLimit: {
        type: SchemaType.INTEGER,
        description: "Thời gian cho câu hỏi (giây), mặc định 15",
      },
      question: {
        type: SchemaType.STRING,
        description: "Nội dung câu hỏi",
      },
      optionA: {
        type: SchemaType.STRING,
        description: "Đáp án A (cho multiple_choice) hoặc 'Đúng' (cho true_false)",
      },
      optionB: {
        type: SchemaType.STRING,
        description: "Đáp án B (cho multiple_choice) hoặc 'Sai' (cho true_false)",
      },
      optionC: {
        type: SchemaType.STRING,
        description: "Đáp án C (chỉ cho multiple_choice)",
      },
      optionD: {
        type: SchemaType.STRING,
        description: "Đáp án D (chỉ cho multiple_choice)",
      },
      correctAnswer: {
        type: SchemaType.STRING,
        description: "Đáp án đúng (A/B/C/D cho trắc nghiệm, A/B cho đúng/sai, hoặc nội dung text cho trả lời ngắn/điền khuyết)",
      },
      matchingPairs: {
        type: SchemaType.ARRAY,
        description: "Các cặp ghép nối (chỉ dùng cho loại matching)",
        items: {
          type: SchemaType.OBJECT,
          properties: {
            id: { type: SchemaType.STRING },
            left: { type: SchemaType.STRING },
            right: { type: SchemaType.STRING }
          },
          required: ["id", "left", "right"]
        }
      },
      topic: {
        type: SchemaType.STRING,
        description: "Chủ đề của câu hỏi",
      },
      imageUrl: {
        type: SchemaType.STRING,
        description: "URL hình ảnh minh họa cho câu hỏi (nếu cần thiết, nếu không thì để trống)",
      },
      audioUrl: {
        type: SchemaType.STRING,
        description: "URL âm thanh cho câu hỏi (nếu cần thiết, nếu không thì để trống)",
      },
      videoUrl: {
        type: SchemaType.STRING,
        description: "URL video cho câu hỏi (nếu cần thiết, nếu không thì để trống)",
      }
    },
    required: ["type", "question", "topic"],
  },
};

export async function generateQuestions(topic: string, count: number = 5): Promise<Question[]> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.7,
    }
  });

  const prompt = `Tạo ${count} câu hỏi đa dạng về chủ đề: "${topic}". 
  Mức độ phù hợp cho học sinh tham gia trò chơi Chinh Phục Tri Thức.
  Hãy tạo ngẫu nhiên các loại câu hỏi sau:
  - multiple_choice: Trắc nghiệm 4 đáp án (cần optionA, optionB, optionC, optionD, correctAnswer là A/B/C/D).
  - true_false: Đúng/Sai (optionA là "Đúng", optionB là "Sai", correctAnswer là A hoặc B).
  - short_answer: Trả lời ngắn (cần correctAnswer là câu trả lời ngắn gọn).
  - fill_blank: Điền khuyết (dùng ___ trong question, correctAnswer là từ cần điền).
  - matching: Ghép nối (cần mảng matchingPairs gồm các cặp left và right).
  Thời gian (timeLimit) mặc định là 15 giây, có thể tăng lên 30-60 giây cho câu khó.
  Nếu chủ đề yêu cầu hoặc phù hợp, bạn có thể thêm URL hình ảnh (imageUrl), âm thanh (audioUrl), hoặc video (videoUrl) có thật trên internet để minh họa cho câu hỏi.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (text) {
      const questions = JSON.parse(text) as Question[];
      return questions;
    }
    return [];
  } catch (error) {
    console.error("Error generating questions:", error);
    throw new Error("Không thể tạo câu hỏi bằng AI lúc này.");
  }
}

export async function generateQuestionsFromImage(imageBase64: string): Promise<Question[]> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
      temperature: 0.2,
    }
  });

  const prompt = `Hãy trích xuất các câu hỏi từ ảnh này thành định dạng JSON. 
  Phân loại loại câu hỏi (multiple_choice, true_false, short_answer, fill_blank, matching) và điền các trường tương ứng. 
  Nếu là trắc nghiệm, đảm bảo có đủ đáp án và chỉ ra đáp án đúng nếu có thể suy luận (hoặc có đánh dấu trong ảnh), nếu không mặc định là A. 
  Phân loại chủ đề phù hợp.`;

  try {
    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg"
        }
      }
    ]);
    
    const response = result.response;
    const text = response.text();

    if (text) {
      const questions = JSON.parse(text) as Question[];
      return questions;
    }
    return [];
  } catch (error) {
    console.error("Error generating questions from image:", error);
    throw new Error("Không thể trích xuất câu hỏi từ ảnh lúc này.");
  }
}
