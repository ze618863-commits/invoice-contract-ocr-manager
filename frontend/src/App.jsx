import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, FileText, Search, FileImage, FileStack, RefreshCw, FolderOpen, Settings, Trash2, CheckSquare, CheckCircle } from 'lucide-react';

const API_BASE = '/api';

function App() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [mainTab, setMainTab] = useState('file-archive'); // 'file-archive' | 'invoice-archive' | 'settings'
  const [archivedDocs, setArchivedDocs] = useState([]);
  const [archivedInvoicesCount, setArchivedInvoicesCount] = useState(0);
  const [isHistoryRefreshing, setIsHistoryRefreshing] = useState(false);
  const [historyFilters, setHistoryFilters] = useState({
    buyer: '',
    doc_type: '全部',
    date_start: '',
    date_end: ''
  });
  const [isCropOcrMode, setIsCropOcrMode] = useState(false);
  const [cropBox, setCropBox] = useState(null);
  const [dragStartPos, setDragStartPos] = useState(null);
  const [showFieldsMenu, setShowFieldsMenu] = useState(null);
  const [isCropOcrLoading, setIsCropOcrLoading] = useState(false);
  const [cropImageAspectRatio, setCropImageAspectRatio] = useState(null);
  
  const prevPendingRef = React.useRef(0);
  const imgRef = React.useRef(null);

  // Selection states
  const [selectedIds, setSelectedIds] = useState([]);
  // Context menu state
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, docId: null });
  // Archive directory path state
  const [archiveDir, setArchiveDir] = useState('');
  const [invoiceArchiveDir, setInvoiceArchiveDir] = useState('');
  
  // Archive Review Modal State
  const [archiveModal, setArchiveModal] = useState({ visible: false, doc: null, queue: [], index: -1, fields: {} });

  const [candidateContracts, setCandidateContracts] = useState([]);
  const [selectedContractId, setSelectedContractId] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [ledgerStatus, setLedgerStatus] = useState({ status: 'ok', message: '' });
  const [documentTypes, setDocumentTypes] = useState(['合同', '发票', '收发货单', '回款凭证', '其他']);
  const [contractTypes, setContractTypes] = useState(['合同', '销售合同']);
  const [showTypesManager, setShowTypesManager] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [isSavingTypes, setIsSavingTypes] = useState(false);

  // Invoice states
  const [invoiceSubdirs, setInvoiceSubdirs] = useState([]);
  const [selectedSubdir, setSelectedSubdir] = useState('');
  const [customSubdir, setCustomSubdir] = useState('');
  const [invoiceLogs, setInvoiceLogs] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceSelectedIds, setInvoiceSelectedIds] = useState([]);
  const [invoiceFormFields, setInvoiceFormFields] = useState({});

  // Image zoom and pan states
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    fetchDocuments();
    fetchSettings();
    fetchInvoiceSubdirs();
    fetchArchivedInvoicesCount();
    // Poll for status updates every 5 seconds
    const interval = setInterval(() => {
      fetchDocuments();
      fetchArchivedInvoicesCount();
      if (activeTab === 'history') {
        fetchArchivedDocuments();
      }
    }, 5000);
    
    // Request Notification permission
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Prevent default browser behavior on file drag/drop to stop navigation
    const preventDefault = (e) => e.preventDefault();
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', preventDefault);
    
    // Close context menu on click elsewhere
    const closeMenu = () => setContextMenu({ visible: false, x: 0, y: 0, docId: null });
    window.addEventListener('click', closeMenu);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', preventDefault);
      window.removeEventListener('click', closeMenu);
    };
  }, [activeTab]);

  // Desktop notification effect
  useEffect(() => {
    const currentPending = documents.filter(d => d.status === 'pending').length;
    if (prevPendingRef.current > 0 && currentPending === 0) {
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('智能文档管理中心', {
          body: '所有上传的单据已全部解析完成！',
          requireInteraction: false
        });
      }
    }
    prevPendingRef.current = currentPending;
  }, [documents]);

  // Load archived documents
  const fetchArchivedDocuments = async (showFeedback = false) => {
    if (showFeedback) setIsHistoryRefreshing(true);
    try {
      const res = await axios.get(`${API_BASE}/documents/archived`, {
        params: {
          buyer: historyFilters.buyer,
          doc_type: historyFilters.doc_type,
          date_start: historyFilters.date_start ? historyFilters.date_start.replace(/\D/g, '') : '',
          date_end: historyFilters.date_end ? historyFilters.date_end.replace(/\D/g, '') : '',
          _t: Date.now()
        }
      });
      setArchivedDocs(res.data);
    } catch (err) {
      console.error('Failed to fetch archived documents', err);
    } finally {
      if (showFeedback) {
        setTimeout(() => setIsHistoryRefreshing(false), 600);
      }
    }
  };

  const fetchArchivedInvoicesCount = async () => {
    try {
      const res = await axios.get(`${API_BASE}/documents/archived`, {
        params: { doc_type: '发票', _t: Date.now() }
      });
      setArchivedInvoicesCount(res.data.length);
    } catch (err) {
      console.error('Failed to fetch archived invoices count', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchArchivedDocuments();
    }
  }, [activeTab, historyFilters.buyer, historyFilters.doc_type, historyFilters.date_start, historyFilters.date_end]);

  const handleCropOcrSubmit = async (fieldName) => {
    if (!cropBox) return;
    setIsCropOcrLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/documents/${archiveModal.doc.id}/crop-ocr`, {
        x: cropBox.x,
        y: cropBox.y,
        width: cropBox.w,
        height: cropBox.h
      });
      const recognizedText = res.data.text;
      
      // Update form field
      handleArchiveFieldChange(fieldName, recognizedText);
    } catch (err) {
      alert('局部识别失败，请重试。');
    } finally {
      setIsCropOcrLoading(false);
      setCropBox(null);
      setShowFieldsMenu(null);
    }
  };

  const handleCropMouseDown = (e) => {
    e.preventDefault();
    // Shift key, right click (button 2) or middle click (button 1) triggers pan/drag scroll
    if (e.shiftKey || e.button === 2 || e.button === 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - zoomOffset.x, y: e.clientY - zoomOffset.y });
      return;
    }
    const rect = imgRef.current ? imgRef.current.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
    const startX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const startY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setDragStartPos({ x: startX, y: startY });
    setCropBox({ x: startX, y: startY, w: 0, h: 0 });
    setShowFieldsMenu(null);
  };

  const handleCropMouseMove = (e) => {
    if (isDragging) {
      setZoomOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      return;
    }
    if (!dragStartPos) return;
    const rect = imgRef.current ? imgRef.current.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const x = Math.min(dragStartPos.x, currentX);
    const y = Math.min(dragStartPos.y, currentY);
    const w = Math.max(0.001, Math.abs(dragStartPos.x - currentX));
    const h = Math.max(0.001, Math.abs(dragStartPos.y - currentY));
    setCropBox({ x, y, w, h });
  };

  const handleCropMouseUp = (e) => {
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    if (!dragStartPos) return;
    setDragStartPos(null);
    if (cropBox && cropBox.w > 0.01 && cropBox.h > 0.01) {
      setShowFieldsMenu({
        x: e.clientX,
        y: e.clientY
      });
    } else {
      setCropBox(null);
    }
  };

  const fetchCandidateContracts = async () => {
    if (archiveModal.visible && !contractTypes.includes(archiveModal.fields.document_type)) {
      const buyer = archiveModal.fields['买受方/购买方'] || '';
      const amount = archiveModal.fields['价税合计金额'] || '';
      const date = archiveModal.fields['签订/开票日期'] || '';
      const products = archiveModal.fields['产品明细'] || '';
      try {
        const res = await axios.get(`${API_BASE}/documents/candidate-contracts`, {
          params: { buyer, amount, date_str: date, products, _t: Date.now() }
        });
        setCandidateContracts(res.data.candidates);
        
        // Prioritize already auto-linked contract if it exists in the candidates list
        const autoLinkedId = archiveModal.doc?.link_contract_id;
        if (autoLinkedId && res.data.candidates.some(c => c.id === autoLinkedId)) {
          setSelectedContractId(autoLinkedId);
        } else {
          setSelectedContractId(res.data.recommended_id);
        }
      } catch (err) {
        console.error('Failed to fetch candidate contracts', err);
      }
    }
  };


  useEffect(() => {
    if (archiveModal.visible && !contractTypes.includes(archiveModal.fields.document_type)) {
      fetchCandidateContracts();
    } else {
      setCandidateContracts([]);
      setSelectedContractId(null);
    }
  }, [
    archiveModal.visible, 
    archiveModal.fields.document_type, 
    archiveModal.fields['买受方/购买方'], 
    archiveModal.fields['价税合计金额'],
    archiveModal.fields['签订/开票日期'],
    archiveModal.fields['产品明细']
  ]);

  const checkDetailsDuplicate = async () => {
    if (archiveModal.visible) {
      const buyer = archiveModal.fields['买受方/购买方'] || '';
      const seller = archiveModal.fields['出卖方/销售方'] || '';
      const amount = archiveModal.fields['价税合计金额'] || '';
      const products = archiveModal.fields['产品明细'] || '';
      const doc_id = archiveModal.doc?.id;
      try {
        const res = await axios.post(`${API_BASE}/documents/check-details-duplicate`, {
          doc_id,
          buyer,
          seller,
          amount,
          products
        });
        setDuplicateWarning(res.data.warning);
      } catch (err) {
        console.error('Failed to check details duplicate', err);
      }
    } else {
      setDuplicateWarning(null);
    }
  };

  useEffect(() => {
    checkDetailsDuplicate();
  }, [
    archiveModal.visible,
    archiveModal.fields['买受方/购买方'],
    archiveModal.fields['出卖方/销售方'],
    archiveModal.fields['价税合计金额'],
    archiveModal.fields['产品明细']
  ]);


  const fetchDocuments = async (showFeedback = false) => {
    if (showFeedback) {
      setIsRefreshing(true);
    }
    try {
      const res = await axios.get(`${API_BASE}/documents`, {
        params: { _t: Date.now() }
      });
      setDocuments(res.data);
      // Use functional state updater to avoid stale closure of selectedDoc inside setInterval
      setSelectedDoc(prev => {
        if (!prev) return null;
        const updated = res.data.find(d => d.id === prev.id);
        return updated || prev;
      });

      // Fetch ledger status in parallel/background to notify user of lock status
      try {
        const statusRes = await axios.get(`${API_BASE}/settings/ledger-status`);
        setLedgerStatus(statusRes.data);
      } catch (err) {
        console.error('Failed to fetch ledger status', err);
      }
    } catch (err) {
      console.error('Failed to fetch documents', err);
    } finally {
      if (showFeedback) {
        setTimeout(() => {
          setIsRefreshing(false);
        }, 600);
      }
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings`, {
        params: { _t: Date.now() }
      });
      setArchiveDir(res.data.archive_dir);
      setInvoiceArchiveDir(res.data.invoice_archive_dir || '');
      if (res.data.document_types) {
        setDocumentTypes(res.data.document_types);
      }
      if (res.data.contract_types) {
        setContractTypes(res.data.contract_types);
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  };

  const fetchInvoiceSubdirs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings/invoice-subdirs`, {
        params: { _t: Date.now() }
      });
      setInvoiceSubdirs(res.data || []);
      if (res.data && res.data.length > 0 && !selectedSubdir) {
        setSelectedSubdir(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch invoice subdirs', err);
    }
  };

  const addInvoiceLog = (message) => {
    const time = new Date().toLocaleTimeString();
    setInvoiceLogs(prev => [...prev, `[${time}] ${message}`]);
  };

  const handleArchiveInvoice = async (doc) => {
    const targetDir = customSubdir.trim() || selectedSubdir;
    if (!targetDir) {
      alert("请先选择或输入归档目标个人目录！");
      return;
    }
    
    let fields = { ...invoiceFormFields };
    if (doc.id !== selectedInvoice?.id) {
      try {
        fields = JSON.parse(doc.extracted_data || '{}');
      } catch(e) {
        fields = {};
      }
    }
    
    addInvoiceLog(`正在归档发票: ${doc.filename} -> ${targetDir}...`);
    try {
      const res = await axios.post(`${API_BASE}/documents/${doc.id}/archive`, {
        document_type: "发票",
        extracted_data: JSON.stringify(fields),
        summary: `发票归档完成，放入 ${targetDir}`,
        link_contract_id: null,
        personal_dir: targetDir
      });
      addInvoiceLog(`[成功] 归档发票: ${doc.filename} -> 重命名为: ${res.data.filename}`);
      
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      if (selectedInvoice?.id === doc.id) {
        setSelectedInvoice(null);
      }
      setInvoiceSelectedIds(prev => prev.filter(id => id !== doc.id));
      fetchInvoiceSubdirs();
      fetchArchivedInvoicesCount();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || err.message;
      addInvoiceLog(`[ERROR] 归档发票 ${doc.filename} 失败: ${errMsg}`);
      alert(errMsg);
    }
  };

  const handleBulkArchiveInvoices = async () => {
    const targetDir = customSubdir.trim() || selectedSubdir;
    if (!targetDir) {
      alert("请先选择或输入归档目标个人目录！");
      return;
    }
    
    const toArchive = documents.filter(d => d.source === 'invoice_archive' && !d.is_archived && invoiceSelectedIds.includes(d.id));
    if (toArchive.length === 0) {
      alert("请先选择要归档的发票！");
      return;
    }
    
    addInvoiceLog(`====== 开始批量归档 (${toArchive.length}张发票) ======`);
    for (const doc of toArchive) {
      let fields = {};
      try {
        fields = JSON.parse(doc.extracted_data || '{}');
      } catch(e) {}
      
      addInvoiceLog(`正在归档: ${doc.filename}...`);
      try {
        const res = await axios.post(`${API_BASE}/documents/${doc.id}/archive`, {
          document_type: "发票",
          extracted_data: JSON.stringify(fields),
          summary: `发票归档完成，放入 ${targetDir}`,
          link_contract_id: null,
          personal_dir: targetDir
        });
        addInvoiceLog(`[成功] ${doc.filename} -> ${res.data.filename}`);
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
      } catch (err) {
        addInvoiceLog(`[失败] ${doc.filename}: ${err.response?.data?.detail || err.message}`);
      }
    }
    addInvoiceLog(`====== 批量归档结束 ======`);
    setSelectedInvoice(null);
    setInvoiceSelectedIds([]);
    fetchInvoiceSubdirs();
    fetchArchivedInvoicesCount();
  };

  const handleSelectInvoice = (doc) => {
    setSelectedInvoice(doc);
    let ext = {};
    try {
      ext = JSON.parse(doc.extracted_data || '{}');
    } catch(e) {}
    
    setInvoiceFormFields({
      "合同/发票编号": ext["合同/发票编号"] || "",
      "出卖方/销售方": ext["出卖方/销售方"] || "",
      "买受方/购买方": ext["买受方/购买方"] || "",
      "签订/开票日期": ext["签订/开票日期"] || "",
      "价税合计金额": ext["价税合计金额"] || "",
      "发票内容": ext["发票内容"] || ext["产品明细"] || ""
    });
    
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await axios.delete(`${API_BASE}/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (selectedInvoice?.id === docId) {
        setSelectedInvoice(null);
      }
      setInvoiceSelectedIds(prev => prev.filter(id => id !== docId));
    } catch (err) {
      const errMsg = err.response?.data?.detail || '删除失败';
      alert(errMsg);
    }
  };

  const handleInvoiceUpload = async (e) => {
    const files = Array.from(e.target.files || e.dataTransfer?.files || []);
    if (files.length === 0) return;
    
    setIsUploading(true);
    addInvoiceLog(`====== 开始上传发票 (${files.length}个文件) ======`);
    
    let validFiles = files.filter(file => file.type.includes('image') || file.type.includes('pdf'));
    if (validFiles.length === 0) {
      alert('仅支持图片或 PDF 格式！');
      setIsUploading(false);
      return;
    }

    for (const file of validFiles) {
      addInvoiceLog(`正在上传: ${file.name}...`);
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const res = await axios.post(`${API_BASE}/upload?source=invoice_archive`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        addInvoiceLog(`[成功] 上传 ${file.name}，已提交后台 OCR。`);
        setDocuments(prev => {
          if (prev.some(d => d.id === res.data.id)) return prev;
          return [res.data, ...prev];
        });
      } catch (err) {
        addInvoiceLog(`[失败] 上传 ${file.name}: ${err.response?.data?.detail || err.message}`);
      }
    }
    
    setIsUploading(false);
    addInvoiceLog(`====== 上传完成 ======`);
  };

  const handleInvoiceDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUploading) return;
    await handleInvoiceUpload(e);
  };

  const handleSaveDocumentTypes = async (newDocTypes, newContractTypes) => {
    setIsSavingTypes(true);
    try {
      const res = await axios.post(`${API_BASE}/settings/document-types`, {
        document_types: newDocTypes,
        contract_types: newContractTypes
      });
      if (res.data.document_types) setDocumentTypes(res.data.document_types);
      if (res.data.contract_types) setContractTypes(res.data.contract_types);
    } catch (err) {
      console.error('Failed to save document types', err);
      alert('保存文档类型失败：' + (err.response?.data?.detail || err.message));
    } finally {
      setIsSavingTypes(false);
    }
  };

  const handleAddDocumentType = () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    if (documentTypes.includes(trimmed)) {
      alert('该文件类型已存在！');
      return;
    }
    const updated = [...documentTypes, trimmed];
    setDocumentTypes(updated);
    setNewTypeName('');
    handleSaveDocumentTypes(updated, contractTypes);
  };

  const handleRemoveDocumentType = (typeName) => {
    const defaultTypes = ['合同', '发票', '收发货单', '回款凭证', '其他'];
    if (defaultTypes.includes(typeName)) {
      alert('内置默认文档类型不可删除！');
      return;
    }
    if (!window.confirm(`确定要删除文件类型 "${typeName}" 吗？`)) return;
    
    const updatedDocs = documentTypes.filter(t => t !== typeName);
    const updatedContracts = contractTypes.filter(t => t !== typeName);
    
    setDocumentTypes(updatedDocs);
    setContractTypes(updatedContracts);
    handleSaveDocumentTypes(updatedDocs, updatedContracts);
  };

  const handleToggleContractType = (typeName) => {
    let updated;
    if (contractTypes.includes(typeName)) {
      if (typeName === '合同' || typeName === '销售合同') {
        alert('内置合同类型不可取消！');
        return;
      }
      updated = contractTypes.filter(t => t !== typeName);
    } else {
      updated = [...contractTypes, typeName];
    }
    setContractTypes(updated);
    handleSaveDocumentTypes(documentTypes, updated);
  };

  const getDocStatus = (doc) => {
    if (doc.status === 'pending') {
      return { text: doc.progress_status || '识别中...', className: 'doc-type-未知' };
    }
    if (doc.status === 'failed') {
      return { text: '处理失败', className: 'doc-type-处理失败' };
    }
    
    if (doc.is_archived) {
      if (doc.document_type === '合同' || doc.document_type === '销售合同') {
        return { text: '已归档', className: 'doc-type-archived' };
      }
      if (doc.document_type === '回款凭证' || doc.document_type === '回款') {
        return { text: '已回款', className: 'doc-type-archived-payment' };
      }
      if (doc.document_type === '收发货单' || doc.document_type === '收货单') {
        let extracted = {};
        try {
          extracted = JSON.parse(doc.extracted_data || '{}');
        } catch(e) {}
        const isReceived = extracted['收货状态'] === '已收货';
        return { 
          text: isReceived ? '已收货' : '未收货', 
          className: isReceived ? 'doc-type-archived-received' : 'doc-type-archived-not-received' 
        };
      }
      return { text: '已归档', className: 'doc-type-archived' };
    }
    
    return { text: doc.document_type, className: getDocTypeClass(doc.document_type) };
  };

  const handleToggleReceipt = async (docId) => {
    try {
      const res = await axios.post(`${API_BASE}/documents/${docId}/toggle-receipt`);
      setDocuments(prev => prev.map(d => d.id === docId ? res.data : d));
      setSelectedDoc(prev => prev?.id === docId ? res.data : prev);
      setArchiveModal(prev => {
        if (prev.visible && prev.doc?.id === docId) {
          let extracted = {};
          try {
            extracted = JSON.parse(res.data.extracted_data || '{}');
          } catch(e) {}
          return {
            ...prev,
            doc: res.data,
            fields: {
              ...prev.fields,
              '收货状态': extracted['收货状态'] || '未收货'
            }
          };
        }
        return prev;
      });
    } catch (err) {
      alert('更新收货状态失败');
    }
  };


  const handleChooseDir = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings/choose-dir`);
      if (res.data.status === 'success') {
        setArchiveDir(res.data.archive_dir);
        fetchDocuments(); // Refresh documents from new dir if any
      }
    } catch (err) {
      alert('选择文件夹失败');
    }
  };

  const handleOpenFolder = async () => {
    try {
      await axios.get(`${API_BASE}/settings/open-folder`);
    } catch (err) {
      alert('无法打开文件夹，可能路径不存在。');
    }
  };

  const handleChooseInvoiceDir = async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings/choose-invoice-dir`);
      if (res.data.status === 'success') {
        setInvoiceArchiveDir(res.data.invoice_archive_dir);
      }
    } catch (err) {
      alert('选择文件夹失败');
    }
  };

  const handleOpenInvoiceFolder = async () => {
    try {
      await axios.get(`${API_BASE}/settings/open-invoice-folder`);
    } catch (err) {
      alert('无法打开文件夹，可能路径不存在。');
    }
  };

  const uploadMultipleFiles = async (files) => {
    setIsUploading(true);
    let failedFiles = [];
    let uploadedDocs = [];

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await axios.post(`${API_BASE}/upload?source=file_archive`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          return { success: true, doc: res.data };
        } catch (err) {
          const errMsg = err.response?.data?.detail || '识别失败，请检查本地环境。';
          return { success: false, name: file.name, error: errMsg };
        }
      });

      const results = await Promise.all(uploadPromises);
      
      results.forEach(res => {
        if (res.success) {
          uploadedDocs.push(res.doc);
        } else {
          failedFiles.push(`${res.name}: ${res.error}`);
        }
      });

      fetchDocuments();
      if (uploadedDocs.length > 0) {
        setSelectedDoc(uploadedDocs[uploadedDocs.length - 1]);
      }
      if (failedFiles.length > 0) {
        alert(`以下文件上传失败：\n` + failedFiles.join('\n'));
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    let validFiles = files.filter(file => file.type.includes('image') || file.type.includes('pdf'));
    if (validFiles.length === 0) {
      alert('仅支持图片或 PDF 格式！');
      e.target.value = '';
      return;
    }

    // Duplicate detection querying the backend
    try {
      const dupCheckPromises = validFiles.map(async (file) => {
        try {
          const res = await axios.get(`${API_BASE}/documents/check-duplicate`, {
            params: { filename: file.name, _t: Date.now() }
          });
          return { name: file.name, exists: res.data.exists };
        } catch (err) {
          const localExists = documents.some(doc => doc.filename === file.name);
          return { name: file.name, exists: localExists };
        }
      });
      const results = await Promise.all(dupCheckPromises);
      const duplicateNames = results.filter(r => r.exists).map(r => r.name);
      
      if (duplicateNames.length > 0) {
        const proceed = confirm(
          `检测到以下文件已存在于系统数据库（待处理或已归档）中：\n${duplicateNames.map(n => `· ${n}`).join('\n')}\n\n确定要重复上传吗？\n点击【确定】将强制重复上传；\n点击【取消】将自动过滤并仅上传其他未存在的文件。`
        );
        if (!proceed) {
          validFiles = validFiles.filter(file => !duplicateNames.includes(file.name));
          if (validFiles.length === 0) {
            e.target.value = '';
            return;
          }
        }
      }
    } catch (err) {
      console.error("Duplicate check failed", err);
    }
    
    await uploadMultipleFiles(validFiles);
    e.target.value = ''; // Reset input
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isUploading) return;
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    
    let validFiles = files.filter(file => file.type.includes('image') || file.type.includes('pdf'));
    if (validFiles.length === 0) {
      alert('仅支持图片或 PDF 格式！');
      return;
    }

    // Duplicate detection querying the backend
    try {
      const dupCheckPromises = validFiles.map(async (file) => {
        try {
          const res = await axios.get(`${API_BASE}/documents/check-duplicate`, {
            params: { filename: file.name, _t: Date.now() }
          });
          return { name: file.name, exists: res.data.exists };
        } catch (err) {
          const localExists = documents.some(doc => doc.filename === file.name);
          return { name: file.name, exists: localExists };
        }
      });
      const results = await Promise.all(dupCheckPromises);
      const duplicateNames = results.filter(r => r.exists).map(r => r.name);
      
      if (duplicateNames.length > 0) {
        const proceed = confirm(
          `检测到以下文件已存在于系统数据库（待处理或已归档）中：\n${duplicateNames.map(n => `· ${n}`).join('\n')}\n\n确定要重复上传吗？\n点击【确定】将强制重复上传；\n点击【取消】将自动过滤并仅上传其他未存在的文件。`
        );
        if (!proceed) {
          validFiles = validFiles.filter(file => !duplicateNames.includes(file.name));
          if (validFiles.length === 0) {
            return;
          }
        }
      }
    } catch (err) {
      console.error("Duplicate check failed", err);
    }
    
    await uploadMultipleFiles(validFiles);
  };

  // Deletion logic
  const deleteSingle = async (docId) => {
    if (!confirm('确认要删除此文档吗？')) return;
    try {
      await axios.delete(`${API_BASE}/documents/${docId}`);
      setSelectedDoc(prev => prev?.id === docId ? null : prev);
      setSelectedIds(prev => prev.filter(id => id !== docId));
      fetchDocuments();
    } catch (err) {
      const errMsg = err.response?.data?.detail || '删除失败';
      alert(errMsg);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确认要删除已选中的 ${selectedIds.length} 个文档吗？`)) return;
    try {
      await axios.post(`${API_BASE}/documents/bulk-delete`, { ids: selectedIds });
      setSelectedDoc(prev => selectedIds.includes(prev?.id) ? null : prev);
      setSelectedIds([]);
      fetchDocuments();
    } catch (err) {
      const errMsg = err.response?.data?.detail || '批量删除失败';
      alert(errMsg);
    }
  };

  // Selection toggle
  const toggleSelect = (docId, e) => {
    e.stopPropagation(); // Stop clicking checkbox from selecting the document detail view
    if (selectedIds.includes(docId)) {
      setSelectedIds(prev => prev.filter(id => id !== docId));
    } else {
      setSelectedIds(prev => [...prev, docId]);
    }
  };

  const handleSelectAll = () => {
    const nonInvoiceDocs = documents.filter(d => d.source !== 'invoice_archive');
    if (selectedIds.length === nonInvoiceDocs.length) {
      setSelectedIds([]); // deselect all
    } else {
      setSelectedIds(nonInvoiceDocs.map(d => d.id)); // select all
    }
  };

  // Context Menu Trigger
  const handleContextMenu = (e, docId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If the right-clicked item is not in selection, select it exclusively
    if (!selectedIds.includes(docId)) {
      setSelectedIds([docId]);
    }
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      docId
    });
  };

  // Archive modal handlers
  const handleOpenArchiveModal = (doc, queue = [], index = -1) => {
    // Reset zoom and pan states when opening modal or switching document
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setIsCropOcrMode(false);
    setCropBox(null);
    setShowFieldsMenu(null);
    setCropImageAspectRatio(null);

    let extracted = {};
    if (doc.extracted_data) {
      try {
        extracted = JSON.parse(doc.extracted_data);
      } catch (err) {}
    }
    setArchiveModal({
      visible: true,
      doc,
      queue,
      index,
      fields: {
        document_type: doc.document_type || '合同',
        summary: doc.summary || '',
        '合同/发票编号': extracted['合同/发票编号'] || '',
        '出卖方/销售方': extracted['出卖方/销售方'] || '',
        '买受方/购买方': extracted['买受方/购买方'] || '',
        '签订/开票日期': extracted['签订/开票日期'] || '',
        '价税合计金额': extracted['价税合计金额'] || '',
        '产品明细': extracted['产品明细'] || '',
        '盖章状态': (() => {
          let val = extracted['盖章状态'] || '无法确认';
          if (val.includes('双方盖章') && !val.includes('合同已生效')) {
            return '双方盖章, 合同已生效';
          }
          return val;
        })(),
        '备注': extracted['备注'] || '',
        '收货状态': extracted['收货状态'] || '未收货',
      }
    });
  };

  const handleMouseDown = (e) => {
    if (zoomScale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoomOffset.x, y: e.clientY - zoomOffset.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setZoomOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    // Zoom on wheel (prevent default page scroll inside modal)
    e.preventDefault();
    const zoomIntensity = 0.1;
    let newScale = zoomScale;
    if (e.deltaY < 0) {
      newScale = Math.min(zoomScale + zoomIntensity, 4.0);
    } else {
      newScale = Math.max(zoomScale - zoomIntensity, 0.5);
    }
    
    if (newScale <= 1) {
      setZoomOffset({ x: 0, y: 0 });
    }
    setZoomScale(newScale);
  };

  const handleArchiveFieldChange = (key, value) => {
    setArchiveModal(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [key]: value
      }
    }));
  };

  const handleToggleSealStatus = (status) => {
    const currentVal = archiveModal.fields['盖章状态'] || '无法确认';
    let selected = currentVal.split(/[,;\s]+/).map(s => s.trim()).filter(s => s);
    
    const GroupA = ['未盖章', '单方盖章', '双方盖章', '无法确认'];
    const GroupB = ['合同已生效'];
    
    if (GroupA.includes(status)) {
      if (selected.includes(status)) {
        selected = selected.filter(s => s !== status);
      } else {
        selected = selected.filter(s => !GroupA.includes(s));
        selected.push(status);
        if (status === '双方盖章' && !selected.includes('合同已生效')) {
          selected.push('合同已生效');
        }
      }
    } else if (GroupB.includes(status)) {
      if (selected.includes(status)) {
        selected = selected.filter(s => s !== status);
      } else {
        selected.push(status);
      }
    }
    
    if (selected.length === 0) {
      selected = ['无法确认'];
    }
    
    const order = ['未盖章', '单方盖章', '双方盖章', '合同已生效', '无法确认'];
    selected.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    
    handleArchiveFieldChange('盖章状态', selected.join(', '));
  };

  const isStatusSelected = (status) => {
    const currentVal = archiveModal.fields['盖章状态'] || '无法确认';
    const selected = currentVal.split(/[,;\s]+/).map(s => s.trim()).filter(s => s);
    return selected.includes(status);
  };

  const handleBulkArchiveStart = () => {
    const archivableDocs = selectedIds
      .map(id => documents.find(d => d.id === id))
      .filter(doc => doc && doc.status === 'processed' && !doc.is_archived);
      
    if (archivableDocs.length === 0) {
      alert('选中的文档中没有可以归档的（需为解析完成且未归档的文档）！');
      return;
    }
    
    // Sort queue by priority: 合同 -> 收发货单 -> 回款凭证 -> 发票
    const priority = {
      '合同': 1,
      '销售合同': 1,
      '收发货单': 2,
      '收货单': 2,
      '回款凭证': 3,
      '回款': 3,
      '发票': 4
    };
    
    archivableDocs.sort((a, b) => {
      const pA = priority[a.document_type] || 999;
      const pB = priority[b.document_type] || 999;
      return pA - pB;
    });
    
    handleOpenArchiveModal(archivableDocs[0], archivableDocs, 0);
  };

  const handleArchiveCancel = () => {
    setArchiveModal({ visible: false, doc: null, queue: [], index: -1, fields: {} });
    setIsCropOcrMode(false);
    setCropBox(null);
    setShowFieldsMenu(null);
    setCropImageAspectRatio(null);
  };

  const handleArchiveSkip = () => {
    const { queue, index } = archiveModal;
    if (queue && index >= 0 && index < queue.length - 1) {
      const nextIndex = index + 1;
      const nextDoc = queue[nextIndex];
      handleOpenArchiveModal(nextDoc, queue, nextIndex);
    } else {
      setArchiveModal({ visible: false, doc: null, queue: [], index: -1, fields: {} });
      setIsCropOcrMode(false);
      setCropBox(null);
      setShowFieldsMenu(null);
      setCropImageAspectRatio(null);
      fetchDocuments();
      setSelectedIds([]);
      alert('批量归档流程结束。');
    }
  };

  const handleArchiveSubmit = async () => {
    const { doc, queue, index, fields } = archiveModal;
    const updatedExtracted = {
      '合同/发票编号': fields['合同/发票编号'],
      '出卖方/销售方': fields['出卖方/销售方'],
      '买受方/购买方': fields['买受方/购买方'],
      '签订/开票日期': fields['签订/开票日期'],
      '价税合计金额': fields['价税合计金额'],
      '产品明细': fields['产品明细'],
      '盖章状态': fields['盖章状态'],
      '备注': fields['备注'],
      '收货状态': fields['收货状态'] || '未收货',
    };

    
    const payload = {
      document_type: fields.document_type,
      summary: fields.summary,
      extracted_data: JSON.stringify(updatedExtracted),
      link_contract_id: selectedContractId
    };

    try {
      const res = await axios.post(`${API_BASE}/documents/${doc.id}/archive`, payload);
      
      if (queue && index >= 0 && index < queue.length - 1) {
        const nextIndex = index + 1;
        const nextDoc = queue[nextIndex];
        handleOpenArchiveModal(nextDoc, queue, nextIndex);
      } else {
        setArchiveModal({ visible: false, doc: null, queue: [], index: -1, fields: {} });
        setIsCropOcrMode(false);
        setCropBox(null);
        setShowFieldsMenu(null);
        setCropImageAspectRatio(null);
        fetchDocuments();
        setSelectedDoc(res.data);
        setSelectedIds([]);
        alert('归档成功！数据已记入本地台账。');
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || '归档失败，请重试。';
      alert(errMsg);
    }
  };

  const getDocTypeClass = (type) => {
    if (!type) return 'doc-type-未知';
    if (type.includes('发票')) return 'doc-type-发票';
    if (type.includes('合同')) return 'doc-type-合同';
    if (type.includes('收发货单') || type.includes('凭证')) return 'doc-type-收发货单';
    if (type === '处理失败') return 'doc-type-处理失败';
    return 'doc-type-未知';
  };

  const renderExtractedData = (dataStr) => {
    try {
      const data = JSON.parse(dataStr);
      // Omit full text preview for cleaner render
      const cleanData = { ...data };
      delete cleanData["全文识别预览"];
      
      return (
        <div className="json-view">
          {JSON.stringify(cleanData, null, 2)}
        </div>
      );
    } catch {
      return <p>{dataStr}</p>;
    }
  };

  const nonInvoiceDocs = documents.filter(d => d.source !== 'invoice_archive');

  return (
    <div className="main-app-wrapper" style={{ display: "flex", minHeight: "100vh", background: "var(--bg-gradient)", color: "var(--text-main)", fontFamily: "Inter, sans-serif" }}>
      {/* Left Sidebar */}
      <div className="sidebar" style={{
        width: '85px',
        background: 'var(--surface)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: '1px solid var(--surface-border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '1.5rem 0.4rem',
        boxShadow: 'var(--shadow-glass)',
        flexShrink: 0,
        alignItems: 'center'
      }}>
        {/* Logo / Brand */}
        <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
            color: 'white',
            borderRadius: '10px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-md)',
            flexShrink: 0
          }}>
            <FileStack size={22} />
          </div>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'var(--primary)',
            fontFamily: 'Outfit, sans-serif',
            textAlign: 'center',
            marginTop: '0.2rem',
            whiteSpace: 'nowrap'
          }}>
            智能文档
          </span>
        </div>

        {/* Nav Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', width: '100%', alignItems: 'center' }}>
          <button 
            onClick={() => setMainTab('file-archive')}
            className={`btn ${mainTab === 'file-archive' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.8rem 0.2rem',
              borderRadius: '8px',
              width: '70px',
              height: '70px',
              transition: 'var(--transition)',
              border: mainTab === 'file-archive' ? 'none' : '1px solid transparent',
              background: mainTab === 'file-archive' ? 'var(--primary)' : 'transparent',
              color: mainTab === 'file-archive' ? 'white' : 'var(--text-main)',
              boxShadow: mainTab === 'file-archive' ? 'var(--shadow-md)' : 'none',
              gap: '6px'
            }}
          >
            <FileStack size={20} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>文件归档</span>
          </button>

          <button 
            onClick={() => setMainTab('invoice-archive')}
            className={`btn ${mainTab === 'invoice-archive' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.8rem 0.2rem',
              borderRadius: '8px',
              width: '70px',
              height: '70px',
              transition: 'var(--transition)',
              border: mainTab === 'invoice-archive' ? 'none' : '1px solid transparent',
              background: mainTab === 'invoice-archive' ? 'var(--primary)' : 'transparent',
              color: mainTab === 'invoice-archive' ? 'white' : 'var(--text-main)',
              boxShadow: mainTab === 'invoice-archive' ? 'var(--shadow-md)' : 'none',
              gap: '6px'
            }}
          >
            <FileText size={20} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>发票归档</span>
          </button>

          <button 
            onClick={() => setMainTab('settings')}
            className={`btn ${mainTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.8rem 0.2rem',
              borderRadius: '8px',
              width: '70px',
              height: '70px',
              transition: 'var(--transition)',
              border: mainTab === 'settings' ? 'none' : '1px solid transparent',
              background: mainTab === 'settings' ? 'var(--primary)' : 'transparent',
              color: mainTab === 'settings' ? 'white' : 'var(--text-main)',
              boxShadow: mainTab === 'settings' ? 'var(--shadow-md)' : 'none',
              gap: '6px'
            }}
          >
            <Settings size={20} />
            <span style={{ fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>设置</span>
          </button>
        </div>
      </div>
      {/* Right Content Area */}
      <div className="content-area" style={{ flex: 1, padding: "2rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1.5rem", maxHeight: "100vh" }}>
        {mainTab === "file-archive" && (
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
{/* Ledger Lock Warning Banner */}
      {ledgerStatus && ledgerStatus.status === 'locked' && (
        <div style={{
          background: 'rgba(255, 152, 0, 0.1)',
          borderLeft: '4px solid #ff9800',
          padding: '0.8rem 1.2rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          color: '#e67e22',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          animation: 'slideIn 0.3s ease'
        }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>⚠️</span>
          <div>
            <strong style={{ fontWeight: 600 }}>台账同步受阻：</strong>
            {ledgerStatus.message || '本地台账（台账.xlsx）正被 Excel 或其他程序占用，无法写入更新。请先关闭该 Excel 文件后再试！'}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-container" style={{ marginTop: '0.5rem' }}>
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => { setActiveTab('pending'); setSelectedDoc(null); }}
        >
          待处理文档 ({nonInvoiceDocs.filter(d => !d.is_archived).length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => { setActiveTab('history'); setSelectedDoc(null); fetchArchivedDocuments(); }}
        >
          历史归档库
        </button>
      </div>

      <main className="main-layout">
        {/* Left Column: List & Upload / Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {activeTab === 'pending' ? (
            <>
              <div className="card glass">
                {(() => {
                  const pendingDocs = nonInvoiceDocs.filter(d => d.status === 'pending');
                  const totalUnarchived = nonInvoiceDocs.filter(d => !d.is_archived).length;
                  const completedUnarchived = nonInvoiceDocs.filter(d => !d.is_archived && d.status !== 'pending').length;
                  const percent = totalUnarchived > 0 ? Math.round((completedUnarchived / totalUnarchived) * 100) : 100;
                  
                  return (
                    <label 
                      className={`upload-area ${isUploading ? 'active' : ''}`}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      style={{ padding: pendingDocs.length > 0 ? '1.5rem 2rem' : '3rem 2rem' }}
                    >
                      {pendingDocs.length > 0 && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          style={{ 
                            width: '100%', 
                            background: 'rgba(79, 70, 229, 0.04)', 
                            border: '1px solid rgba(79, 70, 229, 0.15)', 
                            padding: '0.8rem 1rem', 
                            borderRadius: '10px', 
                            marginBottom: '1.2rem',
                            boxSizing: 'border-box',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--primary)' }}>
                            <span>⏳ 正在进行离线 OCR 识别...</span>
                            <span>{completedUnarchived}/{totalUnarchived} ({percent}%)</span>
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.06)', height: '6px', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                            <div 
                              className="progress-shimmer animate-pulse"
                              style={{ 
                                background: 'linear-gradient(to right, var(--primary), var(--secondary))', 
                                width: `${percent}%`, 
                                height: '100%', 
                                borderRadius: '3px',
                                transition: 'width 0.4s ease-out'
                              }}
                            />
                          </div>
                        </div>
                      )}
                      
                      <input 
                        type="file" 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload}
                        accept="image/*,application/pdf"
                        disabled={isUploading}
                        multiple
                      />
                      {isUploading ? (
                        <div className="spinner"></div>
                      ) : (
                        <UploadCloud className="upload-icon" />
                      )}
                      <h3>{isUploading ? '正在上传并识别中...' : '点击或拖拽文件上传'}</h3>
                      <p className="app-subtitle">支持 PDF, JPG, PNG 格式</p>
                    </label>
                  );
                })()}
              </div>

              <div className="card glass">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileStack size={20} className="upload-icon" style={{width: 20, height: 20}} />
                    文档列表
                  </h3>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {selectedIds.length > 0 && (
                      <>
                        <button 
                          onClick={handleBulkArchiveStart}
                          className="btn-primary"
                          style={{ border: 'none', cursor: 'pointer', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                        >
                          <CheckCircle size={14} /> 一键归档 ({
                            selectedIds.filter(id => {
                              const doc = nonInvoiceDocs.find(d => d.id === id);
                              return doc && doc.status === 'processed' && !doc.is_archived;
                            }).length
                          })
                        </button>
                        <button 
                          onClick={deleteSelected}
                          style={{ background: 'var(--accent)', border: 'none', cursor: 'pointer', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                        >
                          <Trash2 size={14} /> 删除 ({selectedIds.length})
                        </button>
                      </>
                    )}
                    <button 
                      onClick={handleOpenFolder} 
                      style={{ background: 'var(--primary)', border: 'none', cursor: 'pointer', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                    >
                      <FolderOpen size={14} /> 打开本地台账
                    </button>
                    <button onClick={() => fetchDocuments(true)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)'}} title="刷新列表" disabled={isRefreshing}>
                      <RefreshCw size={16} className={isRefreshing ? 'spin-animation' : ''} />
                    </button>
                  </div>
                </div>
                
                {nonInvoiceDocs.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
                    <button 
                      onClick={handleSelectAll} 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <CheckSquare size={14} /> 
                      {selectedIds.length === nonInvoiceDocs.length ? '取消全选' : '选择全部'}
                    </button>
                  </div>
                )}

                <div className={`doc-list ${isRefreshing ? 'doc-list-loading' : ''}`}>
                  {nonInvoiceDocs.length === 0 && <p style={{color: 'var(--text-muted)', textAlign: 'center'}}>暂无文档</p>}
                  {nonInvoiceDocs.map(doc => (
                    <div 
                      key={doc.id} 
                      className={`doc-item ${selectedDoc?.id === doc.id ? 'active' : ''}`}
                      onClick={() => setSelectedDoc(doc)}
                      onContextMenu={(e) => handleContextMenu(e, doc.id)}
                    >
                      <div className="doc-info">
                        <input 
                          type="checkbox" 
                          className="doc-item-checkbox"
                          checked={selectedIds.includes(doc.id)}
                          onChange={(e) => toggleSelect(doc.id, e)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        {doc.file_type.includes('pdf') ? <FileText size={20} color="var(--primary)" /> : <FileImage size={20} color="var(--primary)" />}
                        <div>
                          <h4 style={{fontSize: '0.9rem', marginBottom: '0.2rem'}}>{doc.filename}</h4>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '0.2rem'}}>
                            <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap'}}>
                              <span>{new Date(doc.upload_time).toLocaleString()}</span>
                              {(() => {
                                try {
                                    const ext = JSON.parse(doc.extracted_data || '{}');
                                    if (ext.duplicate_warning) {
                                      return (
                                        <span style={{ fontSize: '0.7rem', color: '#ef4444', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }} title={ext.duplicate_warning}>
                                          ⚠️ 疑似重复
                                        </span>
                                      );
                                    }
                                } catch(e) {}
                                return null;
                              })()}
                            </p>
                            {doc.link_contract_id && (
                              <p style={{ fontSize: '0.72rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '0.2rem', margin: 0, fontWeight: 500 }}>
                                <span>🔗</span>
                                <span style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={
                                  (() => {
                                    const linked = nonInvoiceDocs.find(d => d.id === doc.link_contract_id);
                                    return linked ? `自动关联：${linked.filename}` : "已关联已归档合同";
                                  })()
                                }>
                                  {(() => {
                                    const linked = nonInvoiceDocs.find(d => d.id === doc.link_contract_id);
                                    return linked ? `自动匹配同合同：${linked.filename}` : "已关联已归档合同";
                                  })()}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{textAlign: 'right', flexShrink: 0}}>
                        {(() => {
                          const status = getDocStatus(doc);
                          return (
                            <span className={`doc-type-badge ${status.className}`}>
                              {status.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="card glass">
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Search size={20} className="upload-icon" />
                  历史归档检索
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--text-main)' }}>买受方名称 / 文件名：</label>
                    <input 
                      type="text" 
                      value={historyFilters.buyer}
                      onChange={(e) => setHistoryFilters(prev => ({ ...prev, buyer: e.target.value }))}
                      placeholder="模糊匹配买受方名称或原文件名..."
                      className="form-control"
                      style={{ background: 'rgba(255,255,255,0.4)', color: 'var(--text-main)' }}
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--text-main)' }}>单据类型：</label>
                      <select 
                        value={historyFilters.doc_type}
                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, doc_type: e.target.value }))}
                        className="form-control"
                        style={{ background: 'rgba(255,255,255,0.4)', color: 'var(--text-main)', padding: '0.5rem' }}
                      >
                        <option value="全部">全部</option>
                        <option value="合同">销售合同</option>
                        <option value="收货单">收货单</option>
                        <option value="发票">发票</option>
                        <option value="回款">回款凭证</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem', color: 'var(--text-main)' }}>起止签订/开票日期：</label>
                      <input 
                        type="text"
                        placeholder="起始 YYYYMMDD"
                        value={historyFilters.date_start}
                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, date_start: e.target.value }))}
                        className="form-control"
                        style={{ background: 'rgba(255,255,255,0.4)', color: 'var(--text-main)' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', alignItems: 'flex-end' }}>
                    <div>
                      <input 
                        type="text"
                        placeholder="截止 YYYYMMDD"
                        value={historyFilters.date_end}
                        onChange={(e) => setHistoryFilters(prev => ({ ...prev, date_end: e.target.value }))}
                        className="form-control"
                        style={{ background: 'rgba(255,255,255,0.4)', color: 'var(--text-main)' }}
                      />
                    </div>
                    <button 
                      onClick={() => fetchArchivedDocuments(true)}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', height: '38px', borderRadius: '8px' }}
                    >
                      <Search size={16} /> 检索过滤
                    </button>
                  </div>
                </div>
              </div>

              <div className="card glass">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileStack size={20} className="upload-icon" />
                    已归档历史文档 ({archivedDocs.length})
                  </h3>
                  <button onClick={() => fetchArchivedDocuments(true)} style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)'}} title="刷新列表" disabled={isHistoryRefreshing}>
                    <RefreshCw size={16} className={isHistoryRefreshing ? 'spin-animation' : ''} />
                  </button>
                </div>
                
                <div className={`doc-list ${isHistoryRefreshing ? 'doc-list-loading' : ''}`} style={{ maxHeight: '420px', overflowY: 'auto' }}>
                  {archivedDocs.length === 0 && <p style={{color: 'var(--text-muted)', textAlign: 'center'}}>暂无匹配的已归档历史文档</p>}
                  {archivedDocs.map(doc => (
                    <div 
                      key={doc.id} 
                      className={`doc-item ${selectedDoc?.id === doc.id ? 'active' : ''}`}
                      onClick={() => setSelectedDoc(doc)}
                    >
                      <div className="doc-info">
                        {doc.file_type.includes('pdf') ? <FileText size={20} color="var(--primary)" /> : <FileImage size={20} color="var(--primary)" />}
                        <div>
                          <h4 style={{fontSize: '0.9rem', marginBottom: '0.2rem'}}>{doc.filename}</h4>
                          <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0}}>
                            归档于: {new Date(doc.upload_time).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div style={{textAlign: 'right', flexShrink: 0}}>
                        {(() => {
                          const status = getDocStatus(doc);
                          return (
                            <span className={`doc-type-badge ${status.className}`}>
                              {status.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Details */}
        <div className="card glass details-panel" style={{ minHeight: '500px' }}>
          {selectedDoc ? (
            <>
              {(() => {
                try {
                  const ext = JSON.parse(selectedDoc.extracted_data || '{}');
                  if (ext.duplicate_warning) {
                    return (
                      <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', color: '#b91c1c', fontSize: '0.88rem', fontWeight: 600 }}>
                        ⚠️ 查重警报：{ext.duplicate_warning}
                      </div>
                    );
                  }
                } catch(e) {}
                return null;
              })()}
              <div className="detail-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}><FileText size={20} /> 基本信息</h3>
                  {selectedDoc.status === 'processed' && !selectedDoc.is_archived && (
                    <button 
                      onClick={() => handleOpenArchiveModal(selectedDoc)}
                      className="btn btn-primary"
                      style={{ padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.85rem' }}
                    >
                      <CheckCircle size={14} /> 确认归档
                    </button>
                  )}
                  {selectedDoc.is_archived && (
                    <span style={{ fontSize: '0.85rem', color: '#0284c7', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                      <CheckCircle size={16} /> 已归档入台账
                    </span>
                  )}
                </div>
                <p><strong>文件名：</strong> {selectedDoc.filename}</p>
                <p>
                  <strong>类型 / 归档状态：</strong> 
                  {(() => {
                    const status = getDocStatus(selectedDoc);
                    return (
                      <span className={`doc-type-badge ${status.className}`} style={{ marginLeft: '0.3rem' }}>
                        {status.text}
                      </span>
                    );
                  })()}
                </p>
                <p><strong>状态：</strong> {
                  selectedDoc.status === 'pending' 
                    ? '⏳ 正在进行本地离线 OCR 解析...' 
                    : (selectedDoc.is_archived 
                        ? (contractTypes.includes(selectedDoc.document_type)
                            ? '✅ 已归档到本地台账.xlsx 并移动到归档目录' 
                            : '✅ 已移入归档目录相应合同子文件夹')
                        : '✅ 解析完成 (等待归档)')
                }</p>
                {selectedDoc.link_contract_id && (
                  <p>
                    <strong>自动关联合同：</strong>
                    <span style={{ color: '#059669', fontWeight: 600, marginLeft: '0.3rem' }}>
                      {(() => {
                        const linked = documents.find(d => d.id === selectedDoc.link_contract_id);
                        return linked ? linked.filename : "已归档的关联合同";
                      })()}
                    </span>
                  </p>
                )}
                {(selectedDoc.document_type === '收发货单' || selectedDoc.document_type === '收货单') && selectedDoc.status === 'processed' && (
                  <div style={{ background: 'rgba(22, 101, 52, 0.05)', padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid rgba(22, 101, 52, 0.15)', marginTop: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>收货确认状态：</span>
                      {(() => {
                        let extracted = {};
                        try { extracted = JSON.parse(selectedDoc.extracted_data || '{}'); } catch(e) {}
                        const isReceived = extracted['收货状态'] === '已收货';
                        return (
                          <span className={`doc-type-badge ${isReceived ? 'doc-type-archived-received' : 'doc-type-archived-not-received'}`} style={{ marginLeft: '0.4rem' }}>
                            {isReceived ? '✓ 已签字确认收货' : '✗ 暂无签字确认(未收货)'}
                          </span>
                        );
                      })()}
                    </div>
                    <button
                      onClick={() => handleToggleReceipt(selectedDoc.id)}
                      className="btn"
                      style={{ 
                        background: 'var(--primary)', 
                        color: 'white', 
                        border: 'none', 
                        padding: '0.3rem 0.8rem', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem', 
                        cursor: 'pointer',
                        fontWeight: 500
                      }}
                    >
                      {(() => {
                        let extracted = {};
                        try { extracted = JSON.parse(selectedDoc.extracted_data || '{}'); } catch(e) {}
                        return extracted['收货状态'] === '已收货' ? '标记为未收货' : '人工确认收货';
                      })()}
                    </button>
                  </div>
                )}
              </div>



              {selectedDoc.status === 'processed' && (
                <>
                  <div className="detail-section animate-fade-in">
                    <h3><Search size={20} /> 解析结果概要</h3>
                    <p style={{lineHeight: 1.6}}>{selectedDoc.summary}</p>
                  </div>

                  <div className="detail-section animate-fade-in">
                    <h3><FileStack size={20} /> 智能提取数据 (完全本地)</h3>
                    {renderExtractedData(selectedDoc.extracted_data)}
                  </div>
                </>
              )}
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Search size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
              <p>请在左侧选择一个文档查看详情</p>
              <p style={{fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem'}}>提示：您可以右键点击列表项打开菜单</p>
            </div>
          )}
        </div>
      </main>

                </div>
        )}


        {mainTab === 'invoice-archive' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Header info & Path Config card */}
            <div className="card glass" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>发票归档根目录</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', fontFamily: 'Consolas, monospace' }}>
                  {invoiceArchiveDir || '未配置归档目录'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={handleChooseInvoiceDir}>
                  <FolderOpen size={14} /> 选择目录
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={handleOpenInvoiceFolder}>
                  <FolderOpen size={14} /> 打开目录
                </button>
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={fetchInvoiceSubdirs}>
                  <RefreshCw size={14} /> 刷新
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div className="card glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(79, 70, 229, 0.1)', padding: '0.7rem', borderRadius: '10px', color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                  <FileStack size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>已归档发票</h4>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '1.3rem', fontWeight: 700 }}>
                    {archivedInvoicesCount} 张
                  </p>
                </div>
              </div>
              <div className="card glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(14, 165, 233, 0.1)', padding: '0.7rem', borderRadius: '10px', color: 'var(--secondary)', display: 'flex', alignItems: 'center' }}>
                  <CheckCircle size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>待归档发票</h4>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '1.3rem', fontWeight: 700 }}>
                    {documents.filter(d => d.source === 'invoice_archive' && !d.is_archived).length} 张
                  </p>
                </div>
              </div>
              <div className="card glass" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.7rem', borderRadius: '10px', color: '#10b981', display: 'flex', alignItems: 'center' }}>
                  <FileText size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>已就绪待归档</h4>
                  <p style={{ margin: '0.1rem 0 0 0', fontSize: '1.3rem', fontWeight: 700 }}>
                    {documents.filter(d => d.source === 'invoice_archive' && !d.is_archived && d.status === 'processed').length} 张
                  </p>
                </div>
              </div>
            </div>

            {/* Split Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.2rem', alignItems: 'start' }}>
              
              {/* Column 1: Config, upload, actions and console */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                
                {/* target directory choosing & input */}
                <div className="card glass" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                    <FolderOpen size={16} /> 1. 归档目标个人目录
                  </h3>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'block' }}>选择已有目录</label>
                    <select 
                      value={selectedSubdir} 
                      onChange={(e) => {
                        setSelectedSubdir(e.target.value);
                        setCustomSubdir('');
                      }}
                      className="form-control"
                      style={{ fontSize: '0.82rem', padding: '0.4rem' }}
                    >
                      <option value="">-- 选择已有个人目录 --</option>
                      {invoiceSubdirs.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ borderBottom: '1px solid var(--surface-border)', flex: 1 }}></div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>或</span>
                    <div style={{ borderBottom: '1px solid var(--surface-border)', flex: 1 }}></div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'block' }}>新建个人目录</label>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input 
                        type="text" 
                        placeholder="新姓名，如：张三"
                        value={customSubdir} 
                        onChange={(e) => setCustomSubdir(e.target.value)} 
                        className="form-control"
                        style={{ fontSize: '0.82rem', padding: '0.4rem', flex: 1 }}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                        onClick={async () => {
                          const name = customSubdir.trim();
                          if (!name) return;
                          try {
                            const res = await axios.post(`${API_BASE}/settings/invoice-subdirs`, { name });
                            if (res.data.status === 'success') {
                              const cleanName = res.data.name;
                              await fetchInvoiceSubdirs();
                              setSelectedSubdir(cleanName);
                              setCustomSubdir('');
                              addInvoiceLog(`已新建并选择个人目录: ${cleanName}`);
                            }
                          } catch (err) {
                            console.error(err);
                            const errMsg = err.response?.data?.detail || err.message;
                            alert(`新建个人目录失败: ${errMsg}`);
                          }
                        }}
                      >
                        确定
                      </button>
                    </div>
                  </div>
                </div>

                {/* upload area */}
                <div className="card glass" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                    <UploadCloud size={16} /> 2. 导入待处理发票
                  </h3>
                  
                  <input 
                    type="file" 
                    id="invoice-file-input" 
                    multiple 
                    onChange={handleInvoiceUpload} 
                    style={{ display: 'none' }} 
                    accept="image/*,application/pdf"
                  />
                  
                  <div 
                    className="upload-area"
                    style={{ 
                      minHeight: '130px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      border: '2px dashed var(--primary)',
                      borderRadius: '8px',
                      background: 'rgba(79, 70, 229, 0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      padding: '1rem'
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleInvoiceDrop}
                    onClick={() => document.getElementById('invoice-file-input').click()}
                  >
                    <UploadCloud size={28} className="upload-icon" style={{ color: 'var(--primary)', marginBottom: '0.4rem' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>点击选择或拖入发票文件</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>支持 PDF, PNG, JPG 格式</span>
                  </div>
                </div>

                {/* Operations & Log terminal */}
                <div className="card glass" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)' }}>
                    <Settings size={16} /> 3. 执行归档与日志
                  </h3>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                      onClick={handleBulkArchiveInvoices}
                      disabled={invoiceSelectedIds.length === 0}
                    >
                      <CheckSquare size={14} /> 批量归档发票 ({invoiceSelectedIds.length})
                    </button>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.5rem 0.8rem', fontSize: '0.8rem' }}
                      onClick={() => setInvoiceLogs([])}
                    >
                      清空日志
                    </button>
                  </div>

                  <div 
                    ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                    style={{ 
                      height: '180px', 
                      background: '#090d16', 
                      color: '#06b6d4', 
                      borderRadius: '6px', 
                      padding: '0.6rem', 
                      fontFamily: 'Consolas, monospace', 
                      fontSize: '0.72rem', 
                      overflowY: 'auto', 
                      border: '1px solid #1e293b',
                      lineHeight: '1.4'
                    }}
                  >
                    {invoiceLogs.length === 0 ? (
                      <div style={{ color: '#4b5563' }}>[SYSTEM] 发票报销工作台已就绪。请上传发票并选择归档路径。</div>
                    ) : (
                      invoiceLogs.map((log, i) => (
                        <div key={i} style={{ 
                          marginBottom: '2px', 
                          color: log.includes('[ERROR]') || log.includes('[失败]') ? '#ef4444' : 
                                 log.includes('[成功]') ? '#10b981' : '#06b6d4' 
                        }}>
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Workspace Right Pane: Table and Detail Panel stacked */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', minWidth: 0 }}>
                
                {/* Pending Table Card */}
                <div className="card glass" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <FileText size={18} /> 待处理发票列表
                    </h3>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      待归档: {documents.filter(d => d.source === 'invoice_archive' && !d.is_archived).length} 张
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                    {documents.filter(d => d.source === 'invoice_archive' && !d.is_archived).length === 0 ? (
                      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        暂无待处理的发票单据。请在左侧上传发票文件。
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--surface-border)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '0.5rem 0.3rem', width: '30px' }}>
                              <input 
                                type="checkbox"
                                checked={
                                  documents.filter(d => d.source === 'invoice_archive' && !d.is_archived && d.status === 'processed').length > 0 &&
                                  invoiceSelectedIds.length === documents.filter(d => d.source === 'invoice_archive' && !d.is_archived && d.status === 'processed').length
                                }
                                onChange={(e) => {
                                  const processedDocs = documents.filter(d => d.source === 'invoice_archive' && !d.is_archived && d.status === 'processed');
                                  if (e.target.checked) {
                                    setInvoiceSelectedIds(processedDocs.map(d => d.id));
                                  } else {
                                    setInvoiceSelectedIds([]);
                                  }
                                }}
                              />
                            </th>
                            <th style={{ padding: '0.5rem 0.3rem' }}>文件名</th>
                            <th style={{ padding: '0.5rem 0.3rem' }}>开票日期</th>
                            <th style={{ padding: '0.5rem 0.3rem' }}>发票内容</th>
                            <th style={{ padding: '0.5rem 0.3rem', textAlign: 'right' }}>合计金额</th>
                            <th style={{ padding: '0.5rem 0.3rem', textAlign: 'center' }}>状态</th>
                            <th style={{ padding: '0.5rem 0.3rem', textAlign: 'right' }}>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {documents.filter(d => d.source === 'invoice_archive' && !d.is_archived).map(doc => {
                            let ext = {};
                            try {
                              ext = JSON.parse(doc.extracted_data || '{}');
                            } catch(e) {}
                            
                            const isChecked = invoiceSelectedIds.includes(doc.id);
                            const isSelected = selectedInvoice?.id === doc.id;
                            
                            return (
                              <tr 
                                key={doc.id}
                                className="hover-row"
                                style={{ 
                                  borderBottom: '1px solid rgba(0,0,0,0.03)',
                                  background: isSelected ? 'rgba(79, 70, 229, 0.05)' : 'transparent',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleSelectInvoice(doc)}
                              >
                                <td style={{ padding: '0.5rem 0.3rem' }} onClick={(e) => e.stopPropagation()}>
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={doc.status !== 'processed'}
                                    onChange={() => {
                                      setInvoiceSelectedIds(prev => 
                                        prev.includes(doc.id) ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                                      );
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '0.5rem 0.3rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.filename}>
                                  {doc.filename}
                                </td>
                                <td style={{ padding: '0.5rem 0.3rem' }}>
                                  {doc.status === 'pending' ? '提取中...' : (ext["签订/开票日期"] || <span style={{ color: 'var(--accent)' }}>未提取</span>)}
                                </td>
                                <td style={{ padding: '0.5rem 0.3rem', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ext["发票内容"] || ext["产品明细"]}>
                                  {doc.status === 'pending' ? '提取中...' : (ext["发票内容"] || ext["产品明细"] || <span style={{ color: 'var(--accent)' }}>未提取</span>)}
                                </td>
                                <td style={{ padding: '0.5rem 0.3rem', textAlign: 'right', fontWeight: 600 }}>
                                  {doc.status === 'pending' ? '...' : (ext["价税合计金额"] ? `¥${ext["价税合计金额"]}` : <span style={{ color: 'var(--accent)' }}>未提取</span>)}
                                </td>
                                <td style={{ padding: '0.5rem 0.3rem', textAlign: 'center' }}>
                                  {doc.status === 'pending' ? (
                                    <span style={{ color: '#f59e0b', fontSize: '0.72rem' }}>解析中</span>
                                  ) : doc.status === 'error' ? (
                                    <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>失败</span>
                                  ) : (
                                    <span style={{ color: '#10b981', fontSize: '0.72rem' }}>已解析</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.5rem 0.3rem', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                  <div style={{ display: 'flex', gap: '0.2rem', justifyContent: 'flex-end' }}>
                                    <button 
                                      className="btn btn-primary" 
                                      style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                                      disabled={doc.status !== 'processed'}
                                      onClick={() => handleArchiveInvoice(doc)}
                                    >
                                      归档
                                    </button>
                                    <button 
                                      className="btn" 
                                      style={{ padding: '2px 6px', fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: 'none' }}
                                      onClick={() => handleDeleteDoc(doc.id)}
                                    >
                                      删除
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Form & Verification Panel */}
                {selectedInvoice && (
                  <div className="card glass" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--primary)' }}>发票人工审核与预览</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={selectedInvoice.filename}>{selectedInvoice.filename}</span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.2rem', alignItems: 'start' }}>
                        {/* Image/PDF Preview Pane */}
                        <div 
                          style={{ 
                            border: '1px solid var(--surface-border)', 
                            borderRadius: '6px', 
                            height: '380px', 
                            overflow: 'hidden', 
                            background: '#090d16',
                            position: 'relative',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}
                          onMouseDown={selectedInvoice.filename?.toLowerCase().endsWith('.pdf') || selectedInvoice.file_type?.includes('pdf') ? undefined : handleMouseDown}
                          onMouseMove={selectedInvoice.filename?.toLowerCase().endsWith('.pdf') || selectedInvoice.file_type?.includes('pdf') ? undefined : handleMouseMove}
                          onMouseUp={selectedInvoice.filename?.toLowerCase().endsWith('.pdf') || selectedInvoice.file_type?.includes('pdf') ? undefined : handleMouseUp}
                          onMouseLeave={selectedInvoice.filename?.toLowerCase().endsWith('.pdf') || selectedInvoice.file_type?.includes('pdf') ? undefined : handleMouseUp}
                          onWheel={selectedInvoice.filename?.toLowerCase().endsWith('.pdf') || selectedInvoice.file_type?.includes('pdf') ? undefined : handleWheel}
                        >
                          {selectedInvoice.filename?.toLowerCase().endsWith('.pdf') || selectedInvoice.file_type?.includes('pdf') ? (
                            <iframe 
                              src={`/api/documents/${selectedInvoice.id}/file`} 
                              style={{ width: '100%', height: '100%', border: 'none' }} 
                              title="PDF Preview"
                            />
                          ) : (
                            <img 
                              src={`/api/documents/${selectedInvoice.id}/file`} 
                              alt="Invoice Preview" 
                              style={{ 
                                maxWidth: '100%', 
                                maxHeight: '100%', 
                                objectFit: 'contain',
                                transform: `translate(${zoomOffset.x}px, ${zoomOffset.y}px) scale(${zoomScale})`,
                                cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                                userSelect: 'none',
                                pointerEvents: 'none'
                              }}
                            />
                          )}
                          
                          {/* Floating zoom controls for images */}
                          {!selectedInvoice.filename?.toLowerCase().endsWith('.pdf') && !selectedInvoice.file_type?.includes('pdf') && (
                            <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px', zIndex: 10, background: 'rgba(255,255,255,0.85)', padding: '4px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                              <button 
                                type="button" 
                                onClick={() => setZoomScale(prev => Math.min(prev + 0.25, 4.0))}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}
                                title="放大"
                              >
                                +
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  const newScale = Math.max(zoomScale - 0.25, 0.5);
                                  if (newScale <= 1) setZoomOffset({ x: 0, y: 0 });
                                  setZoomScale(newScale);
                                }}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}
                                title="缩小"
                              >
                                -
                              </button>
                              <button 
                                type="button" 
                                onClick={() => {
                                  setZoomScale(1);
                                  setZoomOffset({ x: 0, y: 0 });
                                }}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}
                                title="重置"
                              >
                                重置
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Edit fields & actions stacked on the right side of preview */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                开票日期 (文件名：日期)
                              </label>
                              <input 
                                type="text" 
                                className="form-control" 
                                style={{ fontSize: '0.78rem', padding: '0.35rem' }} 
                                value={invoiceFormFields["签订/开票日期"] || ''}
                                onChange={(e) => setInvoiceFormFields(prev => ({ ...prev, "签订/开票日期": e.target.value }))}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                发票内容 (文件名：内容描述)
                              </label>
                              <input 
                                type="text" 
                                className="form-control" 
                                style={{ fontSize: '0.78rem', padding: '0.35rem' }} 
                                value={invoiceFormFields["发票内容"] || ''}
                                onChange={(e) => setInvoiceFormFields(prev => ({ ...prev, "发票内容": e.target.value }))}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                价税合计金额 (元) (文件名：金额)
                              </label>
                              <input 
                                type="text" 
                                className="form-control" 
                                style={{ fontSize: '0.78rem', padding: '0.35rem' }} 
                                value={invoiceFormFields["价税合计金额"] || ''}
                                onChange={(e) => setInvoiceFormFields(prev => ({ ...prev, "价税合计金额": e.target.value }))}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                发票号码
                              </label>
                              <input 
                                type="text" 
                                className="form-control" 
                                style={{ fontSize: '0.78rem', padding: '0.35rem' }} 
                                value={invoiceFormFields["合同/发票编号"] || ''}
                                onChange={(e) => setInvoiceFormFields(prev => ({ ...prev, "合同/发票编号": e.target.value }))}
                              />
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                销售方
                              </label>
                              <input 
                                type="text" 
                                className="form-control" 
                                style={{ fontSize: '0.78rem', padding: '0.35rem' }} 
                                value={invoiceFormFields["出卖方/销售方"] || ''}
                                onChange={(e) => setInvoiceFormFields(prev => ({ ...prev, "出卖方/销售方": e.target.value }))}
                              />
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                购买方
                              </label>
                              <input 
                                type="text" 
                                className="form-control" 
                                style={{ fontSize: '0.78rem', padding: '0.35rem' }} 
                                value={invoiceFormFields["买受方/购买方"] || ''}
                                onChange={(e) => setInvoiceFormFields(prev => ({ ...prev, "买受方/购买方": e.target.value }))}
                              />
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                            <button 
                              className="btn btn-primary" 
                              style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}
                              disabled={selectedInvoice.status !== 'processed'}
                              onClick={() => handleArchiveInvoice(selectedInvoice)}
                            >
                              确认归档此单
                            </button>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem' }}
                              onClick={() => setSelectedInvoice(null)}
                            >
                              取消
                            </button>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {mainTab === "settings" && (
          <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <h2 style={{ margin: 0, fontFamily: "Outfit, sans-serif" }}>系统参数设置</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: 0 }}>配置软件的文件存储目录及自定义解析参数</p>
            </div>
{/* Directory Setting Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* File Archive Dir */}
              <div className="card glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', overflow: 'hidden' }}>
                  <FolderOpen size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>文件归档与合同台账目录：</span>
                    <code style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                      {archiveDir || '正在获取...'}
                    </code>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button 
                    onClick={handleChooseDir}
                    style={{ background: 'var(--primary)', border: 'none', cursor: 'pointer', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}
                  >
                    更改目录
                  </button>
                  <button 
                    onClick={handleOpenFolder}
                    style={{ background: 'transparent', border: '1px solid var(--primary)', cursor: 'pointer', color: 'var(--primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <FolderOpen size={14} /> 打开目录
                  </button>
                </div>
              </div>

              {/* Invoice Archive Dir */}
              <div className="card glass" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', overflow: 'hidden' }}>
                  <FileText size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>发票归档与发票台账目录：</span>
                    <code style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                      {invoiceArchiveDir || '正在获取...'}
                    </code>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button 
                    onClick={handleChooseInvoiceDir}
                    style={{ background: 'var(--primary)', border: 'none', cursor: 'pointer', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500 }}
                  >
                    更改目录
                  </button>
                  <button 
                    onClick={handleOpenInvoiceFolder}
                    style={{ background: 'transparent', border: '1px solid var(--primary)', cursor: 'pointer', color: 'var(--primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <FolderOpen size={14} /> 打开目录
                  </button>
                </div>
              </div>
            </div>

      {/* Document Types Manager Panel */}
      {true && (
        <div className="card glass animate-fade-in" style={{ padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', border: '1px solid rgba(79, 70, 229, 0.2)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={18} /> 文档类型与合同属性管理
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>
            自定义管理系统中的文件分类类型。勾选 <strong>“视为合同类”</strong> 的文件类型在归档时会视为合同建档，自动录入本地 Excel 台账。
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.8rem', marginBottom: '1.2rem' }}>
            {documentTypes.map(typeName => {
              const isDefault = ['合同', '发票', '收发货单', '回款凭证', '其他'].includes(typeName);
              const isContract = contractTypes.includes(typeName);
              return (
                <div 
                  key={typeName} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '0.6rem 0.8rem', 
                    background: 'rgba(255, 255, 255, 0.4)', 
                    borderRadius: '8px', 
                    border: '1px solid rgba(0,0,0,0.06)' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.88rem' }}>{typeName}</span>
                    {isDefault && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.05)', padding: '1px 4px', borderRadius: '3px' }}>内置</span>}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0 }}>
                      <input 
                        type="checkbox" 
                        checked={isContract} 
                        onChange={() => handleToggleContractType(typeName)}
                        disabled={typeName === '合同' || typeName === '销售合同'}
                        style={{ cursor: 'pointer' }}
                      />
                      视为合同类
                    </label>
                    
                    {!isDefault && (
                      <button 
                        onClick={() => handleRemoveDocumentType(typeName)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: '#ef4444', 
                          cursor: 'pointer', 
                          padding: '2px', 
                          display: 'flex', 
                          alignItems: 'center' 
                        }}
                        title="删除此类型"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div style={{ display: 'flex', gap: '0.6rem', maxWidth: '420px' }}>
            <input 
              type="text" 
              placeholder="新增文件类型名称 (如: 技术协议)" 
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDocumentType()}
              className="form-control"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            />
            <button 
              onClick={handleAddDocumentType}
              disabled={isSavingTypes || !newTypeName.trim()}
              className="btn btn-primary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
            >
              {isSavingTypes ? '保存中...' : '添加类型'}
            </button>
          </div>
        </div>
      )}

                </div>
        )}
      </div>

{/* Custom Context Menu */}
      {contextMenu.visible && (
        <div 
          className="context-menu" 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} 
        >
          <div className="context-menu-item" onClick={() => deleteSingle(contextMenu.docId)}>
            <Trash2 size={16} /> 删除此文档
          </div>
          <div className="context-menu-divider"></div>
          <div className="context-menu-item" onClick={handleSelectAll}>
            <CheckSquare size={16} /> 全选 / 取消全选
          </div>
          {selectedIds.length > 1 && (
            <div className="context-menu-item danger" onClick={deleteSelected}>
              <Trash2 size={16} /> 批量删除已选 ({selectedIds.length})
            </div>
          )}
        </div>
      )}

      {/* Archive Confirmation & Edit Modal */}
      {archiveModal.visible && (
        <div className="modal-overlay" onClick={handleArchiveCancel}>
          <div className="modal-content" style={{ maxWidth: '1100px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckSquare /> 核对并确认归档数据
            </h2>
            
            {archiveModal.index !== -1 && archiveModal.queue && archiveModal.queue.length > 1 && (
              <div style={{ background: 'rgba(79, 70, 229, 0.08)', padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>
                批量归档进度：第 {archiveModal.index + 1} 个，共 {archiveModal.queue.length} 个文档
              </div>
            )}
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              以下为本地 OCR 提取的信息，写入本地 Excel 台账前，您可以进行人工核对与修正：
            </p>
            
            {duplicateWarning && (
              <div style={{ 
                background: '#fee2e2', 
                border: '1px solid #fca5a5', 
                padding: '0.8rem 1.2rem', 
                borderRadius: '8px', 
                marginBottom: '1.2rem', 
                fontSize: '0.9rem', 
                color: '#b91c1c', 
                fontWeight: 600, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem' 
              }}>
                ⚠️ {duplicateWarning}
              </div>
            )}

            
            <div className="modal-split-layout" style={{ display: 'flex', gap: '2rem', maxHeight: 'calc(80vh - 12rem)', minHeight: '480px', overflow: 'hidden', marginBottom: '1.5rem' }}>
              {/* Left Column: Preview */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', padding: '1rem', border: '1px solid var(--surface-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600 }}>
                    原文件预览 ({archiveModal.doc?.filename})
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {isCropOcrMode && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginRight: '0.8rem', background: 'rgba(79, 70, 229, 0.05)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(79, 70, 229, 0.1)' }}>
                        💡 按住 Shift 拖动可平移，滚轮可缩放
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsCropOcrMode(!isCropOcrMode);
                        setCropBox(null);
                        setShowFieldsMenu(null);
                        // Reset zoom/pan when toggling Crop OCR mode so it starts centered
                        setZoomScale(1);
                        setZoomOffset({ x: 0, y: 0 });
                      }}
                      className={`btn ${isCropOcrMode ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      {isCropOcrMode ? '✓ 框选识别模式' : '🔍 局部框选识别'}
                    </button>
                  </div>
                </div>
                <div 
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    overflow: 'hidden', 
                    background: '#fff', 
                    borderRadius: '4px', 
                    border: '1px solid #e2e8f0',
                    position: 'relative'
                  }}
                  onMouseDown={isCropOcrMode ? undefined : handleMouseDown}
                  onMouseMove={isCropOcrMode ? undefined : handleMouseMove}
                  onMouseUp={isCropOcrMode ? undefined : handleMouseUp}
                  onMouseLeave={isCropOcrMode ? undefined : handleMouseUp}
                  onWheel={isCropOcrMode ? undefined : handleWheel}
                >
                  {isCropOcrMode ? (
                    archiveModal.doc && (
                      <div 
                        style={{ 
                          position: 'relative', 
                          display: 'inline-block', 
                          maxWidth: '100%', 
                          maxHeight: '100%',
                          aspectRatio: cropImageAspectRatio || 'auto',
                          transform: `translate(${zoomOffset.x}px, ${zoomOffset.y}px) scale(${zoomScale})`,
                          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                          transformOrigin: 'center center'
                        }}
                        onMouseDown={handleCropMouseDown}
                        onMouseMove={handleCropMouseMove}
                        onMouseUp={handleCropMouseUp}
                        onMouseLeave={handleCropMouseUp}
                        onWheel={handleWheel}
                      >
                        <img 
                          ref={imgRef}
                          src={`/api/documents/${archiveModal.doc.id}/page-image?t=${Date.now()}`} 
                          alt="Crop OCR source" 
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            display: 'block',
                            pointerEvents: 'none',
                            userSelect: 'none',
                            cursor: 'crosshair'
                          }} 
                          draggable="false"
                          onLoad={(e) => {
                            setCropImageAspectRatio(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight);
                          }}
                        />
                        {cropBox && (
                          <div 
                            className="crop-overlay-box"
                            style={{
                              position: 'absolute',
                              border: '2px dashed var(--primary)',
                              background: 'rgba(79, 70, 229, 0.15)',
                              left: `${cropBox.x * 100}%`,
                              top: `${cropBox.y * 100}%`,
                              width: `${cropBox.w * 100}%`,
                              height: `${cropBox.h * 100}%`,
                              pointerEvents: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        )}
                      </div>
                    )
                  ) : (
                    archiveModal.doc && (archiveModal.doc.file_type?.includes('pdf') || archiveModal.doc.filename?.toLowerCase().endsWith('.pdf')) ? (
                      <iframe 
                        src={`/api/documents/${archiveModal.doc.id}/file`} 
                        style={{ width: '100%', height: '100%', minHeight: '400px', border: 'none' }} 
                        title="PDF Preview"
                      />
                    ) : (
                      archiveModal.doc && (
                        <img 
                          src={`/api/documents/${archiveModal.doc.id}/file`} 
                          alt="Original preview" 
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '100%', 
                            objectFit: 'contain',
                            transform: `translate(${zoomOffset.x}px, ${zoomOffset.y}px) scale(${zoomScale})`,
                            cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                            userSelect: 'none',
                            pointerEvents: 'none'
                          }} 
                        />
                      )
                    )
                  )}

                  {/* Floating zoom controls for images & crop mode */}
                  {archiveModal.doc && (!archiveModal.doc.file_type?.includes('pdf') && !archiveModal.doc.filename?.toLowerCase().endsWith('.pdf') || isCropOcrMode) && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '5px', zIndex: 10, background: 'rgba(255,255,255,0.85)', padding: '4px', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                      <button 
                        type="button" 
                        onClick={() => setZoomScale(prev => Math.min(prev + 0.25, 4.0))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}
                        title="放大"
                      >
                        +
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setZoomScale(prev => {
                            const next = Math.max(prev - 0.25, 0.5);
                            if (next <= 1) {
                              setZoomOffset({ x: 0, y: 0 });
                            }
                            return next;
                          });
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}
                        title="缩小"
                      >
                        -
                      </button>
                      <button 
                        type="button" 
                        onClick={() => {
                          setZoomScale(1);
                          setZoomOffset({ x: 0, y: 0 });
                        }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}
                        title="重置"
                      >
                        重置
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Right Column: Fields (Scrollable) */}
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', maxHeight: '100%' }}>
                <div className="form-group">
                  <label>文档类型</label>
                  <select 
                    className="form-control" 
                    value={archiveModal.fields.document_type}
                    onChange={(e) => handleArchiveFieldChange('document_type', e.target.value)}
                  >
                    {documentTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {!contractTypes.includes(archiveModal.fields.document_type) && (
                  <div className="form-group" style={{ background: 'rgba(79, 70, 229, 0.04)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(79, 70, 229, 0.15)', marginBottom: '1.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>关联归档合同 (关联后该单据将移入所选合同的归档目录下)</span>
                      <button 
                        type="button" 
                        onClick={fetchCandidateContracts} 
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem', padding: 0 }}
                        title="重新获取归档合同"
                      >
                        <RefreshCw size={14} /> 刷新
                      </button>
                    </label>
                    {candidateContracts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <select
                          className="form-control"
                          value={selectedContractId || ''}
                          onChange={(e) => setSelectedContractId(e.target.value ? parseInt(e.target.value) : null)}
                          style={{ width: '100%', padding: '0.4rem' }}
                        >
                          <option value="">-- 不关联任何合同（作为独立单据归档） --</option>
                          {candidateContracts.map(c => {
                            const isRec = c.id === candidateContracts[0]?.id && c.buyer_match && c.date_diff_days !== null && c.date_diff_days <= 30;
                            const matchLabels = [];
                            if (c.buyer_match) matchLabels.push("名称已匹配");
                            if (c.amount_match) matchLabels.push("金额已匹配");
                            if (c.product_match) matchLabels.push("商品产品名称数量已匹配");
                            const matchStr = matchLabels.length > 0 ? ` [${matchLabels.join(" | ")}]` : "";

                            return (
                              <option key={c.id} value={c.id}>
                                {isRec ? '★ [推荐] ' : ''}
                                {c.date} | {c.buyer} | 金额: ¥{c.amount} (天数差: {c.date_diff_days !== null ? `${c.date_diff_days}天` : '未知'}){matchStr}
                              </option>
                            );
                          })}
                        </select>
                        {selectedContractId && (
                          <p style={{ fontSize: '0.8rem', color: '#059669', margin: '0.2rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 500 }}>
                            <span>✓ 已关联：</span>
                            <span>{candidateContracts.find(c => c.id === selectedContractId)?.filename}</span>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
                          系统中暂无已归档的合同，此单据将作为独立单据进行归档。
                        </p>
                        <button 
                          type="button" 
                          onClick={fetchCandidateContracts} 
                          style={{ background: 'none', border: '1px solid var(--primary)', borderRadius: '4px', color: 'var(--primary)', cursor: 'pointer', padding: '2px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                        >
                          <RefreshCw size={10} /> 刷新
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {(archiveModal.fields.document_type === '收发货单' || archiveModal.fields.document_type === '收货单') && (
                  <div className="form-group" style={{ background: 'rgba(22, 101, 52, 0.04)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(22, 101, 52, 0.15)', marginBottom: '1.2rem' }}>
                    <label style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.5rem', display: 'block' }}>
                      收货确认状态 (请人工确认收货单上是否有手写签字)
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => handleArchiveFieldChange('收货状态', '已收货')}
                        className={`btn ${archiveModal.fields['收货状态'] === '已收货' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.4rem 1rem', fontSize: '0.82rem', borderRadius: '20px' }}
                      >
                        ✓ 已签字确认收货
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveFieldChange('收货状态', '未收货')}
                        className={`btn ${archiveModal.fields['收货状态'] === '未收货' || !archiveModal.fields['收货状态'] ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.4rem 1rem', fontSize: '0.82rem', borderRadius: '20px' }}
                      >
                        ✗ 暂无签字确认 (未收货)
                      </button>
                    </div>
                  </div>
                )}


                {contractTypes.includes(archiveModal.fields.document_type) && (
                  <div className="form-group">
                    <label>盖章状态 (人工确认，"双方盖章"与"合同已生效"可同时选)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {['未盖章', '单方盖章', '双方盖章', '合同已生效', '无法确认'].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => handleToggleSealStatus(status)}
                          className={`btn ${isStatusSelected(status) ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', borderRadius: '20px' }}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>合同/发票编号</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={archiveModal.fields['合同/发票编号']}
                    onChange={(e) => handleArchiveFieldChange('合同/发票编号', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>出卖方 / 销售方</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={archiveModal.fields['出卖方/销售方']}
                    onChange={(e) => handleArchiveFieldChange('出卖方/销售方', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>买受方 / 购买方</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={archiveModal.fields['买受方/购买方']}
                    onChange={(e) => handleArchiveFieldChange('买受方/购买方', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>签订 / 开票日期</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={archiveModal.fields['签订/开票日期']}
                    onChange={(e) => handleArchiveFieldChange('签订/开票日期', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>价税合计金额 (小写)</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={archiveModal.fields['价税合计金额']}
                    onChange={(e) => handleArchiveFieldChange('价税合计金额', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>产品明细</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={archiveModal.fields['产品明细']}
                    onChange={(e) => handleArchiveFieldChange('产品明细', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="form-group">
                  <label>备注</label>
                  <input 
                    type="text" 
                    className="form-control"
                    value={archiveModal.fields['备注']}
                    onChange={(e) => handleArchiveFieldChange('备注', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>解析结果概要</label>
                  <textarea 
                    className="form-control"
                    rows="2"
                    value={archiveModal.fields.summary}
                    onChange={(e) => handleArchiveFieldChange('summary', e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              {archiveModal.index !== -1 && archiveModal.queue && archiveModal.queue.length > 1 && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handleArchiveSkip}
                  style={{ marginRight: 'auto', color: 'var(--accent)', borderColor: 'var(--accent)' }}
                >
                  跳过此文档
                </button>
              )}
              <button 
                className="btn btn-secondary" 
                onClick={handleArchiveCancel}
              >
                取消
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleArchiveSubmit}
              >
                <CheckCircle size={16} /> 
                {archiveModal.index !== -1 && archiveModal.queue && archiveModal.index < archiveModal.queue.length - 1 
                  ? '确认归档，核对下一个' 
                  : '确认并写入本地台账'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showFieldsMenu && (
        <div 
          className="crop-floating-menu"
          style={{
            position: 'fixed',
            left: `${showFieldsMenu.x}px`,
            top: `${showFieldsMenu.y}px`,
            zIndex: 9999,
            background: 'var(--surface)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid var(--surface-border)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.15)',
            padding: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            minWidth: '180px'
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.2rem 0.5rem', borderBottom: '1px solid var(--surface-border)', marginBottom: '0.2rem', fontWeight: 600 }}>
            {isCropOcrLoading ? '识别中...' : '选择字段填入 OCR 结果：'}
          </div>
          {[
            { label: '合同/发票编号', key: '合同/发票编号' },
            { label: '出卖方/销售方', key: '出卖方/销售方' },
            { label: '买受方/购买方', key: '买受方/购买方' },
            { label: '签订/开票日期', key: '签订/开票日期' },
            { label: '价税合计金额', key: '价税合计金额' },
            { label: '产品明细', key: '产品明细' },
            { label: '备注', key: '备注' },
            { label: '解析结果概要', key: 'summary' }
          ].map(field => (
            <button
              key={field.key}
              type="button"
              disabled={isCropOcrLoading}
              onClick={() => handleCropOcrSubmit(field.key)}
              className="crop-menu-item"
              style={{
                background: 'none',
                border: 'none',
                textAlign: 'left',
                padding: '0.4rem 0.6rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
                borderRadius: '4px',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'background 0.2s'
              }}
            >
              <span>{field.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setCropBox(null);
              setShowFieldsMenu(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              textAlign: 'center',
              padding: '0.4rem 0.6rem',
              fontSize: '0.82rem',
              cursor: 'pointer',
              borderRadius: '4px',
              color: 'var(--accent)',
              marginTop: '0.2rem',
              borderTop: '1px solid var(--surface-border)',
              fontWeight: 500
            }}
          >
            取消选择
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
