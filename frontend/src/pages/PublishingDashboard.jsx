/**
 * Marketing Machine - Publishing Dashboard
 * Phase 7: Smart Publishing System
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PublishingDashboard.css';

const PublishingDashboard = () => {
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [publishingStats, setPublishingStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    postId: '',
    scheduledFor: '',
    useSmartScheduling: true,
    selectedImageId: null
  });

  useEffect(() => {
    fetchData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [scheduledResponse, statsResponse] = await Promise.all([
        axios.get('/api/publishing/scheduled'),
        axios.get('/api/publishing/stats')
      ]);

      setScheduledPosts(scheduledResponse.data.posts || []);
      setPublishingStats(statsResponse.data || {});
      setError(null);
    } catch (err) {
      console.error('Error fetching publishing data:', err);
      setError('Failed to load publishing data');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedulePost = async (postId, options = {}) => {
    try {
      const response = await axios.post('/api/publishing/schedule', {
        postId,
        ...options
      });

      // Refresh data after scheduling
      await fetchData();
      
      setShowScheduleModal(false);
      setScheduleForm({
        postId: '',
        scheduledFor: '',
        useSmartScheduling: true,
        selectedImageId: null
      });

      alert('Post scheduled successfully!');
    } catch (err) {
      console.error('Error scheduling post:', err);
      alert(err.response?.data?.error || 'Failed to schedule post');
    }
  };

  const handlePublishNow = async (postId) => {
    if (!confirm('Publish this post immediately?')) return;

    try {
      await axios.post('/api/publishing/publish-now', { postId });
      await fetchData();
      alert('Post queued for immediate publishing!');
    } catch (err) {
      console.error('Error publishing immediately:', err);
      alert(err.response?.data?.error || 'Failed to publish post');
    }
  };

  const handleCancelScheduled = async (postId) => {
    if (!confirm('Cancel this scheduled post?')) return;

    try {
      await axios.delete(`/api/publishing/schedule/${postId}`);
      await fetchData();
      alert('Scheduled post cancelled successfully!');
    } catch (err) {
      console.error('Error cancelling post:', err);
      alert(err.response?.data?.error || 'Failed to cancel post');
    }
  };

  const getOptimalTime = async (postId) => {
    try {
      const response = await axios.get(`/api/publishing/optimal-time/${postId}`);
      return response.data.optimalTime;
    } catch (err) {
      console.error('Error getting optimal time:', err);
      return null;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Not set';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    
    const formatted = date.toLocaleString();
    
    if (diffHours > 0) {
      return `${formatted} (in ${diffHours}h)`;
    } else if (diffHours > -24) {
      return `${formatted} (${Math.abs(diffHours)}h ago)`;
    } else {
      return formatted;
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'scheduled': 'badge-scheduled',
      'published': 'badge-published',
      'publish_failed': 'badge-failed',
      'approved': 'badge-approved'
    };

    return (
      <span className={`status-badge ${badges[status] || 'badge-default'}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="publishing-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading publishing dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="publishing-dashboard">
      <header className="dashboard-header">
        <h1>Publishing Dashboard</h1>
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setShowScheduleModal(true)}
          >
            Schedule New Post
          </button>
          <button 
            className="btn btn-secondary"
            onClick={fetchData}
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Publishing Statistics */}
      <section className="stats-section">
        <h2>Publishing Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{publishingStats.scheduled || 0}</div>
            <div className="stat-label">Scheduled</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{publishingStats.published || 0}</div>
            <div className="stat-label">Published</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{publishingStats.failed || 0}</div>
            <div className="stat-label">Failed</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {publishingStats.avg_performance?.toFixed(1) || '0.0'}
            </div>
            <div className="stat-label">Avg Performance</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{publishingStats.total_impressions || 0}</div>
            <div className="stat-label">Total Impressions</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{publishingStats.total_likes || 0}</div>
            <div className="stat-label">Total Likes</div>
          </div>
        </div>
      </section>

      {/* Scheduled Posts */}
      <section className="scheduled-posts-section">
        <h2>Scheduled Posts ({scheduledPosts.length})</h2>
        
        {scheduledPosts.length === 0 ? (
          <div className="empty-state">
            <p>No posts scheduled for publishing.</p>
            <button 
              className="btn btn-primary"
              onClick={() => setShowScheduleModal(true)}
            >
              Schedule Your First Post
            </button>
          </div>
        ) : (
          <div className="posts-list">
            {scheduledPosts.map((post) => (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <div className="post-info">
                    <h3>{post.source_title || `Post ${post.id}`}</h3>
                    <div className="post-meta">
                      {getStatusBadge(post.status)}
                      <span className="post-type">{post.content_type}</span>
                      <span className="scheduled-by">
                        Scheduled by {post.scheduled_by_name}
                      </span>
                    </div>
                  </div>
                  <div className="post-actions">
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => setSelectedPost(post)}
                    >
                      View Details
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleCancelScheduled(post.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                <div className="post-content">
                  <p>{post.post_content.substring(0, 200)}...</p>
                  {post.hashtags?.length > 0 && (
                    <div className="hashtags">
                      {post.hashtags.map((tag, index) => (
                        <span key={index} className="hashtag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="post-schedule">
                  <div className="schedule-info">
                    <strong>Scheduled for:</strong> {formatDateTime(post.scheduled_for)}
                  </div>
                  {post.selected_images?.length > 0 && (
                    <div className="image-info">
                      <span className="image-count">
                        📷 {post.selected_images.length} image(s)
                      </span>
                    </div>
                  )}
                </div>

                {post.performance_score && (
                  <div className="performance-score">
                    Performance Score: {post.performance_score}/10
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Schedule Post for Publishing</h3>
              <button
                className="close-btn"
                onClick={() => setShowScheduleModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                handleSchedulePost(scheduleForm.postId, {
                  scheduledFor: scheduleForm.scheduledFor,
                  useSmartScheduling: scheduleForm.useSmartScheduling,
                  selectedImageId: scheduleForm.selectedImageId
                });
              }}>
                <div className="form-group">
                  <label>Post ID:</label>
                  <input
                    type="number"
                    value={scheduleForm.postId}
                    onChange={(e) => setScheduleForm({
                      ...scheduleForm,
                      postId: e.target.value
                    })}
                    placeholder="Enter post ID"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={scheduleForm.useSmartScheduling}
                      onChange={(e) => setScheduleForm({
                        ...scheduleForm,
                        useSmartScheduling: e.target.checked
                      })}
                    />
                    Use Smart Scheduling (AI-optimized timing)
                  </label>
                </div>

                {!scheduleForm.useSmartScheduling && (
                  <div className="form-group">
                    <label>Scheduled Time:</label>
                    <input
                      type="datetime-local"
                      value={scheduleForm.scheduledFor}
                      onChange={(e) => setScheduleForm({
                        ...scheduleForm,
                        scheduledFor: e.target.value
                      })}
                      min={new Date().toISOString().slice(0, 16)}
                      required={!scheduleForm.useSmartScheduling}
                    />
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    Schedule Post
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowScheduleModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>Post Details</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedPost(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="post-detail">
                <div className="detail-section">
                  <h4>Content</h4>
                  <div className="content-text">{selectedPost.post_content}</div>
                </div>

                {selectedPost.hashtags?.length > 0 && (
                  <div className="detail-section">
                    <h4>Hashtags</h4>
                    <div className="hashtags">
                      {selectedPost.hashtags.map((tag, index) => (
                        <span key={index} className="hashtag">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="detail-section">
                  <h4>Schedule Information</h4>
                  <div className="detail-grid">
                    <div>
                      <strong>Scheduled for:</strong><br />
                      {formatDateTime(selectedPost.scheduled_for)}
                    </div>
                    <div>
                      <strong>Scheduled by:</strong><br />
                      {selectedPost.scheduled_by_name}
                    </div>
                    <div>
                      <strong>Content Type:</strong><br />
                      {selectedPost.content_type}
                    </div>
                    <div>
                      <strong>Status:</strong><br />
                      {getStatusBadge(selectedPost.status)}
                    </div>
                  </div>
                </div>

                {selectedPost.selected_images?.length > 0 && (
                  <div className="detail-section">
                    <h4>Images</h4>
                    <div className="image-gallery">
                      {selectedPost.selected_images.map((image) => (
                        <div key={image.id} className="image-item">
                          <img 
                            src={image.url} 
                            alt="Post image"
                            className="post-image"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="detail-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handlePublishNow(selectedPost.id)}
                  >
                    Publish Now
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      handleCancelScheduled(selectedPost.id);
                      setSelectedPost(null);
                    }}
                  >
                    Cancel Schedule
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedPost(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublishingDashboard;