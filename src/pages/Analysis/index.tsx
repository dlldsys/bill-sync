import React, { useMemo, useState } from 'react';
import BottomNav from '../../components/BottomNav';
import { useBillStore, useCategoryStore } from '../../stores';
import { formatAmount } from '../../utils';
import type { BillRecord } from '../../types';

type ViewMode = 'week' | 'month' | 'year';

interface WeekGroup {
  weekLabel: string;
  weekStart: Date;
  weekEnd: Date;
  bills: BillRecord[];
  total: number;
}

interface MonthGroup {
  monthLabel: string;
  month: number;
  year: number;
  bills: BillRecord[];
  total: number;
}

// 获取某天所在周的周一
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// 获取两个日期之间的天数
function daysBetween(start: Date, end: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / oneDay);
}

// 格式化日期范围
function formatDateRange(start: Date, end: Date): string {
  const startStr = `${start.getMonth() + 1}/${start.getDate()}`;
  const endStr = `${end.getMonth() + 1}/${end.getDate()}`;
  return `${startStr} - ${endStr}`;
}

function AnalysisPage() {
  const bills = useBillStore((state) => state.bills);
  const categories = useCategoryStore((state) => state.categories);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 获取当前视图的时间范围标签
  const getTimeLabel = (): string => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    
    if (viewMode === 'week') {
      const weekStart = getWeekStart(selectedDate);
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      return `${year}年${formatDateRange(weekStart, weekEnd)}`;
    } else if (viewMode === 'month') {
      return `${year}年${month}月`;
    } else {
      return `${year}年`;
    }
  };

  // 获取上一个时间单位
  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() - 1);
    }
    setSelectedDate(newDate);
    setExpandedGroups(new Set());
  };

  // 获取下一个时间单位
  const goToNext = () => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setFullYear(newDate.getFullYear() + 1);
    }
    setSelectedDate(newDate);
    setExpandedGroups(new Set());
  };

  // 判断是否是当前时间单位
  const isCurrentPeriod = (): boolean => {
    const now = new Date();
    if (viewMode === 'week') {
      const currentWeekStart = getWeekStart(now);
      const selectedWeekStart = getWeekStart(selectedDate);
      return currentWeekStart.getTime() === selectedWeekStart.getTime();
    } else if (viewMode === 'month') {
      return now.getFullYear() === selectedDate.getFullYear() && 
             now.getMonth() === selectedDate.getMonth();
    } else {
      return now.getFullYear() === selectedDate.getFullYear();
    }
  };

  // 跳转到今天/当月/当年
  const goToToday = () => {
    setSelectedDate(new Date());
    setExpandedGroups(new Set());
  };

  // 按时间范围筛选账单
  const filteredBills = useMemo(() => {
    const year = selectedDate.getFullYear();
    return bills.filter((b) => {
      const date = new Date(b.date);
      const billYear = date.getFullYear();
      
      if (viewMode === 'week') {
        const weekStart = getWeekStart(selectedDate);
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
        return billYear === year && date >= weekStart && date < weekEnd && !b.deletedAt;
      } else if (viewMode === 'month') {
        const month = selectedDate.getMonth();
        return billYear === year && date.getMonth() === month && !b.deletedAt;
      } else {
        return billYear === year && !b.deletedAt;
      }
    });
  }, [bills, selectedDate, viewMode]);

  // 分离消费和收入
  const expenseBills = useMemo(() => 
    filteredBills.filter(b => {
      const category = categories.find(c => c.id === b.category);
      return !category?.type || category?.type === 'expense';
    }),
    [filteredBills, categories]
  );

  const incomeBills = useMemo(() => 
    filteredBills.filter(b => {
      const category = categories.find(c => c.id === b.category);
      return category?.type === 'income';
    }),
    [filteredBills, categories]
  );

  const currentBills = activeTab === 'expense' ? expenseBills : incomeBills;

  // 按周分组（月视图）
  const weekGroups = useMemo((): WeekGroup[] => {
    const groups: WeekGroup[] = [];
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    
    // 找到该月的第一周
    let date = new Date(year, month, 1);
    let weekStart = getWeekStart(date);
    
    while (date.getMonth() === month || weekStart.getMonth() === month) {
      if (weekStart.getMonth() === month) {
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
        const weekBills = currentBills.filter(b => {
          const billDate = new Date(b.date);
          return billDate >= weekStart && billDate <= weekEnd;
        });
        
        if (weekBills.length > 0) {
          const weekNum = Math.ceil(daysBetween(new Date(year, month, 1), weekStart) / 7) + 1;
          groups.push({
            weekLabel: `第${weekNum}周`,
            weekStart,
            weekEnd,
            bills: weekBills,
            total: weekBills.reduce((sum, b) => sum + b.amount, 0),
          });
        }
      }
      
      weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      date = weekStart;
    }
    
    return groups.reverse();
  }, [currentBills, selectedDate]);

  // 按月分组（年视图）
  const monthGroups = useMemo((): MonthGroup[] => {
    const groups: MonthGroup[] = [];
    const year = selectedDate.getFullYear();
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    for (let month = 0; month < 12; month++) {
      const monthBills = currentBills.filter(b => {
        const date = new Date(b.date);
        return date.getMonth() === month;
      });
      
      if (monthBills.length > 0) {
        groups.push({
          monthLabel: monthNames[month],
          month,
          year,
          bills: monthBills,
          total: monthBills.reduce((sum, b) => sum + b.amount, 0),
        });
      }
    }
    
    return groups.reverse();
  }, [currentBills, selectedDate]);

  // 按分类统计
  const categoryStats = useMemo(() => {
    const stats: Record<string, { amount: number; count: number }> = {};

    currentBills.forEach((bill) => {
      if (!stats[bill.category]) {
        stats[bill.category] = { amount: 0, count: 0 };
      }
      stats[bill.category].amount += bill.amount;
      stats[bill.category].count += 1;
    });

    const total = Object.values(stats).reduce((sum, s) => sum + s.amount, 0);

    return Object.entries(stats)
      .map(([categoryId, data]) => {
        const category = categories.find((c) => c.id === categoryId);
        return {
          categoryId,
          name: category?.name || '未分类',
          icon: category?.icon || '📦',
          color: category?.color || '#85929E',
          amount: data.amount,
          count: data.count,
          percentage: total > 0 ? (data.amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [currentBills, categories]);

  // 总金额
  const totalAmount = useMemo(
    () => currentBills.reduce((sum, b) => sum + b.amount, 0),
    [currentBills]
  );

  // 切换展开
  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  // 获取分类信息
  const getCategoryInfo = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return {
      icon: category?.icon || '📦',
      color: category?.color || '#85929E',
      name: category?.name || '未分类',
    };
  };

  // 渲染单条记录
  const renderBillItem = (bill: BillRecord) => {
    const cat = getCategoryInfo(bill.category);
    return (
      <div
        key={bill.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 0',
          borderBottom: '1px solid #f5f5f5',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: cat.color + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            marginRight: '10px',
          }}
        >
          {cat.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {bill.description}
          </div>
          <div style={{ fontSize: '11px', color: '#999' }}>{cat.name}</div>
        </div>
        <div style={{ fontSize: '14px', fontWeight: '500', marginLeft: '8px' }}>
          {formatAmount(bill.amount)}
        </div>
      </div>
    );
  };

  // 渲染周视图
  const renderWeekView = () => (
    <div>
      {weekGroups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-text">本周暂无数据</div>
        </div>
      ) : (
        weekGroups.map((group, idx) => (
          <div key={idx} className="card" style={{ marginBottom: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                cursor: 'pointer',
              }}
              onClick={() => toggleExpand(`week-${idx}`)}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{group.weekLabel}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {formatDateRange(group.weekStart, group.weekEnd)} · {group.bills.length} 笔
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600' }}>{formatAmount(group.total)}</span>
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {expandedGroups.has(`week-${idx}`) ? '▲' : '▼'}
                </span>
              </div>
            </div>
            
            {expandedGroups.has(`week-${idx}`) && (
              <div style={{ borderTop: '1px solid #f5f5f5', padding: '0 12px 8px' }}>
                {group.bills.map(renderBillItem)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  // 渲染月视图
  const renderMonthView = () => (
    <div>
      {weekGroups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-text">本月暂无数据</div>
        </div>
      ) : (
        weekGroups.map((group, idx) => (
          <div key={idx} className="card" style={{ marginBottom: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                cursor: 'pointer',
              }}
              onClick={() => toggleExpand(`week-${idx}`)}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{group.weekLabel}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {formatDateRange(group.weekStart, group.weekEnd)} · {group.bills.length} 笔
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600' }}>{formatAmount(group.total)}</span>
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {expandedGroups.has(`week-${idx}`) ? '▲' : '▼'}
                </span>
              </div>
            </div>
            
            {expandedGroups.has(`week-${idx}`) && (
              <div style={{ borderTop: '1px solid #f5f5f5', padding: '0 12px 8px' }}>
                {group.bills.map(renderBillItem)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  // 渲染年视图
  const renderYearView = () => (
    <div>
      {monthGroups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-text">本年暂无数据</div>
        </div>
      ) : (
        monthGroups.map((group, idx) => (
          <div key={idx} className="card" style={{ marginBottom: '12px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                cursor: 'pointer',
              }}
              onClick={() => toggleExpand(`month-${idx}`)}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{group.monthLabel}</div>
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {group.bills.length} 笔
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600' }}>{formatAmount(group.total)}</span>
                <span style={{ color: '#999', fontSize: '12px' }}>
                  {expandedGroups.has(`month-${idx}`) ? '▲' : '▼'}
                </span>
              </div>
            </div>
            
            {expandedGroups.has(`month-${idx}`) && (
              <div style={{ borderTop: '1px solid #f5f5f5', padding: '0 12px 8px' }}>
                {group.bills.map(renderBillItem)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="page">
      {/* 头部 */}
      <div className="page-header">
        <h1>收支分析</h1>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {/* 时间导航 */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '12px', 
          marginBottom: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          {/* 导航行 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button
              className="btn btn-outline"
              style={{ width: '40px', height: '40px', padding: '0', borderRadius: '50%' }}
              onClick={goToPrevious}
            >
              ◀
            </button>
            
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '18px', fontWeight: '600' }}>{getTimeLabel()}</div>
              {!isCurrentPeriod() && (
                <button
                  onClick={goToToday}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    fontSize: '12px',
                    cursor: 'pointer',
                    marginTop: '2px'
                  }}
                >
                  跳转到今天
                </button>
              )}
            </div>
            
            <button
              className="btn btn-outline"
              style={{ width: '40px', height: '40px', padding: '0', borderRadius: '50%' }}
              onClick={goToNext}
            >
              ▶
            </button>
          </div>

          {/* 视图切换 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                className={`btn ${viewMode === range ? 'btn-primary' : 'btn-outline'}`}
                style={{ flex: 1, padding: '10px 8px' }}
                onClick={() => {
                  setViewMode(range);
                  setExpandedGroups(new Set());
                }}
              >
                {range === 'week' ? '按周' : range === 'month' ? '按月' : '按年'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 切换 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            className={`btn ${activeTab === 'expense' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '10px' }}
            onClick={() => setActiveTab('expense')}
          >
            消费
          </button>
          <button
            className={`btn ${activeTab === 'income' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, padding: '10px' }}
            onClick={() => setActiveTab('income')}
          >
            收入
          </button>
        </div>

        {/* 总金额 */}
        <div className="stats-card">
          <div className="stats-title">{activeTab === 'expense' ? '总消费' : '总收入'}</div>
          <div className="stats-value">{formatAmount(totalAmount)}</div>
          <div className="stats-sub">
            {currentBills.length} 笔 · {categoryStats.length} 个分类
          </div>
        </div>

        {/* 分类占比 */}
        {categoryStats.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
              分类占比
            </div>
            <div className="card">
              {categoryStats.slice(0, 5).map((stat) => (
                <div key={stat.categoryId} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px' }}>
                      {stat.icon} {stat.name}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>
                      {formatAmount(stat.amount)} ({stat.percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div style={{ height: '6px', background: '#f0f0f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${stat.percentage}%`,
                        height: '100%',
                        background: stat.color,
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 列表视图 */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
            {viewMode === 'week' ? '本周' : viewMode === 'month' ? '按周聚合' : '按月聚合'}
            <span style={{ fontSize: '12px', color: '#999', fontWeight: 'normal' }}>
              （点击展开查看详情）
            </span>
          </div>
          
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'year' && renderYearView()}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default AnalysisPage;
