import React, { useEffect, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ExternalLink,
  FilePlus2,
  Link2,
  LogOut,
  RefreshCw,
  Sparkles,
  Unlink,
  X,
} from 'lucide-react';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from '../services/googleAuth';
import {
  autoDetectAndMergeSheetRows,
  createConnectedGoogleSheet,
  extractSpreadsheetIdAndGid,
  fetchPublicSheetValuesCsv,
  fetchSheetValuesOAuth,
  fetchSpreadsheetMetadata,
  pushFulfillmentToGoogleSheet,
  ensureDataTabs, readDataTab, writeDataTab,
} from '../services/googleSheetsService';
import {
  ExportLogItem,
  PodOrder,
  SheetSyncSummary,
  SheetTabInfo,
  SkuDesignItem,
  VariantMappingRule,
} from '../types/order';

interface GoogleSheetsSyncPanelProps {
  orders: PodOrder[];
  variantMappings: VariantMappingRule[];
  skuDesigns: SkuDesignItem[];
  onOrdersSynced: (mergedOrders: PodOrder[], summary: SheetSyncSummary) => void;
  onToast: (msg: string) => void;
  dirtyIds: string[];
  onDirtySaved: (ids:string[]) => void;
  exportLogs: ExportLogItem[];
  onExportLogsSynced: (items:ExportLogItem[]) => void;
  onVariantsSynced: (items:VariantMappingRule[]) => void;
  onDesignsSynced: (items:SkuDesignItem[]) => void;
}

const SHEET_CONFIG_STORAGE_KEY = 'tikfulfill_sheet_connection_v1';

export const GoogleSheetsSyncPanel: React.FC<GoogleSheetsSyncPanelProps> = ({
  orders,
  variantMappings,
  skuDesigns,
  onOrdersSynced,
  onToast,
  dirtyIds, onDirtySaved, exportLogs, onExportLogsSynced, onVariantsSynced, onDesignsSynced,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [sheetUrlInput, setSheetUrlInput] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SHEET_CONFIG_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.sheetUrlInput || '';
      }
    } catch {
      // ignore
    }
    return '';
  });

  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SHEET_CONFIG_STORAGE_KEY);
      if (saved) return JSON.parse(saved).spreadsheetId || '';
    } catch {
      // ignore
    }
    return '';
  });

  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SHEET_CONFIG_STORAGE_KEY);
      if (saved) return JSON.parse(saved).spreadsheetTitle || 'Orders';
    } catch {
      // ignore
    }
    return 'Orders';
  });

  const [tabs, setTabs] = useState<SheetTabInfo[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(SHEET_CONFIG_STORAGE_KEY);
      if (saved) return JSON.parse(saved).selectedTab || 'Orders';
    } catch {
      // ignore
    }
    return 'Orders';
  });

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [writeStatus, setWriteStatus] = useState('Chưa có thay đổi cần lưu');
  const busyRef = useRef(false);
  const baselineRef = useRef<Record<string,string[]>>({});
  const loadedAuxRef = useRef(false);
  const auxSnapshotRef = useRef<Record<string,string>>({});
  const dirtyRef = useRef(dirtyIds);
  dirtyRef.current = dirtyIds;
  const updateBaseline = (records:PodOrder[], raw:string[][]) => {
    const snapshot:Record<string,string[]> = {};
    records.forEach(o=>{if(o.sheetRowNumber) snapshot[o.id]=[5,7,10,12,13,14,15,16].map(j=>String(raw[o.sheetRowNumber!-1]?.[j]??'').trim());});
    baselineRef.current=snapshot;
  };
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastSyncSummary, setLastSyncSummary] =
    useState<SheetSyncSummary | null>(null);

  // Explicit Confirmation Modal state for mutating operations (Write-Back & Create Sheet)
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'push_to_sheet' | 'create_new_sheet';
    title: string;
    description: string;
  } | null>(null);

  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, accessToken) => {
        setUser(authedUser);
        setToken(accessToken);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        SHEET_CONFIG_STORAGE_KEY,
        JSON.stringify({
          sheetUrlInput,
          spreadsheetId,
          spreadsheetTitle,
          selectedTab,
        })
      );
    } catch {
      // ignore
    }
  }, [sheetUrlInput, spreadsheetId, spreadsheetTitle, selectedTab]);

  // Push only edited line items, debounced; skip read while pending.
  useEffect(()=>{
    if(!dirtyIds.length || !spreadsheetId || !token) return;
    const timer=setTimeout(async()=>{
      if(busyRef.current) return;
      busyRef.current=true;
      const affected=ordersRef.current.filter(o=>dirtyRef.current.includes(o.id));
      const ids=affected.map(o=>o.id);
      if(!affected.length){busyRef.current=false;return;}
      setWriteStatus(`Đang lưu ${ids.length} dòng...`);
      try {
        const currentToken=await getAccessToken();
        if(!currentToken) throw new Error('Phiên Google hết hạn. Hãy đăng nhập lại để lưu.');
        await pushFulfillmentToGoogleSheet(spreadsheetId,selectedTab,affected,currentToken,baselineRef.current);
        affected.forEach(o=>baselineRef.current[o.id]=[o.mockupUrl,String(o.quantity),o.labelUrl,String(o.fulfilled).toUpperCase(),o.variantId,o.designFront,o.designBack,o.note]);
        onDirtySaved(ids);
        setWriteStatus(`Đã lưu ${ids.length} dòng lên Sheet`);
      } catch(err) { setWriteStatus(`Chưa lưu: ${err instanceof Error?err.message:'Lỗi không xác định'}`); }
      finally {busyRef.current=false;}
    },1200);
    return ()=>clearTimeout(timer);
  },[dirtyIds,orders,spreadsheetId,selectedTab,token]);

  // Shared auxiliary tabs: hydrate only after connecting and save subsequent changes.
  useEffect(()=>{
    if(!spreadsheetId || !token || loadedAuxRef.current) return;
    let cancelled=false;
    (async()=>{
      try {
        await ensureDataTabs(spreadsheetId,token);
        const [variants,designs,history]=await Promise.all([
          readDataTab<VariantMappingRule>(spreadsheetId,'VariantMapping',token),
          readDataTab<SkuDesignItem>(spreadsheetId,'DesignLibrary',token),
          readDataTab<ExportLogItem>(spreadsheetId,'ExportHistory',token)
        ]);
        if(cancelled) return;
        if(variants.length) onVariantsSynced(variants);
        if(designs.length) onDesignsSynced(designs);
        if(history.length) onExportLogsSynced(history);
        auxSnapshotRef.current={
          VariantMapping:JSON.stringify(variants.length?variants:variantMappings),
          DesignLibrary:JSON.stringify(designs.length?designs:skuDesigns),
          ExportHistory:JSON.stringify(history.length?history:exportLogs)
        };
        loadedAuxRef.current=true;
      } catch(err){setWriteStatus(`Chưa đồng bộ thư viện: ${err instanceof Error?err.message:'Lỗi'}`);}
    })();
    return()=>{cancelled=true;};
  },[spreadsheetId,token]);

  useEffect(()=>{
    if(!loadedAuxRef.current || !spreadsheetId || !token) return;
    const timer=setTimeout(async()=>{
      const data=[['VariantMapping',variantMappings],['DesignLibrary',skuDesigns],['ExportHistory',exportLogs]] as const;
      for(const [tab,records] of data){
        const json=JSON.stringify(records);
        if(auxSnapshotRef.current[tab]===json) continue;
        try {await writeDataTab(spreadsheetId,tab,records,token);auxSnapshotRef.current[tab]=json;}
        catch(err){setWriteStatus(`Lỗi ghi ${tab}: ${err instanceof Error?err.message:'Lỗi'}`);}
      }
    },1300);
    return()=>clearTimeout(timer);
  },[variantMappings,skuDesigns,exportLogs,spreadsheetId,token]);

  // Auto-polling interval when autoSyncEnabled is active
  useEffect(() => {
    if (!autoSyncEnabled || !spreadsheetId) return;
    const timer = setInterval(() => {
      handlePullAndDetectFromSheet(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [autoSyncEnabled, spreadsheetId, selectedTab, token]);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        onToast(`Đã đăng nhập Google Sheets với ${result.user.email}`);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Đăng nhập Google không thành công.';
      setErrorMsg(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setNeedsAuth(true);
    setAutoSyncEnabled(false);
    onToast('Đã ngắt phiên đăng nhập Google');
  };

  const handleConnectSheetUrl = async () => {
    setErrorMsg(null);
    const { spreadsheetId: extractedId, gid } =
      extractSpreadsheetIdAndGid(sheetUrlInput);

    if (!extractedId) {
      setErrorMsg(
        'Vui lòng dán đường dẫn Google Sheet hợp lệ (VD: https://docs.google.com/spreadsheets/d/.../edit).'
      );
      return;
    }

    setIsSyncing(true);
    try {
      const currentToken = await getAccessToken();

      if (currentToken) {
        const meta = await fetchSpreadsheetMetadata(extractedId, currentToken);
        setSpreadsheetId(extractedId);
        setSpreadsheetTitle(meta.title);
        setTabs(meta.tabs);

        // Pick tab matching gid, or named 'Orders', or first tab
        let chosenTab = meta.tabs[0]?.title || 'Orders';
        if (gid !== null) {
          const byGid = meta.tabs.find((t) => t.sheetId === gid);
          if (byGid) chosenTab = byGid.title;
        } else {
          const ordersTab = meta.tabs.find(
            (t) => t.title.toLowerCase() === 'orders'
          );
          if (ordersTab) chosenTab = ordersTab.title;
        }
        setSelectedTab(chosenTab);

        const rawRows = await fetchSheetValuesOAuth(
          extractedId,
          chosenTab,
          currentToken
        );
        const result = autoDetectAndMergeSheetRows(
          rawRows,
          ordersRef.current,
          variantMappings,
          skuDesigns
        );
        updateBaseline(result.orders, rawRows);
        setLastSyncSummary(result.summary);
        onOrdersSynced(result.orders, result.summary);
      } else {
        // Public sheet fallback (read-only CSV export)
        const rawRows = await fetchPublicSheetValuesCsv(
          extractedId,
          gid,
          selectedTab
        );
        setSpreadsheetId(extractedId);
        setSpreadsheetTitle('Google Sheet (Chế độ Link Chia Sẻ)');
        const result = autoDetectAndMergeSheetRows(
          rawRows,
          ordersRef.current,
          variantMappings,
          skuDesigns
        );
        updateBaseline(result.orders, rawRows);
        setLastSyncSummary(result.summary);
        onOrdersSynced(result.orders, result.summary);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Không thể kết nối Google Sheet. Hãy kiểm tra quyền truy cập.';
      setErrorMsg(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullAndDetectFromSheet = async (silent = false) => {
    if (!spreadsheetId) {
      setErrorMsg('Vui lòng nhập link Google Sheet để kết nối trước.');
      return;
    }

    if (!silent) {
      setErrorMsg(null);
      setIsSyncing(true);
    }

    try {
      const currentToken = await getAccessToken();
      const { gid } = extractSpreadsheetIdAndGid(sheetUrlInput);

      let rawRows: string[][] = [];
      if (currentToken) {
        rawRows = await fetchSheetValuesOAuth(
          spreadsheetId,
          selectedTab,
          currentToken
        );
      } else {
        rawRows = await fetchPublicSheetValuesCsv(
          spreadsheetId,
          gid,
          selectedTab
        );
      }

      const result = autoDetectAndMergeSheetRows(
        rawRows,
        ordersRef.current,
        variantMappings,
        skuDesigns
      );
      if(dirtyRef.current.length || busyRef.current) return; // never overwrite unsaved edits
      updateBaseline(result.orders, rawRows);
      setLastSyncSummary(result.summary);
      onOrdersSynced(result.orders, result.summary);
    } catch (err: unknown) {
      if (!silent) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Lỗi khi đồng bộ dữ liệu từ Google Sheet.'
        );
      }
    } finally {
      if (!silent) setIsSyncing(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!confirmDialog) return;
    const actionType = confirmDialog.type;
    setConfirmDialog(null);
    setErrorMsg(null);

    const currentToken = await getAccessToken();
    if (!currentToken) {
      setNeedsAuth(true);
      setErrorMsg(
        'Vui lòng nhấn "Sign in with Google" để cấp quyền ghi dữ liệu lên Google Sheets.'
      );
      return;
    }

    setIsSyncing(true);
    try {
      if (actionType === 'push_to_sheet') {
        const res = await pushFulfillmentToGoogleSheet(
          spreadsheetId,
          selectedTab,
          orders,
          currentToken
        );
        onToast(
          `Đã cập nhật thành công ${res.updatedRows} dòng Fulfillment lên Google Sheet "${spreadsheetTitle}" (${selectedTab})!`
        );
      } else if (actionType === 'create_new_sheet') {
        const created = await createConnectedGoogleSheet(orders, currentToken);
        setSheetUrlInput(created.spreadsheetUrl);
        setSpreadsheetId(created.spreadsheetId);
        setSpreadsheetTitle('Orders - TikFulfill POD');
        setSelectedTab(created.tabTitle);
        setTabs([{ sheetId: 0, title: created.tabTitle }]);
        onToast(
          `Đã tạo & kết nối Google Sheet "${created.tabTitle}" mới với ${orders.length} đơn hàng!`
        );
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật dữ liệu lên Google Sheet.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectSheet = () => {
    loadedAuxRef.current=false;
    setSpreadsheetId('');
    setSheetUrlInput('');
    setTabs([]);
    setLastSyncSummary(null);
    setAutoSyncEnabled(false);
    localStorage.removeItem(SHEET_CONFIG_STORAGE_KEY);
    onToast('Đã ngắt liên kết file Google Sheet hiện tại');
  };

  return (
    <section className="bg-white border border-[#E4E4E7] rounded-xl p-5 space-y-4">
      <div role="status" className={`text-xs font-semibold px-3 py-2 rounded-lg ${writeStatus.startsWith('Chưa lưu') || writeStatus.startsWith('Lỗi') ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
        Đồng bộ hai chiều: {writeStatus}{dirtyIds.length ? ` · ${dirtyIds.length} dòng chờ lưu` : ''}
      </div>
      {/* Top Row: Connection Status & Google OAuth Account */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#E8E8ED]">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#16794B]/10 border border-[#16794B]/25 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-[#16794B]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold text-[#121212] tracking-tight">
                Kết Nối Trực Tiếp Google Sheets & Tự Nhận Diện Dữ Liệu Orders
              </h2>
              <span className="text-xs text-zinc-400">·</span>
              <span className="text-xs font-semibold text-[#16794B]">
                {spreadsheetId
                  ? `Đang kết nối: ${spreadsheetTitle} (Tab: ${selectedTab})`
                  : 'Sẵn sàng kết nối'}
              </span>
            </div>
            <p className="text-xs text-zinc-600 mt-0.5">
              Tự động nhận diện vị trí cột (Order ID, Sản phẩm, Variation Màu/Size, SKU, Label PDF), tự khớp Variant ID & Design và đồng bộ 2 chiều với Google Sheet.
            </p>
          </div>
        </div>

        {/* Google Sign-In / Connected User Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {needsAuth || !token ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSigningIn}
              className="gsi-material-button inline-flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-zinc-50 text-[#1F1F1F] border border-[#747775] rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shadow-2xs"
            >
              <div className="w-4 h-4 shrink-0">
                <svg
                  version="1.1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 48 48"
                  className="w-full h-full block"
                >
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                  <path fill="none" d="M0 0h48v48H0z" />
                </svg>
              </div>
              <span>
                {isSigningIn ? 'Đang kết nối...' : 'Sign in with Google'}
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">
                Đã kết nối Google:{' '}
                <strong className="text-[#121212]">{user?.email}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  setConfirmDialog({
                    type: 'create_new_sheet',
                    title: 'Tạo Google Sheet "Orders" mới trên tài khoản của bạn?',
                    description: `Hệ thống sẽ tạo một file Google Sheet mới có tên "Orders - TikFulfill POD" và ghi toàn bộ ${orders.length} đơn hàng hiện tại (cùng các cột Variant ID, Design Front, Design Back) lên Google Sheets của bạn để bạn test đồng bộ 2 chiều ngay lập tức.`,
                  })
                }
                disabled={isSyncing}
                className="px-3 py-1.5 text-xs font-bold text-[#121212] bg-[#F8F8FA] border border-[#D4D4D8] rounded-lg hover:bg-zinc-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Tạo mới 1 file Google Sheet chứa 17 đơn hàng hiện tại trên Google Drive của bạn"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-[#16794B]" />
                Tạo Sheet mẫu & Kết nối
              </button>
              <button
                type="button"
                onClick={handleGoogleLogout}
                className="p-1.5 text-zinc-500 hover:text-rose-600 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Đăng xuất Google"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* URL Input & Sync Controls */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-center">
        <div className="xl:col-span-6 flex items-center gap-2">
          <input
            type="text"
            value={sheetUrlInput}
            onChange={(e) => setSheetUrlInput(e.target.value)}
            placeholder="Dán link Google Sheet (https://docs.google.com/spreadsheets/d/.../edit) hoặc Spreadsheet ID..."
            className="w-full px-3.5 py-2 text-xs font-mono bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:bg-white focus:border-[#121212] text-[#121212]"
          />
          {spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
              target="_blank"
              rel="noreferrer"
              className="p-2 text-zinc-600 hover:text-[#121212] bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg shrink-0"
              title="Mở file Google Sheet trong tab mới"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>

        {/* Sheet Tab Selector */}
        <div className="xl:col-span-2">
          {tabs.length > 0 ? (
            <select
              value={selectedTab}
              onChange={(e) => setSelectedTab(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
            >
              {tabs.map((t) => (
                <option key={t.sheetId} value={t.title}>
                  Tab: {t.title}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={selectedTab}
              onChange={(e) => setSelectedTab(e.target.value)}
              placeholder="Tên Tab (VD: Orders)"
              className="w-full px-3 py-2 text-xs font-semibold bg-[#F8F8FA] border border-[#E4E4E7] rounded-lg focus:outline-none focus:border-[#121212]"
              title="Tên sheet tab cần đọc (Mặc định: Orders)"
            />
          )}
        </div>

        {/* Action Buttons: Connect / Pull / Push to Sheet */}
        <div className="xl:col-span-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={
              spreadsheetId
                ? () => handlePullAndDetectFromSheet(false)
                : handleConnectSheetUrl
            }
            disabled={isSyncing}
            className="px-3.5 py-2 text-xs font-bold text-white bg-[#16794B] rounded-lg hover:bg-[#12633D] disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowDownToLine className="w-3.5 h-3.5" />
            )}
            {spreadsheetId
              ? 'Quét & Nhận diện Data từ Sheet'
              : 'Kết nối & Nhận diện Sheet'}
          </button>

          {spreadsheetId && (
            <>
              <button
                type="button"
                onClick={() =>
                  setConfirmDialog({
                    type: 'push_to_sheet',
                    title: `Cập nhật dữ liệu Fulfillment lên Google Sheet "${spreadsheetTitle}"?`,
                    description: `Thao tác này sẽ ghi cập nhật ${orders.length} đơn hàng (bao gồm trạng thái Cột M TRUE/FALSE và các cột Variant ID, Design Front, Design Back, Ghi chú tại cột N–Q) lên tab "${selectedTab}" của Google Sheet.`,
                  })
                }
                disabled={isSyncing}
                className="px-3.5 py-2 text-xs font-bold text-white bg-[#121212] rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                title="Ghi ngược Variant ID, Design Front/Back và trạng thái TRUE/FALSE lên Google Sheet"
              >
                <ArrowUpFromLine className="w-3.5 h-3.5 text-[#25F4EE]" />
                Ghi Fulfillment lên Sheet
              </button>

              <button
                type="button"
                onClick={handleDisconnectSheet}
                className="p-2 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Ngắt kết nối Sheet này"
              >
                <Unlink className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Auto-Watch Toggle & Last Detection Summary */}
      {(spreadsheetId || lastSyncSummary) && (
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600 border-t border-[#F1F1F4]">
          <div className="flex items-center gap-2 flex-wrap">
            {lastSyncSummary ? (
              <>
                <span className="inline-flex items-center gap-1 font-semibold text-[#16794B]">
                  <Sparkles className="w-3.5 h-3.5" />
                  Đã nhận diện {lastSyncSummary.totalDetected} đơn
                </span>
                <span>·</span>
                <span>
                  Đơn mới: <strong>+{lastSyncSummary.newOrdersAdded}</strong>
                </span>
                <span>·</span>
                <span>
                  Cập nhật: <strong>{lastSyncSummary.existingUpdated}</strong>
                </span>
                <span>·</span>
                <span>
                  Tự khớp Variant/Design:{' '}
                  <strong>
                    {lastSyncSummary.autoMappedVariants} mã Variant /{' '}
                    {lastSyncSummary.autoMappedDesigns} Design
                  </strong>
                </span>
                <span>·</span>
                <span className="text-zinc-500">
                  {lastSyncSummary.columnMapSummary} (Lúc {lastSyncSummary.syncedAt})
                </span>
              </>
            ) : (
              <span>
                Đã lưu kết nối tới <strong>{spreadsheetTitle}</strong> (Tab:{' '}
                <code className="font-mono">{selectedTab}</code>). Nhấn "Quét & Nhận diện Data từ Sheet" để làm mới.
              </span>
            )}
          </div>

          {spreadsheetId && (
            <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="w-4 h-4 rounded accent-[#16794B]"
              />
              <span className="font-semibold text-[#121212]">
                Tự động nhận diện đơn mới mỗi 30 giây
              </span>
            </label>
          )}
        </div>
      )}

      {/* Error Display */}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-xs text-rose-700 font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MANDATORY CONFIRMATION DIALOG FOR MUTATING GOOGLE SHEETS API CALLS */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-[#E4E4E7] shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#121212] text-white flex items-center justify-between">
              <h3 className="text-sm font-bold tracking-tight">
                Xác nhận thao tác trên Google Sheets
              </h3>
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="text-sm font-bold text-[#121212]">
                {confirmDialog.title}
              </div>
              <p className="text-xs text-zinc-600 leading-relaxed">
                {confirmDialog.description}
              </p>
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-700 bg-white border border-[#D4D4D8] rounded-lg hover:bg-zinc-50 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={executeConfirmedAction}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#16794B] rounded-lg hover:bg-[#12633D] flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Xác nhận thực hiện
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
