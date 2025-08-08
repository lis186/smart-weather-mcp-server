{
  "displayName": "Cloud Run memory bytes > 80% of limit (5m)",
  "notificationChannels": ["{{NOTIFICATION_CHANNEL_ID}}"],
  "combiner": "OR",
  "conditions": [
    {
      "displayName": "Memory usage ratio MQL",
      "conditionMonitoringQueryLanguage": {
        "duration": "300s",
        "query": "mem = fetch cloud_run_revision | metric 'run.googleapis.com/container/instance/memory/bytes_used' | filter resource.service_name == '{{SERVICE_NAME}}' && resource.location == '{{REGION}}' | align mean(1m);\nlimit = fetch cloud_run_revision | metric 'run.googleapis.com/container/instance/memory/limit_bytes' | filter resource.service_name == '{{SERVICE_NAME}}' && resource.location == '{{REGION}}' | align mean(1m);\njoin mem, limit | value val(0) / val(1) | condition gt(val(), 0.8)"
      }
    }
  ]
}


