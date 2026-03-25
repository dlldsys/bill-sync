import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SwipeAction, Modal } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useBillStore, useCategoryStore } from '../../stores';
import { formatAmount, formatDate, getToday } from '../../utils';
import { BillRecord } from '../../types';

function HomePage() {
  const navigate = useNavigate();
  const bills = useBillStore((state) => state.bills);
  const deleteBill = useBillStore((state) => state.deleteBill);
  const categories = useCategoryStore((state) => state.categories);

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

  // 删除账单
  const handleDelete = (bill: BillRecord) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条账单吗？',
      onConfirm: () => deleteBill(bill.id),
    });
  };

  return (
    <div className="page">
      {/* 头部 */}
      <div className="page-header">
        <h1>账单</h1>
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
                return (
                  <SwipeAction
                    key={bill.id}
                    rightActions={[
                      {
                        key: 'delete',
                        text: '删除',
                        color: '#F4333C',
                        onClick: () => handleDelete(bill),
                      },
                    ]}
                  >
                    <div className="bill-card">
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
                  </SwipeAction>
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
