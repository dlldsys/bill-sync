import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../../components/BottomNav';
import { useBillStore, useCategoryStore } from '../../stores';
import { formatAmount, formatDate, getToday } from '../../utils';
import { BillRecord } from '../../types';
import { useToast } from '../../components/CustomToast';

function HomePage() {
  const navigate = useNavigate();
  const bills = useBillStore((state) => state.bills);
  const deleteBill = useBillStore((state) => state.deleteBill);
  const categories = useCategoryStore((state) => state.categories);
  const toast = useToast();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  // 获取今日消费统计
  const todayStats = useMemo(() => {
    const today = getToday();
    const todayBills = bills.filter((b) => b.date.startsWith(today) && b.amount > 0);
    const total = todayBills.reduce((sum, b) => sum + b.amount, 0);
    return { count: todayBills.length, total };
  }, [bills]);

  // 获取月度消费统计
  const monthStats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthBills = bills.filter((b) => b.date >= monthStart && b.amount > 0);
    const total = monthBills.reduce((sum, b) => sum + b.amount, 0);
    return { count: monthBills.length, total };
  }, [bills]);

  // 按日期分组账单
  const groupedBills = useMemo(() => {
    const groups: Record<string, BillRecord[]> = {};
    bills.forEach((bill) => {
      const date = bill.date.split('T')[0];
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(bill);
    });
    return groups;
  }, [bills]);

  // 获取分类信息
  const getCategoryInfo = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return {
      icon: category?.icon || '📦',
      color: category?.color || '#85929E',
      name: category?.name || '未分类',
    };
  };

  // 长按开始
  const handleLongPressStart = (billId: string) => {
    longPressTimer.current = window.setTimeout(() => {
      setIsSelectMode(true);
      setSelectedIds(new Set([billId]));
    }, 500);
  };

  // 长按取消
  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 切换选中
  const toggleSelect = (billId: string) => {
    if (!isSelectMode) return;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(billId)) {
      newSelected.delete(billId);
      if (newSelected.size === 0) {
        setIsSelectMode(false);
      }
    } else {
      newSelected.add(billId);
    }
    setSelectedIds(newSelected);
  };

  // 点击记录
  const handleClick = (bill: BillRecord) => {
    if (isSelectMode) {
      toggleSelect(bill.id);
    } else {
      navigate(`/edit/${bill.id}`);
    }
  };

  // 删除选中记录
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条记录吗？`)) return;

    try {
      await Promise.all(Array.from(selectedIds).map((id) => deleteBill(id)));
      toast.show(`已删除 ${selectedIds.size} 条记录`, 'success');
      setSelectedIds(new Set());
      setIsSelectMode(false);
    } catch (error) {
      console.error('Delete failed:', error);
      toast.show('删除失败', 'fail');
    }
  };

  // 取消选择
  const cancelSelect = () => {
    setSelectedIds(new Set());
    setIsSelectMode(false);
  };

  return (
    <div className="page">
      {/* 头部 */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>账单</h1>
          {isSelectMode && (
            <button
              onClick={cancelSelect}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '14px',
              }}
            >
              取消
            </button>
          )}
        </div>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {/* 统计卡片 */}
        <div className="stats-card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div className="stats-title">今日消费</div>
              <div className="stats-value">{formatAmount(todayStats.total)}</div>
              <div className="stats-sub">{todayStats.count} 笔</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="stats-title">本月消费</div>
              <div className="stats-value">{formatAmount(monthStats.total)}</div>
              <div className="stats-sub">{monthStats.count} 笔</div>
            </div>
          </div>
        </div>

        {/* 快捷操作 */}
        {!isSelectMode && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={() => navigate('/manual')}
            >
              + 记一笔
            </button>
            <button
              className="btn btn-outline"
              style={{ flex: 1 }}
              onClick={() => navigate('/import')}
            >
              📷 拍照识别
            </button>
          </div>
        )}

        {/* 多选操作栏 */}
        {isSelectMode && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'white',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <span style={{ fontSize: '14px', color: '#333' }}>
              已选择 {selectedIds.size} 条
            </span>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 16px' }}
              onClick={handleDeleteSelected}
            >
              删除
            </button>
          </div>
        )}

        {/* 提示文字 */}
        {!isSelectMode && Object.keys(groupedBills).length > 0 && (
          <div style={{
            fontSize: '12px',
            color: '#999',
            textAlign: 'center',
            marginBottom: '12px',
          }}>
            点击记录编辑 · 长按多选删除
          </div>
        )}

        {/* 账单列表 */}
        {Object.keys(groupedBills).length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <div className="empty-text">暂无账单记录</div>
            <div style={{ marginTop: '16px' }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/manual')}
              >
                添加第一笔
              </button>
            </div>
          </div>
        ) : (
          Object.entries(groupedBills).map(([date, dateBills]) => (
            <div key={date} style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '13px',
                  color: '#999',
                  marginBottom: '8px',
                  padding: '0 4px',
                }}
              >
                {formatDate(date)}
              </div>
              {dateBills.map((bill) => {
                const catInfo = getCategoryInfo(bill.category);
                const isSelected = selectedIds.has(bill.id);
                return (
                  <div
                    key={bill.id}
                    className="bill-card"
                    onClick={() => handleClick(bill)}
                    onTouchStart={() => handleLongPressStart(bill.id)}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                    onMouseDown={() => handleLongPressStart(bill.id)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    style={{
                      cursor: 'pointer',
                      borderLeft: isSelected ? '3px solid #667eea' : undefined,
                      background: isSelected ? '#f0f5ff' : undefined,
                    }}
                  >
                    {/* 多选框 */}
                    {isSelectMode && (
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: `2px solid ${isSelected ? '#667eea' : '#ddd'}`,
                        background: isSelected ? '#667eea' : 'transparent',
                        marginRight: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isSelected && (
                          <span style={{ color: 'white', fontSize: '12px' }}>✓</span>
                        )}
                      </div>
                    )}
                    <div
                      className="bill-icon"
                      style={{ backgroundColor: catInfo.color + '20' }}
                    >
                      {catInfo.icon}
                    </div>
                    <div className="bill-info">
                      <div className="bill-description">{bill.description}</div>
                      <div className="bill-meta">{catInfo.name}</div>
                    </div>
                    <div className={`bill-amount ${bill.amount < 0 ? 'income' : ''}`}>
                      {bill.amount < 0 ? '+' : '-'}
                      {formatAmount(Math.abs(bill.amount))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default HomePage;
