/**
 * Marketing Machine - Approval Dashboard
 * Phase 6: In-App Approval Workflow
 */

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Edit3, 
  Clock, 
  Eye,
  Calendar,
  TrendingUp,
  Filter,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const ApprovalDashboard = () => {
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'pending_approval',
    content_type: '',
    page: 1
  });
  const [editingPost, setEditingPost] = useState(null);
  const [editForm, setEditForm] = useState({
    post_content: '',
    hashtags: [],
    scheduled_for: '',
    notes: ''
  });

  useEffect(() => {
    fetchPosts();
    fetchStats();
  }, [filters]);

  const fetchPosts = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams({
        page: filters.page,
        limit: 20,
        status: filters.status
      });
      
      if (filters.content_type) {
        params.append('content_type', filters.content_type);
      }

      const response = await fetch(`/api/approval/pending?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch posts');
      
      const data = await response.json();
      setPosts(data.posts || []);
    } catch (error) {
      toast.error('Failed to fetch posts');
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/approval/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchPostDetails = async (postId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/approval/posts/${postId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to fetch post details');
      const post = await response.json();
      setSelectedPost(post);
    } catch (error) {
      toast.error('Failed to fetch post details');
      console.error('Error fetching post details:', error);
    }
  };

  const approvePost = async (postId, autoPublish = false, scheduledFor = null, notes = '') => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/approval/posts/${postId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auto_publish: autoPublish,
          scheduled_for: scheduledFor,
          notes: notes
        })
      });

      if (!response.ok) throw new Error('Failed to approve post');
      
      toast.success('Post approved successfully');
      fetchPosts();
      fetchStats();
      setSelectedPost(null);
    } catch (error) {
      toast.error('Failed to approve post');
      console.error('Error approving post:', error);
    }
  };

  const rejectPost = async (postId, notes = '', regenerate = false) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/approval/posts/${postId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes,
          regenerate
        })
      });

      if (!response.ok) throw new Error('Failed to reject post');
      
      toast.success(regenerate ? 'Post rejected - regenerating new version' : 'Post rejected');
      fetchPosts();
      fetchStats();
      setSelectedPost(null);
    } catch (error) {
      toast.error('Failed to reject post');
      console.error('Error rejecting post:', error);
    }
  };

  const updatePost = async (postId, updates) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/approval/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) throw new Error('Failed to update post');
      
      toast.success('Post updated successfully');
      fetchPosts();
      setEditingPost(null);
      if (selectedPost?.id === postId) {
        fetchPostDetails(postId);
      }
    } catch (error) {
      toast.error('Failed to update post');
      console.error('Error updating post:', error);
    }
  };

  const startEdit = (post) => {
    setEditingPost(post.id);
    setEditForm({
      post_content: post.post_content,
      hashtags: post.hashtags || [],
      scheduled_for: post.scheduled_for || '',
      notes: ''
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending_approval': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'published': 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const PostCard = ({ post }) => (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-3">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
            {post.status.replace('_', ' ').toUpperCase()}
          </span>
          {post.content_type && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
              {post.content_type.replace('_', ' ').toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1 text-sm text-gray-500">
          <TrendingUp className="w-4 h-4" />
          <span>{post.performance_score}/10</span>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-gray-900 line-clamp-3">{post.post_content}</p>
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {post.hashtags.slice(0, 3).map((tag, idx) => (
              <span key={idx} className="text-blue-600 text-sm">#{tag}</span>
            ))}
            {post.hashtags.length > 3 && (
              <span className="text-gray-500 text-sm">+{post.hashtags.length - 3} more</span>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
        <span>Created {formatDate(post.created_at)}</span>
        {post.created_by_name && <span>by {post.created_by_name}</span>}
      </div>

      {post.images && post.images.length > 0 && (
        <div className="mb-4">
          <div className="flex space-x-2 overflow-x-auto">
            {post.images.slice(0, 3).map((image) => (
              <img 
                key={image.id}
                src={image.url} 
                alt="Generated content"
                className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
              />
            ))}
            {post.images.length > 3 && (
              <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm">
                +{post.images.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex space-x-2">
        <button
          onClick={() => fetchPostDetails(post.id)}
          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          <Eye className="w-4 h-4" />
          <span>Review</span>
        </button>
        
        {post.status === 'pending_approval' && (
          <>
            <button
              onClick={() => approvePost(post.id)}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Approve</span>
            </button>
            
            <button
              onClick={() => rejectPost(post.id, '', true)}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Regenerate</span>
            </button>
          </>
        )}
      </div>
    </div>
  );

  const PostDetailModal = () => {
    if (!selectedPost) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Post Review</h2>
              <button
                onClick={() => setSelectedPost(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedPost.status)}`}>
                      {selectedPost.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <TrendingUp className="w-4 h-4" />
                      <span>Score: {selectedPost.performance_score}/10</span>
                    </div>
                  </div>

                  {editingPost === selectedPost.id ? (
                    <div className="space-y-4">
                      <textarea
                        value={editForm.post_content}
                        onChange={(e) => setEditForm({...editForm, post_content: e.target.value})}
                        className="w-full h-40 p-3 border border-gray-300 rounded-md resize-none"
                        placeholder="Post content..."
                      />
                      
                      <input
                        type="datetime-local"
                        value={editForm.scheduled_for}
                        onChange={(e) => setEditForm({...editForm, scheduled_for: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />

                      <input
                        type="text"
                        value={editForm.notes}
                        onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded-md"
                        placeholder="Edit notes..."
                      />

                      <div className="flex space-x-2">
                        <button
                          onClick={() => updatePost(selectedPost.id, editForm)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingPost(null)}
                          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-900 whitespace-pre-wrap mb-4">{selectedPost.post_content}</p>
                      
                      {selectedPost.hashtags && selectedPost.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {selectedPost.hashtags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {selectedPost.scheduled_for && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
                          <Calendar className="w-4 h-4" />
                          <span>Scheduled: {formatDate(selectedPost.scheduled_for)}</span>
                        </div>
                      )}

                      <button
                        onClick={() => startEdit(selectedPost)}
                        className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>Edit Post</span>
                      </button>
                    </div>
                  )}
                </div>

                {selectedPost.hooks && selectedPost.hooks.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Marketing Hooks</h3>
                    <div className="space-y-2">
                      {selectedPost.hooks.slice(0, 5).map((hook) => (
                        <div key={hook.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm font-medium text-gray-600">{hook.hook_type}</span>
                            <span className="text-sm text-gray-500">Score: {hook.score}/10</span>
                          </div>
                          <p className="text-sm text-gray-900">{hook.hook_text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                {selectedPost.images && selectedPost.images.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Generated Images</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {selectedPost.images.map((image) => (
                        <div key={image.id} className="border border-gray-200 rounded-lg overflow-hidden">
                          <img 
                            src={image.url} 
                            alt="Generated content"
                            className="w-full h-48 object-cover"
                          />
                          <div className="p-3">
                            <div className="flex justify-between items-center text-sm">
                              <span className="font-medium">{image.model}</span>
                              <div className="flex space-x-4 text-gray-500">
                                <span>Quality: {image.quality_score}/10</span>
                                <span>Brand: {image.brand_alignment}/10</span>
                              </div>
                            </div>
                            {image.selected && (
                              <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                Selected
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPost.status === 'pending_approval' && (
                  <div className="space-y-3">
                    <button
                      onClick={() => approvePost(selectedPost.id)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Approve Post</span>
                    </button>
                    
                    <button
                      onClick={() => approvePost(selectedPost.id, true, new Date(Date.now() + 60000).toISOString())}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      <Calendar className="w-5 h-5" />
                      <span>Approve & Auto-Publish</span>
                    </button>
                    
                    <button
                      onClick={() => rejectPost(selectedPost.id, '', true)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                    >
                      <RefreshCw className="w-5 h-5" />
                      <span>Reject & Regenerate</span>
                    </button>
                    
                    <button
                      onClick={() => rejectPost(selectedPost.id)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                      <span>Reject Post</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Approval</h1>
          <p className="text-gray-600">Review and approve AI-generated LinkedIn content</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approved || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Score</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avg_performance_score ? (stats.avg_performance_score).toFixed(1) : '0.0'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Avg Approval Time</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avg_approval_time_hours ? `${(stats.avg_approval_time_hours).toFixed(1)}h` : '0h'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 mb-6">
          <div className="flex items-center space-x-4">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value, page: 1})}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="published">Published</option>
            </select>
            
            <select
              value={filters.content_type}
              onChange={(e) => setFilters({...filters, content_type: e.target.value, page: 1})}
              className="border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All Content Types</option>
              <option value="meeting_transcript">Meeting Transcript</option>
              <option value="sales_call">Sales Call</option>
              <option value="product_update">Product Update</option>
              <option value="manual_input">Manual Input</option>
            </select>
            
            <button
              onClick={fetchPosts}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Posts Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No posts found</h3>
            <p className="text-gray-500">No posts match the current filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {/* Post Detail Modal */}
        <PostDetailModal />
      </div>
    </div>
  );
};

export default ApprovalDashboard;