import React, { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import BottomNav from '../../components/BottomNav';
import { useBillStore, useCategoryStore } from '../../stores';
import { formatAmount } from '../../utils';

function AnalysisPage() {
  const bills = useBillStore((state) => state.bills);
  const categories = useCategoryStore((state) => state.categories);

  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  // 按时间范围筛选账单
  const filteredBills = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (dateRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return bills.filter(
      (b) => new Date(b.date) >= startDate && !b.deletedAt
    );
  }, [bills, dateRange]);

  // 按分类统计
  const categoryStats = useMemo(() => {
    const stats: Record<string, { amount: number; count: number }> = {};

    filteredBills.forEach((bill) => {
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
  }, [filteredBills, categories]);

  // 总消费
  const totalAmount = useMemo(
    () => filteredBills.reduce((sum, b) => sum + b.amount, 0),
    [filteredBills]
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


  return (
    <div className="page">
      {/* 头部 */}
      <div className="page-header">
        <h1>消费分析</h1>
      </div>

      {/* 内容 */}
      <div className="page-content">
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
              className={`btn ${dateRange === range ? 'btn-primary' : 'btn-outline'}`}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '14px',
              }}
              onClick={() => setDateRange(range)}
            >
              {range === 'week' ? '本周' : range === 'month' ? '本月' : '本年'}
            </button>
          ))}
        </div>

        {/* 总消费 */}
        <div className="stats-card">
          <div className="stats-title">总消费</div>
          <div className="stats-value">{formatAmount(totalAmount)}</div>
          <div className="stats-sub">
            {filteredBills.length} 笔 · {categoryStats.length} 个分类
          </div>
        </div>

        {/* 饼图 */}
        {categoryStats.length > 0 && (
          <>
            <div className="chart-container">
              <div className="chart-title">消费占比</div>
              <ReactECharts option={pieOption} style={{ height: '250px' }} />
            </div>

            <div className="chart-container">
              <div className="chart-title">分类详情</div>
              {categoryStats.map((stat) => (
                <div
                  key={stat.categoryId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      backgroundColor: stat.color + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      marginRight: '12px',
                    }}
                  >
                    {stat.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', marginBottom: '2px' }}>
                      {stat.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {stat.count} 笔
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>
                      {formatAmount(stat.amount)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {stat.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {categoryStats.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-text">暂无消费数据</div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default AnalysisPage;
