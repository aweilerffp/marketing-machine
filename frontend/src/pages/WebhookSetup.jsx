/**
 * Marketing Machine - Webhook Setup Page
 * Configure and manage meeting recorder integrations
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  CardActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
  Grid,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Switch,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Pause as PauseIcon,
  VideoLibrary as RecorderIcon,
  Link as LinkIcon,
  Security as SecurityIcon,
  Analytics as AnalyticsIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { createAuthenticatedAPI } from '../services/api';

// Supported meeting recorders
const RECORDERS = {
  'read.ai': {
    name: 'Read.ai',
    icon: '📹',
    color: '#4A90E2',
    description: 'AI-powered meeting assistant with automatic transcription'
  },
  'otter.ai': {
    name: 'Otter.ai',
    icon: '🎙️',
    color: '#00D4AA',
    description: 'Real-time transcription and collaboration platform'
  },
  'zoom': {
    name: 'Zoom',
    icon: '🎥',
    color: '#2D8CFF',
    description: 'Video conferencing with cloud recording'
  },
  'fireflies': {
    name: 'Fireflies.ai',
    icon: '🔥',
    color: '#FF6B6B',
    description: 'AI notetaker for meetings'
  },
  'custom': {
    name: 'Custom Integration',
    icon: '⚙️',
    color: '#666666',
    description: 'Connect any meeting recorder via webhook'
  }
};

function WebhookSetup() {
  const { getToken } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [selectedRecorder, setSelectedRecorder] = useState('');
  const [webhookName, setWebhookName] = useState('');
  const [filterKeywords, setFilterKeywords] = useState('');
  const [webhookConfig, setWebhookConfig] = useState(null);
  const [existingWebhooks, setExistingWebhooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [copied, setCopied] = useState({});

  useEffect(() => {
    fetchExistingWebhooks();
  }, []);

  const fetchExistingWebhooks = async () => {
    try {
      const api = createAuthenticatedAPI(getToken);
      const response = await api.get('/webhooks/configs');
      setExistingWebhooks(response.data.webhooks || []);
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    }
  };

  const handleRecorderSelect = (recorder) => {
    setSelectedRecorder(recorder);
    setActiveStep(1);
  };

  const handleConfigSubmit = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const api = createAuthenticatedAPI(getToken);
      const response = await api.post('/webhooks/configs', {
        name: webhookName || `${RECORDERS[selectedRecorder].name} Integration`,
        source_type: selectedRecorder,
        filters: filterKeywords ? {
          keywords: filterKeywords.split(',').map(k => k.trim())
        } : {}
      });

      setWebhookConfig(response.data.webhook);
      setActiveStep(2);
      setSuccess('Webhook configuration created successfully!');
      fetchExistingWebhooks();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create webhook configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (field) => {
    const value = field === 'url' ? webhookConfig.webhook_url : webhookConfig.secret_key;
    navigator.clipboard.writeText(value);
    setCopied({ ...copied, [field]: true });
    setTimeout(() => {
      setCopied({ ...copied, [field]: false });
    }, 2000);
  };

  const handleTestWebhook = async (configId) => {
    setTestStatus({ id: configId, status: 'testing' });
    
    try {
      const api = createAuthenticatedAPI(getToken);
      const response = await api.post(`/webhooks/test/${configId || webhookConfig.id}`);
      setTestStatus({ id: configId, status: 'success', message: 'Test successful!' });
      setSuccess('Webhook test completed successfully!');
    } catch (err) {
      setTestStatus({ 
        id: configId, 
        status: 'error', 
        message: err.response?.data?.error || 'Test failed' 
      });
      setError('Webhook test failed. Please check your configuration.');
    }
  };

  const handleToggleWebhook = async (webhook) => {
    try {
      const api = createAuthenticatedAPI(getToken);
      const newStatus = webhook.status === 'active' ? 'paused' : 'active';
      await api.put(`/webhooks/configs/${webhook.id}`, { status: newStatus });
      
      setSuccess(`Webhook ${newStatus === 'active' ? 'activated' : 'paused'} successfully`);
      fetchExistingWebhooks();
    } catch (err) {
      setError('Failed to update webhook status');
    }
  };

  const handleDeleteWebhook = async () => {
    if (!deleteDialog) return;
    
    try {
      const api = createAuthenticatedAPI(getToken);
      await api.delete(`/webhooks/configs/${deleteDialog.id}`);
      
      setSuccess('Webhook deleted successfully');
      setDeleteDialog(null);
      fetchExistingWebhooks();
    } catch (err) {
      setError('Failed to delete webhook');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckIcon color="success" />;
      case 'paused':
        return <PauseIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <WarningIcon color="disabled" />;
    }
  };

  const steps = ['Select Recorder', 'Configure', 'Setup Instructions', 'Test Connection'];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Meeting Recorder Integration
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Connect your meeting recorder to automatically generate content from your transcripts
      </Typography>

      {/* Existing Webhooks */}
      {existingWebhooks.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardHeader 
            title="Active Webhooks"
            subheader={`${existingWebhooks.length} webhook${existingWebhooks.length !== 1 ? 's' : ''} configured`}
          />
          <CardContent>
            <List>
              {existingWebhooks.map((webhook, index) => (
                <React.Fragment key={webhook.id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemIcon>
                      <Typography variant="h5">
                        {RECORDERS[webhook.source_type]?.icon || '📡'}
                      </Typography>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {webhook.name}
                          {getStatusIcon(webhook.status)}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {RECORDERS[webhook.source_type]?.name || webhook.source_type}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                            <Chip 
                              size="small" 
                              icon={<AnalyticsIcon />}
                              label={`${webhook.statistics?.transcripts_processed || 0} transcripts`}
                            />
                            <Chip 
                              size="small"
                              icon={<ScheduleIcon />}
                              label={webhook.statistics?.last_received 
                                ? `Last: ${new Date(webhook.statistics.last_received).toLocaleDateString()}`
                                : 'No data yet'}
                            />
                            {webhook.statistics?.success_rate > 0 && (
                              <Chip 
                                size="small"
                                color={webhook.statistics.success_rate > 90 ? 'success' : 'warning'}
                                label={`${webhook.statistics.success_rate}% success`}
                              />
                            )}
                          </Box>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title="Test Connection">
                        <IconButton 
                          onClick={() => handleTestWebhook(webhook.id)}
                          disabled={testStatus?.id === webhook.id && testStatus.status === 'testing'}
                        >
                          {testStatus?.id === webhook.id && testStatus.status === 'testing'
                            ? <CircularProgress size={20} />
                            : <TestIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={webhook.status === 'active' ? 'Pause' : 'Activate'}>
                        <Switch
                          checked={webhook.status === 'active'}
                          onChange={() => handleToggleWebhook(webhook)}
                        />
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          onClick={() => setDeleteDialog(webhook)}
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Setup Wizard */}
      <Card>
        <CardHeader 
          title="Add New Webhook"
          subheader="Connect a meeting recorder to start generating content"
        />
        <CardContent>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {/* Step 1: Select Recorder */}
          {activeStep === 0 && (
            <Grid container spacing={2}>
              {Object.entries(RECORDERS).map(([key, recorder]) => (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <Paper
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: 2,
                      borderColor: selectedRecorder === key ? recorder.color : 'transparent',
                      '&:hover': {
                        borderColor: recorder.color,
                        bgcolor: 'action.hover'
                      }
                    }}
                    onClick={() => handleRecorderSelect(key)}
                  >
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h2">{recorder.icon}</Typography>
                      <Typography variant="h6" sx={{ mt: 1 }}>
                        {recorder.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {recorder.description}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Step 2: Configure */}
          {activeStep === 1 && (
            <Box sx={{ maxWidth: 600, mx: 'auto' }}>
              <TextField
                fullWidth
                label="Webhook Name"
                value={webhookName}
                onChange={(e) => setWebhookName(e.target.value)}
                placeholder={`${RECORDERS[selectedRecorder]?.name} Integration`}
                sx={{ mb: 3 }}
              />
              <TextField
                fullWidth
                label="Filter Keywords (optional)"
                value={filterKeywords}
                onChange={(e) => setFilterKeywords(e.target.value)}
                placeholder="marketing, strategy, content"
                helperText="Comma-separated keywords to filter meetings"
                sx={{ mb: 3 }}
              />
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button onClick={() => setActiveStep(0)}>
                  Back
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleConfigSubmit}
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'Create Configuration'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 3: Setup Instructions */}
          {activeStep === 2 && webhookConfig && (
            <Box>
              <Alert severity="success" sx={{ mb: 3 }}>
                Webhook configuration created! Follow the instructions below to complete setup.
              </Alert>

              <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50' }}>
                <Typography variant="h6" gutterBottom>
                  <LinkIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Your Webhook URL
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TextField
                    fullWidth
                    value={webhookConfig.webhook_url}
                    InputProps={{ readOnly: true }}
                    size="small"
                  />
                  <IconButton onClick={() => handleCopy('url')}>
                    {copied.url ? <CheckIcon color="success" /> : <CopyIcon />}
                  </IconButton>
                </Box>

                <Typography variant="h6" gutterBottom>
                  <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Secret Key
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    fullWidth
                    value={webhookConfig.secret_key}
                    type="password"
                    InputProps={{ readOnly: true }}
                    size="small"
                  />
                  <IconButton onClick={() => handleCopy('secret')}>
                    {copied.secret ? <CheckIcon color="success" /> : <CopyIcon />}
                  </IconButton>
                </Box>
              </Paper>

              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Setup Instructions for {RECORDERS[selectedRecorder]?.name}
                </Typography>
                <List>
                  {webhookConfig.instructions?.steps?.map((step, index) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={`${index + 1}. ${step}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>

              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={() => setActiveStep(1)}>
                  Back
                </Button>
                <Button 
                  variant="contained" 
                  onClick={() => setActiveStep(3)}
                >
                  Continue to Test
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 4: Test Connection */}
          {activeStep === 3 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="h6" gutterBottom>
                Test Your Webhook Connection
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Click the button below to send a test webhook to verify your configuration
              </Typography>
              
              {testStatus?.status === 'success' && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  <Typography variant="h6">✅ Connection Successful!</Typography>
                  Your webhook is configured correctly and ready to receive transcripts.
                </Alert>
              )}

              {testStatus?.status === 'error' && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <Typography variant="h6">Connection Failed</Typography>
                  {testStatus.message}
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button 
                  variant="contained" 
                  size="large"
                  startIcon={testStatus?.status === 'testing' ? <CircularProgress size={20} /> : <TestIcon />}
                  onClick={() => handleTestWebhook()}
                  disabled={testStatus?.status === 'testing'}
                >
                  {testStatus?.status === 'testing' ? 'Testing...' : 'Send Test Webhook'}
                </Button>
              </Box>

              {testStatus?.status === 'success' && (
                <Box sx={{ mt: 4 }}>
                  <Button 
                    variant="contained" 
                    color="success"
                    size="large"
                    onClick={() => {
                      setActiveStep(0);
                      setSelectedRecorder('');
                      setWebhookName('');
                      setFilterKeywords('');
                      setWebhookConfig(null);
                      setTestStatus(null);
                    }}
                  >
                    Complete Setup
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>Delete Webhook Configuration?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button onClick={handleDeleteWebhook} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifications */}
      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={() => setSuccess(null)}
        message={success}
      />
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
      />
    </Box>
  );
}

export default WebhookSetup;