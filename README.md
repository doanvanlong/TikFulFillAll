# TikFulfill — phát triển từ source React/TypeScript gốc

Đây là bản chỉnh sửa TRỰC TIẾP trên dự án do người dùng cung cấp, không chuyển sang HTML/Apps Script mới. Gồm 5 màn hình đã có: Đơn hàng, Cần Fulfill, Bảng mã Variant, Thư viện Design, Lịch sử Excel.

## Nâng cấp an toàn dữ liệu
- Cập nhật Google Sheets qua nút ghi Sheet hiện hữu chỉ ghi các cột M:Q (M = TRUE/FALSE, N = Variant ID, O = Design Front, P = Design Back, Q = Note); **KHÔNG** ghi đè A:L.
- Trước khi ghi, hệ thống tải danh sách Order ID hiện thời ở cột B để xác minh vị trí dòng sau khi Google Sheet thay đổi hoặc được sắp xếp.
- Tạm chặn ghi nếu cùng Order ID có nhiều dòng. Đây là biện pháp an toàn, **không** phải giải pháp hoàn chỉnh cho line item trùng: cần thêm Line UID ổn định cho phép xử lý nhiều sản phẩm/đơn.
- Khi nhập/đọc, mỗi dòng mới dùng mã riêng gồm Order ID + số dòng; ghép dữ liệu không còn gom tất cả dòng cùng Order ID vào một dòng duy nhất.
- Chỉ tự điền Variant ID khi có quy tắc Mapping hoặc giá trị có sẵn; không tạo mã nhà cung cấp bằng suy đoán.
- Giữ nguyên giao diện và các component React của dự án gốc.

## Chạy dự án
Yêu cầu Node.js (v22 phù hợp với Vite 8). Chạy `npm install`, sau đó `npm run dev`. Build: `npm run build`.

## Kết nối Google Sheets
Dùng panel kết nối Google Sheets hiện có. Đăng nhập Google để đọc/ghi (Firebase OAuth cấu hình từ dự án gốc). Link công khai chỉ để đọc. Nút "Ghi lên Sheet" cần xác nhận trước khi lưu. Tự quét dữ liệu từ Sheet là chức năng lấy dữ liệu xuống theo chu kỳ; **bản này chưa tự đẩy mọi thay đổi lên Sheet ngay khi chỉnh sửa**. Không nên bật tự quét nếu đang có chỉnh sửa chưa đẩy lên Sheet, vì Sheet có thể ghi đè dữ liệu ở trình duyệt.

**Quan trọng:** Hãy tạo một bản sao Google Sheet và thử ghi trước khi dùng thật. Cấu hình đăng nhập Google/Firebase và tên miền được cấp phép là của dự án gốc, phải kiểm tra sau khi triển khai lên hosting mới. Không đưa tài khoản dịch vụ hay private key vào frontend.

## Việc cần bổ sung trong vòng phát triển kế tiếp
- Đồng bộ tự động hai chiều với chống xung đột / hàng đợi ghi / Line UID riêng mỗi đơn-sản phẩm.
- Lưu VariantMapping / DesignLibrary / ExportHistory vào Google Sheets, thay vì chỉ lưu browser localStorage.
- Nhận thumbnail TikTok từ nguồn được cấp quyền, quản lý và xuất Excel theo mẫu xưởng.

## Nâng cấp đồng bộ 2 chiều (bản này)
- Khi đăng nhập OAuth Google và kết nối Sheet, ứng dụng tự đọc lại Orders 30 giây/lần; sửa đơn trên web sẽ tự ghi sau khoảng 1,2 giây. Panel hiển thị số dòng chờ và trạng thái ghi lỗi/thành công.
- Chỉ cập nhật các cột F (mockup URL), H (quantity), K (label), M:Q (status, variant, front, back, ghi chú). Các cột nguồn khác không bị ghi lại. Trước khi ghi, kiểm tra lại Order ID + SKU + Variation, và đối chiếu giá trị trước đó nhằm tránh mất thay đổi trên Sheet. Với nhiều dòng hoàn toàn trùng nhau, không thể bảo đảm định danh qua sắp xếp; hệ thống ngừng ghi và yêu cầu xử lý.
- Tạo tab VariantMapping, DesignLibrary, ExportHistory trên Spreadsheet và lưu dữ liệu ở cột A dưới dạng JSON cho từng mục, giúp dữ liệu dùng được giữa các trình duyệt. Đây là định dạng dữ liệu nội bộ của ứng dụng; không sửa thủ công JSON trong các tab này.
- Auto-fill không còn tự tạo Variant ID hoặc liên kết Google Drive tưởng tượng; chỉ sử dụng mã/link đã tồn tại trong bảng mapping/thư viện.
- Ghi Sheet yêu cầu đăng nhập OAuth và quyền `spreadsheets`; chế độ CSV công khai chỉ đọc. Token OAuth hiện lưu trong RAM và có thể cần đăng nhập lại khi hết hạn.
- **Giới hạn cần biết:** chưa giải quyết được định danh ổn định cho các line item trùng hoàn toàn khi Sheet bị sắp xếp; chưa có cơ chế đồng bộ thời gian thực giữa nhiều người cùng chỉnh tab thư viện; chưa thử end-to-end với tài khoản Google thật trong môi trường này. Hãy thử trên bản sao Sheet trước.
