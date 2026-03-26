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

  // 检测是否为手机端
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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
      color: category?.color || '#0abfb6',
      name: category?.name || '未分类',
    };
  };

  // 长按开始（仅手机端）
  const handleLongPressStart = (billId: string) => {
    if (!isMobile) return;
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
  const toggleSelect = (billId: string, e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    if (!isSelectMode) {
      setIsSelectMode(true);
    }
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

  // 点击 checkbox
  const handleCheckboxClick = (billId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelect(billId, e);
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
      {/* 头部 - 参考图片4风格 */}
      <div className="page-header">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h1>今日收支</h1>
          {isSelectMode ? (
            <button
              onClick={cancelSelect}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-color)',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              取消
            </button>
          ) : (
            <button
              onClick={() => navigate('/settings')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-color)',
                fontSize: '14px',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              筛选
            </button>
          )}
        </div>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {/* 收支结余卡片 - 参考图片4风格 */}
        <div className="card" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
            }}>
              💰
            </div>
            <div>
              <div style={{
                fontSize: '18px',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}>
                收支结余
              </div>
              <div style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginTop: '4px',
              }}>
                本月 {formatAmount(monthStats.total)}
              </div>
            </div>
          </div>
          {!isSelectMode && (
            <button
              onClick={() => navigate('/manual')}
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                fontSize: '14px',
              }}
            >
              新增
            </button>
          )}
        </div>

        {/* 快捷操作 */}
        {!isSelectMode && (
          <div style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
          }}>
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
            boxShadow: 'var(--shadow-sm)',
            border: '1px solid var(--border-light)',
          }}>
            <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
              已选择 {selectedIds.size} 条
            </span>
            <button
              className="btn btn-primary"
              style={{
                padding: '8px 16px',
                fontSize: '13px',
              }}
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
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginBottom: '12px',
          }}>
            {isMobile ? '点击记录编辑 · 长按多选删除' : '点击记录编辑 · 点击checkbox多选删除'}
          </div>
        )}

        {/* 账单列表 - 参考图片4风格 */}
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
          <div className="card" style={{ padding: '0' }}>
            {Object.entries(groupedBills)
              .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
              .map(([date, dateBills], groupIndex) => (
              <div key={date}>
                {/* 日期分隔 */}
                <div style={{
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  padding: '12px 16px',
                  background: 'var(--bg-primary)',
                  fontWeight: 500,
                }}>
                  {formatDate(date)}
                </div>
                {/* 账单列表 */}
                {dateBills.map((bill, billIndex) => {
                  const catInfo = getCategoryInfo(bill.category);
                  const isSelected = selectedIds.has(bill.id);
                  const displayIndex = groupIndex * 100 + billIndex + 1;

                  return (
                    <div
                      key={bill.id}
                      className="list-item"
                      onClick={() => handleClick(bill)}
                      onTouchStart={() => handleLongPressStart(bill.id)}
                      onTouchEnd={handleLongPressEnd}
                      onTouchCancel={handleLongPressEnd}
                      onMouseDown={() => handleLongPressStart(bill.id)}
                      onMouseUp={handleLongPressEnd}
                      onMouseLeave={handleLongPressEnd}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'var(--primary-light)' : 'white',
                        margin: '0 16px',
                        padding: '16px 0',
                      }}
                    >
                      {/* 多选框 */}
                      {isSelectMode && (
                        <div
                          onClick={(e) => handleCheckboxClick(bill.id, e)}
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            border: `2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                            background: isSelected ? 'var(--primary-color)' : 'transparent',
                            marginRight: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          {isSelected && (
                            <span style={{ color: 'white', fontSize: '12px' }}>✓</span>
                          )}
                        </div>
                      )}

                      {/* 序号 */}
                      {!isSelectMode && (
                        <span style={{
                          width: '28px',
                          fontSize: '15px',
                          color: 'var(--text-secondary)',
                          flexShrink: 0,
                        }}>
                          {displayIndex}
                        </span>
                      )}

                      {/* 图标和描述 */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        flex: 1,
                        minWidth: 0,
                      }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: catInfo.color + '15',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '18px',
                          flexShrink: 0,
                        }}>
                          {catInfo.icon}
                        </div>
                        <div style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          <div style={{
                            fontSize: '15px',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                          }}>
                            {bill.description}
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                          }}>
                            {catInfo.name}
                          </div>
                        </div>
                      </div>

                      {/* 金额 */}
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 600,
                        color: bill.amount < 0 ? 'var(--accent-success)' : 'var(--text-primary)',
                        flexShrink: 0,
                        marginLeft: '12px',
                      }}>
                        {bill.amount < 0 ? '+' : '-'}
                        ¥{formatAmount(Math.abs(bill.amount))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default HomePage;
