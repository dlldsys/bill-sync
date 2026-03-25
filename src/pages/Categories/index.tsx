import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Toast } from 'antd-mobile';
import BottomNav from '../../components/BottomNav';
import { useCategoryStore } from '../../stores';
import { Category } from '../../types';

const icons = ['🍜', '🛒', '🚗', '🎬', '💊', '📱', '🏠', '📚', '💰', '📦', '🎮', '👔', '🎁', '✈️', '🐱', '💪'];

function CategoriesPage() {
  const navigate = useNavigate();
  const categories = useCategoryStore((state) => state.categories);
  const addCategory = useCategoryStore((state) => state.addCategory);
  const updateCategory = useCategoryStore((state) => state.updateCategory);
  const deleteCategory = useCategoryStore((state) => state.deleteCategory);

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📦',
    color: '#85929E',
  });

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', icon: '📦', color: '#85929E' });
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      icon: category.icon,
      color: category.color,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Toast.show('请输入分类名称');
      return;
    }

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
        Toast.show('修改成功');
      } else {
        await addCategory(formData);
        Toast.show('添加成功');
      }
      setShowModal(false);
    } catch {
      Toast.show('操作失败');
    }
  };

  const handleDelete = (category: Category) => {
    if (category.isDefault) {
      Toast.show('默认分类不能删除');
      return;
    }

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除分类"${category.name}"吗？`,
      onConfirm: async () => {
        try {
          await deleteCategory(category.id);
          Toast.show('删除成功');
        } catch {
          Toast.show('删除失败');
        }
      },
    });
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
          <h1>分类管理</h1>
        </div>
      </div>

      {/* 内容 */}
      <div className="page-content">
        {/* 分类列表 */}
        <div className="card">
          {categories.map((category) => (
            <div
              key={category.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: category.color + '20',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  marginRight: '12px',
                }}
              >
                {category.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '500' }}>
                  {category.name}
                </div>
                {category.isDefault && (
                  <div style={{ fontSize: '12px', color: '#999' }}>默认分类</div>
                )}
              </div>
              <button
                onClick={() => openEditModal(category)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667eea',
                  fontSize: '14px',
                  cursor: 'pointer',
                  marginRight: '12px',
                }}
              >
                编辑
              </button>
              {!category.isDefault && (
                <button
                  onClick={() => handleDelete(category)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#F4333C',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  删除
                </button>
              )}
            </div>
          ))}
        </div>

        {/* 添加按钮 */}
        <button
          className="btn btn-outline btn-block"
          style={{ marginTop: '16px' }}
          onClick={openAddModal}
        >
          + 添加分类
        </button>
      </div>

      {/* 模态框 */}
      <Modal
        visible={showModal}
        title={editingCategory ? '编辑分类' : '添加分类'}
        closeOnAction
        onClose={() => setShowModal(false)}
        actions={[
          { text: '取消', key: 'cancel' },
          { text: '保存', key: 'save' },
        ]}
        onAction={(action) => {
          if (action.key === 'save') {
            handleSave();
          } else {
            setShowModal(false);
          }
        }}
        content={
          <div style={{ padding: '16px 0' }}>
            {/* 名称 */}
            <div className="form-group">
              <label className="form-label">分类名称</label>
              <input
                type="text"
                className="form-input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入分类名称"
              />
            </div>

            {/* 图标 */}
            <div className="form-group">
              <label className="form-label">选择图标</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(8, 1fr)',
                  gap: '8px',
                }}
              >
                {icons.map((icon) => (
                  <div
                    key={icon}
                    onClick={() => setFormData({ ...formData, icon })}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background:
                        formData.icon === icon
                          ? '#667eea20'
                          : '#f5f5f5',
                      border:
                        formData.icon === icon
                          ? '2px solid #667eea'
                          : '2px solid transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      cursor: 'pointer',
                    }}
                  >
                    {icon}
                  </div>
                ))}
              </div>
            </div>

            {/* 颜色 */}
            <div className="form-group">
              <label className="form-label">选择颜色</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '8px',
                }}
              >
                {[
                  '#FF6B6B',
                  '#4ECDC4',
                  '#45B7D1',
                  '#96CEB4',
                  '#DDA0DD',
                  '#98D8C8',
                  '#F7DC6F',
                  '#BB8FCE',
                  '#58D68D',
                  '#85929E',
                ].map((color) => (
                  <div
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: color,
                      border:
                        formData.color === color
                          ? '3px solid #333'
                          : '3px solid transparent',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        }
      />

      <BottomNav />
    </div>
  );
}

export default CategoriesPage;
