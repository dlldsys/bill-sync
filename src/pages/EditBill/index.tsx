import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Toast } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useBillStore, useCategoryStore } from '../../stores';
import { autoMatchCategory } from '../../services/categoryRules';
import { BillRecord } from '../../types';

function EditBillPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const updateBill = useBillStore((state) => state.updateBill);
  const deleteBill = useBillStore((state) => state.deleteBill);
  const bills = useBillStore((state) => state.bills);
  const categories = useCategoryStore((state) => state.categories);

  const [bill, setBill] = useState<BillRecord | null>(null);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [billType, setBillType] = useState<'expense' | 'income'>('expense');
  const [loading, setLoading] = useState(false);

  // 根据收支类型过滤分类
  const filteredCategories = categories.filter(c => 
    billType === 'expense' ? (!c.type || c.type === 'expense') : c.type === 'income'
  );

  // 自动匹配分类
  const handleAutoMatch = async () => {
    if (!merchant && !description) return;
    
    try {
      const matchResult = await autoMatchCategory(merchant || '', description);
      if (matchResult && matchResult.category.type === billType) {
        setCategory(matchResult.categoryId);
        Toast.show({
          content: `已匹配到分类：${matchResult.category.name}`,
          icon: 'success',
        });
      } else if (matchResult) {
        Toast.show({
          content: `匹配的分类类型不符，请手动选择`,
          icon: 'fail',
        });
      }
    } catch (error) {
      console.error('Auto match failed:', error);
    }
  };

  // 加载账单数据
  useEffect(() => {
    if (!id) return;
    
    const foundBill = bills.find(b => b.id === id);
    if (!foundBill) {
      Toast.show('账单不存在');
      navigate('/');
      return;
    }

    setBill(foundBill);
    setAmount(foundBill.amount.toString());
    setDescription(foundBill.description);
    setMerchant(foundBill.rawText ? extractMerchantFromRawText(foundBill.rawText) : '');
    setDate(new Date(foundBill.date));
    setCategory(foundBill.category);
    
    // 根据分类确定收支类型
    const billCategory = categories.find(c => c.id === foundBill.category);
    setBillType(billCategory?.type || 'expense');
  }, [id, bills, categories, navigate]);

  // 当收支类型改变时，重置分类选择
  useEffect(() => {
    const firstCategory = filteredCategories[0];
    if (firstCategory && !filteredCategories.find(c => c.id === category)) {
      setCategory(firstCategory.id);
    }
  }, [billType]);

  // 当商家或描述改变时，尝试自动匹配
  useEffect(() => {
    if (bill) { // 只在编辑模式下自动匹配
      const timer = setTimeout(() => {
        handleAutoMatch();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [merchant, description, billType]);

  const handleSubmit = async () => {
    if (!bill || !id) return;

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
      await updateBill(id, {
        amount: Math.abs(parseFloat(amount)),
        description,
        date: date.toISOString(),
        category,
        categoryName: categories.find((c) => c.id === category)?.name,
        rawText: merchant ? `商家：${merchant}\n${description}` : description,
      });

      Toast.show('修改成功');
      navigate('/');
    } catch {
      Toast.show('修改失败');
    } finally {
      setLoading(false);
    }
  };

  // 从rawText中提取商家信息
  const extractMerchantFromRawText = (rawText?: string): string => {
    if (!rawText) return '';
    const match = rawText.match(/商家[:：]\s*(.+)/);
    return match ? match[1].trim() : '';
  };

  // 删除账单
  const handleDelete = async () => {
    if (!bill || !id) return;

    try {
      await deleteBill(id);
      Toast.show('删除成功');
      navigate('/');
    } catch {
      Toast.show('删除失败');
    }
  };

  if (!bill) {
    return (
      <div className="page">
        <div className="page-content">
          <div style={{ textAlign: 'center', padding: '50px' }}>
            加载中...
          </div>
        </div>
      </div>
    );
  }

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
          <h1>编辑账单</h1>
        </div>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {/* 收支类型选择 */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '14px',
              color: '#666',
              marginBottom: '12px',
            }}
          >
            账单类型
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className={`btn ${billType === 'expense' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => setBillType('expense')}
            >
              支出
            </button>
            <button
              className={`btn ${billType === 'income' ? 'btn-primary' : 'btn-outline'}`}
              style={{ flex: 1 }}
              onClick={() => setBillType('income')}
            >
              收入
            </button>
          </div>
        </div>

        {/* 金额输入 */}
        <div className="card" style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '14px',
              color: '#999',
              marginBottom: '8px',
            }}
          >
            {billType === 'expense' ? '消费金额' : '收入金额'}
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

        {/* 商家输入 */}
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="form-group">
            <label className="form-label">商家名称（可选）</label>
            <input
              type="text"
              className="form-input"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="输入商家名称，用于自动分类"
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
            {merchant && (
              <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                正在自动匹配...
              </span>
            )}
          </div>
          <div className="category-grid">
            {filteredCategories.map((cat) => (
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
          保存修改
        </Button>

        {/* 删除按钮 */}
        <Button
          block
          color="danger"
          size="large"
          style={{ marginTop: '12px' }}
          onClick={handleDelete}
        >
          删除账单
        </Button>
      </div>

      <BottomNav />
    </div>
  );
}

export default EditBillPage;
