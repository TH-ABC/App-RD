
// SERVICE: Gửi dữ liệu về Google Sheet
// Link Google Sheet: https://docs.google.com/spreadsheets/d/17MqtANWPCsYgF0lUV3I356ejjVgasJhftHI_sAIbroM/edit

// BẠN CẦN THAY THẾ LINK DƯỚI ĐÂY BẰNG LINK "WEB APP URL" BẠN VỪA DEPLOY TỪ APPS SCRIPT
// Link mẫu (thay thế bằng link thật của bạn):
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx5ad3IA5TJ0DiLMu-lNh40NS48l5XWoI1QTN0OaMJQ9sgZF6cvuWhNBtbMj1WP9UqV1A/exec";

export const sendDataToSheet = async (
  images: string[], // Mảng 6 hình ảnh base64
  prompt: string,
  description: string
): Promise<void> => {
  // Nếu chưa thay link script thì bỏ qua (để tránh lỗi khi dev)
  if (GOOGLE_SCRIPT_URL.includes("example-replace-this")) {
    console.warn("Google Sheet Service: Chưa cập nhật Web App URL. Vui lòng update services/googleSheetService.ts");
    return;
  }

  try {
    // Dùng mode 'no-cors' để gửi được từ trình duyệt mà không bị chặn
    // Tuy nhiên 'no-cors' sẽ không trả về response body, nhưng dữ liệu vẫn được gửi đi.
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors", 
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        images: images,
        prompt: prompt,
        description: description
      }),
    });
    console.log("Data sent to Google Sheet successfully");
  } catch (error) {
    console.error("Failed to send data to Google Sheet", error);
  }
};
