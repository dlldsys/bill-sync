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
  const [showSelectModal, setShowSelectModal] = useState(false);
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

  // 打开多选弹窗（仅电脑端）
  const openSelectModal = () => {
    setShowSelectModal(true);
  };

  // 关闭多选弹窗
  const closeSelectModal = () => {
    setShowSelectModal(false);
    setSelectedIds(new Set());
  };

  // 全选
  const selectAll = () => {
    setSelectedIds(new Set(bills.map(b => b.id)));
  };

  // 取消全选
  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // 确认选择并进入多选模式
  const confirmSelection = () => {
    if (selectedIds.size > 0) {
      setIsSelectMode(true);
      setShowSelectModal(false);
    } else {
      toast.show('请先选择要操作的记录', 'warning');
    }
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
          <>
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
            {/* 电脑端多选按钮 */}
            {!isMobile && Object.keys(groupedBills).length > 0 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '12px',
              }}>
                <button
                  onClick={openSelectModal}
                  style={{
                    background: 'rgba(10, 191, 202, 0.1)',
                    border: '1px solid var(--primary-color)',
                    borderRadius: '20px',
                    padding: '8px 20px',
                    color: 'var(--primary-color)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  ☑️ 批量选择
                </button>
              </div>
            )}
          </>
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

      {/* 电脑端多选弹窗 */}
      {showSelectModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* 弹窗标题 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div style={{ fontSize: '18px', fontWeight: 600 }}>
                选择要操作的记录
              </div>
              <button
                onClick={closeSelectModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                ×
              </button>
            </div>

            {/* 全选/取消全选按钮 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '12px',
              gap: '8px',
            }}>
              <button
                onClick={selectAll}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'var(--primary-light)',
                  border: '1px solid var(--primary-color)',
                  borderRadius: '6px',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                全选
              </button>
              <button
                onClick={deselectAll}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                取消全选
              </button>
            </div>

            {/* 已选数量提示 */}
            <div style={{
              fontSize: '14px',
              color: 'var(--primary-color)',
              marginBottom: '12px',
              textAlign: 'center',
            }}>
              已选择 {selectedIds.size} 条记录
            </div>

            {/* 账单列表 */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              maxHeight: '400px',
              border: '1px solid #eee',
              borderRadius: '8px',
            }}>
              {bills
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((bill) => {
                  const catInfo = getCategoryInfo(bill.category);
                  const isSelected = selectedIds.has(bill.id);
                  const billDate = bill.date.split('T')[0];

                  return (
                    <div
                      key={bill.id}
                      onClick={() => toggleSelect(bill.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        borderBottom: '1px solid #f0f0f0',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--primary-light)' : 'white',
                      }}
                    >
                      {/* 选择框 */}
                      <div
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? 'var(--primary-color)' : '#ddd'}`,
                          background: isSelected ? 'var(--primary-color)' : 'transparent',
                          marginRight: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && (
                          <span style={{ color: 'white', fontSize: '12px' }}>✓</span>
                        )}
                      </div>

                      {/* 图标 */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: catInfo.color + '15',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        marginRight: '10px',
                        flexShrink: 0,
                      }}>
                        {catInfo.icon}
                      </div>

                      {/* 描述和分类 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {bill.description}
                        </div>
                        <div style={{ fontSize: '12px', color: '#999' }}>
                          {catInfo.name} · {formatDate(billDate)}
                        </div>
                      </div>

                      {/* 金额 */}
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: bill.amount < 0 ? 'var(--accent-success)' : 'var(--text-primary)',
                        flexShrink: 0,
                        marginLeft: '8px',
                      }}>
                        {bill.amount < 0 ? '+' : '-'}
                        ¥{formatAmount(Math.abs(bill.amount))}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* 确认按钮 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '16px',
            }}>
              <button
                onClick={closeSelectModal}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                取消
              </button>
              <button
                onClick={confirmSelection}
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={selectedIds.size === 0}
              >
                确认 ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HomePage;
