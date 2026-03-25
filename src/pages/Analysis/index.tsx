import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
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

function AnalysisPage() {
  const bills = useBillStore((state) => state.bills);
  const categories = useCategoryStore((state) => state.categories);

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 年份选项（当前年份前后5年）
  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = selectedYear - 5; y <= selectedYear + 1; y++) {
      years.push(y);
    }
    return years;
  }, [selectedYear]);

  // 按时间范围筛选账单
  const filteredBills = useMemo(() => {
    return bills.filter((b) => {
      const date = new Date(b.date);
      const year = date.getFullYear();
      return year === selectedYear && !b.deletedAt;
    });
  }, [bills, selectedYear]);

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
    const currentYear = selectedYear;
    
    // 找到每年的第1周
    let date = new Date(currentYear, 0, 1);
    let weekStart = getWeekStart(date);
    
    while (weekStart.getFullYear() === currentYear) {
      const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      const weekBills = currentBills.filter(b => {
        const billDate = new Date(b.date);
        return billDate >= weekStart && billDate <= weekEnd;
      });
      
      if (weekBills.length > 0) {
        const month = weekStart.getMonth() + 1;
        const weekNum = Math.ceil(daysBetween(new Date(currentYear, 0, 1), weekStart) / 7) + 1;
        groups.push({
          weekLabel: `${month}月第${weekNum}周`,
          weekStart,
          weekEnd,
          bills: weekBills,
          total: weekBills.reduce((sum, b) => sum + b.amount, 0),
        });
      }
      
      weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    return groups.reverse();
  }, [currentBills, selectedYear]);

  // 按月分组（年视图）
  const monthGroups = useMemo((): MonthGroup[] => {
    const groups: MonthGroup[] = [];
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
          bills: monthBills,
          total: monthBills.reduce((sum, b) => sum + b.amount, 0),
        });
      }
    }
    
    return groups.reverse();
  }, [currentBills, selectedYear]);

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

  // 饼图配置
  const pieOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        textStyle: {
          fontSize: 12,
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
            },
          },
          data: categoryStats.map((s) => ({
            value: s.amount,
            name: s.name,
            itemStyle: { color: s.color },
          })),
        },
      ],
    }),
    [categoryStats]
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

  // 渲染周视图
  const renderWeekView = () => (
    <div>
      {weekGroups.map((group, idx) => (
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
                {group.bills.length} 笔
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '600' }}>{formatAmount(group.total)}</span>
              <span style={{ color: '#999' }}>
                {expandedGroups.has(`week-${idx}`) ? '▲' : '▼'}
              </span>
            </div>
          </div>
          
          {expandedGroups.has(`week-${idx}`) && (
            <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 12px' }}>
              {group.bills.map(bill => {
                const cat = getCategoryInfo(bill.category);
                return (
                  <div
                    key={bill.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        backgroundColor: cat.color + '20',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        marginRight: '8px',
                      }}
                    >
                      {cat.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px' }}>{bill.description}</div>
                      <div style={{ fontSize: '11px', color: '#999' }}>{cat.name}</div>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '500' }}>
                      {formatAmount(bill.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // 渲染月视图
  const renderMonthView = () => (
    <div>
      {weekGroups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-text">暂无数据</div>
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
                  {group.bills.length} 笔
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: '600' }}>{formatAmount(group.total)}</span>
                <span style={{ color: '#999' }}>
                  {expandedGroups.has(`week-${idx}`) ? '▲' : '▼'}
                </span>
              </div>
            </div>
            
            {expandedGroups.has(`week-${idx}`) && (
              <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 12px' }}>
                {group.bills.map(bill => {
                  const cat = getCategoryInfo(bill.category);
                  return (
                    <div
                      key={bill.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: cat.color + '20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          marginRight: '8px',
                        }}
                      >
                        {cat.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px' }}>{bill.description}</div>
                        <div style={{ fontSize: '11px', color: '#999' }}>{cat.name}</div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>
                        {formatAmount(bill.amount)}
                      </div>
                    </div>
                  );
                })}
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
          <div className="empty-text">暂无数据</div>
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
                <span style={{ color: '#999' }}>
                  {expandedGroups.has(`month-${idx}`) ? '▲' : '▼'}
                </span>
              </div>
            </div>
            
            {expandedGroups.has(`month-${idx}`) && (
              <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 12px' }}>
                {group.bills.map(bill => {
                  const cat = getCategoryInfo(bill.category);
                  return (
                    <div
                      key={bill.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          backgroundColor: cat.color + '20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          marginRight: '8px',
                        }}
                      >
                        {cat.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px' }}>{bill.description}</div>
                        <div style={{ fontSize: '11px', color: '#999' }}>{cat.name}</div>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '500' }}>
                        {formatAmount(bill.amount)}
                      </div>
                    </div>
                  );
                })}
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
        {/* 年份选择 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <button
            className="btn btn-outline"
            style={{ padding: '6px 12px' }}
            onClick={() => setSelectedYear(y => y - 1)}
          >
            ◀
          </button>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '14px',
              textAlign: 'center',
              background: 'white',
            }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <button
            className="btn btn-outline"
            style={{ padding: '6px 12px' }}
            onClick={() => setSelectedYear(y => y + 1)}
          >
            ▶
          </button>
        </div>

        {/* 时间筛选 */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              className={`btn ${viewMode === range ? 'btn-primary' : 'btn-outline'}`}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '14px',
              }}
              onClick={() => {
                setViewMode(range);
                setExpandedGroups(new Set());
              }}
            >
              {range === 'week' ? '按周' : range === 'month' ? '按月' : '按年'}
            </button>
          ))}
        </div>

        {/* Tab 切换 */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <button
            className={`btn ${activeTab === 'expense' ? 'btn-primary' : 'btn-outline'}`}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '14px',
            }}
            onClick={() => setActiveTab('expense')}
          >
            消费
          </button>
          <button
            className={`btn ${activeTab === 'income' ? 'btn-primary' : 'btn-outline'}`}
            style={{
              flex: 1,
              padding: '10px',
              fontSize: '14px',
            }}
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

        {/* 饼图 */}
        {categoryStats.length > 0 && (
          <div className="chart-container">
            <div className="chart-title">{activeTab === 'expense' ? '消费' : '收入'}分类占比</div>
            <ReactECharts option={pieOption} style={{ height: '200px' }} />
          </div>
        )}

        {/* 列表视图 */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
            {viewMode === 'week' ? '本周记录' : viewMode === 'month' ? '按周聚合' : '按月聚合'}
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
