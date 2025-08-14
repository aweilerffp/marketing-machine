import React, { useState } from 'react'
import { Play, ChevronDown, ChevronUp } from 'lucide-react'

// Sample content for testing
const SAMPLE_CONTENT = {
  sales_meeting: {
    title: "B2B Sales Discovery Call",
    content: `[Sales Rep]: Thanks for joining today, Sarah. I'd love to learn about your current catalog management challenges on Amazon.

[Sarah - Prospect]: We're managing about 5,000 SKUs across multiple brands. The biggest pain point is keeping variations in sync. When we update one variant, the others don't always update correctly, and we've lost Buy Box eligibility multiple times because of listing errors.

[Sales Rep]: That's exactly what we solve at FlatFilePro. Our bulk editing tool can update all variations simultaneously, and we have error detection that catches issues before they affect your Buy Box. How much revenue would you estimate you've lost from these listing problems?

[Sarah]: It's hard to quantify exactly, but we estimate we lose about $50,000 per month in sales when products go out of Buy Box. It usually takes us 2-3 days to notice and fix the issues.`,
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

[Product Manager]: This is huge for our enterprise clients. ABC Corp specifically mentioned this was blocking them from migrating their full catalog to our platform.`,
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

[CS Manager]: Three things: First, they used our variation management to fix 2,000 broken parent-child relationships that were hurting their search visibility. Second, our keyword optimization tool helped them rank for 15 new high-volume search terms.`,
    metadata: {
      type: 'customer_success',
      metrics: ['45% revenue increase', '20 hours saved weekly', '15 new keyword rankings'],
      features_used: ['variation_management', 'keyword_optimization', 'automation']
    }
  }
}

export default function SampleContentSelector({ onSelect }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handleSampleSelect = (key) => {
    onSelect(SAMPLE_CONTENT[key])
    setIsExpanded(false)
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Try Sample Content (Demo)
        </label>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
        >
          {isExpanded ? (
            <>
              Hide Samples <ChevronUp className="w-4 h-4 ml-1" />
            </>
          ) : (
            <>
              Show Samples <ChevronDown className="w-4 h-4 ml-1" />
            </>
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            Click any sample below to load realistic content and test Marketing Machine:
          </p>
          
          <div className="grid gap-3">
            {Object.entries(SAMPLE_CONTENT).map(([key, sample]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleSampleSelect(key)}
                className="text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{sample.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {sample.content.substring(0, 100)}...
                    </p>
                    <div className="flex items-center mt-2 text-xs text-gray-500">
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {sample.metadata.type.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <Play className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}