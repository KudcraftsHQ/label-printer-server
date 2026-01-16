#!/bin/bash

# Test script for Label Printer Server API
# Make sure the server is running before executing this script

API_URL="http://localhost:3000"

echo "====================================="
echo "Label Printer Server API Test Script"
echo "====================================="
echo ""

# 1. Health Check
echo "1. Testing health endpoint..."
curl -s "${API_URL}/health" | json_pp
echo ""
echo ""

# 2. List Printers
echo "2. Listing available printers..."
curl -s "${API_URL}/printers" | json_pp
echo ""
echo ""

# 3. Get Page Configs
echo "3. Getting page configurations..."
curl -s "${API_URL}/configs" | json_pp
echo ""
echo ""

# 4. Submit a print job
echo "4. Submitting a print job..."
curl -s -X POST "${API_URL}/print" \
  -H "Content-Type: application/json" \
  -d '{
    "pageConfig": "default",
    "label": {
      "qrData": "20260115-00033",
      "title": "PEREDAM-CALYA-10MM",
      "subtitle": "20260115-00033"
    },
    "quantity": 1
  }' | json_pp
echo ""
echo ""

# 5. Get Queue Stats
echo "5. Getting queue statistics..."
curl -s "${API_URL}/queue/stats" | json_pp
echo ""
echo ""

# 6. List All Jobs
echo "6. Listing all jobs..."
curl -s "${API_URL}/jobs" | json_pp
echo ""
echo ""

echo "====================================="
echo "Test completed!"
echo "====================================="
