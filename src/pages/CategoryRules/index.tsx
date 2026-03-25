import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Switch, Toast, Button } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useCategoryStore } from '../../stores';
import { getAllRules, addRule, deleteRule, toggleRule } from '../../services/categoryRules';
import type { CategoryRule } from '../../types';

function CategoryRulesPage() {
  const navigate = useNavigate();
  const categories = useCategoryStore((state) => state.categories);
  
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // 新规则表单
  const [newKeyword, setNewKeyword] = useState('');
  const [newMatchField, setNewMatchField] = useState<'merchant' | 'description'>('description');
  const [newMatchType, setNewMatchType] = useState<'contains' | 'regex'>('contains');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newPriority, setNewPriority] = useState(0);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      const allRules = await getAllRules();
      setRules(allRules.sort((a, b) => b.priority - a.priority));
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  };

  const handleToggleRule = async (rule: CategoryRule) => {
    try {
      await toggleRule(rule.id);
      await loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      Toast.show({ content: '切换失败', icon: 'fail' });
    }
  };

  const handleDeleteRule = async (rule: CategoryRule) => {
    if (!confirm(`确定删除规则「${rule.keyword}」吗？`)) return;
    
    try {
      await deleteRule(rule.id);
      await loadRules();
      Toast.show({ content: '删除成功' });
    } catch (error) {
      console.error('Failed to delete rule:', error);
      Toast.show({ content: '删除失败', icon: 'fail' });
    }
  };

  const handleAddRule = async () => {
    if (!newKeyword.trim()) {
      Toast.show({ content: '请输入关键词', icon: 'fail' });
      return;
    }
    if (!newCategoryId) {
      Toast.show({ content: '请选择分类', icon: 'fail' });
      return;
    }

    setLoading(true);
    try {
      await addRule({
        keyword: newKeyword.trim(),
        matchField: newMatchField,
        matchType: newMatchType,
        categoryId: newCategoryId,
        priority: newPriority,
        enabled: true,
      });
      
      Toast.show({ content: '添加成功' });
      setShowModal(false);
      resetForm();
      await loadRules();
    } catch (error) {
      console.error('Failed to add rule:', error);
      Toast.show({ content: '添加失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewKeyword('');
    setNewMatchField('description');
    setNewMatchType('contains');
    setNewCategoryId('');
    setNewPriority(0);
  };

  // 获取分类名称
  const getCategoryName = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat ? `${cat.icon} ${cat.name}` : '未分类';
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
          <h1>分类规则</h1>
        </div>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {/* 说明 */}
        <div className="card" style={{ marginBottom: '16px', background: '#f0f7ff' }}>
          <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
            <p style={{ marginBottom: '8px' }}><strong>提示：</strong></p>
            <p>• 关键词支持模糊匹配商家名称或描述</p>
            <p>• 规则按优先级从高到低执行</p>
            <p>• 启用规则后，OCR识别和手动输入时会自动匹配</p>
          </div>
        </div>

        {/* 规则列表 */}
        {rules.length > 0 ? (
          <div className="card">
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  padding: '12px 0',
                  borderBottom: rules.indexOf(rule) < rules.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>
                      {rule.keyword}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      匹配字段：{rule.matchField === 'merchant' ? '商家' : '描述'} · 
                      方式：{rule.matchType === 'contains' ? '模糊匹配' : '正则'} · 
                      优先级：{rule.priority}
                    </div>
                    <div style={{ fontSize: '12px', color: '#667eea', marginTop: '4px' }}>
                      → {getCategoryName(rule.categoryId)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Switch
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule)}
                    />
                    <button
                      onClick={() => handleDeleteRule(rule)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f5222d',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <div className="empty-text">暂无分类规则</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
              点击下方按钮添加规则
            </div>
          </div>
        )}

        {/* 添加按钮 */}
        <Button
          block
          color="primary"
          size="large"
          style={{ marginTop: '16px' }}
          onClick={() => setShowModal(true)}
        >
          添加规则
        </Button>
      </div>

      {/* 添加规则弹窗 */}
      {showModal && (
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
            maxWidth: '360px',
            maxHeight: '80vh',
            overflow: 'auto',
          }}>
            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              添加分类规则
            </div>

            {/* 关键词 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
                关键词 *
              </div>
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="输入匹配关键词"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* 匹配字段 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
                匹配字段
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn ${newMatchField === 'description' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setNewMatchField('description')}
                >
                  描述
                </button>
                <button
                  className={`btn ${newMatchField === 'merchant' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setNewMatchField('merchant')}
                >
                  商家
                </button>
              </div>
            </div>

            {/* 匹配方式 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
                匹配方式
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className={`btn ${newMatchType === 'contains' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setNewMatchType('contains')}
                >
                  模糊匹配
                </button>
                <button
                  className={`btn ${newMatchType === 'regex' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ flex: 1 }}
                  onClick={() => setNewMatchType('regex')}
                >
                  正则表达式
                </button>
              </div>
            </div>

            {/* 分类选择 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
                目标分类 *
              </div>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'white',
                }}
              >
                <option value="">请选择分类</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name} ({cat.type === 'expense' ? '支出' : '收入'})
                  </option>
                ))}
              </select>
            </div>

            {/* 优先级 */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', marginBottom: '8px', fontWeight: '500' }}>
                优先级
              </div>
              <input
                type="number"
                value={newPriority}
                onChange={(e) => setNewPriority(parseInt(e.target.value) || 0)}
                placeholder="数字越大优先级越高"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* 按钮组 */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                取消
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleAddRule}
                disabled={loading}
              >
                {loading ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default CategoryRulesPage;
