import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'react-query'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'

// Icons
import { 
  Upload, 
  FileText, 
  Mic, 
  Video, 
  File, 
  Trash2, 
  Play,
  Clock,
  Zap,
  ChevronRight,
  AlertCircle
} from 'lucide-react'

// Services
import { contentAPI } from '@/services/api'

// Components
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import SampleContentSelector from '@/components/content/SampleContentSelector'

// Sample content for testing
const SAMPLE_CONTENT = {
  sales_meeting: {
    title: "B2B Sales Discovery Call",
    content: `[Sales Rep]: Thanks for joining today, Sarah. I'd love to learn about your current catalog management challenges on Amazon.

[Sarah - Prospect]: We're managing about 5,000 SKUs across multiple brands. The biggest pain point is keeping variations in sync. When we update one variant, the others don't always update correctly, and we've lost Buy Box eligibility multiple times because of listing errors.

[Sales Rep]: That's exactly what we solve at FlatFilePro. Our bulk editing tool can update all variations simultaneously, and we have error detection that catches issues before they affect your Buy Box. How much revenue would you estimate you've lost from these listing problems?

[Sarah]: It's hard to quantify exactly, but we estimate we lose about $50,000 per month in sales when products go out of Buy Box. It usually takes us 2-3 days to notice and fix the issues.

[Sales Rep]: With our real-time monitoring, you'd know immediately when there's a problem. Plus, our automated variation management would prevent most of these issues from happening in the first place. We've helped similar-sized brands reduce listing errors by 95% and increase their Buy Box win rate by 30%.

[Sarah]: That sounds impressive. What kind of implementation timeline are we looking at? And what's the learning curve for my team?

[Sales Rep]: Implementation typically takes 2-4 weeks depending on catalog complexity. We provide full onboarding support, and most teams are up and running productively within the first week. We also offer ongoing training and 24/7 support.`,
    metadata: {
      type: 'sales_discovery',
      duration: '30 minutes',
      key_topics: ['variations', 'buy box', 'bulk editing', 'revenue impact']
    }
  },
  
  product_update: {
    title: "Product Team Weekly Sync",
    content: `[Product Manager]: Quick update on the new bulk upload feature. We've reduced processing time by 70% - what used to take 30 minutes now completes in under 9 minutes.

[Engineer]: We achieved this by implementing parallel processing and optimizing our database queries. The system can now handle 100,000 SKUs without timeout issues.

[Product Manager]: This is huge for our enterprise clients. ABC Corp specifically mentioned this was blocking them from migrating their full catalog to our platform. Now they can process their entire inventory in one upload session.

[Designer]: From a UX perspective, we've added a real-time progress bar and better error messaging. Users can see exactly which items are processing and get instant feedback on any validation issues.

[QA Lead]: We've run extensive testing with datasets up to 500,000 SKUs. The new architecture is solid and handles edge cases much better than the previous version.

[Product Manager]: Perfect. This puts us ahead of competitors who still struggle with large catalog uploads. Let's make sure we highlight this in our next release notes and get the sales team trained on the performance improvements.`,
    metadata: {
      type: 'product_update',
      feature: 'bulk_upload_optimization',
      impact: 'enterprise_clients',
      metrics: ['70% faster processing', '100K SKU capacity']
    }
  },
  
  customer_success: {
    title: "Customer Success Story Discussion",
    content: `[CS Manager]: I want to share an amazing win from XYZ Retailer. They've increased their Amazon revenue by 45% in just 3 months using our automated listing optimization.

[Team Lead]: That's incredible! What specifically drove that improvement?

[CS Manager]: Three things: First, they used our variation management to fix 2,000 broken parent-child relationships that were hurting their search visibility. Second, our keyword optimization tool helped them rank for 15 new high-volume search terms. Third, they're saving 20 hours per week on manual updates, which they're reinvesting in product expansion.

[Account Manager]: What was their biggest concern during onboarding?

[CS Manager]: They were worried about disrupting their existing workflow since they had a complex multi-brand catalog. But our phased rollout approach let them test with one brand first, see the results, then scale to their full catalog.

[Team Lead]: Have they become a reference customer?

[CS Manager]: Absolutely. They're so happy they agreed to a case study and will speak at our user conference next month. The CEO said our platform is "the first tool that actually delivers on its promises for Amazon sellers."

[Marketing]: This is perfect timing for our Q4 campaign. Can we get metrics on their specific improvements for the case study?

[CS Manager]: Yes, I'll pull together the revenue growth, time savings, and ranking improvements data. It's a compelling story of transformation.`,
    metadata: {
      type: 'customer_success',
      metrics: ['45% revenue increase', '20 hours saved weekly', '15 new keyword rankings'],
      features_used: ['variation_management', 'keyword_optimization', 'automation']
    }
  }
}

const ContentInputPage = () => {
  const navigate = useNavigate()
  
  // Form state
  const [content, setContent] = useState('')
  const [contentType, setContentType] = useState('meeting_transcript')
  const [title, setTitle] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [processingStatus, setProcessingStatus] = useState(null)

  // File upload with react-dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/markdown': ['.md']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: async (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const error = rejectedFiles[0].errors[0]
        toast.error(`File rejected: ${error.message}`)
        return
      }

      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]
        setUploadedFiles([file])
        
        // Extract text content from file
        try {
          const text = await extractTextFromFile(file)
          setContent(text)
          toast.success(`File uploaded: ${file.name}`)
        } catch (error) {
          toast.error(`Failed to read file: ${error.message}`)
        }
      }
    }
  })

  // Content submission mutation
  const submitContentMutation = useMutation(
    (contentData) => contentAPI.submitManual(contentData),
    {
      onSuccess: (response) => {
        const { batch_id } = response.data
        toast.success('Content submitted successfully!')
        
        // Start polling for processing status
        setProcessingStatus({
          batchId: batch_id,
          status: 'processing',
          step: 'initializing',
          progress: 0
        })
        
        // Navigate to approval page after processing
        setTimeout(() => {
          navigate(`/approval?batch=${batch_id}`)
        }, 2000)
      },
      onError: (error) => {
        const message = error.response?.data?.error?.message || 'Failed to submit content'
        toast.error(message)
      }
    }
  )

  // Extract text from file
  const extractTextFromFile = async (file) => {
    const fileType = file.type || file.name.split('.').pop()
    
    if (fileType === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      return await file.text()
    }
    
    if (fileType === 'application/pdf' || file.name.endsWith('.pdf')) {
      // For now, just return a placeholder - PDF parsing would be done on backend
      throw new Error('PDF parsing not implemented yet - please paste text content instead')
    }
    
    if (file.name.endsWith('.docx')) {
      // For now, just return a placeholder - DOCX parsing would be done on backend
      throw new Error('DOCX parsing not implemented yet - please paste text content instead')
    }
    
    throw new Error('Unsupported file type')
  }

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault()
    
    if (!content.trim()) {
      toast.error('Please provide content or upload a file')
      return
    }

    const contentData = {
      title: title.trim() || `${contentType.replace('_', ' ')} - ${new Date().toLocaleDateString()}`,
      content: content.trim(),
      content_type: contentType,
      metadata: {
        source: 'manual_input',
        input_method: uploadedFiles.length > 0 ? 'file_upload' : 'manual_text',
        timestamp: new Date().toISOString(),
        character_count: content.length,
        estimated_reading_time: Math.ceil(content.split(' ').length / 200)
      }
    }

    submitContentMutation.mutate(contentData)
  }

  // Handle sample content selection
  const handleSampleSelect = (sample) => {
    setContent(sample.content)
    setTitle(sample.title)
    setContentType(sample.metadata.type || 'meeting_transcript')
    setUploadedFiles([])
    toast.success('Sample content loaded')
  }

  // Clear content
  const handleClear = () => {
    setContent('')
    setTitle('')
    setUploadedFiles([])
    toast.success('Content cleared')
  }

  // Remove uploaded file
  const removeFile = () => {
    setUploadedFiles([])
    setContent('')
    toast.success('File removed')
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Drop Content into Marketing Machine
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Paste a meeting transcript, upload a document, or type any content to generate LinkedIn posts instantly.
          Marketing Machine will extract marketing hooks and create engaging posts for you.
        </p>
      </div>

      {/* Processing Status */}
      {processingStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <LoadingSpinner className="mr-3" />
            <div>
              <h3 className="font-semibold text-blue-900">Marketing Machine is Working...</h3>
              <p className="text-blue-700">Processing your content and generating LinkedIn posts</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-blue-600">
              <span>Progress</span>
              <span>{processingStatus.progress}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${processingStatus.progress}%` }}
              />
            </div>
            <p className="text-sm text-blue-600">
              Estimated time: 30-45 seconds
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Content Type Selection */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content Type
          </label>
          <select
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
            className="input-field"
            disabled={submitContentMutation.isLoading}
          >
            <option value="meeting_transcript">Meeting Transcript</option>
            <option value="sales_call">Sales Call</option>
            <option value="product_update">Product Update</option>
            <option value="customer_success">Customer Success Story</option>
            <option value="blog_post">Blog Post</option>
            <option value="general_notes">General Notes</option>
          </select>
        </div>

        {/* Title */}
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Title (Optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your content a descriptive title..."
            className="input-field"
            disabled={submitContentMutation.isLoading}
          />
        </div>

        {/* Content Input Methods */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Text Input */}
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Paste or Type Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your meeting transcript, notes, or any text content here..."
              rows={15}
              className="input-field resize-none"
              disabled={submitContentMutation.isLoading}
            />
            <div className="mt-2 text-sm text-gray-500 flex justify-between">
              <span>{content.length} characters</span>
              <span>~{Math.ceil(content.split(' ').length / 200)} min read</span>
            </div>
          </div>

          {/* File Upload */}
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-4">
              Or Upload a File
            </label>
            
            {uploadedFiles.length > 0 ? (
              <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <File className="w-5 h-5 text-green-600 mr-2" />
                    <div>
                      <p className="font-medium text-green-900">{uploadedFiles[0].name}</p>
                      <p className="text-sm text-green-600">
                        {(uploadedFiles[0].size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="text-red-600 hover:text-red-800"
                    disabled={submitContentMutation.isLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={`upload-area ${isDragActive ? 'upload-area-active' : ''}`}
              >
                <input {...getInputProps()} />
                <div className="text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-900 mb-2">
                    {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Supports: .txt, .docx, .pdf, .md
                  </p>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={submitContentMutation.isLoading}
                  >
                    Browse Files
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sample Content */}
        <SampleContentSelector onSelect={handleSampleSelect} />

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 border-t">
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={handleClear}
              className="btn-secondary"
              disabled={submitContentMutation.isLoading}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </button>
          </div>

          <button
            type="submit"
            className="btn-primary flex items-center px-8 py-3 text-lg"
            disabled={!content.trim() || submitContentMutation.isLoading}
          >
            {submitContentMutation.isLoading ? (
              <>
                <LoadingSpinner className="mr-3" />
                Marketing Machine is Working...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Generate LinkedIn Posts
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Marketing Machine analyzes your content and extracts 10 marketing hooks</li>
                <li>Each hook becomes a LinkedIn post (1500-2200 characters)</li>
                <li>Posts are optimized for LinkedIn algorithm and engagement</li>
                <li>You'll review and approve posts before publishing</li>
              </ul>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default ContentInputPage