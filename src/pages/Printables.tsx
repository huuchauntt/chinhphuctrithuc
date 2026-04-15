import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Printables() {
  const navigate = useNavigate();
  const studentCount = 40; // Generate 40 cards

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="print:hidden bg-white p-4 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin')} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Thẻ QR cho học sinh (Paper Mode)</h1>
        </div>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-md transition-colors"
        >
          <Printer size={20} />
          In thẻ
        </button>
      </div>

      <div className="p-8 print:p-0">
        <div className="max-w-5xl mx-auto bg-white print:bg-transparent print:shadow-none shadow-lg rounded-2xl p-8 print:p-0">
          <div className="print:hidden mb-8 text-gray-600">
            <p>Hướng dẫn:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>In trang này ra giấy (khuyên dùng giấy A4, in 1 mặt).</li>
              <li>Mỗi học sinh sẽ nhận 1 thẻ có đánh số tương ứng.</li>
              <li>Khi trả lời, học sinh xoay thẻ sao cho chữ cái đáp án (A, B, C, D) hướng lên trên.</li>
              <li>Giáo viên dùng điện thoại quét thẻ để nhận đáp án.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 print:gap-4">
            {Array.from({ length: studentCount }).map((_, i) => {
              const id = i + 1;
              return (
                <div key={id} className="flex flex-col items-center justify-center border-4 border-black p-8 aspect-square relative break-inside-avoid">
                  {/* Corners */}
                  <div className="absolute top-2 left-2 text-2xl font-bold">{id}</div>
                  <div className="absolute top-2 right-2 text-2xl font-bold">{id}</div>
                  <div className="absolute bottom-2 left-2 text-2xl font-bold">{id}</div>
                  <div className="absolute bottom-2 right-2 text-2xl font-bold">{id}</div>

                  {/* Labels */}
                  <div className="absolute top-4 text-4xl font-black">A</div>
                  <div className="absolute right-4 text-4xl font-black rotate-90">B</div>
                  <div className="absolute bottom-4 text-4xl font-black rotate-180">C</div>
                  <div className="absolute left-4 text-4xl font-black -rotate-90">D</div>

                  {/* QR Code */}
                  <div className="mt-4">
                    <QRCodeSVG 
                      value={`student:${id}`} 
                      size={250} 
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
