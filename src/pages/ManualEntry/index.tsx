import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Toast } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useBillStore, useCategoryStore } from '../../stores';

function ManualEntryPage() {
  const navigate = useNavigate();
  const addBill = useBillStore((state) => state.addBill);
  const categories = useCategoryStore((state) => state.categories);

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState(categories[0]?.id || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Toast.show('请输入有效金额');
      return;
    }

    if (!description) {
      Toast.show('请输入描述');
      return;
    }

    if (!category) {
      Toast.show('请选择分类');
      return;
    }

    setLoading(true);
    try {
      await addBill({
        amount: Math.abs(parseFloat(amount)),
        description,
        date: date.toISOString(),
        category,
        categoryName: categories.find((c) => c.id === category)?.name,
        source: 'manual',
      });

      Toast.show('添加成功');
      navigate('/');
    } catch {
      Toast.show('添加失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      {/* 头部 */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ←
          </button>
          <h1>记一笔</h1>
        </div>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {/* 金额输入 */}
        <div className="card" style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '14px',
              color: '#999',
              marginBottom: '8px',
            }}
          >
            消费金额
          </div>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 'bold',
              color: '#333',
            }}
          >
            <span style={{ fontSize: '24px' }}>¥</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                border: 'none',
                outline: 'none',
                width: '150px',
                fontSize: '36px',
                fontWeight: 'bold',
                textAlign: 'center',
                background: 'transparent',
              }}
            />
          </div>
        </div>

        {/* 分类选择 */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '12px',
            }}
          >
            选择分类
          </div>
          <div className="category-grid">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`category-item ${category === cat.id ? 'active' : ''}`}
                onClick={() => setCategory(cat.id)}
              >
                <div className="category-icon">{cat.icon}</div>
                <div className="category-name">{cat.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 描述 */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">描述</label>
            <input
              type="text"
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入消费描述"
            />
          </div>
        </div>

        {/* 日期 */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">日期</label>
            <input
              type="date"
              className="form-input"
              value={date.toISOString().split('T')[0]}
              onChange={(e) => setDate(new Date(e.target.value))}
            />
          </div>
        </div>

        {/* 提交按钮 */}
        <Button
          block
          color="primary"
          size="large"
          loading={loading}
          onClick={handleSubmit}
        >
          保存
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}

export default ManualEntryPage;
