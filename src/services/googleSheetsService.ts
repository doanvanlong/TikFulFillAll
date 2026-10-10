import * as XLSX from 'xlsx';
import {
  GarmentType,
  PodOrder,
  PrintSides,
  SheetSyncSummary,
  SheetTabInfo,
  SkuDesignItem,
  VariantMappingRule,
} from '../types/order';

export function extractSpreadsheetIdAndGid(input: string): {
  spreadsheetId: string;
  gid: number | null;
} {
  const trimmed = input.trim();
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/[#&?]gid=(\d+)/);

  if (idMatch) {
    return {
      spreadsheetId: idMatch[1],
      gid: gidMatch ? parseInt(gidMatch[1], 10) : null,
    };
  }

  // Assume direct spreadsheet ID if no slash
  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) {
    return { spreadsheetId: trimmed, gid: null };
  }

  return { spreadsheetId: '', gid: null };
}

export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<{ title: string; tabs: SheetTabInfo[] }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}?fields=properties.title,sheets.properties`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const msg =
      errBody?.error?.message ||
      `Lỗi kết nối Google Sheets API (HTTP ${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json();
  const title: string = data?.properties?.title || 'Google Sheet';
  const tabs: SheetTabInfo[] = (data?.sheets || []).map(
    (s: {
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title || 'Orders',
      rowCount: s.properties?.gridProperties?.rowCount,
      columnCount: s.properties?.gridProperties?.columnCount,
    })
  );

  return { title, tabs };
}

export async function fetchSheetValuesOAuth(
  spreadsheetId: string,
  tabTitle: string,
  accessToken: string
): Promise<string[][]> {
  const range = `${tabTitle}!A1:Z1000`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `Không thể đọc dữ liệu từ tab "${tabTitle}"`
    );
  }

  const data = await res.json();
  return (data?.values as string[][]) || [];
}

/**
 * Fallback reader for public ("Anyone with link can view") Google Sheets
 * when user hasn't signed in with OAuth yet.
 */
export async function fetchPublicSheetValuesCsv(
  spreadsheetId: string,
  gid: number | null,
  tabTitle?: string
): Promise<string[][]> {
  let url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:csv`;
  if (tabTitle && tabTitle.trim()) {
    url += `&sheet=${encodeURIComponent(tabTitle.trim())}`;
  } else if (gid !== null) {
    url += `&gid=${gid}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      'Không thể đọc Sheet qua link công khai. Vui lòng đăng nhập Google (Sign in with Google) hoặc bật chia sẻ Sheet "Bất kỳ ai có đường liên kết".'
    );
  }

  const csvText = await res.text();
  if (csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes('accounts.google.com')) {
    throw new Error(
      'Sheet này đang ở chế độ Riêng tư. Vui lòng nhấn "Sign in with Google" để kết nối quyền đọc/ghi trực tiếp.'
    );
  }

  const wb = XLSX.read(csvText, { type: 'string' });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
    header: 1,
    raw: false,
  });
  return rows || [];
}

function parsePriceCell(val: unknown): number {
  if (typeof val === 'number') return val;
  const cleaned = String(val ?? '0')
    .trim()
    .replace(/[^0-9,.-]/g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Smart Column & Data Auto-Detector:
 * Automatically detects column positions from either headers OR cell content patterns
 * (e.g. 18-digit TikTok Order ID in Col B, Dates in C/D, Variation "Color, Size" in G, SKU in I, Drive link in K)
 * and merges with existing orders while auto-mapping Variant ID & Design Front/Back.
 */
export function autoDetectAndMergeSheetRows(
  rows: string[][],
  existingOrders: PodOrder[],
  variantMappings: VariantMappingRule[],
  skuDesigns: SkuDesignItem[]
): {
  orders: PodOrder[];
  summary: SheetSyncSummary;
} {
  // 1. Detect column mapping by scanning sample data rows
  let orderIdCol = 1; // Default Col B (index 1)
  let sttCol = 0;     // Default Col A (index 0)

  // Find first row that looks like an order data row
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const nonEmptyCount = row.filter((c) => String(c ?? '').trim() !== '').length;
    if (nonEmptyCount < 3) continue;

    // Look for a 12-22 digit TikTok Order ID in Col A or Col B or Col C
    const idxOrderId = row.findIndex((cell) =>
      /^\d{12,22}$/.test(String(cell ?? '').trim())
    );
    if (idxOrderId >= 0) {
      orderIdCol = idxOrderId;
      sttCol = idxOrderId > 0 ? idxOrderId - 1 : -1;
      break;
    }
  }

  const offset = orderIdCol - 1; // 0 when Order ID is in Col B (standard A-M sheet)

  const colMap = {
    stt: sttCol,
    orderId: 1 + offset,
    orderDate: 2 + offset,
    fulfillDate: 3 + offset,
    productName: 4 + offset,
    mockupUrl: 5 + offset,
    variation: 6 + offset,
    quantity: 7 + offset,
    sku: 8 + offset,
    price: 9 + offset,
    labelUrl: 10 + offset,
    shopCode: 11 + offset,
    fulfilled: 12 + offset,
    variantId: 13 + offset,
    designFront: 14 + offset,
    designBack: 15 + offset,
    note: 16 + offset,
  };

  const detectedOrders: PodOrder[] = [];
  let newOrdersAdded = 0;
  let existingUpdated = 0;
  let autoMappedVariants = 0;
  let autoMappedDesigns = 0;

  // A TikTok order can have multiple line items. Prefer row+order ID, never dedupe by order ID alone.
  const existingByRow = new Map<string, PodOrder>();
  const existingByOrderId = new Map<string, PodOrder[]>();
  existingOrders.forEach((o) => {
    if (o.sheetRowNumber) existingByRow.set(`${o.sheetRowNumber}:${o.orderId.trim()}`, o);
    const key = o.orderId.trim();
    existingByOrderId.set(key, [...(existingByOrderId.get(key) || []), o]);
  });

  const nowStr = new Date().toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const sheetRowNumber = r + 1; // 1-based row number in Google Sheet

    const rawOrderId = String(row[colMap.orderId] ?? '').trim();
    if (!rawOrderId) continue;

    // Skip header rows
    const lowerOrderId = rawOrderId.toLowerCase();
    if (
      lowerOrderId === 'order id' ||
      lowerOrderId === 'orderid' ||
      lowerOrderId === 'mã đơn' ||
      lowerOrderId.includes('order_id')
    ) {
      continue;
    }

    const rawStt =
      colMap.stt >= 0 ? String(row[colMap.stt] ?? '').trim() : '';
    const parsedStt =
      /^\d+$/.test(rawStt) ? parseInt(rawStt, 10) : detectedOrders.length + 8;

    const orderDate = String(row[colMap.orderDate] ?? '').trim();
    const fulfillDate = String(row[colMap.fulfillDate] ?? '').trim();
    const productName =
      String(row[colMap.productName] ?? '').trim() || 'Unisex Graphic T-Shirt';
    const mockupUrl = String(row[colMap.mockupUrl] ?? '').trim();
    const variation = String(row[colMap.variation] ?? 'Black, L').trim();

    // Smart split Variation into Color & Size (e.g. "Military Green, L" -> Color: "Military Green", Size: "L")
    const varParts = variation.split(',').map((s) => s.trim());
    const color = varParts[0] || 'Black';
    const size = varParts[1] || 'L';

    const quantity =
      Math.max(1, parseInt(String(row[colMap.quantity] ?? '1').trim(), 10) || 1);
    const sku = String(row[colMap.sku] ?? '').trim();
    const price = parsePriceCell(row[colMap.price]);
    const labelUrl = String(row[colMap.labelUrl] ?? '').trim();
    const shopCode = String(row[colMap.shopCode] ?? '922').trim();

    const statusRaw = String(row[colMap.fulfilled] ?? '')
      .trim()
      .toUpperCase();
    const sheetFulfilled =
      statusRaw === 'TRUE' || statusRaw === '1' || statusRaw === 'YES';

    const sheetVariantId = String(row[colMap.variantId] ?? '').trim();
    const sheetDesignFront = String(row[colMap.designFront] ?? '').trim();
    const sheetDesignBack = String(row[colMap.designBack] ?? '').trim();
    const sheetNote = String(row[colMap.note] ?? '').trim();

    const candidates = existingByOrderId.get(rawOrderId) || [];
    const existing = existingByRow.get(`${sheetRowNumber}:${rawOrderId}`) ||
      candidates.find(o => o.sku === sku && o.variation === `${color}, ${size}`) ||
      (candidates.length === 1 ? candidates[0] : undefined);

    // Auto-detect GarmentType & PrintSides from Product Name and SKU
    const isSweatshirt =
      productName.toLowerCase().includes('sweatshirt') ||
      productName.toLowerCase().includes('crewneck') ||
      sku.startsWith('S-');
    const productType: GarmentType =
      existing?.productType || (isSweatshirt ? 'Sweatshirt' : 'T-Shirt');
    const printSides: PrintSides = sku.endsWith('_2M')
      ? '2M'
      : sku.endsWith('_1M')
      ? '1M'
      : existing?.printSides || '1M';

    // Lookup SKU design preset & Variant ID mapping
    const skuPreset = skuDesigns.find(
      (d) => d.sku.toLowerCase() === sku.toLowerCase()
    );
    const variantPreset = variantMappings.find(
      (m) =>
        m.productType === productType &&
        m.color.toLowerCase() === color.toLowerCase() &&
        m.size.toLowerCase() === size.toLowerCase()
    );

    // Never invent a supplier Variant ID: only trust explicit mapping / Sheet value.
    const generatedVariantId = variantPreset?.variantId || '';

    const finalVariantId =
      sheetVariantId || existing?.variantId || generatedVariantId;
    const finalDesignFront =
      sheetDesignFront || existing?.designFront || skuPreset?.designFront || '';
    const finalDesignBack =
      sheetDesignBack || existing?.designBack || skuPreset?.designBack || '';

    if (!existing?.variantId && finalVariantId) autoMappedVariants++;
    if (!existing?.designFront && finalDesignFront) autoMappedDesigns++;

    if (existing) {
      existingUpdated++;
      detectedOrders.push({
        ...existing,
        stt: parsedStt,
        sheetRowNumber,
        orderId: rawOrderId,
        orderDate: orderDate || existing.orderDate,
        fulfillDate: fulfillDate || existing.fulfillDate,
        productName: productName || existing.productName,
        mockupUrl: mockupUrl || existing.mockupUrl || skuPreset?.defaultMockup || '',
        variation: `${color}, ${size}`,
        color,
        size,
        quantity,
        sku,
        price: String(row[colMap.price] ?? '').trim() ? price : existing.price,
        labelUrl: labelUrl || existing.labelUrl,
        shopCode: shopCode || existing.shopCode,
        fulfilled: statusRaw !== '' ? sheetFulfilled : existing.fulfilled,
        variantId: finalVariantId,
        productType,
        printSides,
        designFront: finalDesignFront,
        designBack: finalDesignBack,
        baseCost:
          existing.baseCost ||
          variantPreset?.baseCost ||
          (productType === 'Sweatshirt' ? 13.5 : 6.45),
        note: sheetNote || existing.note,
        updatedAt: nowStr,
      });
    } else {
      newOrdersAdded++;
      detectedOrders.push({
        id: `ord-sheet-${rawOrderId}-row-${sheetRowNumber}`,
        stt: parsedStt,
        sheetRowNumber,
        orderId: rawOrderId,
        orderDate,
        fulfillDate,
        productName,
        mockupUrl: mockupUrl || skuPreset?.defaultMockup || '',
        variation: `${color}, ${size}`,
        color,
        size,
        quantity,
        sku,
        price,
        labelUrl,
        shopCode,
        fulfilled: sheetFulfilled,
        variantId: finalVariantId,
        productType,
        printSides,
        designFront: finalDesignFront,
        designBack: finalDesignBack,
        neckLabel: '',
        supplier: variantPreset?.supplier || 'Merchize',
        baseCost:
          variantPreset?.baseCost ||
          (productType === 'Sweatshirt' ? 13.5 : 6.45),
        note: sheetNote,
        updatedAt: nowStr,
      });
    }
  }

  return {
    orders: detectedOrders,
    summary: {
      totalDetected: detectedOrders.length,
      newOrdersAdded,
      existingUpdated,
      autoMappedVariants,
      autoMappedDesigns,
      syncedAt: nowStr,
      columnMapSummary:
        offset === 0
          ? 'Chuẩn cột A–M (A: STT, B: Order ID, E: Product, G: Variation, I: SKU, K: Label, M: Status)'
          : `Tự động dịch cột (Order ID tại Cột ${String.fromCharCode(65 + orderIdCol)})`,
    },
  };
}

/**
 * Push / Write Fulfillment Updates back to the connected Google Sheet
 * (Must only be called after explicit user confirmation dialog).
 */
export const FULFILLMENT_FIELDS = ['fulfilled','variantId','designFront','designBack','note'] as const;

/** Resolve rows by a compound line identity, not Order ID alone. Safely reject ambiguity. */
export async function pushFulfillmentToGoogleSheet(
  spreadsheetId: string, tabTitle: string, orders: PodOrder[], accessToken: string,
  baseline?: Record<string, string[]>
): Promise<{ updatedRows: number }> {
  if (!orders.length) return { updatedRows: 0 };
  const quotedTab = `'${tabTitle.replace(/'/g, "''")}'`;
  const rows = await fetchSheetValuesOAuth(spreadsheetId, tabTitle, accessToken);
  const payload: {range:string;values:(string|boolean)[][]}[] = [];
  const used = new Set<number>();
  for (const order of orders) {
    const matches = rows.map((row, i) => ({row, i})).filter(({row}) =>
      String(row[1]||'').trim() === order.orderId.trim() &&
      String(row[8]||'').trim() === order.sku.trim() &&
      String(row[6]||'').replace(/\s+/g,'').toLowerCase() === order.variation.replace(/\s+/g,'').toLowerCase()
    );
    let target = matches.length === 1 ? matches[0] : undefined;
    if (matches.length > 1 && order.sheetRowNumber) {
      target = matches.find(m => m.i + 1 === order.sheetRowNumber);
      // A repeated line item cannot be safely identified after rows are moved.
      if (!target) throw new Error(`Nhiều sản phẩm trùng hoàn toàn trong Order ${order.orderId}. Cần Line UID trước khi ghi.`);
    }
    if (!target) throw new Error(`Không xác minh được chính xác dòng ${order.orderId} / ${order.sku}. Tải lại Sheet rồi thử lại.`);
    const rowNumber = target.i + 1;
    if (used.has(rowNumber)) throw new Error(`Dòng ${rowNumber} đã được cập nhật trong lượt này.`);
    used.add(rowNumber);
    const current = [5,7,10,12,13,14,15,16].map(j=>String(target!.row[j]??'').trim());
    const original = baseline?.[order.id];
    if (original && current.some((v,j)=>v !== String(original[j]??'').trim())) {
      throw new Error(`Xung đột tại Order ${order.orderId}: Sheet đã thay đổi từ lần tải gần nhất. Hãy tải lại và kiểm tra trước khi lưu.`);
    }
    payload.push({ range: `${quotedTab}!F${rowNumber}`, values: [[order.mockupUrl || '']] });
    payload.push({ range: `${quotedTab}!H${rowNumber}`, values: [[String(order.quantity)]] });
    payload.push({ range: `${quotedTab}!K${rowNumber}`, values: [[order.labelUrl || '']] });
    payload.push({ range: `${quotedTab}!M${rowNumber}:Q${rowNumber}`, values: [[order.fulfilled, order.variantId || '', order.designFront || '', order.designBack || '', order.note || '']] });
  }
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, {
    method:'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type':'application/json' },
    body:JSON.stringify({valueInputOption:'USER_ENTERED',data:payload})
  });
  if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err?.error?.message || `Ghi Sheet thất bại: ${res.status}`); }
  return {updatedRows:orders.length};
}

/** Auxiliary sheets keep shared mappings, design URLs and Excel export history in the same spreadsheet. */
export async function ensureDataTabs(spreadsheetId:string, accessToken:string):Promise<void> {
  const meta = await fetchSpreadsheetMetadata(spreadsheetId, accessToken);
  const names = ['VariantMapping','DesignLibrary','ExportHistory'];
  const absent = names.filter(n=>!meta.tabs.some(t=>t.title===n));
  if (!absent.length) return;
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},
    body:JSON.stringify({requests:absent.map(title=>({addSheet:{properties:{title}}}))})
  });
  if(!response.ok) throw new Error('Không tạo được các tab quản lý trên Sheet.');
}
export async function readDataTab<T>(id:string, tab:string, token:string):Promise<T[]> {
  const rows = await fetchSheetValuesOAuth(id,tab,token);
  return rows.slice(1).flatMap(row=>{ try { return row[0] ? [JSON.parse(row[0]) as T] : []; } catch { return []; } });
}
export async function writeDataTab<T>(id:string, tab:string, records:T[],token:string):Promise<void> {
  const range = `'${tab}'!A1:A${Math.max(records.length+1,2)}`;
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,{
    method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify({range,majorDimension:'ROWS',values:[['JSON'],...records.map(r=>[JSON.stringify(r)])]})
  });
  if(!res.ok) throw new Error(`Không ghi được tab ${tab}: HTTP ${res.status}`);
  // Clear stale rows after deletions.
  const clearRange = `'${tab}'!A${records.length+2}:A10000`;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}/values/${encodeURIComponent(clearRange)}:clear`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'
  });
}

/**
 * Create a brand-new Google Sheet in the user's Google Drive populated with current orders
 * so they can test or start a clean 2-way connected Sheet immediately.
 */
export async function createConnectedGoogleSheet(
  orders: PodOrder[],
  accessToken: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; tabTitle: string }> {
  const createRes = await fetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: `Orders - TikFulfill POD (${new Date().toLocaleDateString('vi-VN')})`,
        },
        sheets: [
          {
            properties: {
              title: 'Orders',
              gridProperties: {
                rowCount: 200,
                columnCount: 20,
                frozenRowCount: 1,
              },
            },
          },
        ],
      }),
    }
  );

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(
      err?.error?.message || 'Không thể tạo Google Sheet mới.'
    );
  }

  const created = await createRes.json();
  const spreadsheetId: string = created.spreadsheetId;
  const spreadsheetUrl: string =
    created.spreadsheetUrl ||
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const tabTitle = 'Orders';

  // Write Header Row 1 + Orders starting at Row 2 (or exact sheet rows)
  const headerRow = [
    'STT',
    'Order ID',
    'Order Date',
    'Fulfill Date',
    'Product Name',
    'Mockup Link',
    'Variation',
    'Quantity',
    'SKU',
    'Price',
    'Label Link',
    'Shop Code',
    'Status',
    'Variant ID',
    'Design Front',
    'Design Back',
    'Fulfillment Note',
  ];

  const valueRows = orders.map((o) => [
    o.stt,
    o.orderId,
    o.orderDate,
    o.fulfillDate,
    o.productName,
    o.mockupUrl,
    o.variation,
    o.quantity,
    o.sku,
    o.price.toFixed(2).replace('.', ','),
    o.labelUrl,
    o.shopCode,
    o.fulfilled ? 'TRUE' : 'FALSE',
    o.variantId,
    o.designFront,
    o.designBack,
    o.note,
  ]);

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent('Orders!A1:Q' + (valueRows.length + 1))}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [headerRow, ...valueRows],
      }),
    }
  );

  return { spreadsheetId, spreadsheetUrl, tabTitle };
}
