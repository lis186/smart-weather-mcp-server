{
  "displayName": "Smart Weather - Cloud Run",
  "gridLayout": {
    "columns": 3,
    "widgets": [
      {
        "title": "Requests per minute",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_count\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" resource.label.\"location\"=\"{{REGION}}\"",
                  "aggregation": { "alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_RATE" }
                }
              }
            }
          ],
          "chartOptions": { "mode": "COLOR" }
        }
      },
      {
        "title": "Latency P50/P95",
        "xyChart": {
          "dataSets": [
            {
              "plotType": "LINE",
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" resource.label.\"location\"=\"{{REGION}}\"",
                  "aggregation": { "alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_PERCENTILE_50" }
                }
              }
            },
            {
              "plotType": "LINE",
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_latencies\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" resource.label.\"location\"=\"{{REGION}}\"",
                  "aggregation": { "alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_PERCENTILE_95" }
                }
              }
            }
          ],
          "chartOptions": { "mode": "COLOR" }
        }
      },
      {
        "title": "5xx error rate (rpm)",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/request_count\" metric.label.\"response_code_class\"=\"5xx\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" resource.label.\"location\"=\"{{REGION}}\"",
                  "aggregation": { "alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_RATE" }
                }
              }
            }
          ],
          "chartOptions": { "mode": "COLOR" }
        }
      },
      {
        "title": "CPU utilization",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/container/instance/cpu/utilization\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" resource.label.\"location\"=\"{{REGION}}\"",
                  "aggregation": { "alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_MEAN" }
                }
              }
            }
          ],
          "chartOptions": { "mode": "COLOR" }
        }
      },
      {
        "title": "Memory utilization",
        "xyChart": {
          "dataSets": [
            {
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "metric.type=\"run.googleapis.com/container/instance/memory/utilization\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" resource.label.\"location\"=\"{{REGION}}\"",
                  "aggregation": { "alignmentPeriod": "60s", "perSeriesAligner": "ALIGN_MEAN" }
                }
              }
            }
          ],
          "chartOptions": { "mode": "COLOR" }
        }
      },
      {
        "title": "Concurrency / Active instances",
        "xyChart": {
          "dataSets": [
            { "timeSeriesQuery": { "timeSeriesFilter": { "filter": "metric.type=\"run.googleapis.com/container/instance/concurrent_requests\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" resource.label.\"location\"=\"{{REGION}}\"" } } },
            { "timeSeriesQuery": { "timeSeriesFilter": { "filter": "metric.type=\"run.googleapis.com/container/instance/active_instances\" resource.type=\"cloud_run_revision\" resource.label.\"service_name\"=\"{{SERVICE_NAME}}\" resource.label.\"location\"=\"{{REGION}}\"" } } }
          ],
          "chartOptions": { "mode": "COLOR" }
        }
      }
    ]
  }
}


