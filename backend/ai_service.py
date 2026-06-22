import json
import re
import os
import fitz  # PyMuPDF
from PIL import Image
import io
from rapidocr_onnxruntime import RapidOCR

ocr = RapidOCR()

def extract_text_from_image_raw(img: Image.Image):
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    result, _ = ocr(img_bytes)
    return result

def get_flat_text(ocr_result) -> str:
    if not ocr_result:
        return ""
    return "\n".join([line[1] for line in ocr_result])

def get_reconstructed_lines(ocr_result, y_overlap_threshold=0.4, x_overlap_threshold=0.3) -> list:
    if not ocr_result:
        return []
    # 1. Compute bounding box specs
    processed = []
    for b in ocr_result:
        box = b[0]
        text = b[1]
        y_min = min(p[1] for p in box)
        y_max = max(p[1] for p in box)
        x_min = min(p[0] for p in box)
        x_max = max(p[0] for p in box)
        center_y = (y_min + y_max) / 2.0
        height = y_max - y_min
        processed.append({
            'text': text,
            'y_min': y_min,
            'y_max': y_max,
            'x_min': x_min,
            'x_max': x_max,
            'center_y': center_y,
            'height': height
        })

    # 2. Sort primarily by center_y
    processed.sort(key=lambda item: item['center_y'])

    # 3. Group into rows based on vertical overlap
    rows = []
    for item in processed:
        matched_row_idx = -1
        for idx, row in enumerate(rows):
            row_ymin = min(r['y_min'] for r in row)
            row_ymax = max(r['y_max'] for r in row)
            row_height = row_ymax - row_ymin
            
            overlap = min(item['y_max'], row_ymax) - max(item['y_min'], row_ymin)
            if overlap > 0:
                min_h = min(item['height'], row_height)
                if min_h > 0 and (overlap / min_h) > y_overlap_threshold:
                    matched_row_idx = idx
                    break
        
        if matched_row_idx != -1:
            rows[matched_row_idx].append(item)
        else:
            rows.append([item])

    # 4. For each row, merge blocks that overlap horizontally (cell wrapping)
    refined_rows = []
    for row in rows:
        merged_row = []
        used = set()
        for i, b1 in enumerate(row):
            if i in used:
                continue
            component = [b1]
            used.add(i)
            expanded = True
            while expanded:
                expanded = False
                for j, b2 in enumerate(row):
                    if j in used:
                        continue
                    overlaps = False
                    for cb in component:
                        overlap_x = min(cb['x_max'], b2['x_max']) - max(cb['x_min'], b2['x_min'])
                        w1 = cb['x_max'] - cb['x_min']
                        w2 = b2['x_max'] - b2['x_min']
                        min_w = min(w1, w2)
                        if min_w > 0 and (overlap_x / min_w) > x_overlap_threshold:
                            overlaps = True
                            break
                    if overlaps:
                        component.append(b2)
                        used.add(j)
                        expanded = True
            
            if len(component) == 1:
                merged_row.append(component[0])
            else:
                component.sort(key=lambda x: x['y_min'])
                merged_text = ""
                for idx, cb in enumerate(component):
                    text = cb['text']
                    if idx > 0:
                        merged_text += text
                    else:
                        merged_text = text
                
                m_ymin = min(x['y_min'] for x in component)
                m_ymax = max(x['y_max'] for x in component)
                m_xmin = min(x['x_min'] for x in component)
                m_xmax = max(x['x_max'] for x in component)
                merged_row.append({
                    'text': merged_text,
                    'y_min': m_ymin,
                    'y_max': m_ymax,
                    'x_min': m_xmin,
                    'x_max': m_xmax,
                    'center_y': (m_ymin + m_ymax) / 2.0,
                    'height': m_ymax - m_ymin
                })
        refined_rows.append(merged_row)

    # 5. Sort rows by their average center_y
    rows_with_y = []
    for r in refined_rows:
        avg_cy = sum(item['center_y'] for item in r) / len(r)
        rows_with_y.append((avg_cy, r))
    rows_with_y.sort(key=lambda x: x[0])

    # 6. Sort items within each row from left to right, and join with double spaces
    reconstructed_lines = []
    for avg_cy, r in rows_with_y:
        r.sort(key=lambda item: item['x_min'])
        line_text = "  ".join(item['text'] for item in r)
        reconstructed_lines.append(line_text)

    return reconstructed_lines

def extract_text_from_image(img: Image.Image) -> str:
    result = extract_text_from_image_raw(img)
    return get_flat_text(result)

def extract_text_from_pdf_raw(pdf_path: str):
    all_pages_results = []
    with fitz.open(pdf_path) as doc:
        total_pages = len(doc)
        pages_to_extract = list(range(min(3, total_pages)))
        if total_pages > 3:
            pages_to_extract.append(total_pages - 1)
        for page_num in pages_to_extract:
            page = doc.load_page(page_num)
            pix = page.get_pixmap(alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            result = extract_text_from_image_raw(img)
            if result:
                all_pages_results.append(result)
    return all_pages_results


def extract_text_from_pdf(pdf_path: str) -> str:
    results = extract_text_from_pdf_raw(pdf_path)
    return "\n".join([get_flat_text(res) for res in results])

def detect_seals_by_color(file_path: str, mime_type: str = "") -> str:
    """
    Detects seals in the document using a red pixel density heuristic.
    Works for both images and PDFs.
    Returns: "双方盖章", "单方盖章", "未盖章", or "无法确认"
    """
    try:
        img = None
        is_pdf = file_path.lower().endswith('.pdf') or (mime_type and "pdf" in mime_type.lower())
        # Determine if it's a PDF or an image
        if is_pdf:
            with fitz.open(file_path) as doc:
                if len(doc) > 0:
                    # Load the last page for seal detection (stamps are usually on the last page)
                    last_page = doc.load_page(len(doc) - 1)
                    pix = last_page.get_pixmap(alpha=False)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        else:
            img = Image.open(file_path)


        if img is None:
            return "无法确认"

        # Convert to RGB if needed
        if img.mode != 'RGB':
            img = img.convert('RGB')

        width, height = img.size
        
        # Sig/seal block is typically in the bottom 35% of the page
        bottom_start_y = int(height * 0.65)
        
        # We sample pixels to count red pixels
        # Red stamp color: R > 120 and R - G > 45 and R - B > 45
        red_pixels = []
        step = 4  # sample every 4th pixel for speed
        for y in range(bottom_start_y, height, step):
            for x in range(0, width, step):
                r, g, b = img.getpixel((x, y))[:3]
                if r > 120 and r - g > 45 and r - b > 45:
                    red_pixels.append((x, y))
                    
        # Close the image immediately after sampling pixels to release lock
        if img and not is_pdf:
            img.close()

                    
        # Heuristic rules:
        # If there are very few red pixels, it's unstamped.
        # 30 sampled pixels at step=4 is 30 * 16 = 480 raw pixels. Very safe threshold.
        if len(red_pixels) < 30:
            return "未盖章"
            
        # Group red pixels horizontally to find clusters (left stamp vs right stamp)
        xs = [p[0] for p in red_pixels]
        x_min, x_max = min(xs), max(xs)
        x_range = x_max - x_min
        
        # If the range is very narrow, it's a single stamp.
        # 20% of page width is typically larger than one stamp but smaller than two.
        if x_range < width * 0.20:
            return "单方盖章"
            
        # If the range is wide, let's see if we have pixels on both sides of the midpoint.
        mid_x = (x_min + x_max) / 2.0
        # Check if there are distinct clusters on left and right
        left_count = sum(1 for x in xs if x < mid_x - width * 0.05)
        right_count = sum(1 for x in xs if x > mid_x + width * 0.05)
        
        if left_count > 20 and right_count > 20:
            return "双方盖章"
        elif left_count > 20 or right_count > 20:
            return "单方盖章"
        else:
            return "未盖章"
    except Exception as e:
        print(f"Error in detect_seals_by_color: {e}")
        return "无法确认"

def classify_document(full_text: str, filename: str) -> str:
    lower_filename = filename.lower()
    
    # Priority 1: Filename-based classification (strong heuristic)
    if "发票" in lower_filename:
        return "发票"
    if any(kw in lower_filename for kw in ["发货单", "收货单", "送货单", "出库单", "入库单", "签收单"]):
        return "收发货单"
    if any(kw in lower_filename for kw in ["凭证", "回单", "回款", "进账", "汇款", "转账", "水单", "收条"]):
        return "回款凭证"
    if "合同" in lower_filename or "协议" in lower_filename:
        return "合同"

    # Priority 2: Weighted feature scoring on OCR text
    contract_score = 0
    invoice_score = 0
    delivery_score = 0
    receipt_score = 0
    
    # --- CONTRACT KEYWORDS ---
    # High weight (+10)
    for kw in ["本合同", "甲乙双方", "双方盖章", "违约责任", "争议解决", "出卖方", "买受方", "本协议", "合同专用章"]:
        if kw in full_text:
            contract_score += 10
    # Medium weight (+5)
    contract_match = re.search(r'合同(?!号|编号|名称|金额|期|协议|款)', full_text)
    if contract_match:
        contract_score += 5
    if "协议" in full_text and "协议号" not in full_text and "协议编号" not in full_text:
        contract_score += 5
    # Low weight (+3)
    for kw in ["乙方", "甲方", "第一条", "第二条", "第三条", "印章", "盖章", "签字", "签字盖章", "产品买卖", "销售合同", "采购合同", "意向书"]:
        if kw in full_text:
            contract_score += 3

    # --- INVOICE KEYWORDS ---
    # High weight (+10)
    for kw in ["发票号码", "发票代码", "密码区", "开票人", "税率/征收率", "电子发票", "普通发票", "专用发票", "代开"]:
        if kw in full_text:
            invoice_score += 10
    # Medium weight (+5)
    for kw in ["纳税人识别号", "统一社会信用代码", "开票日期", "价税合计"]:
        if kw in full_text:
            invoice_score += 5
    # Low weight (+3)
    for kw in ["销售方", "购买方", "发票", "增值税"]:
        if kw in full_text:
            invoice_score += 3

    # --- DELIVERY NOTE KEYWORDS ---
    # High weight (+10)
    for kw in ["送货单", "发货单", "收货单", "出库单", "入库单", "签收单", "送货单位", "收货单位"]:
        if kw in full_text:
            delivery_score += 10
    # Medium weight (+5)
    for kw in ["送货", "发货", "收货", "出库", "入库", "签收"]:
        if kw in full_text:
            delivery_score += 5
    # Low weight (+3)
    for kw in ["单号", "货号"]:
        if kw in full_text:
            delivery_score += 3

    # --- RECEIPT KEYWORDS ---
    # High weight (+10)
    for kw in ["回单", "凭证", "付款凭证", "收款凭证", "交易日志", "电子回单", "转账凭证", "回单编号", "流水号", "回款凭证"]:
        if kw in full_text:
            receipt_score += 10
    # Medium weight (+5)
    for kw in ["回款", "进账", "汇款", "转账", "水单", "支付", "收款"]:
        if kw in full_text:
            receipt_score += 5
    # Low weight (+3)
    for kw in ["付款人", "收款人", "付款账号", "收款账号"]:
        if kw in full_text:
            receipt_score += 3

    scores = {
        "合同": contract_score,
        "发票": invoice_score,
        "收发货单": delivery_score,
        "回款凭证": receipt_score
    }
    
    max_type = max(scores, key=scores.get)
    if scores[max_type] < 3:
        return "未知"
    return max_type

def parse_products_from_lines(reconstructed_lines) -> list:
    UNITS = {'个', '件', '台', '套', '把', '只', '吨', '支', '双', '千克', '米', 'm', 'kg', '卷', '包', '箱', '张', '本', '瓶', '盒', '个', 'kg', 't'}
    products = []
    for line in reconstructed_lines:
        if '|' in line or '│' in line:
            parts = [p.strip() for p in re.split(r'[|│]', line) if p.strip()]
        else:
            parts = [p.strip() for p in re.split(r'\s{2,}', line) if p.strip()]
            
        if len(parts) >= 3:
            u_idx = -1
            for idx, part in enumerate(parts):
                if part in UNITS:
                    u_idx = idx
                    break
                    
            if u_idx != -1:
                unit = parts[u_idx]
                qty = ""
                if len(parts) > u_idx + 1:
                    qty = parts[u_idx + 1]
                    qty_clean = re.sub(r'[^\d\.]', '', qty)
                    if not re.match(r'^\d+(\.\d+)?$', qty_clean):
                        qty = ""
                
                price = ""
                if qty and len(parts) > u_idx + 2:
                    potential_price = parts[u_idx + 2]
                    price_clean = re.sub(r'[^\d\.]', '', potential_price)
                    if re.match(r'^\d+(\.\d+)?$', price_clean):
                        price = potential_price
                
                has_serial = re.match(r'^\d+$', parts[0]) is not None
                if has_serial:
                    if u_idx == 2:
                        name = parts[1]
                        spec = "无"
                    elif u_idx > 2:
                        name = parts[u_idx - 2]
                        spec = parts[u_idx - 1]
                    else:
                        continue
                else:
                    if u_idx == 1:
                        name = parts[0]
                        spec = "无"
                    elif u_idx >= 2:
                        name = parts[u_idx - 2]
                        spec = parts[u_idx - 1]
                    else:
                        continue
                
                if qty:
                    if price:
                        total = ""
                        try:
                            q_val = float(re.sub(r'[^\d\.]', '', qty))
                            p_val = float(re.sub(r'[^\d\.]', '', price))
                            expected_total = q_val * p_val
                            min_diff = float('inf')
                            best_total = ""
                            for p_val_str in parts[u_idx + 3:]:
                                clean_str = re.sub(r'[^\d\.]', '', p_val_str)
                                if clean_str:
                                    try:
                                        val = float(clean_str)
                                        if abs(val - expected_total) < min_diff:
                                            min_diff = abs(val - expected_total)
                                            best_total = p_val_str
                                    except:
                                        pass
                            if min_diff < 5:
                                total = best_total
                            else:
                                total = f"{expected_total:.2f}"
                        except:
                            total = parts[u_idx + 3] if len(parts) > u_idx + 3 else ""
                        
                        products.append(f"{name}(规格:{spec}, {qty}{unit}*{price}={total})")
                    else:
                        products.append(f"{name}(规格:{spec}, {qty}{unit})")
                else:
                    products.append(f"{name}(规格:{spec})")
    return products

def clean_extracted_value(val: str) -> str:
    if not val:
        return ""
    # Strip common garbage prefix/suffix
    val = re.sub(r'^[：:\s\[\({（【]+', '', val)
    val = re.sub(r'[\]\)\}）】\s]+$', '', val)
    return val.strip()

def extract_date(text: str) -> str:
    # If it is a passenger transport ticket/invoice, prioritize the travel date
    is_passenger = any(kw in text for kw in ["旅客运输服务", "客运", "交通运输服务", "出行日期", "出发地", "到达地", "乘车", "铁路", "火车票", "客票"])
    if is_passenger:
        # A. Try to match dates preceded by "出行日期" or "发车时间" or "乘车日期"
        match = re.search(r'(出行日期|发车时间|乘车日期|乘车时间)[：:\s]*([\d\.\-\/年\月\日]+)', text)
        if match:
            val = clean_extracted_value(match.group(2))
            if re.search(r'\d', val):
                return val
                
        # B. Otherwise, find dates that are not preceded by "开票日期" or "打印时间"
        date_patterns = [
            r'(\d{4}年\d{1,2}月\d{1,2}日)',
            r'(\d{4}[\-\.\/]\d{1,2}[\-\.\/]\d{1,2})'
        ]
        for pattern in date_patterns:
            for m in re.finditer(pattern, text):
                start = m.start()
                prefix_context = text[max(0, start-15):start]
                if not any(kw in prefix_context for kw in ["开票", "打印", "开具"]):
                    return clean_extracted_value(m.group(1))

    # 1. Look for date with prefix keyword
    match = re.search(r'(开票日期|签订时间|签订日期|交易日期|交易时间|打印时间|送货日期|发货日期|收货日期|日期|时间|签收日期|交易发生时间)[：:\s]*([\d\.\-\/年\月\日]+)', text)
    if match:
        val = clean_extracted_value(match.group(2))
        if re.search(r'\d', val):
            return val
    # 2. Look for YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, YYYY年MM月DD日
    match = re.search(r'(\d{4}[\.\-\/年]\d{1,2}[\.\-\/月]\d{1,2}日?)', text)
    if match:
        return clean_extracted_value(match.group(1))
    # 3. Look for 8 consecutive digits (like 20260602)
    match = re.search(r'(\d{8})', text)
    if match:
        return clean_extracted_value(match.group(1))
    return ""

def extract_amount(text: str) -> str:
    normalized = re.sub(r'\s+', '', text)
    # Strip dates to prevent date numbers (like YYYY.MM in YYYY.MM.DD) from being parsed as amount decimals
    normalized_no_dates = re.sub(r'\d{4}[\.\-\/年]\d{1,2}[\dots/月]\d{1,2}日?', '', normalized)
    
    # For invoices and receipts, prioritize the maximum currency-symbol-preceded amount
    is_invoice_like = any(kw in text for kw in ["发票", "客运", "运输", "收据", "账单", "票价", "航空", "机票"])
    if is_invoice_like:
        currency_amounts = []
        # Support ¥, ￥, CNY, CY
        for m in re.finditer(r'(?:¥|￥|CNY|CY)[^\d\.]*(\d+(?:\.\d{1,2})?)', normalized_no_dates, re.IGNORECASE):
            val = m.group(1)
            if len(val) < 10:
                try:
                    currency_amounts.append(float(val))
                except:
                    pass
        if currency_amounts:
            max_val = max(currency_amounts)
            if max_val.is_integer():
                return str(int(max_val))
            return f"{max_val:.2f}"
            
        
    # 2. Priority 2: Consolidated total keywords (invoice, contract, receipt)
    for m in re.finditer(r'(价税合计金额|价税合计|合同总价|合同金额|合计金额|实收金额|实付金额|交易金额|转入金额|转出金额|付款金额|收款金额|转账金额|汇款金额|合计|总计|总金额|小写|小\)|小）)[^\d\.]*(\d+(?:\.\d{1,2})?)', normalized_no_dates):
        val = m.group(2)
        if len(val) < 10:
            return val
        
    # 4. Priority 4: Weak keywords requiring a colon/symbol
    for m in re.finditer(r'(金额|人民币|转入|转出|元|¥|￥)[：:\=\-]*(\d+(?:\.\d{1,2})?)', normalized_no_dates):
        val = m.group(2)
        if len(val) < 10:
            return val
            
    return ""
        
    # 5. Priority 5: Fallback to any decimal number
    matches = re.findall(r'\d+\.\d{2}', normalized_no_dates)
    if matches:
        return matches[0]
    return ""

def extract_buyer(text: str) -> str:
    # If it is a railway ticket, the company preceding 统一社会信用代码 is the buyer
    if "铁路" in text and ("客票" in text or "电子发票" in text):
        match = re.search(r'([^\s\n\r]+)\s+(?:统一社会信用代码|纳税人识别号)', text)
        if match:
            return clean_extracted_value(match.group(1))

    # 1. Specific invoice layout: find "名称" after "购买方" or "买方"
    buyer_start = -1
    for kw in ["购买方", "买方", "购货单位"]:
        idx = text.find(kw)
        if idx != -1:
            buyer_start = idx
            break
    if buyer_start != -1:
        name_idx = text.find("名称", buyer_start)
        if name_idx != -1 and name_idx - buyer_start < 100:
            line_end = text.find("\n", name_idx)
            line = text[name_idx:line_end] if line_end != -1 else text[name_idx:]
            match = re.search(r'名称[：:\s]*([^\s\n\r\t]+)', line)
            if match:
                return clean_extracted_value(match.group(1))

    # 2. Fallback to original regex
    match = re.search(r'(收货单位|购货单位|买受方|购买方|付款人名称|付款人|汇款人|付款账户名称|转出账户|付款账号名称|买方|需方|收货方|客户名称|客户|收货人|收货人姓名)[：:\s]*([^\n\r\[\]]+)', text)
    if match:
        return clean_extracted_value(match.group(2))
    match = re.search(r'(乙方|承租方|承包方)[：:\s]*([^\n\r\[\]]+)', text)
    if match:
        return clean_extracted_value(match.group(2))
    return ""

def extract_seller(text: str) -> str:
    # 1. Specific invoice layout: find "名称" after "销售方" or "销货单位"
    seller_start = -1
    for kw in ["销售方", "销货方", "销售", "商户", "服务商"]:
        idx = text.find(kw)
        if idx != -1:
            seller_start = idx
            break
    if seller_start != -1:
        name_idx = text.find("名称", seller_start)
        if name_idx != -1 and name_idx - seller_start < 100:
            line_end = text.find("\n", name_idx)
            line = text[name_idx:line_end] if line_end != -1 else text[name_idx:]
            match = re.search(r'名称[：:\s]*([^\s\n\r\t]+)', line)
            if match:
                return clean_extracted_value(match.group(1))

    # 2. Fallback to original regex
    match = re.search(r'(销售方|出卖方|商户|发货单位|发货方|发货人|销货单位|服务商|送货单位|送货人|供货单位|供货方|生产商|发货商|收款人名称|收款人|收款账户名称|转入账户|收款账号名称|受益人|第一署名)[：:\s]*([^\n\r\[\]]+)', text)
    if match:
        return clean_extracted_value(match.group(2))
    match = re.search(r'(甲方|出租方|发包方)[：:\s]*([^\n\r\[\]]+)', text)
    if match:
        return clean_extracted_value(match.group(2))
    return ""

def extract_number(text: str) -> str:
    # 1. Standard search with keywords (including common OCR misrecognitions like '发系号码', '发系号')
    match = re.search(r'(合同编号|发票号码|发票代码|发系号码|发系号|订单号|送货单号|送货单|发货单号|出库单号|流水号|交易号|回单编号|凭证号|交易流水号|业务编号|编号|合同号|协议号|发票号|单号|No|№)[：:\s]*([A-Za-z0-9\-]+)', text)
    if match:
        val = clean_extracted_value(match.group(2))
        if val:
            return val
            
    # 2. Fallback: if we find typical ticket keywords and there is a 20-digit number
    if any(kw in text for kw in ["行程单", "电子发票", "客票", "自：", "至：", "自:", "至:"]):
        match_20 = re.search(r'\b(\d{20})\b', text)
        if match_20:
            return match_20.group(1)
            
    # 3. Fallback: search for any 20-digit number
    match_20 = re.search(r'\b(\d{20})\b', text)
    if match_20:
        return match_20.group(1)
        
    return ""

def get_ollama_models() -> dict:
    """
    Returns available local Ollama models classified by capability.
    Returns: {"vision": "model_name_or_None", "text": "model_name_or_None"}
    """
    res_dict = {"vision": None, "text": None}
    try:
        import requests
        res = requests.get("http://127.0.0.1:11434/api/tags", timeout=1.0)
        if res.status_code == 200:
            models = [m["name"] for m in res.json().get("models", [])]
            for m in models:
                m_lower = m.lower()
                if any(v in m_lower for v in ["qwen2-vl", "minicpm", "llava", "vision", "internvl"]):
                    res_dict["vision"] = m
                    break
            for m in models:
                m_lower = m.lower()
                if res_dict["vision"] == m:
                    continue
                if any(t in m_lower for t in ["qwen", "llama", "deepseek", "mistral", "gemma", "phi", "internlm"]):
                    res_dict["text"] = m
                    break
            if not res_dict["vision"] and not res_dict["text"] and models:
                res_dict["text"] = models[0]
    except:
        pass
    return res_dict

def get_ollama_vision_model() -> str:
    return get_ollama_models().get("vision")

def extract_invoice_content_helper(full_text: str, products_list: list) -> str:
    # 1. Broad detection of travel/itinerary-related invoices
    travel_kws = ["旅客运输服务", "客运", "交通运输服务", "出行日期", "出发地", "到达地", "乘车", "铁路", "火车", "客票", "机票", "行程", "航空", "旅游", "差旅", "乘机", "航段", "站", "自", "至", "到", "客运服务", "运输费", "差旅费"]
    is_travel = any(kw in full_text for kw in travel_kws)
    
    if is_travel:
        # A. Helper to clean station names
        def clean_station_name(name):
            name = re.sub(r'（[^）]*）|\([^)]*\)', '', name)
            name = re.sub(r'\(.*?\)|（.*?）', '', name)
            name = re.sub(r'门口$', '', name)
            return name.strip()

        # B. Helper to validate location/place name
        def is_valid_place_name(name):
            name = name.strip()
            if not name or len(name) < 2 or len(name) > 10:
                return False
            # Filter out non-location words or dates
            black_list = ["年", "月", "日", "期", "时", "分", "秒", "公司", "合同", "甲方", "乙方", "发票", "金额", "合计", 
                          "单价", "数量", "签字", "盖章", "代表", "银行", "账号", "地址", "姓名", "身份证", "代码", 
                          "限乘", "票价", "税额", "税号", "购买", "销售", "项目", "服务", "费用", "价格", "规定", 
                          "标准", "要求", "电话", "条款", "生效", "失效", "备注", "清单", "明细", "产品", "商品", 
                          "劳务", "技术", "开发", "管理", "设计", "施工", "咨询", "代理", "分包", "租赁", "协议", 
                          "代收", "手续费", "服务费", "客运服务", "运输服务", "交通运输", "信息", "内容", "文件",
                          "凭证", "双方", "买方", "卖方", "旅客", "说明", "注意", "事项", "规定", "标准"]
            if any(kw in name for kw in black_list):
                return False
            # Prevent pure numbers
            if name.isdigit():
                return False
            return True

        # Pattern 1: Check for aviation route patterns: lines starting with 自 or 至/到
        dep_list = []
        arr_list = []
        for line in full_text.split('\n'):
            line = line.strip()
            m_dep = re.match(r'^自[：:\s]*(.*)', line)
            if m_dep:
                val = clean_station_name(m_dep.group(1).strip())
                if is_valid_place_name(val):
                    dep_list.append(re.sub(r'\s+', '', val))
            m_arr = re.match(r'^[至到][：:\s]*(.*)', line)
            if m_arr:
                val = clean_station_name(m_arr.group(1).strip())
                if is_valid_place_name(val):
                    arr_list.append(re.sub(r'\s+', '', val))
                    
        if dep_list and arr_list:
            return f"{dep_list[0]}_{arr_list[0]}"

        # Pattern 2: Check for "出发地...目的地" label patterns
        m_dep_label = re.search(r'(?:出发地|起点|出差地|乘车地|始发地)[：:\s]*([\u4e00-\u9fa5]{2,8})', full_text)
        m_arr_label = re.search(r'(?:目的地|终点|到达地|落脚地)[：:\s]*([\u4e00-\u9fa5]{2,8})', full_text)
        if m_dep_label and m_arr_label:
            dep_val = clean_station_name(m_dep_label.group(1))
            arr_val = clean_station_name(m_arr_label.group(1))
            if is_valid_place_name(dep_val) and is_valid_place_name(arr_val):
                return f"{dep_val}_{arr_val}"

        # Pattern 3: Check for inline route pattern: 自[地点]至/到[地点]
        inline_route = re.search(r'(?:自|起点|出发地|始发地)[：:\s]*([\u4e00-\u9fa5]{2,8})\s*(?:至|到|终点|目的地)[：:\s]*([\u4e00-\u9fa5]{2,8})', full_text)
        if inline_route:
            dep_val = clean_station_name(inline_route.group(1))
            arr_val = clean_station_name(inline_route.group(2))
            if is_valid_place_name(dep_val) and is_valid_place_name(arr_val):
                return f"{dep_val}_{arr_val}"

        # Pattern 4: Check for remarks bus ticket pattern: CityA(StationA)-CityB(StationB)
        trip_match = re.search(
            r'([\u4e00-\u9fa5]{2,10})\(([\u4e00-\u9fa5A-Za-z0-9（）\(\)]+?)\)\-([\u4e00-\u9fa5]{2,10})\(([\u4e00-\u9fa5A-Za-z0-9（）\(\)]+?)\)',
            full_text
        )
        if trip_match:
            dep = clean_station_name(trip_match.group(2)) or trip_match.group(1)
            arr = clean_station_name(trip_match.group(4)) or trip_match.group(3)
            if is_valid_place_name(dep) and is_valid_place_name(arr):
                return f"{dep}_{arr}"

        # Pattern 5: Check for railway ticket stations (two station names)
        stations = []
        matches = re.findall(r'([\u4e00-\u9fa5]{2,8}站)', full_text)
        for m in matches:
            if m not in ["网站", "终点站", "始发站", "火车站", "客运站", "汽车站", "地铁站"]:
                clean_name = m[:-1] if m.endswith("站") else m
                if is_valid_place_name(clean_name) and clean_name not in stations:
                    stations.append(clean_name)
        if len(stations) >= 2:
            return f"{stations[0]}_{stations[1]}"

        # Pattern 6: Check for hyphenated route: [城市/站名]-[城市/站名]
        routes = []
        for m in re.finditer(r'([\u4e00-\u9fa5]{2,10})\-([\u4e00-\u9fa5]{2,15})', full_text):
            city = m.group(1)
            station = m.group(2)
            clean_c = clean_station_name(city)
            clean_s = clean_station_name(station)
            if is_valid_place_name(clean_c) and clean_c not in routes:
                routes.append(clean_c)
            if is_valid_place_name(clean_s) and clean_s not in routes:
                routes.append(clean_s)
        if len(routes) >= 2:
            return f"{routes[0]}_{routes[1]}"

        # Pattern 7: Check for fallback hyphenated cities: [城市名]-[城市名] or [城市名]至/到[城市名]
        city_trip = re.search(r'([\u4e00-\u9fa5]{2,8})[-_至到]([\u4e00-\u9fa5]{2,8})', full_text)
        if city_trip:
            dep_city = clean_station_name(city_trip.group(1))
            arr_city = clean_station_name(city_trip.group(2))
            if is_valid_place_name(dep_city) and is_valid_place_name(arr_city):
                return f"{dep_city}_{arr_city}"

    names = []
    # 1. Try to extract names from parsed products list
    if products_list:
        for p in products_list:
            # Extract name before any parenthesis
            match = re.match(r'^([^(]+)', p)
            if match:
                name = match.group(1).strip()
                if name:
                    names.append(name)
    
    # 2. If no names from products list, find *category*item or category*item in the full text
    if not names:
        # Match *category*item or category*item (e.g. *煤炭*块煤 or 煤炭*块煤 or 生产生活服务*住宿服务间)
        matches = re.findall(r'(\*?[^* \n\r\t]+\*[^* \n\r\t]+)', full_text)
        for m in matches:
            m_clean = m.strip().strip('*')
            if m_clean and m_clean not in names:
                names.append(m_clean)
                
    # 3. Clean up list (limit to top 3 names to avoid filename being too long)
    names = [n for n in names if n]
    
    # Strip common trailing units merged by OCR (e.g. "住宿服务间" -> "住宿服务")
    UNITS = {'个', '件', '台', '套', '把', '只', '吨', '支', '双', '千克', '米', 'm', 'kg', '卷', '包', '箱', '张', '本', '瓶', '盒', '个', 'kg', 't', '间', '次', '月', '天'}
    if names:
        for idx, n in enumerate(names):
            if len(n) > 3:
                for u in UNITS:
                    if n.endswith(u):
                        names[idx] = n[:-len(u)].strip()
                        break
                        
    names = [n for n in names if n]
    if names:
        joined = "+".join(names[:3])
        # Clean up invalid characters just in case
        joined = re.sub(r'[\\/*?:"<>|]', "", joined).strip()
        return joined
        
    return "商品"

def analyze_document(file_path: str, mime_type: str, on_progress=None) -> dict:
    """
    Analyzes a document locally using RapidOCR and Regex.
    Extracts structured fields matching the ledger columns.
    """
    try:
        if on_progress:
            on_progress("正在提取文件文本 (OCR)...")
        full_text = ""
        reconstructed_lines = []
        if "pdf" in mime_type.lower():
            ocr_results_by_page = extract_text_from_pdf_raw(file_path)
            for page_result in ocr_results_by_page:
                full_text += get_flat_text(page_result) + "\n"
                reconstructed_lines.extend(get_reconstructed_lines(page_result))
        else:
            with Image.open(file_path) as img:
                page_result = extract_text_from_image_raw(img)
                full_text = get_flat_text(page_result)
                reconstructed_lines = get_reconstructed_lines(page_result)

            
        if on_progress:
            on_progress("正在分析类型及提取字段...")
        lower_filename = os.path.basename(file_path).lower()
        doc_type = classify_document(full_text, lower_filename)
        
        # Initialize default fields
        extracted_data = {
            "合同/发票编号": "",
            "出卖方/销售方": "",
            "买受方/购买方": "",
            "签订/开票日期": "",
            "价税合计金额": "",
            "产品明细": "",
            "发票内容": "",
            "盖章状态": "无法确认",
            "备注": ""
        }
        
        # Populate values
        extracted_data["合同/发票编号"] = extract_number(full_text)
        extracted_data["出卖方/销售方"] = extract_seller(full_text)
        extracted_data["买受方/购买方"] = extract_buyer(full_text)
        extracted_data["签订/开票日期"] = extract_date(full_text)
        extracted_data["价税合计金额"] = extract_amount(full_text)
        
        # Parse products for specific document types
        products = []
        if doc_type in ["合同", "发票", "收发货单"]:
            products = parse_products_from_lines(reconstructed_lines)
            if products:
                extracted_data["产品明细"] = "; ".join(products)
                
        if doc_type == "发票":
            extracted_data["发票内容"] = extract_invoice_content_helper(full_text, products)
                
        # Initialize receipt status for delivery notes
        if doc_type == "收发货单":
            extracted_data["收货状态"] = "未收货"
            # Simple signature detection: check if there is non-whitespace text after "收货人" or "签收"
            match = re.search(r'(?:收货人|签收人|签收|签字)[：:\s]*([^\s\n\r[\]]{2,10})', full_text)
            if match:
                val = match.group(1).strip()
                # Exclude labels, titles or noise terms
                if val and not any(kw in val for kw in ["送货人", "商品", "发货", "日期", "地点", "单位", "姓名"]):
                    extracted_data["收货状态"] = "已收货"

                
        # Handle specific logic for contracts
        if doc_type == "合同":
            tax_notes = re.search(r'(含\s*\d+%\s*税[^\n]*)', full_text)
            if tax_notes:
                extracted_data["备注"] = tax_notes.group(1).strip()
            
            if on_progress:
                on_progress("正在进行合同印章检测...")
            seal_status = detect_seals_by_color(file_path, mime_type)
            if seal_status == "无法确认":
                stamp_texts = ["合同专用章", "公章", "财务专用章", "印章"]
                has_stamp_text = any(st in full_text for st in stamp_texts)
                if has_stamp_text:
                    actual_stamps = sum(full_text.count(st) for st in ["合同专用章", "公章", "财务专用章"])
                    if actual_stamps >= 2:
                        seal_status = "双方盖章"
                    else:
                        seal_status = "单方盖章"
                elif "盖章" in lower_filename:
                    seal_status = "单方盖章"
                else:
                    seal_status = "未盖章"
            if seal_status == "双方盖章":
                seal_status = "双方盖章, 合同已生效"
            extracted_data["盖章状态"] = seal_status
            
        # Try local Ollama model enhancement
        ollama_models = get_ollama_models()
        active_model = None
        mode = None
        
        if ollama_models["vision"]:
            active_model = ollama_models["vision"]
            mode = "vision"
        elif ollama_models["text"]:
            active_model = ollama_models["text"]
            mode = "text"
            
        if active_model:
            if on_progress:
                on_progress(f"正在使用本地大模型 ({active_model}) 辅助分析...")
            try:
                import base64
                import requests
                
                ollama_json = {}
                prompt = (
                    "You are a structured document data extractor. Please analyze this document and extract these fields in JSON format:\n"
                    "{\n"
                    "  \"合同/发票编号\": \"\",\n"
                    "  \"出卖方/销售方\": \"\",\n"
                    "  \"买受方/购买方\": \"\",\n"
                    "  \"签订/开票日期\": \"\",\n"
                    "  \"价税合计金额\": \"\",\n"
                    "  \"产品明细\": \"\"\n"
                    "}\n"
                    "Only return valid JSON containing these fields. If a field is not found, keep it as empty string. Do not include markdown blocks."
                )
                
                if mode == "vision":
                    if file_path.lower().endswith(".pdf"):
                        with fitz.open(file_path) as doc:
                            page = doc.load_page(0)
                            pix = page.get_pixmap(dpi=150)
                            img_bytes = pix.tobytes("png")
                    else:
                        with open(file_path, "rb") as f:
                            img_bytes = f.read()
                    
                    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
                    payload = {
                        "model": active_model,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt,
                                "images": [img_b64]
                            }
                        ],
                        "stream": False,
                        "format": "json"
                    }
                else:
                    text_prompt = (
                        f"Please extract structured fields in JSON format from this document text:\n"
                        f"--- BEGIN TEXT ---\n{full_text[:3000]}\n--- END TEXT ---\n\n" + prompt
                    )
                    payload = {
                        "model": active_model,
                        "messages": [
                            {
                                "role": "user",
                                "content": text_prompt
                            }
                        ],
                        "stream": False,
                        "format": "json"
                    }
                
                res = requests.post("http://127.0.0.1:11434/api/chat", json=payload, timeout=8.0)
                if res.status_code == 200:
                    ollama_json = json.loads(res.json()["message"]["content"])
                    for k in ["合同/发票编号", "出卖方/销售方", "买受方/购买方", "签订/开票日期", "价税合计金额", "产品明细"]:
                        val = str(ollama_json.get(k, "")).strip()
                        if val:
                            if k == "价税合计金额":
                                val = re.sub(r'[^\d\.]', '', val)
                            
                            existing_val = extracted_data.get(k, "").strip()
                            if not existing_val:
                                extracted_data[k] = val
                            elif len(existing_val) < 4 and len(val) >= 4 and k in ["出卖方/销售方", "买受方/购买方"]:
                                extracted_data[k] = val
            except Exception as e:
                print("Ollama model extraction failed:", e)
            
        summary = "本地纯离线处理完成。"
        if doc_type == "发票":
            summary = "检测为发票文件，已提取基础字段。"
        elif doc_type == "合同":
            summary = f"检测为合同文件。合同编号:{extracted_data['合同/发票编号'] or '未提取'}, 合计金额:{extracted_data['价税合计金额'] or '未提取'}"
        elif doc_type == "收发货单":
            summary = "检测为收发货单据。"
        elif doc_type == "回款凭证":
            summary = "检测为财务凭证/回单。"
            
        return {
            "document_type": doc_type,
            "extracted_data": json.dumps({"全文识别预览": full_text[:150] + "..."} | extracted_data, ensure_ascii=False),
            "summary": summary
        }
    except Exception as e:
        return {
            "document_type": "处理失败",
            "extracted_data": json.dumps({"error": str(e)}),
            "summary": f"OCR 本地处理失败: {str(e)}"
        }

