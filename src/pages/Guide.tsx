import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, Users, GraduationCap, CheckCircle2, PlayCircle, FileText, Settings, Smartphone, Monitor } from 'lucide-react';

export default function Guide() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="text-amber-500" size={28} />
            <h1 className="text-xl font-bold text-gray-900">Hướng dẫn sử dụng</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-8">
        {/* Tabs */}
        <div className="flex p-1 bg-white rounded-2xl shadow-sm border border-gray-200 mb-8 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('student')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
              activeTab === 'student' 
                ? 'bg-amber-500 text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users size={20} />
            Dành cho Học sinh
          </button>
          <button
            onClick={() => setActiveTab('teacher')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
              activeTab === 'teacher' 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <GraduationCap size={20} />
            Dành cho Giáo viên
          </button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 p-6 md:p-10">
          {activeTab === 'student' ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Chào mừng các bạn Học sinh! 👋</h2>
                <p className="text-gray-600 text-lg">Hệ thống giúp các bạn ôn tập và kiểm tra kiến thức một cách thú vị. Dưới đây là cách để bắt đầu.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 shrink-0 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center font-bold text-xl">1</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Tham gia phòng thi</h3>
                      <p className="text-gray-600 mb-3">Có 2 cách để tham gia vào bài kiểm tra do giáo viên tạo:</p>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                          <span><strong>Nhập mã PIN:</strong> Lấy mã PIN (6 số) từ giáo viên, nhập vào ô trên màn hình chính và nhấn "Vào thi".</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                          <span><strong>Quét mã QR:</strong> Sử dụng camera điện thoại quét mã QR do giáo viên trình chiếu.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="w-12 h-12 shrink-0 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center font-bold text-xl">2</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Chế độ thi Online</h3>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <Monitor size={20} className="text-blue-500 shrink-0 mt-0.5" />
                          <span>Đọc kỹ câu hỏi hiển thị trên màn hình của giáo viên hoặc thiết bị của bạn.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                          <span>Chọn đáp án đúng (A, B, C, D) tương ứng với màu sắc trên điện thoại/máy tính của bạn trước khi hết giờ.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                          <span>Điểm số sẽ phụ thuộc vào độ chính xác và tốc độ trả lời của bạn.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 shrink-0 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center font-bold text-xl">3</div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Chế độ thi trên Giấy (Paper Mode)</h3>
                      <ul className="space-y-2 text-gray-600">
                        <li className="flex items-start gap-2">
                          <FileText size={20} className="text-purple-500 shrink-0 mt-0.5" />
                          <span>Giáo viên sẽ phát cho bạn một thẻ Plickers (mã QR đặc biệt) hoặc phiếu tô trắc nghiệm.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                          <span><strong>Với thẻ Plickers:</strong> Xoay thẻ sao cho chữ cái đáp án bạn chọn (A, B, C, D) hướng lên trên, sau đó giơ cao để giáo viên quét bằng điện thoại.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={20} className="text-green-500 shrink-0 mt-0.5" />
                          <span><strong>Với phiếu tô:</strong> Tô đen kín ô tròn của đáp án bạn chọn. Giáo viên sẽ dùng máy chấm sau khi thu bài.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Dành cho Giáo viên Quản trị 👨‍🏫</h2>
                <p className="text-gray-600 text-lg">Quản lý lớp học, tạo bộ đề thông minh và tổ chức các phiên kiểm tra tương tác.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-8">
                  <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                      <Settings className="text-blue-500" />
                      1. Thiết lập ban đầu
                    </h3>
                    <ul className="space-y-3 text-gray-600">
                      <li><strong>Đăng nhập:</strong> Sử dụng tài khoản Google đã được cấp quyền để truy cập trang Quản trị.</li>
                      <li><strong>Liên kết Google Sheets:</strong> Vào mục Cài đặt (biểu tượng bánh răng), dán URL của Google Apps Script để kích hoạt tính năng lưu câu hỏi vào kho và tải ảnh lên Drive.</li>
                      <li><strong>Quản lý lớp học:</strong> Chuyển sang tab "Lớp học" để tạo danh sách học sinh (có thể nhập từ Excel).</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                      <FileText className="text-blue-500" />
                      2. Tạo Bộ Đề (Quiz)
                    </h3>
                    <p className="text-gray-600 mb-3">Hệ thống hỗ trợ 4 cách tạo câu hỏi:</p>
                    <ul className="space-y-3 text-gray-600">
                      <li><span className="font-medium text-gray-900">Thêm thủ công:</span> Tự nhập câu hỏi, đáp án và tải lên hình ảnh/âm thanh.</li>
                      <li><span className="font-medium text-gray-900">Tạo bằng AI:</span> Nhập chủ đề và số lượng, AI (Gemini) sẽ tự động sinh câu hỏi trắc nghiệm.</li>
                      <li><span className="font-medium text-gray-900">Nhập từ File:</span> Tải file mẫu Excel/CSV về, điền dữ liệu và upload lên hệ thống.</li>
                      <li><span className="font-medium text-gray-900">Tải từ Kho (Sheets):</span> Lấy các câu hỏi đã lưu trữ trước đó từ Google Sheets.</li>
                    </ul>
                  </section>
                </div>

                <div className="space-y-8">
                  <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                      <PlayCircle className="text-blue-500" />
                      3. Tổ chức thi (Sessions)
                    </h3>
                    <ul className="space-y-3 text-gray-600">
                      <li>Chọn một bộ đề đã lưu và nhấn <strong>"Bắt đầu phiên mới"</strong>.</li>
                      <li><strong>Thi Online:</strong> Học sinh dùng thiết bị cá nhân nhập mã PIN để tham gia. Giáo viên điều khiển tiến độ chuyển câu hỏi.</li>
                      <li><strong>Thi trên Giấy (Paper Mode):</strong> Chọn lớp học, in thẻ Plickers/phiếu tô cho học sinh. Giáo viên dùng camera điện thoại quét thẻ của học sinh để nhận đáp án ngay lập tức.</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                      <Users className="text-blue-500" />
                      4. Quản lý & Thống kê
                    </h3>
                    <ul className="space-y-3 text-gray-600">
                      <li><strong>Lịch sử:</strong> Xem lại các phiên thi đã tổ chức trong tab "Phiên thi".</li>
                      <li><strong>Bảng xếp hạng:</strong> Xem điểm số chi tiết của từng học sinh trong mỗi phiên.</li>
                      <li><strong>In ấn:</strong> Truy cập mục "In ấn" để tải về và in các thẻ Plickers hoặc phiếu tô trắc nghiệm chuẩn cho học sinh.</li>
                    </ul>
                  </section>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
