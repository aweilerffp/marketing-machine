/**
 * Marketing Machine - Webhook Dashboard Component
 * Real-time monitoring of webhook activity and transcripts
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  LinearProgress,
  IconButton,
  Tooltip,
  Badge,
  Alert,
  Button,
  Divider,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Description as TranscriptIcon,
  AutoAwesome as HookIcon,
  PostAdd as PostIcon,
  Image as ImageIcon,
  Schedule as ScheduleIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  HourglassEmpty as ProcessingIcon,
  MoreVert as MoreIcon,
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  TrendingUp as TrendingIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { createAuthenticatedAPI } from '../services/api';

// Format relative time
function formatRelativeTime(date) {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now - then) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return then.toLocaleDateString();
}

// Status colors and icons
const STATUS_CONFIG = {
  pending: { color: 'default', icon: <HourglassEmpty />, label: 'Pending' },
  processing: { color: 'info', icon: <ProcessingIcon />, label: 'Processing' },
  completed: { color: 'success', icon: <SuccessIcon />, label: 'Completed' },
  failed: { color: 'error', icon: <ErrorIcon />, label: 'Failed' }
};

function WebhookDashboard() {
  const { getToken } = useAuth();
  const [transcripts, setTranscripts] = useState([]);
  const [stats, setStats] = useState({
    total_transcripts: 0,
    total_hooks: 0,
    total_posts: 0,
    processing_time: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuTranscript, setMenuTranscript] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    
    try {
      const api = createAuthenticatedAPI(getToken);
      
      // Fetch recent transcripts
      const transcriptsResponse = await api.get('/content/sources?type=webhook&limit=10');
      setTranscripts(transcriptsResponse.data.sources || []);
      
      // Fetch statistics
      const statsResponse = await api.get('/analytics/webhook-stats');
      setStats(statsResponse.data);
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMenuOpen = (event, transcript) => {
    setAnchorEl(event.currentTarget);
    setMenuTranscript(transcript);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuTranscript(null);
  };

  const handleViewTranscript = (transcript) => {
    setSelectedTranscript(transcript);
    handleMenuClose();
  };

  const handleRegenerateHooks = async (transcriptId) => {
    try {
      const api = createAuthenticatedAPI(getToken);
      await api.post(`/content/regenerate-hooks/${transcriptId}`);
      fetchDashboardData(true);
    } catch (error) {
      console.error('Failed to regenerate hooks:', error);
    }
    handleMenuClose();
  };

  const getProcessingStage = (transcript) => {
    if (transcript.posts_count > 0) return { stage: 4, label: 'Posts Generated' };
    if (transcript.hooks_count > 0) return { stage: 3, label: 'Hooks Extracted' };
    if (transcript.processing_status === 'processing') return { stage: 2, label: 'Processing' };
    if (transcript.processing_status === 'pending') return { stage: 1, label: 'Queued' };
    return { stage: 0, label: 'Received' };
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Transcripts
                  </Typography>
                  <Typography variant="h4">
                    {stats.total_transcripts}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'primary.light' }}>
                  <TranscriptIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Hooks Generated
                  </Typography>
                  <Typography variant="h4">
                    {stats.total_hooks}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'secondary.light' }}>
                  <HookIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Posts Created
                  </Typography>
                  <Typography variant="h4">
                    {stats.total_posts}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'success.light' }}>
                  <PostIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Avg Processing
                  </Typography>
                  <Typography variant="h4">
                    {stats.processing_time}s
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: 'warning.light' }}>
                  <SpeedIcon />
                </Avatar>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Transcripts */}
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Recent Transcripts
            </Typography>
            <Tooltip title="Refresh">
              <IconButton onClick={() => fetchDashboardData(true)} disabled={refreshing}>
                <RefreshIcon className={refreshing ? 'rotating' : ''} />
              </IconButton>
            </Tooltip>
          </Box>

          {transcripts.length === 0 ? (
            <Alert severity="info">
              No transcripts received yet. Configure a webhook to get started.
            </Alert>
          ) : (
            <List>
              {transcripts.map((transcript, index) => {
                const processingStage = getProcessingStage(transcript);
                const statusConfig = STATUS_CONFIG[transcript.processing_status] || STATUS_CONFIG.pending;
                
                return (
                  <React.Fragment key={transcript.id}>
                    {index > 0 && <Divider />}
                    <ListItem
                      sx={{
                        '&:hover': {
                          bgcolor: 'action.hover'
                        }
                      }}
                    >
                      <ListItemAvatar>
                        <Badge
                          badgeContent={statusConfig.icon}
                          color={statusConfig.color}
                          anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                          }}
                        >
                          <Avatar>
                            <TranscriptIcon />
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle1">
                              {transcript.title || 'Untitled Meeting'}
                            </Typography>
                            <Chip 
                              size="small"
                              label={transcript.source_name}
                              variant="outlined"
                            />
                            {transcript.duration && (
                              <Chip
                                size="small"
                                icon={<ScheduleIcon />}
                                label={`${transcript.duration} min`}
                              />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                              {formatRelativeTime(transcript.created_at)}
                              {transcript.word_count && ` • ${transcript.word_count} words`}
                            </Typography>
                            
                            {/* Processing Pipeline */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <LinearProgress 
                                variant="determinate" 
                                value={processingStage.stage * 25}
                                sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {processingStage.label}
                              </Typography>
                            </Box>

                            {/* Generated Content Stats */}
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                              {transcript.hooks_count > 0 && (
                                <Chip
                                  size="small"
                                  icon={<HookIcon />}
                                  label={`${transcript.hooks_count} hooks`}
                                  color="primary"
                                  variant="outlined"
                                />
                              )}
                              {transcript.posts_count > 0 && (
                                <Chip
                                  size="small"
                                  icon={<PostIcon />}
                                  label={`${transcript.posts_count} posts`}
                                  color="success"
                                  variant="outlined"
                                />
                              )}
                              {transcript.images_count > 0 && (
                                <Chip
                                  size="small"
                                  icon={<ImageIcon />}
                                  label={`${transcript.images_count} images`}
                                  color="secondary"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          </Box>
                        }
                      />
                      <IconButton onClick={(e) => handleMenuOpen(e, transcript)}>
                        <MoreIcon />
                      </IconButton>
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleViewTranscript(menuTranscript)}>
          <ViewIcon sx={{ mr: 1 }} /> View Transcript
        </MenuItem>
        <MenuItem onClick={() => handleRegenerateHooks(menuTranscript?.id)}>
          <RefreshIcon sx={{ mr: 1 }} /> Regenerate Hooks
        </MenuItem>
        <MenuItem onClick={() => window.location.href = `/content/${menuTranscript?.id}`}>
          <PostIcon sx={{ mr: 1 }} /> View Generated Content
        </MenuItem>
      </Menu>

      <style>
        {`
          @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .rotating {
            animation: rotate 1s linear infinite;
          }
        `}
      </style>
    </Box>
  );
}

export default WebhookDashboard;