{
  "displayName": "Cloud Run 5xx error rpm > 3 (5m)",
  "notificationChannels": ["{{NOTIFICATION_CHANNEL_ID}}"],
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "5xx error absolute rate",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" AND resource.label.\"location\"=\"{{REGION}}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.\"response_code_class\"=\"5xx\"",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_RATE",
            "crossSeriesReducer": "REDUCE_SUM",
            "groupByFields": ["resource.label.\"service_name\""]
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0.05,
        "duration": "300s",
        "trigger": { "count": 1 }
      }
    }
  ]
}


