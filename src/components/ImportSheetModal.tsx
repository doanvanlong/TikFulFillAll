import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { ClipboardPaste, FileUp, PlusCircle, Upload, X } from 'lucide-react';
import {
  PodOrder,
  SheetSyncSummary,
  SkuDesignItem,
  VariantMappingRule,
} from '../types/order';
import { autoDetectAndMergeSheetRows } from '../services/googleSheetsService';

interface ImportSheetModalProps {
  existingOrders: PodOrder[];
  variantMappings: VariantMappingRule[];
  skuDesigns: SkuDesignItem[];
  onClose: () => void;
  onImportOrders: (
    newOrders: PodOrder[],
    replaceExisting: boolean,
    summary?: SheetSyncSummary
  ) => void;
}

export const ImportSheetModal: React.FC<ImportSheetModalProps> = ({
  existingOrders,
  variantMappings,
  skuDesigns,
  onClose,
  onImportOrders,
}) => {
  const [tab, setTab] = useState<'paste' | 'file' | 'single'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Single manual order state
  const [manualOrderId, setManualOrderId] = useState('577610889912345678');
  const [manualProductName, setManualProductName] = useState(
    'Dachshund Dad Club Unisex T-Shirt'
  );
  const [manualColor, setManualColor] = useState('Black');
  const [manualSize, setManualSize] = useState('L');
  const [manualQty, setManualQty] = useState(1);
  const [manualSku, setManualSku] = useState('T_20382627295_1M');
  const [manualPrice, setManualPrice] = useState('16,96');
  const [manualLabel, setManualLabel] = useState(
    'https://drive.google.com/file/d/1bsS5Kc9bJwYMp-8zchW3pTT6TXHUW8Glz/view?usp=sharing'
  );
  const [manualShop, setManualShop] = useState('922');

  const handleParsePaste = () => {
    setErrorMsg(null);
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setErrorMsg('Vui lòng dán ít nhất 1 dòng dữ liệu từ Google Sheet.');
      return;
    }

    const rows = lines.map((line) => line.split('\t'));
    const { orders: detected, summary } = autoDetectAndMergeSheetRows(
      rows,
      existingOrders,
      variantMappings,
      skuDesigns
    );

    if (detected.length === 0) {
      setErrorMsg(
        'Không nhận diện được dòng Order hợp lệ. Hãy copy các cột từ Google Sheet và dán vào đây.'
      );
      return;
    }

    onImportOrders(detected, replaceExisting, summary);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, {
          header: 1,
          raw: false,
        });

        const { orders: detected, summary } = autoDetectAndMergeSheetRows(
          rows,
          existingOrders,
          variantMappings,
          skuDesigns
        );

        if (detected.length === 0) {
          setErrorMsg('File Excel không có dòng đơn hàng hợp lệ.');
          return;
        }
        onImportOrders(detected, replaceExisting, summary);
        onClose();
      } catch {
        setErrorMsg(
          'Không thể đọc file Excel/CSV. Vui lòng kiểm tra định dạng.'
        );
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const row = [
      String(existingOrders.length + 8),
      manualOrderId.trim(),
      todayStr,
      todayStr,
      manualProductName.trim(),
      '',
      `${manualColor}, ${manualSize}`,
      String(manualQty),
      manualSku.trim(),
      manualPrice,
      manualLabel.trim(),
      manualShop.trim(),
      'FALSE',
    ];
    const { orders: detected, summary } = autoDetectAndMergeSheetRows(
      [row],
      existingOrders,
      variantMappings,
      skuDesigns
    );
    onImportOrders(detected, false, summary);
    onClose();
  };

  const handleFillSamplePaste = () => {
    const sample = [
      '25\t577610992837465112\t10/10/2026\t11/10/2026\tDachshund Dad Club Unisex T-Shirt\thttps://p16-oec-general-useast5.ttcdn-us.com/sample1.jpg\tMilitary Green, XL\t1\tT_20382627295_1M\t16,96\thttps://drive.google.com/file/d/1SampleLabel25/view?usp=sharing\t922\tTRUE',
      "26\t577611223948576201\t10/10/2026\t11/10/2026\tMen's Southern Redfish Tail Graphic T-Shirt\thttps://p16-oec-general-useast5.ttcdn-us.com/sample2.jpg\tSand, L\t2\tT_73326023411_2M\t24,84\thttps://drive.google.com/file/d/1SampleLabel26/view?usp=sharing\t947\tFALSE",
    ].join('\n');
    setPasteText(sample);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl border border-[#E4E4E7] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-[#121212] text-white">
          <div className="flex items-center gap-2.5">
            <ClipboardPaste className="w-5 h-5 text-[#FE2C55]" />
            <h2 className="text-base font-bold tracking-tight">
              Nhập & Tự Nhận Diện Đơn Hàng từ Google Sheet / Excel
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="flex border-b border-[#E4E4E7] bg-[#F8F8FA] px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setTab('paste')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'paste'
                ? 'border-[#FE2C55] text-[#121212] bg-white'
                : 'border-transparent text-zinc-500 hover:text-[#121212]'
            }`}
          >
            Dán trực tiếp từ Google Sheet (Ctrl+V)
          </button>
          <button
            type="button"
            onClick={() => setTab('file')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'file'
                ? 'border-[#FE2C55] text-[#121212] bg-white'
                : 'border-transparent text-zinc-500 hover:text-[#121212]'
            }`}
          >
            Tải file Excel / CSV (.xlsx, .csv)
          </button>
          <button
            type="button"
            onClick={() => setTab('single')}
            className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              tab === 'single'
                ? 'border-[#FE2C55] text-[#121212] bg-white'
                : 'border-transparent text-zinc-500 hover:text-[#121212]'
            }`}
          >
            Thêm lẻ 1 đơn mới
          </button>
        </div>

        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
              {errorMsg}
            </div>
          )}

          {tab === 'paste' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-600">
                  Copy các dòng từ Google Sheet của bạn rồi nhấn{' '}
                  <code className="px-1.5 py-0.5 bg-zinc-100 rounded font-mono font-bold">
                    Ctrl+V
                  </code>{' '}
                  vào ô bên dưới. Hệ thống sẽ tự nhận diện cột Order ID, Variation, SKU và cập nhật các đơn trùng mã.
                </p>
                <button
                  type="button"
                  onClick={handleFillSamplePaste}
                  className="text-xs font-semibold text-[#FE2C55] hover:underline whitespace-nowrap cursor-pointer"
                >
                  Chèn 2 dòng mẫu thử
                </button>
              </div>

              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="8	577597628477379409	01/10/2026	02/10/2026	Dachshund Dad Club Unisex	https://p16-oec...	Black, L	1	T_20382627295_1M	16,96	https://drive.google.com/...	922	TRUE"
                className="w-full p-3 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:bg-white focus:border-[#121212]"
              />

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 rounded accent-[#FE2C55]"
                  />
                  <span className="text-xs text-zinc-700">
                    Thay thế toàn bộ bảng (nếu bỏ tích sẽ tự động Gộp / Cập nhật đơn trùng Order ID & thêm đơn mới)
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleParsePaste}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#FE2C55] rounded-lg hover:bg-[#E02046] transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-4 h-4" />
                  Tự nhận diện & Cập nhật
                </button>
              </div>
            </div>
          )}

          {tab === 'file' && (
            <div className="space-y-4">
              <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[#D4D4D8] rounded-xl bg-[#F8F8FA] hover:bg-zinc-100/80 transition-colors cursor-pointer">
                <FileUp className="w-8 h-8 text-[#FE2C55] mb-2" />
                <span className="text-sm font-bold text-[#121212]">
                  Chọn file Excel (.xlsx) hoặc CSV (.csv) từ máy tính
                </span>
                <span className="text-xs text-zinc-500 mt-1">
                  Tự động nhận diện vị trí cột Order ID, Variation, SKU và khớp dữ liệu Fulfillment
                </span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#FE2C55]"
                />
                <span className="text-xs text-zinc-700">
                  Thay thế toàn bộ danh sách hiện tại bằng file mới
                </span>
              </label>
            </div>
          )}

          {tab === 'single' && (
            <form onSubmit={handleAddSingle} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Order ID (Cột B)
                  </label>
                  <input
                    type="text"
                    required
                    value={manualOrderId}
                    onChange={(e) => setManualOrderId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Tên sản phẩm (Cột E)
                  </label>
                  <input
                    type="text"
                    required
                    value={manualProductName}
                    onChange={(e) => setManualProductName(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Màu sắc
                  </label>
                  <input
                    type="text"
                    value={manualColor}
                    onChange={(e) => setManualColor(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Size
                  </label>
                  <input
                    type="text"
                    value={manualSize}
                    onChange={(e) => setManualSize(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Quantity (Cột H)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={manualQty}
                    onChange={(e) =>
                      setManualQty(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Shop Code (Cột L)
                  </label>
                  <input
                    type="text"
                    value={manualShop}
                    onChange={(e) => setManualShop(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Mã SKU (Cột I)
                  </label>
                  <input
                    type="text"
                    value={manualSku}
                    onChange={(e) => setManualSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Giá bán $ (Cột J)
                  </label>
                  <input
                    type="text"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#121212] mb-1">
                    Link Label Drive (Cột K)
                  </label>
                  <input
                    type="text"
                    value={manualLabel}
                    onChange={(e) => setManualLabel(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#121212] rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Thêm đơn vào danh sách
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
