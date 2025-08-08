{
  "displayName": "Cloud Run P95 latency > 1.5s (5m)",
  "combiner": "OR",
  "notificationChannels": ["{{NOTIFICATION_CHANNEL_ID}}"],
  "conditions": [
    {
      "displayName": "P95 latency threshold",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_revision\" AND resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" AND resource.label.\"location\"=\"{{REGION}}\" AND metric.type=\"run.googleapis.com/request_latencies\"",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_PERCENTILE_95",
            "crossSeriesReducer": "REDUCE_MEAN",
            "groupByFields": ["resource.label.\"service_name\""]
          }
        ],
        "comparison": "COMPARISON_GT",
        "thresholdValue": 1.5,
        "duration": "300s",
        "trigger": { "count": 1 }
      }
    }
  ]
}


