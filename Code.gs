function doGet(e) {
  var action = e.parameter.action;
  
  if (action === 'getQuestions') {
    return ContentService.createTextOutput(JSON.stringify(getQuestions()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getBankQuestions') {
    return ContentService.createTextOutput(JSON.stringify(getBankQuestions()))
      .setMimeType(ContentService.MimeType.JSON);
  } else if (action === 'getUsageHistory') {
    return ContentService.createTextOutput(JSON.stringify(getUsageHistory()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: "Invalid action"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    
    if (action === 'saveScore') {
      var result = saveScore(data.payload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'saveToBank') {
      var result = saveToBank(data.payload);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    } else if (action === 'uploadMedia') {
      var result = uploadFileToDrive(data.payload.base64Data, data.payload.fileName);
      return ContentService.createTextOutput(JSON.stringify({url: result}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({error: "Invalid action"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 1. Lấy danh sách câu hỏi từ Sheets
function getQuestions() {
  // THAY ID FILE SHEETS CỦA BẠN VÀO ĐÂY
  var sheetId = 'ĐIỀN_ID_FILE_TẠI_ĐÂY'; 
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('CauHoi');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var questions = [];
  
  // Bỏ qua dòng tiêu đề (i = 1)
  for (var i = 1; i < data.length; i++) {
    questions.push({
      id: i,
      question: data[i][0],
      options: [data[i][1], data[i][2], data[i][3], data[i][4]],
      correctAnswer: data[i][5],
      timeLimit: data[i][6] || 15,
      mediaUrl: data[i][7] || ''
    });
  }
  return questions;
}

// 2. Lưu điểm số
function saveScore(payload) {
  var sheetId = 'ĐIỀN_ID_FILE_TẠI_ĐÂY';
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('BangXepHang');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(sheetId).insertSheet('BangXepHang');
    sheet.appendRow(['Thời gian', 'Tên người chơi', 'ID Thiết bị', 'Điểm số']);
  }
  
  sheet.appendRow([
    new Date(),
    payload.playerName,
    payload.deviceId,
    payload.score
  ]);
  
  return {success: true};
}

// 3. Lưu câu hỏi vào kho
function saveToBank(questions) {
  var sheetId = 'ĐIỀN_ID_FILE_TẠI_ĐÂY';
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('KhoCauHoi');
  if (!sheet) {
    sheet = SpreadsheetApp.openById(sheetId).insertSheet('KhoCauHoi');
    sheet.appendRow(['Câu hỏi', 'Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D', 'Đáp án đúng', 'Thời gian', 'Media URL', 'Chủ đề', 'Loại']);
  }
  
  questions.forEach(function(q) {
    sheet.appendRow([
      q.question,
      q.optionA || '',
      q.optionB || '',
      q.optionC || '',
      q.optionD || '',
      q.correctAnswer,
      q.timeLimit || 15,
      q.imageUrl || q.audioUrl || q.videoUrl || '',
      q.topic || 'Chung',
      q.type || 'multiple_choice'
    ]);
  });
  
  return {success: true};
}

function getBankQuestions() {
  var sheetId = 'ĐIỀN_ID_FILE_TẠI_ĐÂY';
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('KhoCauHoi');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var questions = [];
  
  for (var i = 1; i < data.length; i++) {
    var type = data[i][9] || 'multiple_choice';
    var q = {
      id: i,
      question: data[i][0],
      optionA: data[i][1],
      optionB: data[i][2],
      optionC: data[i][3],
      optionD: data[i][4],
      correctAnswer: data[i][5],
      timeLimit: data[i][6] || 15,
      topic: data[i][8] || 'Chung',
      type: type
    };
    
    var mediaUrl = data[i][7] || '';
    if (mediaUrl) {
      if (mediaUrl.includes('image')) q.imageUrl = mediaUrl;
      else if (mediaUrl.includes('audio')) q.audioUrl = mediaUrl;
      else if (mediaUrl.includes('video')) q.videoUrl = mediaUrl;
      else q.imageUrl = mediaUrl; // Default to image if unsure
    }
    
    questions.push(q);
  }
  return questions;
}

// 4. Lấy lịch sử
function getUsageHistory() {
  var sheetId = 'ĐIỀN_ID_FILE_TẠI_ĐÂY';
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('BangXepHang');
  if (!sheet) return [];
  
  var data = sheet.getDataRange().getValues();
  var history = [];
  for (var i = 1; i < data.length; i++) {
    history.push({
      timestamp: data[i][0],
      playerName: data[i][1],
      deviceId: data[i][2],
      score: data[i][3]
    });
  }
  return history;
}

// 5. Upload file lên Drive
function uploadFileToDrive(base64Data, fileName) {
  // 1. Tự động tạo hoặc tìm thư mục "Media_Game" trên Drive
  var folder, folders = DriveApp.getFoldersByName("Media_Game");
  if (folders.hasNext()) { 
    folder = folders.next(); 
  } else { 
    folder = DriveApp.createFolder("Media_Game"); 
  }
  
  // 2. Giải mã và lưu file
  var contentType = base64Data.substring(5, base64Data.indexOf(';'));
  var bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  var blob = Utilities.newBlob(bytes, contentType, fileName);
  var file = folder.createFile(blob);
  
  // 3. Tự động cấp quyền xem cho mọi người và trả về link trực tiếp
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}
